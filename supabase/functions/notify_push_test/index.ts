/**
 * Supabase Edge Function: send a test push to the caller's mobile devices (iOS + Android).
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  apnsDirectConfigured,
  getApnsEdgeSendContext,
} from "../_shared/deliver-ios-push.ts";
import {
  deliverPushToDevice,
  getMobilePushEdgeContext,
  mobilePushDeliveryConfigured,
  type DeliverPushResult,
} from "../_shared/deliver-push.ts";
import { fcmDirectConfigured, getFcmEdgeSendContext } from "../_shared/deliver-android-push.ts";
import { fetchLatestPushTokensForUser } from "../_shared/push-token-query.ts";

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

    if (!mobilePushDeliveryConfigured()) {
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

    const { rows, error: tokenErr } = await fetchLatestPushTokensForUser(admin, callerId);

    if (tokenErr) {
      return new Response(JSON.stringify({ success: false, error: "tokens_fetch_failed", detail: tokenErr }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (rows.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "no_push_token" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenProbe = (raw: string) => {
      const h = raw.replace(/\s+/g, "").replace(/[<>]/g, "").toLowerCase();
      return { hex_length: h.length, hex_prefix_8: h.slice(0, 8) };
    };

    const title = "Diabeaters test push";
    const body = "If you can read this, push delivery is working for your device.";
    const payload = { kind: "push_test", deep_link: "/settings/notifications" };

    let delivered = 0;
    let lastFailure: Extract<DeliverPushResult, { success: false }> | undefined;
    const attempts: Array<{
      platform: string;
      success: boolean;
      channel?: string;
      http_status?: number;
      errorBody?: string;
    }> = [];
    for (const row of rows) {
      const platform = row.platform === "android" ? "android" : "ios";
      const t = String(row.token ?? "").trim();
      if (!t) continue;
      try {
        const r = await deliverPushToDevice(platform, t, title, body, payload);
        attempts.push({
          platform,
          success: r.success,
          channel: r.channel,
          ...(!r.success && "httpStatus" in r ? { http_status: r.httpStatus, errorBody: r.errorBody } : {}),
        });
        if (r.success) delivered += 1;
        else lastFailure = r;
      } catch (e) {
        console.error("[notify_push_test] push send", e);
        attempts.push({ platform, success: false, errorBody: String(e) });
      }
    }

    const ctx = getMobilePushEdgeContext();
    const iosAttempt = attempts.find((a) => a.platform === "ios");
    const iosDelivered = iosAttempt?.success === true;

    const out: Record<string, unknown> = {
      success: true,
      tokens: rows.length,
      delivered_push: delivered,
      delivered_ok: delivered > 0,
      ios_delivered: iosDelivered,
      push_context: ctx,
      attempts,
    };

    const firstIos = rows.find((r) => r.platform === "ios");
    if (apnsDirectConfigured() && firstIos) {
      const apnsCtx = getApnsEdgeSendContext();
      out.apns_environment = apnsCtx.environment;
      out.apns_bundle_id = apnsCtx.bundleId;
      out.apns_topic = apnsCtx.bundleId;
      out.apns_host = apnsCtx.host;
      out.token_probe = tokenProbe(firstIos.token);
    }

    if (delivered === 0 && lastFailure) {
      out.failure_channel = lastFailure.channel;
      out.failure_platform = lastFailure.platform;
      out.detail = lastFailure.errorBody ?? null;
      if ("httpStatus" in lastFailure && lastFailure.httpStatus !== undefined) {
        out.http_status = lastFailure.httpStatus;
      }
      if (fcmDirectConfigured()) {
        out.fcm_project_id = getFcmEdgeSendContext().projectId;
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
