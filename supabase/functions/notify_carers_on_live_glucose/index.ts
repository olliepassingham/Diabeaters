/**
 * Notify linked supporters when a patient's latest shared CGM reading is out of target range.
 * Dedupes via patient_live_glucose.last_alerted_range_status.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { deliverPushToTokenRows, mobilePushDeliveryConfigured } from "../_shared/deliver-push.ts";
import { fetchLatestPushTokensForUserId } from "../_shared/push-token-query.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function formatBg(value: number, units: string): string {
  if (units === "mg/dL") return String(Math.round(value));
  return (Math.round(value * 10) / 10).toFixed(1);
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
      .select(
        "user_id, value, units, range_status, last_alerted_range_status, target_low, target_high, recorded_at",
      )
      .eq("user_id", patientId)
      .maybeSingle();

    if (rowErr || !row) {
      return new Response(JSON.stringify({ success: true, notified: 0, skipped: "no_row" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rangeStatus = String((row as { range_status?: string }).range_status ?? "in_range");
    const lastAlerted = (row as { last_alerted_range_status?: string | null }).last_alerted_range_status;

    if (rangeStatus === "in_range") {
      if (lastAlerted !== "in_range") {
        await admin
          .from("patient_live_glucose")
          .update({ last_alerted_range_status: "in_range" })
          .eq("user_id", patientId);
      }
      return new Response(JSON.stringify({ success: true, notified: 0, skipped: "in_range" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (rangeStatus !== "low" && rangeStatus !== "high") {
      return new Response(JSON.stringify({ success: true, notified: 0, skipped: "unknown_status" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (lastAlerted === rangeStatus) {
      return new Response(JSON.stringify({ success: true, notified: 0, skipped: "deduped" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await admin.from("profiles").select("full_name").eq("id", patientId).maybeSingle();
    const patientLabel = (profile as { full_name?: string } | null)?.full_name?.trim() || "Your contact";
    const value = Number((row as { value?: number }).value);
    const units = String((row as { units?: string }).units ?? "mmol/L");
    const bgText = `${formatBg(value, units)} ${units}`;

    const title = rangeStatus === "low" ? "Glucose below target" : "Glucose above target";
    const bodyText =
      rangeStatus === "low"
        ? `${patientLabel}'s latest reading is ${bgText} — below their target range`
        : `${patientLabel}'s latest reading is ${bgText} — above their target range`;

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
    const { data: prefsRows } = await admin
      .from("notification_preferences")
      .select("user_id,prefs")
      .in("user_id", recipients);
    const prefsById = new Map<string, unknown>(
      (prefsRows ?? []).map((r: { user_id: string; prefs: unknown }) => [String(r.user_id), r.prefs]),
    );

    let notified = 0;
    const payload = {
      kind: "live_glucose_out_of_range",
      deep_link: "/carer-view/glucose",
      patient_user_id: patientId,
      range_status: rangeStatus,
      value,
      units,
      recorded_at: (row as { recorded_at?: string }).recorded_at,
    };

    for (const rid of recipients) {
      const prefsRaw = prefsById.get(rid);
      const prefs = (prefsRaw && typeof prefsRaw === "object" ? prefsRaw : {}) as Record<string, unknown>;
      const enabled = prefs.enabled !== false;
      const liveGlucoseOn = prefs.live_glucose_alerts !== false;
      const inappOn = prefs.inapp !== false;
      const pushOn = prefs.push === true;
      if (!enabled || !liveGlucoseOn) continue;

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

    await admin
      .from("patient_live_glucose")
      .update({ last_alerted_range_status: rangeStatus })
      .eq("user_id", patientId);

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
