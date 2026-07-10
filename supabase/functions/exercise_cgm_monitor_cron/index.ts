/**
 * Scheduled Edge Function: poll Dexcom Share for active exercise monitors and send low-BG push alerts.
 *
 * Schedule HTTP POST every 1–2 minutes with service role or x-exercise-cgm-monitor-cron-secret.
 * Requires EXERCISE_CGM_MONITOR_SECRET for credential decryption.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { fetchLatestDexcomShareReading } from "../_shared/dexcom-share-client.ts";
import { decryptExerciseCgmSecret } from "../_shared/exercise-cgm-crypto.ts";
import {
  buildExerciseCgmAlertCopy,
  evaluateExerciseCgmAlert,
  isExerciseCgmReadingStale,
  mapDexcomShareTrend,
  mgDlToDisplay,
  shouldSkipExerciseCgmAlertDueToCooldown,
  type ExerciseBgTrend,
} from "../_shared/exercise-cgm-alert-eval.ts";
import { deliverPushToTokenRows, mobilePushDeliveryConfigured } from "../_shared/deliver-push.ts";
import { fetchLatestPushTokensForUserId } from "../_shared/push-token-query.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-exercise-cgm-monitor-cron-secret",
};

type MonitorRow = {
  id: string;
  user_id: string;
  session_id: string;
  exercise_name: string;
  dexcom_server: "eu" | "us" | "jp";
  dexcom_username: string;
  dexcom_password_ciphertext: string;
  dexcom_password_iv: string;
  bg_units: "mmol/L" | "mg/dL";
  alert_threshold: number;
  trend_aware: boolean;
  clinical_hypo_threshold: number | null;
  carbs_if_low: number | null;
  carb_line: string | null;
  last_bg_recorded_at: string | null;
  last_alert_at: string | null;
};

function prefsAllowExerciseCgmAlert(prefsRaw: unknown): boolean {
  const prefs = (prefsRaw && typeof prefsRaw === "object" ? prefsRaw : {}) as Record<string, unknown>;
  const enabled = prefs.enabled !== false;
  const hypoOn = prefs.hypo_alerts !== false;
  const exerciseOn = prefs.exercise_cgm_alerts !== false;
  const pushOn = prefs.push === true;
  return enabled && hypoOn && exerciseOn && pushOn;
}

async function processMonitorRow(
  admin: ReturnType<typeof createClient>,
  row: MonitorRow,
  cryptoSecret: string,
): Promise<{ polled: boolean; alerted: boolean; error?: string }> {
  const nowIso = new Date().toISOString();
  let password: string;
  try {
    password = await decryptExerciseCgmSecret(
      { ciphertext: row.dexcom_password_ciphertext, iv: row.dexcom_password_iv },
      cryptoSecret,
    );
  } catch {
    return { polled: false, alerted: false, error: "decrypt_failed" };
  }

  let reading;
  try {
    reading = await fetchLatestDexcomShareReading({
      username: row.dexcom_username,
      password,
      server: row.dexcom_server,
    });
  } catch (e) {
    await admin
      .from("patient_exercise_cgm_monitor")
      .update({ last_polled_at: nowIso, updated_at: nowIso })
      .eq("id", row.id);
    return { polled: true, alerted: false, error: String(e) };
  }

  if (!reading || isExerciseCgmReadingStale(reading.recordedAt)) {
    await admin
      .from("patient_exercise_cgm_monitor")
      .update({ last_polled_at: nowIso, updated_at: nowIso })
      .eq("id", row.id);
    return { polled: true, alerted: false, error: "stale_or_missing" };
  }

  const bg = mgDlToDisplay(reading.valueMgDl, row.bg_units);
  const trend = mapDexcomShareTrend(reading.trend) as ExerciseBgTrend | null;

  await admin
    .from("patient_exercise_cgm_monitor")
    .update({
      last_polled_at: nowIso,
      last_bg: bg,
      last_bg_trend: trend,
      last_bg_recorded_at: reading.recordedAt,
      updated_at: nowIso,
    })
    .eq("id", row.id);

  if (row.last_bg_recorded_at === reading.recordedAt && row.last_alert_at) {
    return { polled: true, alerted: false };
  }

  const evaluation = evaluateExerciseCgmAlert({
    bg,
    bgUnits: row.bg_units,
    trend,
    threshold: Number(row.alert_threshold),
    trendAware: row.trend_aware,
    clinicalHypoThreshold: row.clinical_hypo_threshold,
    carbsIfLow: row.carbs_if_low,
    carbLine: row.carb_line,
  });

  if (!evaluation.shouldAlert || !evaluation.reason) {
    return { polled: true, alerted: false };
  }

  if (
    shouldSkipExerciseCgmAlertDueToCooldown({
      lastAlertAt: row.last_alert_at,
      bg,
      threshold: Number(row.alert_threshold),
      bgUnits: row.bg_units,
    })
  ) {
    return { polled: true, alerted: false };
  }

  const { data: prefsRow } = await admin
    .from("notification_preferences")
    .select("prefs")
    .eq("user_id", row.user_id)
    .maybeSingle();

  if (!prefsAllowExerciseCgmAlert((prefsRow as { prefs?: unknown } | null)?.prefs)) {
    return { polled: true, alerted: false, error: "prefs_disabled" };
  }

  if (!mobilePushDeliveryConfigured()) {
    return { polled: true, alerted: false, error: "push_not_configured" };
  }

  const copy = buildExerciseCgmAlertCopy({
    bg,
    bgUnits: row.bg_units,
    trend,
    evaluation,
    exerciseName: row.exercise_name,
  });

  const payload = {
    kind: "exercise_cgm_alert",
    deep_link: "/scenarios/exercise",
    session_id: row.session_id,
    reason: evaluation.reason,
  };

  const tokenRows = await fetchLatestPushTokensForUserId(admin, row.user_id);
  const { delivered } = await deliverPushToTokenRows(tokenRows, copy.title, copy.body, payload, {
    recipientUserId: row.user_id,
    admin,
  });

  if (delivered > 0) {
    await admin
      .from("patient_exercise_cgm_monitor")
      .update({
        last_alert_at: nowIso,
        last_alert_bg: bg,
        last_alert_reason: evaluation.reason,
        updated_at: nowIso,
      })
      .eq("id", row.id);
    return { polled: true, alerted: true };
  }

  return { polled: true, alerted: false, error: "push_not_delivered" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const cryptoSecret = (Deno.env.get("EXERCISE_CGM_MONITOR_SECRET") ?? "").trim();

    if (!supabaseUrl || !serviceKey || cryptoSecret.length < 16) {
      return new Response(JSON.stringify({ success: false, error: "server_misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sk = serviceKey.trim();
    const authHeader = (req.headers.get("Authorization") ?? "").trim();
    const apikeyHeader = (req.headers.get("apikey") ?? "").trim();
    const bearerBody = /^Bearer\s+(.+)$/i.exec(authHeader)?.[1]?.trim() ?? "";
    const cronSecretEnv = (Deno.env.get("EXERCISE_CGM_MONITOR_CRON_SECRET") ?? "").trim();
    const cronSecretHeader = (req.headers.get("x-exercise-cgm-monitor-cron-secret") ?? "").trim();
    const authorizedByServiceKey =
      authHeader === `Bearer ${sk}` || bearerBody === sk || apikeyHeader === sk;
    const authorizedByCronSecret =
      cronSecretEnv.length >= 16 && cronSecretHeader === cronSecretEnv;
    if (!authorizedByServiceKey && !authorizedByCronSecret) {
      return new Response(JSON.stringify({ success: false, error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const nowIso = new Date().toISOString();
    await admin.from("patient_exercise_cgm_monitor").delete().lt("expires_at", nowIso);

    const { data: rows, error: fetchErr } = await admin
      .from("patient_exercise_cgm_monitor")
      .select(
        "id, user_id, session_id, exercise_name, dexcom_server, dexcom_username, dexcom_password_ciphertext, dexcom_password_iv, bg_units, alert_threshold, trend_aware, clinical_hypo_threshold, carbs_if_low, carb_line, last_bg_recorded_at, last_alert_at",
      )
      .gt("expires_at", nowIso)
      .limit(200);

    if (fetchErr) {
      return new Response(JSON.stringify({ success: false, error: "fetch_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let polled = 0;
    let alerted = 0;
    let errors = 0;

    for (const raw of rows ?? []) {
      const result = await processMonitorRow(admin, raw as MonitorRow, cryptoSecret);
      if (result.polled) polled += 1;
      if (result.alerted) alerted += 1;
      if (result.error) errors += 1;
    }

    return new Response(
      JSON.stringify({
        success: true,
        monitors: (rows ?? []).length,
        polled,
        alerted,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[exercise_cgm_monitor_cron]", e);
    return new Response(JSON.stringify({ success: false, error: "internal_error", detail: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
