/**
 * Supabase Edge Function: notify linked carers when a scenario starts (sick_day/travel).
 *
 * Push: APNs (APNS_*) or legacy PUSH_NOTIFICATION_API_URL — see ../_shared/deliver-ios-push.ts
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { deliverIosPushToDevice, iosPushDeliveryConfigured } from "../_shared/deliver-ios-push.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = { scenario_key?: string; title?: string; summary?: string | null };

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s,
  );
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
    const scenarioKey = typeof body.scenario_key === "string" ? body.scenario_key.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "Scenario update";
    const summary = typeof body.summary === "string" ? body.summary.trim() : null;

    if (scenarioKey !== "sick_day" && scenarioKey !== "travel") {
      return new Response(JSON.stringify({ success: false, error: "invalid_scenario_key" }), {
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
      (profile as { full_name?: string } | null)?.full_name?.trim() || "Patient";

    const { data: linkRows } = await admin
      .from("carer_links")
      .select("carer_id, scopes")
      .eq("patient_id", callerId);
    const recipients = (linkRows ?? [])
      .map((r: any) => ({ id: String(r.carer_id), scopes: r.scopes }))
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
      (prefsRows ?? []).map((r: any) => [String(r.user_id), r.prefs]),
    );

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

      const bodyText = `${patientLabel} started ${scenarioKey === "sick_day" ? "Sick day mode" : "Travel mode"}${summary ? `: ${summary}` : ""}`;
      const data = {
        kind: "scenario_started",
        scenario_key: scenarioKey,
        patient_user_id: callerId,
        deep_link: "/carer-view",
      };

      if (inappOn) {
        const { error } = await admin.from("notifications").insert({
          user_id: rid,
          title,
          body: bodyText,
          data,
          read: false,
        });
        if (!error) deliveredInapp += 1;
      }

      if (pushOn && iosPushDeliveryConfigured()) {
        const { data: tokenRows } = await admin
          .from("push_tokens")
          .select("token")
          .eq("user_id", rid)
          .eq("platform", "ios");
        const tokens = (tokenRows ?? []).map((t: any) => String(t.token)).filter(Boolean);
        for (const t of tokens) {
          const ok = await deliverIosPushToDevice(t, title, bodyText, data);
          if (ok) deliveredPush += 1;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, recipients: recipients.length, delivered_inapp: deliveredInapp, delivered_push: deliveredPush }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[notify_scenario_started]", e);
    return new Response(JSON.stringify({ success: false, error: "internal_error", detail: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

