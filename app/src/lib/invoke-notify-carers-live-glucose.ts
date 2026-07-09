import {
  getBearerAuthHeadersForEdgeFunctions,
  invokeEdgeFunctionPost,
} from "@/lib/edge-function-invoke-auth";
import { logEdgeInvokeFailure } from "./dev-log";
import { getSupabase, getSupabaseUrlAndAnonKey } from "./supabase";

export type NotifyCarersOnLiveGlucoseResult = {
  success: boolean;
  notified?: number;
  error?: string;
  detail?: string;
};

/** Ask the server to notify supporters when the latest shared reading is out of range. */
export async function invokeNotifyCarersOnLiveGlucose(): Promise<NotifyCarersOnLiveGlucoseResult> {
  const supabase = getSupabase();
  const env = getSupabaseUrlAndAnonKey();
  if (!supabase || !env) {
    return { success: false, error: "supabase_not_configured" };
  }

  const headers = await getBearerAuthHeadersForEdgeFunctions(supabase);
  if (!headers) {
    return { success: false, error: "no_session" };
  }

  const { data, error } = await invokeEdgeFunctionPost<NotifyCarersOnLiveGlucoseResult>(
    "notify_carers_on_live_glucose",
    {},
    env,
    headers,
  );

  if (error) {
    logEdgeInvokeFailure("notify_carers_on_live_glucose", error.message);
    return { success: false, error: "invoke_failed", detail: error.message };
  }

  const payload = data as NotifyCarersOnLiveGlucoseResult | null;
  if (!payload || typeof payload.success !== "boolean") {
    return { success: false, error: "invalid_response" };
  }
  return payload;
}
