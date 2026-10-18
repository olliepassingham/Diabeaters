/**
 * Store or remove the encrypted Dexcom Share login used to refresh supporter glucose
 * while the user account is closed. Password is encrypted with EXERCISE_CGM_MONITOR_SECRET.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { decryptExerciseCgmSecret, encryptExerciseCgmSecret } from "../_shared/exercise-cgm-crypto.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RegisterBody = {
  action: "register";
  dexcom_server: "eu" | "us" | "jp";
  dexcom_username: string;
  dexcom_password: string;
  bg_units: "mmol/L" | "mg/dL";
  target_low?: number | null;
  target_high?: number | null;
};

type UnregisterBody = { action: "unregister" };

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const cryptoSecret = (Deno.env.get("EXERCISE_CGM_MONITOR_SECRET") ?? "").trim();

    if (!supabaseUrl || !anonKey || !serviceKey || cryptoSecret.length < 16) {
      return json({ success: false, error: "server_misconfigured" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ success: false, error: "unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const jwt = authHeader.replace("Bearer ", "").trim();
    const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
    if (userErr || !userData?.user?.id || !isUuid(userData.user.id)) {
      return json({ success: false, error: "invalid_jwt" }, 401);
    }
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const body = (await req.json().catch(() => ({}))) as RegisterBody | UnregisterBody;

    if (body.action === "unregister") {
      const { error } = await admin.from("patient_supporter_cgm_poll").delete().eq("user_id", userId);
      if (error) return json({ success: false, error: "delete_failed" }, 500);
      return json({ success: true, action: "unregistered" });
    }

    if (body.action !== "register") return json({ success: false, error: "invalid_action" }, 400);

    const { data: links, error: linkErr } = await admin
      .from("carer_links")
      .select("scopes")
      .eq("patient_id", userId);
    if (linkErr) return json({ success: false, error: "carer_links_fetch_failed" }, 500);

    const sharingOn = (links ?? []).some((row) => {
      const scopes = (row.scopes && typeof row.scopes === "object" ? row.scopes : {}) as Record<string, unknown>;
      return scopes.live_glucose !== false;
    });
    if (!sharingOn) {
      await admin.from("patient_supporter_cgm_poll").delete().eq("user_id", userId);
      return json({ success: true, action: "unregistered", reason: "sharing_off" });
    }

    const username = typeof body.dexcom_username === "string" ? body.dexcom_username.trim() : "";
    const password = typeof body.dexcom_password === "string" ? body.dexcom_password : "";
    const server = body.dexcom_server;
    const bgUnits = body.bg_units;
    if (!username || !password) return json({ success: false, error: "invalid_register_payload" }, 400);
    if (server !== "eu" && server !== "us" && server !== "jp") {
      return json({ success: false, error: "invalid_dexcom_server" }, 400);
    }
    if (bgUnits !== "mmol/L" && bgUnits !== "mg/dL") {
      return json({ success: false, error: "invalid_bg_units" }, 400);
    }

    const targetLow = Number(body.target_low);
    const targetHigh = Number(body.target_high);
    const encrypted = await encryptExerciseCgmSecret(password, cryptoSecret);
    await decryptExerciseCgmSecret(encrypted, cryptoSecret);

    const { error: upsertErr } = await admin.from("patient_supporter_cgm_poll").upsert(
      {
        user_id: userId,
        dexcom_server: server,
        dexcom_username: username.slice(0, 320),
        dexcom_password_ciphertext: encrypted.ciphertext,
        dexcom_password_iv: encrypted.iv,
        bg_units: bgUnits,
        target_low: Number.isFinite(targetLow) && targetLow > 0 ? targetLow : null,
        target_high: Number.isFinite(targetHigh) && targetHigh > 0 ? targetHigh : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (upsertErr) {
      console.error("[supporter_cgm_share] upsert", upsertErr);
      return json({ success: false, error: "upsert_failed" }, 500);
    }

    return json({ success: true, action: "registered" });
  } catch (e) {
    console.error("[supporter_cgm_share]", e);
    return json({ success: false, error: "internal_error" }, 500);
  }
});
