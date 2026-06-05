/**
 * Supabase Edge Function: after a hypo is logged, notify linked carers.
 *
 * This implementation uses:
 * - `public.carer_links` as the relationship (scoped access)
 * - `public.notifications` for the in-app inbox
 * - `public.push_tokens` for iOS push delivery
 * - `public.notification_preferences` to honor user toggles
 *
 * Secrets (Dashboard → Edge Functions → Secrets):
 * - SUPABASE_URL (often auto)
 * - SUPABASE_ANON_KEY
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Push delivery (configure one path):
 * - Direct APNs: APNS_TEAM_ID, APNS_KEY_ID, APNS_PRIVATE_KEY (.p8 body; use \\n for newlines in secrets)
 *   optional: APNS_BUNDLE_ID (default com.passingtime.diabeaters), APNS_USE_SANDBOX=true for Xcode debug builds
 * - Legacy relay: PUSH_NOTIFICATION_API_URL — POST JSON { to, title, body, data }
 *   optional: PUSH_NOTIFICATION_API_KEY — Bearer token
 *
 * Invoke with user's JWT; body: { hypo_id, user_id } must match the hypo row and JWT sub.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { deliverPushToTokenRows, mobilePushDeliveryConfigured } from "../_shared/deliver-push.ts";
import { fetchLatestPushTokensForUserId } from "../_shared/push-token-query.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = {
  hypo_id?: string;
  user_id?: string;
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

    const callerId = userData.user.id;
    const body = (await req.json().catch(() => ({}))) as Body;
    const hypoId = typeof body.hypo_id === "string" ? body.hypo_id.trim() : "";
    const bodyUserId = typeof body.user_id === "string" ? body.user_id.trim() : "";

    if (!hypoId || !isUuid(hypoId)) {
      return new Response(JSON.stringify({ success: false, error: "invalid_hypo_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!bodyUserId || !isUuid(bodyUserId) || bodyUserId !== callerId) {
      return new Response(JSON.stringify({ success: false, error: "user_mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: hypo, error: hypoErr } = await userClient
      .from("hypo_logs")
      .select("id, user_id, blood_glucose, treatment, notes, created_at")
      .eq("id", hypoId)
      .maybeSingle();

    if (hypoErr || !hypo) {
      return new Response(JSON.stringify({ success: false, error: "hypo_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (hypo.user_id !== callerId) {
      return new Response(JSON.stringify({ success: false, error: "hypo_forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", hypo.user_id)
      .maybeSingle();

    const patientLabel =
      (profile as { full_name?: string } | null)?.full_name?.trim() || "Your contact";

    const { data: linkRows, error: linkErr } = await admin
      .from("carer_links")
      .select("carer_id, scopes")
      .eq("patient_id", hypo.user_id);

    if (linkErr) {
      console.error("[notify_carers_on_hypo] carer_links query", linkErr);
      return new Response(
        JSON.stringify({ success: false, error: "carer_links_fetch_failed", detail: linkErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const carers = (linkRows ?? [])
      .map((r) => ({ carer_id: String((r as any).carer_id), scopes: (r as any).scopes }))
      .filter((r) => isUuid(r.carer_id))
      .filter((r) => {
        const scopes = (r.scopes && typeof r.scopes === "object" ? r.scopes : {}) as Record<string, unknown>;
        return scopes.hypo_alerts === true || scopes.hypo_alerts === "true";
      });

    const hypoPayload = {
      hypo_id: hypo.id,
      patient_user_id: hypo.user_id,
      blood_glucose: hypo.blood_glucose,
      treatment: hypo.treatment,
      notes: hypo.notes,
      created_at: hypo.created_at,
    };

    const title = "Hypo treated";
    const bodyText = `${patientLabel} has treated a hypo`;

    const recipients = carers.map((c) => c.carer_id);

    const { data: prefsRows } = await admin
      .from("notification_preferences")
      .select("user_id,prefs")
      .in("user_id", recipients);
    const prefsById = new Map<string, unknown>(
      (prefsRows ?? []).map((r: any) => [String(r.user_id), r.prefs]),
    );

    let pushDelivered = 0;
    let inappDelivered = 0;

    for (const rid of recipients) {
      const prefsRaw = prefsById.get(rid);
      const prefs = (prefsRaw && typeof prefsRaw === "object" ? (prefsRaw as Record<string, unknown>) : {}) as Record<
        string,
        unknown
      >;
      const enabled = prefs.enabled !== false;
      const hypoOn = prefs.hypo_alerts !== false;
      const inappOn = prefs.inapp !== false;
      const pushOn = prefs.push === true;
      if (!enabled || !hypoOn) continue;

      const payload = {
        kind: "hypo_logged",
        deep_link: "/carer-view",
        ...hypoPayload,
      };

      if (inappOn) {
        const { error: insErr } = await admin.from("notifications").insert({
          user_id: rid,
          title,
          body: bodyText,
          data: payload,
          read: false,
        });
        if (!insErr) inappDelivered += 1;
        else console.error("[notify_carers_on_hypo] notification insert", insErr);
      }

      if (pushOn && mobilePushDeliveryConfigured()) {
        const tokenRows = await fetchLatestPushTokensForUserId(admin, rid);
        const { delivered } = await deliverPushToTokenRows(tokenRows, title, bodyText, payload, {
          recipientUserId: rid,
          admin,
        });
        pushDelivered += delivered;
      }
    }

    // Patient in-app row (self): mirrors carer inbox so the patient sees a confirmation in Notifications.
    const { data: patientPrefsRow } = await admin
      .from("notification_preferences")
      .select("prefs")
      .eq("user_id", hypo.user_id)
      .maybeSingle();
    const patientPrefsRaw = (patientPrefsRow as { prefs?: unknown } | null)?.prefs;
    const patientPrefs = (patientPrefsRaw && typeof patientPrefsRaw === "object"
      ? (patientPrefsRaw as Record<string, unknown>)
      : {}) as Record<string, unknown>;
    const patientEnabled = patientPrefs.enabled !== false;
    const patientHypoOn = patientPrefs.hypo_alerts !== false;
    const patientInappOn = patientPrefs.inapp !== false;

    if (patientEnabled && patientHypoOn && patientInappOn) {
      const patientPayload = {
        kind: "hypo_logged_self",
        deep_link: "/tools/hypo-history",
        ...hypoPayload,
      };
      const { error: patientInsErr } = await admin.from("notifications").insert({
        user_id: hypo.user_id,
        title: "Hypo treatment logged",
        body: "Your hypo treatment was saved to your record.",
        data: patientPayload,
        read: false,
      });
      if (!patientInsErr) inappDelivered += 1;
      else console.error("[notify_carers_on_hypo] patient notification insert", patientInsErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        eligible_carers: recipients.length,
        delivered_push: pushDelivered,
        delivered_inapp: inappDelivered,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[notify_carers_on_hypo]", e);
    return new Response(
      JSON.stringify({ success: false, error: "internal_error", detail: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
