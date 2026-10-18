/**
 * Scheduled poll of Dexcom Share for supporter live glucose.
 *
 * The exercise CGM cron also runs this poll, so an existing 1–2 minute exercise
 * schedule keeps supporter readings fresh. This function is the standalone schedule
 * if that job is not running.
 *
 * Auth: service role bearer, x-supporter-cgm-share-cron-secret, or the existing
 * x-exercise-cgm-monitor-cron-secret.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { pollSupporterCgmShares } from "../_shared/supporter-cgm-share-poll.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supporter-cgm-share-cron-secret, x-exercise-cgm-monitor-cron-secret",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const cryptoSecret = (Deno.env.get("EXERCISE_CGM_MONITOR_SECRET") ?? "").trim();
    if (!supabaseUrl || !serviceKey || cryptoSecret.length < 16) {
      return new Response(JSON.stringify({ success: false, error: "server_misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sk = serviceKey.trim();
    const authHeader = (req.headers.get("Authorization") ?? "").trim();
    const apikeyHeader = (req.headers.get("apikey") ?? "").trim();
    const bearerBody = /^Bearer\s+(.+)$/i.exec(authHeader)?.[1]?.trim() ?? "";
    const shareSecret = (Deno.env.get("SUPPORTER_CGM_SHARE_CRON_SECRET") ?? "").trim();
    const exerciseSecret = (Deno.env.get("EXERCISE_CGM_MONITOR_CRON_SECRET") ?? "").trim();
    const shareHeader = (req.headers.get("x-supporter-cgm-share-cron-secret") ?? "").trim();
    const exerciseHeader = (req.headers.get("x-exercise-cgm-monitor-cron-secret") ?? "").trim();
    const authorizedByServiceKey = authHeader === `Bearer ${sk}` || bearerBody === sk || apikeyHeader === sk;
    const authorizedByShareSecret = shareSecret.length >= 16 && shareHeader === shareSecret;
    const authorizedByExerciseSecret = exerciseSecret.length >= 16 && exerciseHeader === exerciseSecret;
    if (!authorizedByServiceKey && !authorizedByShareSecret && !authorizedByExerciseSecret) {
      return new Response(JSON.stringify({ success: false, error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const stats = await pollSupporterCgmShares(admin, cryptoSecret);
    return new Response(JSON.stringify({ success: true, ...stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[supporter_cgm_share_cron]", e);
    return new Response(JSON.stringify({ success: false, error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
