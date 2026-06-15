import {
  getBearerAuthHeadersForEdgeFunctions,
  invokeEdgeFunctionPost,
} from "@/lib/edge-function-invoke-auth";
import { logEdgeInvokeFailure } from "@/lib/dev-log";
import { getSupabase, getSupabaseUrlAndAnonKey } from "@/lib/supabase";

export async function invokeNotifyAlcoholNightMode(params: {
  sessionId: string;
  intensity: "light" | "moderate" | "long_or_heavy";
  plannedBedtimeIso: string;
}): Promise<{ success: boolean; error?: string; detail?: string }> {
  const supabase = getSupabase();
  const env = getSupabaseUrlAndAnonKey();
  if (!supabase || !env) return { success: false, error: "supabase_not_configured" };

  const headers = await getBearerAuthHeadersForEdgeFunctions(supabase);
  if (!headers) {
    return { success: false, error: "no_session", detail: "Sign in to notify supporters." };
  }

  const { data, error } = await invokeEdgeFunctionPost<{
    success?: boolean;
    error?: string;
    detail?: string;
  }>(
    "notify_alcohol_night_mode",
    {
      session_id: params.sessionId,
      intensity: params.intensity,
      planned_bedtime_iso: params.plannedBedtimeIso,
    },
    env,
    headers,
  );

  if (error) {
    logEdgeInvokeFailure("notify_alcohol_night_mode", error.message);
    return { success: false, error: "invoke_failed", detail: error.message };
  }
  const payload = data as { success?: boolean; error?: string; detail?: string } | null;
  if (!payload || typeof payload.success !== "boolean") {
    return { success: false, error: "invalid_response" };
  }
  return { success: payload.success, error: payload.error, detail: payload.detail };
}
