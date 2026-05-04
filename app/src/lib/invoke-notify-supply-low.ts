import {
  getBearerAuthHeadersForEdgeFunctions,
  invokeEdgeFunctionPost,
} from "@/lib/edge-function-invoke-auth";
import { devWarn } from "@/lib/dev-log";
import { getSupabase, getSupabaseUrlAndAnonKey } from "@/lib/supabase";

export async function invokeNotifySupplyLow(params: {
  supplyId: string;
  supplyName: string;
  level: "low" | "critical";
  daysRemaining: number;
}): Promise<{ success: boolean; error?: string; detail?: string }> {
  const supabase = getSupabase();
  const env = getSupabaseUrlAndAnonKey();
  if (!supabase || !env) return { success: false, error: "supabase_not_configured" };

  const headers = await getBearerAuthHeadersForEdgeFunctions(supabase);
  if (!headers) {
    return { success: false, error: "no_session", detail: "Sign in to send alerts." };
  }

  const { data, error } = await invokeEdgeFunctionPost<{
    success?: boolean;
    error?: string;
    detail?: string;
  }>(
    "notify_supply_low",
    {
      supply_id: params.supplyId,
      supply_name: params.supplyName,
      level: params.level,
      days_remaining: params.daysRemaining,
    },
    env,
    headers,
  );

  if (error) {
    devWarn("[invokeNotifySupplyLow]", error.message);
    return { success: false, error: "invoke_failed", detail: error.message };
  }
  const payload = data as { success?: boolean; error?: string; detail?: string } | null;
  if (!payload || typeof payload.success !== "boolean") {
    return { success: false, error: "invalid_response" };
  }
  return { success: payload.success, error: payload.error, detail: payload.detail };
}

