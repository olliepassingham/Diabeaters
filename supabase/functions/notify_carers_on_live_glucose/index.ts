/**
 * Notify linked supporters when a patient's latest shared CGM reading has
 * *stayed* past that supporter's extreme check-in limits long enough to
 * warrant a "check if they're OK" prompt.
 *
 * Policy (see `_shared/live-glucose-alert-policy.ts`):
 * - Sustain ~15 min extreme before the first alert
 * - One alert per excursion
 * - ~10 min back in range before a new excursion can alert again
 * - Atomic claim so concurrent publishes cannot send duplicate copies
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { deliverPushToTokenRows, mobilePushDeliveryConfigured } from "../_shared/deliver-push.ts";
import { fetchLatestPushTokensForUserId } from "../_shared/push-token-query.ts";
import {
  decideLiveGlucoseAlert,
  type LiveGlucoseAlertState,
  type LiveGlucoseAlertStatus,
  type LiveGlucoseExtremeStatus,
} from "../_shared/live-glucose-alert-policy.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_ALERT_LOW_MMOL = 3.5;
const DEFAULT_ALERT_HIGH_MMOL = 14;

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function formatBg(value: number, units: string): string {
  if (units === "mg/dL") return String(Math.round(value));
  return (Math.round(value * 10) / 10).toFixed(1);
}

function toMmol(value: number, units: string): number {
  return units === "mg/dL" ? value / 18 : value;
}

function resolveAlertLimits(prefs: Record<string, unknown>): { low: number; high: number } {
  const lowRaw = prefs.live_glucose_alert_low;
  const highRaw = prefs.live_glucose_alert_high;
  const lowNum = typeof lowRaw === "number" ? lowRaw : typeof lowRaw === "string" ? Number(lowRaw) : NaN;
  const highNum = typeof highRaw === "number" ? highRaw : typeof highRaw === "string" ? Number(highRaw) : NaN;
  const low = Number.isFinite(lowNum) && lowNum > 0 ? lowNum : DEFAULT_ALERT_LOW_MMOL;
  const high = Number.isFinite(highNum) && highNum > 0 ? highNum : DEFAULT_ALERT_HIGH_MMOL;
  if (high <= low) return { low: DEFAULT_ALERT_LOW_MMOL, high: DEFAULT_ALERT_HIGH_MMOL };
  return { low, high };
}

function computeAlertStatus(value: number, units: string, low: number, high: number): LiveGlucoseAlertStatus {
  if (!Number.isFinite(value) || high <= low) return "ok";
  const mmol = toMmol(value, units);
  if (mmol < low) return "extreme_low";
  if (mmol > high) return "extreme_high";
  return "ok";
}

function parseStatus(raw: unknown): LiveGlucoseAlertStatus {
  if (raw === "extreme_low" || raw === "extreme_high" || raw === "ok") return raw;
  return "ok";
}

function parsePending(raw: unknown): LiveGlucoseExtremeStatus | null {
  if (raw === "extreme_low" || raw === "extreme_high") return raw;
  return null;
}

function msFromIso(raw: unknown): number | null {
  if (typeof raw !== "string" || !raw) return null;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function isoOrNull(ms: number | null): string | null {
  return ms == null ? null : new Date(ms).toISOString();
}

function rowToState(row: Record<string, unknown> | null | undefined): LiveGlucoseAlertState | null {
  if (!row) return null;
  return {
    lastAlertedStatus: parseStatus(row.last_alerted_status),
    pendingStatus: parsePending(row.pending_status),
    extremeSinceMs: msFromIso(row.extreme_since),
    okSinceMs: msFromIso(row.ok_since),
  };
}

function stateToRow(state: LiveGlucoseAlertState, nowIso: string) {
  return {
    last_alerted_status: state.lastAlertedStatus,
    pending_status: state.pendingStatus,
    extreme_since: isoOrNull(state.extremeSinceMs),
    ok_since: isoOrNull(state.okSinceMs),
    updated_at: nowIso,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return new Response(JSON.stringify({ success: false, error: "server_misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const jwt = authHeader.replace("Bearer ", "").trim();
    const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
    if (userErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ success: false, error: "invalid_jwt" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const patientId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: row, error: rowErr } = await admin
      .from("patient_live_glucose")
      .select("user_id, value, units, recorded_at")
      .eq("user_id", patientId)
      .maybeSingle();

    if (rowErr || !row) {
      return new Response(JSON.stringify({ success: true, notified: 0, skipped: "no_row" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const value = Number((row as { value?: number }).value);
    const units = String((row as { units?: string }).units ?? "mmol/L");
    if (!Number.isFinite(value)) {
      return new Response(JSON.stringify({ success: true, notified: 0, skipped: "bad_value" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await admin.from("profiles").select("full_name").eq("id", patientId).maybeSingle();
    const patientLabel = (profile as { full_name?: string } | null)?.full_name?.trim() || "Your contact";
    const bgText = `${formatBg(value, units)} ${units}`;

    const { data: linkRows, error: linkErr } = await admin
      .from("carer_links")
      .select("carer_id, scopes")
      .eq("patient_id", patientId);

    if (linkErr) {
      return new Response(JSON.stringify({ success: false, error: "carer_links_fetch_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const carers = (linkRows ?? [])
      .map((r) => ({ carer_id: String((r as { carer_id: string }).carer_id), scopes: (r as { scopes: unknown }).scopes }))
      .filter((r) => isUuid(r.carer_id))
      .filter((r) => {
        const scopes = (r.scopes && typeof r.scopes === "object" ? r.scopes : {}) as Record<string, unknown>;
        return scopes.live_glucose !== false;
      });

    const recipients = carers.map((c) => c.carer_id);
    if (recipients.length === 0) {
      return new Response(JSON.stringify({ success: true, notified: 0, skipped: "no_recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: prefsRows } = await admin
      .from("notification_preferences")
      .select("user_id,prefs")
      .in("user_id", recipients);
    const prefsById = new Map<string, unknown>(
      (prefsRows ?? []).map((r: { user_id: string; prefs: unknown }) => [String(r.user_id), r.prefs]),
    );

    const { data: stateRows } = await admin
      .from("carer_live_glucose_alert_state")
      .select("carer_id, last_alerted_status, pending_status, extreme_since, ok_since")
      .eq("patient_id", patientId)
      .in("carer_id", recipients);
    const stateByCarer = new Map<string, LiveGlucoseAlertState | null>(
      (stateRows ?? []).map((r: Record<string, unknown>) => [
        String(r.carer_id),
        rowToState(r),
      ]),
    );

    let notified = 0;
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    for (const rid of recipients) {
      const prefsRaw = prefsById.get(rid);
      const prefs = (prefsRaw && typeof prefsRaw === "object" ? prefsRaw : {}) as Record<string, unknown>;
      const enabled = prefs.enabled !== false;
      const liveGlucoseOn = prefs.live_glucose_alerts !== false;
      const inappOn = prefs.inapp !== false;
      const pushOn = prefs.push === true;
      if (!enabled || !liveGlucoseOn) continue;

      const { low, high } = resolveAlertLimits(prefs);
      const status = computeAlertStatus(value, units, low, high);
      const decision = decideLiveGlucoseAlert({
        status,
        state: stateByCarer.get(rid) ?? null,
        nowMs,
      });

      if (decision.action === "noop") continue;

      if (decision.action === "persist") {
        await admin.from("carer_live_glucose_alert_state").upsert(
          {
            carer_id: rid,
            patient_id: patientId,
            ...stateToRow(decision.next, nowIso),
          },
          { onConflict: "carer_id,patient_id" },
        );
        continue;
      }

      // action === "notify" — claim atomically so concurrent publishes only send once.
      const { data: claimed, error: claimErr } = await admin
        .from("carer_live_glucose_alert_state")
        .update(stateToRow(decision.next, nowIso))
        .eq("carer_id", rid)
        .eq("patient_id", patientId)
        .eq("last_alerted_status", decision.claimFrom)
        .select("carer_id");

      let wonClaim = !claimErr && Array.isArray(claimed) && claimed.length > 0;

      if (!wonClaim && decision.claimFrom === "ok") {
        // No row yet (first ever alert for this pair, coming from a clean ok state).
        const { data: inserted, error: insertErr } = await admin
          .from("carer_live_glucose_alert_state")
          .insert({
            carer_id: rid,
            patient_id: patientId,
            ...stateToRow(decision.next, nowIso),
          })
          .select("carer_id");
        // Unique violation → another concurrent claim won; treat as lost.
        wonClaim = !insertErr && Array.isArray(inserted) && inserted.length > 0;
      }

      if (!wonClaim) continue;

      const title = "Check if they're OK";
      const bodyText =
        decision.status === "extreme_low"
          ? `${patientLabel}'s glucose is ${bgText} (below your alert limit) — please check they're OK`
          : `${patientLabel}'s glucose is ${bgText} (above your alert limit) — please check they're OK`;

      const payload = {
        kind: "live_glucose_check_in",
        deep_link: "/carer-view/glucose",
        patient_user_id: patientId,
        alert_status: decision.status,
        /** Legacy field for older clients */
        range_status: decision.status === "extreme_low" ? "low" : "high",
        value,
        units,
        recorded_at: (row as { recorded_at?: string }).recorded_at,
        alert_low_mmol: low,
        alert_high_mmol: high,
      };

      if (inappOn) {
        const { error: insErr } = await admin.from("notifications").insert({
          user_id: rid,
          title,
          body: bodyText,
          data: payload,
          read: false,
        });
        if (!insErr) notified += 1;
      }

      if (pushOn && mobilePushDeliveryConfigured()) {
        const tokenRows = await fetchLatestPushTokensForUserId(admin, rid);
        await deliverPushToTokenRows(tokenRows, title, bodyText, payload, {
          recipientUserId: rid,
          admin,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, notified }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[notify_carers_on_live_glucose]", e);
    return new Response(JSON.stringify({ success: false, error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
