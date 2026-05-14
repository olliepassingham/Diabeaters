/**
 * Supabase Edge Function: send a test push to the caller's iOS devices.
 *
 * Purpose: quickly verify that
 * - APNs secrets are configured correctly (or relay is configured),
 * - the caller has saved a push token in `public.push_tokens`,
 * - pushes can be delivered end-to-end to a real device.
 *
 * Secrets:
 * - SUPABASE_URL
 * - SUPABASE_ANON_KEY
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Push: direct APNs (APNS_TEAM_ID, APNS_KEY_ID, APNS_PRIVATE_KEY, optional APNS_BUNDLE_ID, APNS_USE_SANDBOX)
 * or legacy relay (PUSH_NOTIFICATION_API_URL, optional PUSH_NOTIFICATION_API_KEY).
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  apnsDirectConfigured,
  type DeliverIosPushResult,
  deliverIosPushToDevice,
  getApnsEdgeSendContext,
  iosPushDeliveryConfigured,
} from "../_shared/deliver-ios-push.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    if (!iosPushDeliveryConfigured()) {
      return new Response(JSON.stringify({ success: false, error: "push_not_configured" }), {
        status: 200,
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

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: tokenRows, error: tokenErr } = await admin
      .from("push_tokens")
      .select("token")
      .eq("user_id", callerId)
      .eq("platform", "ios");

    if (tokenErr) {
      return new Response(JSON.stringify({ success: false, error: "tokens_fetch_failed", detail: tokenErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokens = (tokenRows ?? []).map((t: { token: string }) => String(t.token)).filter(Boolean);
    if (tokens.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "no_push_token" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    /** Normalized hex probe (matches Edge APNs path); safe prefix for comparing to in-app Copy JSON. */
    const tokenProbe = (raw: string) => {
      const h = raw.replace(/\s+/g, "").replace(/[<>]/g, "").toLowerCase();
      return { hex_length: h.length, hex_prefix_8: h.slice(0, 8) };
    };

    const title = "Diabeaters test push";
    const body = "If you can read this, APNs delivery is working for your device.";
    const payload = { kind: "push_test", deep_link: "/settings/notifications" };

    let delivered = 0;
    let lastFailure: Extract<DeliverIosPushResult, { success: false }> | undefined;
    for (const t of tokens) {
      try {
        const r = await deliverIosPushToDevice(t, title, body, payload);
        if (r.success) delivered += 1;
        else lastFailure = r;
      } catch (e) {
        console.error("[notify_push_test] push send", e);
      }
    }

    const out: Record<string, unknown> = {
      success: true,
      tokens: tokens.length,
      delivered_push: delivered,
      delivered_ok: delivered > 0,
    };
    if (delivered === 0 && lastFailure) {
      out.failure_channel = lastFailure.channel;
      out.detail = lastFailure.errorBody ?? null;
      if ("httpStatus" in lastFailure && lastFailure.httpStatus !== undefined) {
        out.http_status = lastFailure.httpStatus;
      }
      if (apnsDirectConfigured()) {
        const ctx = getApnsEdgeSendContext();
        out.apns_environment = ctx.environment;
        out.apns_bundle_id = ctx.bundleId;
        out.apns_topic = ctx.bundleId;
        out.apns_host = ctx.host;
        out.token_probe = tokenProbe(tokens[0] ?? "");
      }
    }

    return new Response(JSON.stringify(out), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[notify_push_test]", e);
    return new Response(JSON.stringify({ success: false, error: "internal_error", detail: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

