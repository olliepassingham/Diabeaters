/**
 * Register or unregister server-side Dexcom Share monitoring for an active exercise session.
 * Credentials are encrypted at rest with EXERCISE_CGM_MONITOR_SECRET.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { decryptExerciseCgmSecret, encryptExerciseCgmSecret } from "../_shared/exercise-cgm-crypto.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RegisterBody = {
  action: "register";
  session_id: string;
  exercise_name?: string;
  dexcom_server: "eu" | "us" | "jp";
  dexcom_username: string;
  dexcom_password: string;
  bg_units: "mmol/L" | "mg/dL";
  alert_threshold: number;
  trend_aware?: boolean;
  clinical_hypo_threshold?: number | null;
  carbs_if_low?: number | null;
  carb_line?: string | null;
  exercise_started_at: string;
  duration_minutes: number;
  recovery_minutes?: number;
};

type UnregisterBody = {
  action: "unregister";
  session_id: string;
};

type Body = RegisterBody | UnregisterBody;

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function parsePositiveNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function computeExpiresAt(
  exerciseStartedAt: string,
  durationMinutes: number,
  recoveryMinutes: number,
): string | null {
  const startedMs = new Date(exerciseStartedAt).getTime();
  if (!Number.isFinite(startedMs)) return null;
  const totalMs = (Math.max(1, durationMinutes) + Math.max(0, recoveryMinutes) + 30) * 60_000;
  return new Date(startedMs + totalMs).toISOString();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const cryptoSecret = (Deno.env.get("EXERCISE_CGM_MONITOR_SECRET") ?? "").trim();

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return new Response(JSON.stringify({ success: false, error: "server_misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (cryptoSecret.length < 16) {
      return new Response(JSON.stringify({ success: false, error: "crypto_secret_missing" }), {
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
    if (userErr || !userData?.user?.id || !isUuid(userData.user.id)) {
      return new Response(JSON.stringify({ success: false, error: "invalid_jwt" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = (await req.json().catch(() => ({}))) as Body;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (body.action === "unregister") {
      const sessionId = typeof body.session_id === "string" ? body.session_id.trim() : "";
      if (!sessionId) {
        return new Response(JSON.stringify({ success: false, error: "session_id_required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await admin
        .from("patient_exercise_cgm_monitor")
        .delete()
        .eq("user_id", userId)
        .eq("session_id", sessionId);

      if (error) {
        return new Response(JSON.stringify({ success: false, error: "delete_failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, action: "unregistered" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action !== "register") {
      return new Response(JSON.stringify({ success: false, error: "invalid_action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sessionId = typeof body.session_id === "string" ? body.session_id.trim() : "";
    const username = typeof body.dexcom_username === "string" ? body.dexcom_username.trim() : "";
    const password = typeof body.dexcom_password === "string" ? body.dexcom_password : "";
    const server = body.dexcom_server;
    const bgUnits = body.bg_units;
    const threshold = parsePositiveNumber(body.alert_threshold);
    const exerciseStartedAt = typeof body.exercise_started_at === "string" ? body.exercise_started_at : "";

    if (!sessionId || !username || !password || !threshold || !exerciseStartedAt) {
      return new Response(JSON.stringify({ success: false, error: "invalid_register_payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (server !== "eu" && server !== "us" && server !== "jp") {
      return new Response(JSON.stringify({ success: false, error: "invalid_dexcom_server" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (bgUnits !== "mmol/L" && bgUnits !== "mg/dL") {
      return new Response(JSON.stringify({ success: false, error: "invalid_bg_units" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const durationMinutes = Math.max(1, Math.floor(Number(body.duration_minutes) || 60));
    const recoveryMinutes = Math.max(0, Math.floor(Number(body.recovery_minutes) || 0));
    const expiresAt = computeExpiresAt(exerciseStartedAt, durationMinutes, recoveryMinutes);
    if (!expiresAt) {
      return new Response(JSON.stringify({ success: false, error: "invalid_exercise_started_at" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const encrypted = await encryptExerciseCgmSecret(password, cryptoSecret);
  // Verify decrypt round-trip before persisting.
    await decryptExerciseCgmSecret(encrypted, cryptoSecret);

    const row = {
      user_id: userId,
      session_id: sessionId,
      exercise_name: typeof body.exercise_name === "string" ? body.exercise_name.trim().slice(0, 120) : "",
      dexcom_server: server,
      dexcom_username: username.slice(0, 320),
      dexcom_password_ciphertext: encrypted.ciphertext,
      dexcom_password_iv: encrypted.iv,
      bg_units: bgUnits,
      alert_threshold: threshold,
      trend_aware: body.trend_aware !== false,
      clinical_hypo_threshold: parsePositiveNumber(body.clinical_hypo_threshold) ?? null,
      carbs_if_low: parsePositiveNumber(body.carbs_if_low) ?? null,
      carb_line: typeof body.carb_line === "string" ? body.carb_line.trim().slice(0, 240) : null,
      exercise_started_at: exerciseStartedAt,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertErr } = await admin
      .from("patient_exercise_cgm_monitor")
      .upsert(row, { onConflict: "user_id,session_id" });

    if (upsertErr) {
      console.error("[exercise_cgm_monitor] upsert", upsertErr);
      return new Response(JSON.stringify({ success: false, error: "upsert_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, action: "registered", expires_at: expiresAt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[exercise_cgm_monitor]", e);
    return new Response(JSON.stringify({ success: false, error: "internal_error", detail: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
