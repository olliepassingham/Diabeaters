/**
 * Supabase Edge Function: after a supporter sends a hypo check-in, notify the patient (push).
 *
 * Invoke with the carer's JWT; body: { check_in_id }.
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

    const carerId = userData.user.id;
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
      .select("id, carer_id, patient_id, status")
      .eq("id", checkInId)
      .maybeSingle();

    if (checkInErr || !checkIn) {
      return new Response(JSON.stringify({ success: false, error: "check_in_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (String(checkIn.carer_id) !== carerId) {
      return new Response(JSON.stringify({ success: false, error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (String(checkIn.status) !== "pending") {
      return new Response(
        JSON.stringify({ success: true, delivered_push: 0, skipped: "not_pending" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Atomically claim push delivery: only the first invoke for this check-in proceeds.
    const { data: claimed } = await admin
      .from("hypo_check_ins")
      .update({ push_sent_at: new Date().toISOString() })
      .eq("id", checkInId)
      .is("push_sent_at", null)
      .select("id")
      .maybeSingle();

    if (!claimed) {
      return new Response(
        JSON.stringify({ success: true, delivered_push: 0, skipped: "already_sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const patientId = String(checkIn.patient_id);

    const { data: carerProfile } = await admin
      .from("profiles")
      .select("full_name, public_handle")
      .eq("id", carerId)
      .maybeSingle();

    const carerLabel =
      (carerProfile as { full_name?: string; public_handle?: string } | null)?.full_name?.trim() ||
      (carerProfile as { full_name?: string; public_handle?: string } | null)?.public_handle?.trim() ||
      "Your supporter";

    const { data: patientPrefsRow } = await admin
      .from("notification_preferences")
      .select("prefs")
      .eq("user_id", patientId)
      .maybeSingle();

    const patientPrefsRaw = (patientPrefsRow as { prefs?: unknown } | null)?.prefs;
    const patientPrefs = (patientPrefsRaw && typeof patientPrefsRaw === "object"
      ? (patientPrefsRaw as Record<string, unknown>)
      : {}) as Record<string, unknown>;
    const patientEnabled = patientPrefs.enabled !== false;
    const patientHypoOn = patientPrefs.hypo_alerts !== false;
    const patientPushOn = patientPrefs.push === true;

    const title = "Hypo check-in";
    const bodyText = `${carerLabel} is checking you're OK`;
    const payload = {
      kind: "hypo_check_in",
      check_in_id: checkInId,
      carer_id: carerId,
      carer_name: carerLabel,
      patient_user_id: patientId,
      deep_link: "/",
    };

    let pushDelivered = 0;
    if (patientEnabled && patientHypoOn && patientPushOn && mobilePushDeliveryConfigured()) {
      const tokenRows = await fetchLatestPushTokensForUserId(admin, patientId);
      const { delivered } = await deliverPushToTokenRows(tokenRows, title, bodyText, payload, {
        recipientUserId: patientId,
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
    console.error("[notify_patient_hypo_check_in]", e);
    return new Response(
      JSON.stringify({ success: false, error: "internal_error", detail: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
