/**
 * Supabase Edge Function: after a patient responds to a hypo check-in, notify the supporter (push).
 *
 * Invoke with the patient's JWT; body: { check_in_id }.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { deliverPushToTokenRows, mobilePushDeliveryConfigured } from "../_shared/deliver-push.ts";
import { fetchLatestPushTokensForUserId } from "../_shared/push-token-query.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = {
  check_in_id?: string;
};

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s,
  );
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
      return new Response(
        JSON.stringify({ success: false, error: "server_misconfigured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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
    const body = (await req.json().catch(() => ({}))) as Body;
    const checkInId = typeof body.check_in_id === "string" ? body.check_in_id.trim() : "";

    if (!checkInId || !isUuid(checkInId)) {
      return new Response(JSON.stringify({ success: false, error: "invalid_check_in_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: checkIn, error: checkInErr } = await admin
      .from("hypo_check_ins")
      .select("id, carer_id, patient_id, status, hypo_log_id")
      .eq("id", checkInId)
      .maybeSingle();

    if (checkInErr || !checkIn) {
      return new Response(JSON.stringify({ success: false, error: "check_in_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (String(checkIn.patient_id) !== patientId) {
      return new Response(JSON.stringify({ success: false, error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (String(checkIn.status) === "pending") {
      return new Response(JSON.stringify({ success: false, error: "not_responded" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const carerId = String(checkIn.carer_id);
    const status = String(checkIn.status);

    const { data: patientProfile } = await admin
      .from("profiles")
      .select("full_name, public_handle")
      .eq("id", patientId)
      .maybeSingle();

    const patientLabel =
      (patientProfile as { full_name?: string; public_handle?: string } | null)?.full_name?.trim() ||
      (patientProfile as { full_name?: string; public_handle?: string } | null)?.public_handle?.trim() ||
      "Your contact";

    const bodyText =
      status === "ok"
        ? `${patientLabel} replied they're OK`
        : status === "treating"
          ? `${patientLabel} is treating a possible hypo`
          : `${patientLabel} logged a hypo`;

    const { data: carerPrefsRow } = await admin
      .from("notification_preferences")
      .select("prefs")
      .eq("user_id", carerId)
      .maybeSingle();

    const carerPrefsRaw = (carerPrefsRow as { prefs?: unknown } | null)?.prefs;
    const carerPrefs = (carerPrefsRaw && typeof carerPrefsRaw === "object"
      ? (carerPrefsRaw as Record<string, unknown>)
      : {}) as Record<string, unknown>;
    const carerEnabled = carerPrefs.enabled !== false;
    const carerHypoOn = carerPrefs.hypo_alerts !== false;
    const carerPushOn = carerPrefs.push === true;

    const title = "Hypo check-in update";
    const payload = {
      kind: "hypo_check_in_response",
      check_in_id: checkInId,
      response: status,
      patient_user_id: patientId,
      patient_name: patientLabel,
      hypo_id: checkIn.hypo_log_id ?? undefined,
      deep_link: "/carer-view",
    };

    let pushDelivered = 0;
    if (carerEnabled && carerHypoOn && carerPushOn && mobilePushDeliveryConfigured()) {
      const tokenRows = await fetchLatestPushTokensForUserId(admin, carerId);
      const { delivered } = await deliverPushToTokenRows(tokenRows, title, bodyText, payload, {
        recipientUserId: carerId,
        admin,
      });
      pushDelivered = delivered;
    }

    return new Response(
      JSON.stringify({
        success: true,
        delivered_push: pushDelivered,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[notify_carer_hypo_check_in_response]", e);
    return new Response(
      JSON.stringify({ success: false, error: "internal_error", detail: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
