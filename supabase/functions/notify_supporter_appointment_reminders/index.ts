/**
 * Notify linked supporters about upcoming appointments (evening before + ~2h before).
 *
 * Auth:
 * - Patient JWT: scans only the caller's appointments (invoked from AppointmentReminderPoller).
 * - Service role or NOTIFY_SUPPORTER_APPT_CRON_SECRET: scans all patients with upcoming appointments.
 *
 * Patient must have `supporter_appointment_reminders !== false` in notification_preferences.
 * Supporter must have appointments scope + `appointment_alerts !== false`.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { prefsAllowSupporterAppointmentReminders } from "../_shared/appointment-reminder-schedule.ts";
import { deliverSupporterAppointmentRemindersForPatient } from "../_shared/deliver-supporter-appointment-reminders.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-notify-supporter-appt-cron-secret",
};

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function patientLabelFromProfile(fullName: unknown): string {
  const t = typeof fullName === "string" ? fullName.trim() : "";
  if (!t || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return "Someone you support";
  return t;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ success: false, error: "server_misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sk = serviceKey.trim();
    const authHeader = (req.headers.get("Authorization") ?? "").trim();
    const apikeyHeader = (req.headers.get("apikey") ?? "").trim();
    const bearerBody = /^Bearer\s+(.+)$/i.exec(authHeader)?.[1]?.trim() ?? "";
    const cronSecretEnv = (Deno.env.get("NOTIFY_SUPPORTER_APPT_CRON_SECRET") ?? "").trim();
    const cronSecretHeader = (req.headers.get("x-notify-supporter-appt-cron-secret") ?? "").trim();
    const authorizedByServiceKey =
      authHeader === `Bearer ${sk}` || bearerBody === sk || apikeyHeader === sk;
    const authorizedByCronSecret =
      cronSecretEnv.length >= 16 && cronSecretHeader === cronSecretEnv;

    let patientFilter: string | null = null;

    if (!authorizedByServiceKey && !authorizedByCronSecret) {
      if (!anonKey) {
        return new Response(JSON.stringify({ success: false, error: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
      patientFilter = userData.user.id;
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const now = new Date();
    const horizon = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    let query = admin
      .from("appointments")
      .select("id,user_id,client_id,title,date,time,scheduled_at,is_completed,deleted_at")
      .eq("is_completed", false)
      .is("deleted_at", null)
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", horizon.toISOString());

    if (patientFilter) {
      query = query.eq("user_id", patientFilter);
    }

    const { data: rows, error: selErr } = await query;
    if (selErr) {
      return new Response(
        JSON.stringify({ success: false, error: "appointments_fetch_failed", detail: selErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const byPatient = new Map<string, typeof rows>();
    for (const raw of rows ?? []) {
      const userId = String((raw as { user_id: string }).user_id ?? "");
      if (!isUuid(userId)) continue;
      const list = byPatient.get(userId) ?? [];
      list.push(raw);
      byPatient.set(userId, list);
    }

    let patientsScanned = 0;
    let remindersAttempted = 0;
    let inappTotal = 0;
    let pushTotal = 0;

    for (const [patientId, appointments] of byPatient) {
      const { data: prefRow } = await admin
        .from("notification_preferences")
        .select("prefs")
        .eq("user_id", patientId)
        .maybeSingle();

      if (!prefsAllowSupporterAppointmentReminders((prefRow as { prefs?: unknown } | null)?.prefs)) {
        continue;
      }

      const { data: profile } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", patientId)
        .maybeSingle();
      const patientLabel = patientLabelFromProfile((profile as { full_name?: string } | null)?.full_name);

      patientsScanned += 1;
      const r = await deliverSupporterAppointmentRemindersForPatient(
        admin,
        patientId,
        patientLabel,
        appointments as Parameters<typeof deliverSupporterAppointmentRemindersForPatient>[3],
        now,
      );
      remindersAttempted += r.reminders_attempted;
      inappTotal += r.inapp_delivered;
      pushTotal += r.push_delivered;
    }

    const payload = {
      success: true,
      patients_scanned: patientsScanned,
      reminders_attempted: remindersAttempted,
      delivered_inapp: inappTotal,
      delivered_push: pushTotal,
    };
    console.log("[notify_supporter_appointment_reminders]", JSON.stringify(payload));
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[notify_supporter_appointment_reminders]", e);
    return new Response(JSON.stringify({ success: false, error: "internal_error", detail: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
