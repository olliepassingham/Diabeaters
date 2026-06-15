/**
 * Supabase Edge Function: after a supporter acknowledges a hypo log, notify the patient.
 *
 * Invoke with the carer's JWT; body: { hypo_log_id }.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { deliverPushToTokenRows, mobilePushDeliveryConfigured } from "../_shared/deliver-push.ts";
import { fetchLatestPushTokensForUserId } from "../_shared/push-token-query.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = {
  hypo_log_id?: string;
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
    const hypoLogId = typeof body.hypo_log_id === "string" ? body.hypo_log_id.trim() : "";

    if (!hypoLogId || !isUuid(hypoLogId)) {
      return new Response(JSON.stringify({ success: false, error: "invalid_hypo_log_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: hypo, error: hypoErr } = await admin
      .from("hypo_logs")
      .select("id, user_id")
      .eq("id", hypoLogId)
      .maybeSingle();

    if (hypoErr || !hypo) {
      return new Response(JSON.stringify({ success: false, error: "hypo_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const patientId = String(hypo.user_id);

    const { data: link, error: linkErr } = await admin
      .from("carer_links")
      .select("scopes")
      .eq("patient_id", patientId)
      .eq("carer_id", carerId)
      .maybeSingle();

    if (linkErr) {
      console.error("[notify_patient_hypo_acknowledged] carer_links query", linkErr);
      return new Response(
        JSON.stringify({ success: false, error: "carer_links_fetch_failed", detail: linkErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!link) {
      return new Response(JSON.stringify({ success: false, error: "not_linked" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scopes = (link.scopes && typeof link.scopes === "object" ? link.scopes : {}) as Record<
      string,
      unknown
    >;
    if (scopes.hypo_alerts !== true && scopes.hypo_alerts !== "true") {
      return new Response(JSON.stringify({ success: false, error: "scope_denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ack, error: ackErr } = await admin
      .from("hypo_log_acknowledgements")
      .select("id")
      .eq("hypo_log_id", hypoLogId)
      .eq("carer_id", carerId)
      .maybeSingle();

    if (ackErr) {
      console.error("[notify_patient_hypo_acknowledged] ack query", ackErr);
      return new Response(
        JSON.stringify({ success: false, error: "ack_fetch_failed", detail: ackErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!ack) {
      return new Response(JSON.stringify({ success: false, error: "ack_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    const patientInappOn = patientPrefs.inapp !== false;
    const patientPushOn = patientPrefs.push === true;

    const dedupeKey = `hypo_ack:${hypoLogId}:${carerId}`;
    const title = "Supporter acknowledged";
    const bodyText = `${carerLabel} saw your hypo log`;
    const payload = {
      kind: "hypo_acknowledged",
      hypo_id: hypoLogId,
      carer_id: carerId,
      carer_name: carerLabel,
      deep_link: "/tools/hypo-history",
    };

    let inappDelivered = 0;
    if (patientEnabled && patientHypoOn && patientInappOn) {
      const { data: existing } = await admin
        .from("notifications")
        .select("id")
        .eq("user_id", patientId)
        .eq("dedupe_key", dedupeKey)
        .maybeSingle();

      if (!existing) {
        const { error: insErr } = await admin.from("notifications").insert({
          user_id: patientId,
          title,
          body: bodyText,
          data: payload,
          read: false,
          dedupe_key: dedupeKey,
        });
        if (!insErr) inappDelivered = 1;
        else console.error("[notify_patient_hypo_acknowledged] notification insert", insErr);
      } else {
        inappDelivered = 1;
      }
    }

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
        delivered_inapp: inappDelivered,
        delivered_push: pushDelivered,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[notify_patient_hypo_acknowledged]", e);
    return new Response(
      JSON.stringify({ success: false, error: "internal_error", detail: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
