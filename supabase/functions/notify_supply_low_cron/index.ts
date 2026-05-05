/**
 * Scheduled Edge Function: scan `public.supplies.days_remaining_cached` and send the same
 * low/critical alerts as `notify_supply_low` when the patient app has not run recently.
 *
 * Invoke with **service role** Authorization — e.g. schedule an HTTP POST from **Integrations → Cron**
 * (or `pg_cron` + `pg_net`; https://supabase.com/docs/guides/functions/schedule-functions ),
 * or manually: `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` and/or `apikey: <same>` (must match the Edge env service role).
 *
 * **Dashboard “Test” often overwrites `Authorization` / `apikey`.** Set Edge secret **`NOTIFY_SUPPLY_LOW_CRON_SECRET`**
 * (long random string) and send header **`x-notify-supply-low-cron-secret: <same>`**; **`apikey`** can be the **anon** key for the gateway.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, optional NOTIFY_SUPPLY_LOW_CRON_SECRET, plus APNs keys (via deliver-ios-push).
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { deliverSupplyLowAlerts, prefsAllowSupply } from "../_shared/supply-low-delivery.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-notify-supply-low-cron-secret",
};

const FORECAST_MAX_AGE_MS = 84 * 60 * 60 * 1000;

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function thresholdsFromPrefs(prefs: unknown): { critical: number; low: number } | null {
  const p = (prefs && typeof prefs === "object" ? prefs : {}) as Record<string, unknown>;
  const critical = Math.max(0, Number(p.critical_threshold_days ?? 0));
  const lowRaw = Number(p.low_threshold_days ?? 0);
  const low = Math.max(critical, lowRaw);
  if (low <= 0) return null;
  return { critical, low };
}

function levelFromDays(days: number, t: { critical: number; low: number }): "low" | "critical" | null {
  const d = Math.round(days);
  if (d <= t.critical) return "critical";
  if (d <= t.low) return "low";
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) {
      console.error("[notify_supply_low_cron] server_misconfigured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(JSON.stringify({ success: false, error: "server_misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sk = serviceKey.trim();
    const authHeader = (req.headers.get("Authorization") ?? "").trim();
    const apikeyHeader = (req.headers.get("apikey") ?? "").trim();
    const bearerBody = /^Bearer\s+(.+)$/i.exec(authHeader)?.[1]?.trim() ?? "";
    const cronSecretEnv = (Deno.env.get("NOTIFY_SUPPLY_LOW_CRON_SECRET") ?? "").trim();
    const cronSecretHeader = (req.headers.get("x-notify-supply-low-cron-secret") ?? "").trim();
    const authorizedByServiceKey =
      authHeader === `Bearer ${sk}` || bearerBody === sk || apikeyHeader === sk;
    const authorizedByCronSecret =
      cronSecretEnv.length >= 16 && cronSecretHeader === cronSecretEnv;
    const authorized = authorizedByServiceKey || authorizedByCronSecret;
    if (!authorized) {
      console.warn(
        `[notify_supply_low_cron] unauthorized (auth_len=${authHeader.length} apikey_len=${apikeyHeader.length} sk_len=${sk.length} cron_secret_configured=${cronSecretEnv.length >= 16})`,
      );
      return new Response(JSON.stringify({ success: false, error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: rows, error: selErr } = await admin
      .from("supplies")
      .select("id,user_id,name,days_remaining_cached,supply_forecast_at,quantity")
      .not("days_remaining_cached", "is", null)
      .gt("quantity", 0);

    if (selErr) {
      return new Response(JSON.stringify({ success: false, error: "supplies_fetch_failed", detail: selErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = Date.now();
    let scanned = 0;
    let alertsAttempted = 0;
    let inappTotal = 0;
    let pushTotal = 0;

    for (const raw of rows ?? []) {
      const row = raw as Record<string, unknown>;
      const id = String(row.id ?? "");
      const userId = String(row.user_id ?? "");
      const name = String(row.name ?? "Supply");
      const qty = Number(row.quantity ?? 0);
      const daysCached = Number(row.days_remaining_cached);
      const forecastAt = row.supply_forecast_at ? new Date(String(row.supply_forecast_at)).getTime() : NaN;

      scanned += 1;
      if (!isUuid(id) || !isUuid(userId) || qty <= 0 || !Number.isFinite(daysCached)) continue;
      if (!Number.isFinite(forecastAt) || now - forecastAt > FORECAST_MAX_AGE_MS) continue;

      const { data: prefRow } = await admin
        .from("notification_preferences")
        .select("prefs")
        .eq("user_id", userId)
        .maybeSingle();

      const prefsRaw = (prefRow as { prefs?: unknown } | null)?.prefs;
      const gate = prefsAllowSupply(prefsRaw);
      if (!gate.enabled || !gate.supplyAlerts) continue;

      const th = thresholdsFromPrefs(prefsRaw);
      if (!th) continue;

      const level = levelFromDays(daysCached, th);
      if (!level) continue;

      const { data: profile } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
      const patientLabel = (profile as { full_name?: string } | null)?.full_name?.trim() || "Patient";

      const { data: linkRows, error: linkErr } = await admin
        .from("carer_links")
        .select("carer_id, scopes")
        .eq("patient_id", userId);
      if (linkErr) {
        console.error("[notify_supply_low_cron] carer_links", linkErr);
        continue;
      }

      const carers = (linkRows ?? [])
        .map((r) => ({ carer_id: String((r as Record<string, unknown>).carer_id), scopes: (r as Record<string, unknown>).scopes }))
        .filter((r) => isUuid(r.carer_id))
        .filter((r) => {
          const scopes = (r.scopes && typeof r.scopes === "object" ? r.scopes : {}) as Record<string, unknown>;
          return scopes.supplies === true || scopes.supplies === "true";
        });

      alertsAttempted += 1;
      const r = await deliverSupplyLowAlerts(admin, {
        patientId: userId,
        patientLabel,
        supplyId: id,
        supplyName: name,
        level,
        daysRemaining: Math.round(daysCached),
        carers,
      });
      inappTotal += r.inappDelivered;
      pushTotal += r.pushDelivered;
    }

    const payload = {
      success: true,
      scanned,
      alerts_attempted: alertsAttempted,
      delivered_inapp: inappTotal,
      delivered_push: pushTotal,
    };
    console.log("[notify_supply_low_cron]", JSON.stringify(payload));
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[notify_supply_low_cron]", e);
    return new Response(JSON.stringify({ success: false, error: "internal_error", detail: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
