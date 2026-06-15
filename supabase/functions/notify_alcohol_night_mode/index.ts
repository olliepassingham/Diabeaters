/**
 * Supabase Edge Function: optional alert when a patient turns on alcohol night mode.
 *
 * Carers need `scopes.scenarios` on their link and scenario_alerts enabled in prefs.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { deliverPushToTokenRows, mobilePushDeliveryConfigured } from "../_shared/deliver-push.ts";
import { fetchLatestPushTokensForUserId } from "../_shared/push-token-query.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = {
  session_id?: string;
  intensity?: string;
  planned_bedtime_iso?: string;
};

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function intensityLabel(raw: string): string {
  if (raw === "light") return "light drinking";
  if (raw === "moderate") return "moderate drinking";
  return "a heavier drinking night";
}

function formatBedtime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "tonight";
  return d.toLocaleString("en-GB", { weekday: "short", hour: "numeric", minute: "2-digit" });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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
    const callerId = userData.user.id;

    const body = (await req.json().catch(() => ({}))) as Body;
    const sessionId = typeof body.session_id === "string" ? body.session_id.trim() : "";
    const intensity = typeof body.intensity === "string" ? body.intensity.trim() : "moderate";
    const plannedBedtimeIso =
      typeof body.planned_bedtime_iso === "string" ? body.planned_bedtime_iso.trim() : "";

    if (!isUuid(sessionId)) {
      return new Response(JSON.stringify({ success: false, error: "invalid_session_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", callerId)
      .maybeSingle();
    const patientLabel =
      (profile as { full_name?: string } | null)?.full_name?.trim() || "Someone you support";

    const { data: linkRows } = await admin
      .from("carer_links")
      .select("carer_id, scopes")
      .eq("patient_id", callerId);
    const recipients = (linkRows ?? [])
      .map((r: { carer_id?: string; scopes?: unknown }) => ({
        id: String(r.carer_id),
        scopes: r.scopes,
      }))
      .filter((r) => isUuid(r.id))
      .filter((r) => {
        const scopes = (r.scopes && typeof r.scopes === "object" ? r.scopes : {}) as Record<string, unknown>;
        return scopes.scenarios === true || scopes.scenarios === "true";
      })
      .map((r) => r.id);

    const { data: prefsRows } = await admin
      .from("notification_preferences")
      .select("user_id,prefs")
      .in("user_id", recipients);
    const prefsById = new Map<string, unknown>(
      (prefsRows ?? []).map((r: { user_id?: string; prefs?: unknown }) => [String(r.user_id), r.prefs]),
    );

    const title = "Alcohol night mode on";
    const bedtimeText = plannedBedtimeIso ? formatBedtime(plannedBedtimeIso) : "tonight";
    const bodyText = `${patientLabel} turned on alcohol night mode (${intensityLabel(intensity)}). Bedtime check around ${bedtimeText}.`;
    const dedupeKey = `alcohol_night:${sessionId}`;

    let deliveredInapp = 0;
    let deliveredPush = 0;

    for (const rid of recipients) {
      const prefsRaw = prefsById.get(rid);
      const prefs = (prefsRaw && typeof prefsRaw === "object" ? (prefsRaw as Record<string, unknown>) : {}) as Record<
        string,
        unknown
      >;
      const enabled = prefs.enabled !== false;
      const scenarioOn = prefs.scenario_alerts !== false;
      const inappOn = prefs.inapp !== false;
      const pushOn = prefs.push === true;
      if (!enabled || !scenarioOn) continue;

      const data = {
        kind: "alcohol_night_mode",
        session_id: sessionId,
        intensity,
        patient_user_id: callerId,
        deep_link: "/notifications?bell=1",
      };

      if (inappOn) {
        const { error } = await admin.from("notifications").insert({
          user_id: rid,
          title,
          body: bodyText,
          data,
          dedupe_key: dedupeKey,
          read: false,
        });
        if (!error) deliveredInapp += 1;
      }

      if (pushOn && mobilePushDeliveryConfigured()) {
        const tokenRows = await fetchLatestPushTokensForUserId(admin, rid);
        const { delivered } = await deliverPushToTokenRows(tokenRows, title, bodyText, data, {
          recipientUserId: rid,
          admin,
        });
        deliveredPush += delivered;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        recipients: recipients.length,
        delivered_inapp: deliveredInapp,
        delivered_push: deliveredPush,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[notify_alcohol_night_mode]", e);
    return new Response(JSON.stringify({ success: false, error: "internal_error", detail: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
