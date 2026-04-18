/**
 * Supabase Edge Function: notify patient + linked carers when a supply becomes low/critical.
 *
 * Secrets:
 * - SUPABASE_URL
 * - SUPABASE_ANON_KEY
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Push: direct APNs (APNS_TEAM_ID, APNS_KEY_ID, APNS_PRIVATE_KEY, optional APNS_BUNDLE_ID, APNS_USE_SANDBOX)
 * or legacy relay (PUSH_NOTIFICATION_API_URL, optional PUSH_NOTIFICATION_API_KEY).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { deliverIosPushToDevice, iosPushDeliveryConfigured } from "../_shared/deliver-ios-push.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = {
  supply_id?: string;
  supply_name?: string;
  level?: "low" | "critical";
  days_remaining?: number;
};

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s,
  );
}

function prefsAllowSupply(prefs: unknown): { enabled: boolean; inapp: boolean; push: boolean } {
  const p = (prefs && typeof prefs === "object" ? prefs : {}) as Record<string, unknown>;
  return {
    enabled: p.enabled !== false,
    inapp: p.inapp !== false,
    push: p.push === true,
  };
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
    const callerId = userData.user.id;

    const body = (await req.json().catch(() => ({}))) as Body;
    const supplyId = typeof body.supply_id === "string" ? body.supply_id.trim() : "";
    const supplyName = typeof body.supply_name === "string" ? body.supply_name.trim() : "Supply";
    const level = body.level === "critical" ? "critical" : "low";
    const daysRemaining = typeof body.days_remaining === "number" ? body.days_remaining : null;

    if (!supplyId) {
      return new Response(JSON.stringify({ success: false, error: "invalid_supply_id" }), {
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

    const { data: linkRows, error: linkErr } = await admin
      .from("carer_links")
      .select("carer_id, scopes")
      .eq("patient_id", callerId);
    if (linkErr) {
      return new Response(JSON.stringify({ success: false, error: "carer_links_fetch_failed", detail: linkErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const carers = (linkRows ?? [])
      .map((r) => ({ carer_id: String((r as any).carer_id), scopes: (r as any).scopes }))
      .filter((r) => isUuid(r.carer_id))
      .filter((r) => {
        const scopes = (r.scopes && typeof r.scopes === "object" ? r.scopes : {}) as Record<string, unknown>;
        return scopes.supplies === true || scopes.supplies === "true";
      });

    const recipients = [callerId, ...carers.map((c) => c.carer_id)];
    const { data: prefsRows } = await admin
      .from("notification_preferences")
      .select("user_id,prefs")
      .in("user_id", recipients);
    const prefsById = new Map<string, unknown>(
      (prefsRows ?? []).map((r: any) => [String(r.user_id), r.prefs]),
    );

    const title =
      level === "critical" ? "Supplies critical" : "Supplies running low";

    let inappDelivered = 0;
    let pushDelivered = 0;

    for (const rid of recipients) {
      const prefs = prefsAllowSupply(prefsById.get(rid));
      if (!prefs.enabled) continue;

      const isPatient = rid === callerId;
      const bodyText = isPatient
        ? `${supplyName} is ${level}${daysRemaining != null ? ` (${Math.max(0, Math.round(daysRemaining))}d left)` : ""}.`
        : `${patientLabel}: ${supplyName} is ${level}${daysRemaining != null ? ` (${Math.max(0, Math.round(daysRemaining))}d left)` : ""}.`;

      const data = {
        kind: "supplies_low",
        level,
        supply_id: supplyId,
        supply_name: supplyName,
        days_remaining: daysRemaining,
        patient_user_id: callerId,
        deep_link: isPatient ? "/supplies" : "/carer-view",
      };

      if (prefs.inapp) {
        const { error: insErr } = await admin.from("notifications").insert({
          user_id: rid,
          title,
          body: bodyText,
          data,
          read: false,
        });
        if (!insErr) inappDelivered += 1;
        else console.error("[notify_supply_low] notification insert", insErr);
      }

      if (prefs.push && iosPushDeliveryConfigured()) {
        const { data: tokenRows } = await admin
          .from("push_tokens")
          .select("token")
          .eq("user_id", rid)
          .eq("platform", "ios");
        const tokens = (tokenRows ?? []).map((t: any) => String(t.token)).filter(Boolean);
        for (const t of tokens) {
          try {
            const ok = await deliverIosPushToDevice(t, title, bodyText, data);
            if (ok) pushDelivered += 1;
          } catch (e) {
            console.error("[notify_supply_low] push send", e);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        recipients: recipients.length,
        delivered_inapp: inappDelivered,
        delivered_push: pushDelivered,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[notify_supply_low]", e);
    return new Response(
      JSON.stringify({ success: false, error: "internal_error", detail: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

