/**
 * Calls Edge Function `notify_carers_on_hypo` with the active session.
 * Uses explicit fetch + apikey + Authorization so the gateway accepts the request (avoids 401 with execution_id null).
 */
import {
  getBearerAuthHeadersForEdgeFunctions,
  invokeEdgeFunctionPost,
} from "@/lib/edge-function-invoke-auth";
import { logEdgeInvokeFailure } from "./dev-log";
import { getSupabase, getSupabaseUrlAndAnonKey } from "./supabase";
import type { NotifyCarersOnHypoResult } from "./carer-notify-types";

export async function invokeNotifyCarersOnHypo(params: {
  hypoId: string;
  userId: string;
}): Promise<NotifyCarersOnHypoResult> {
  const supabase = getSupabase();
  const env = getSupabaseUrlAndAnonKey();
  if (!supabase || !env) {
    return { success: false, error: "supabase_not_configured" };
  }

  const headers = await getBearerAuthHeadersForEdgeFunctions(supabase);
  if (!headers) {
    return { success: false, error: "no_session", detail: "Sign in to send alerts." };
  }

  const { data, error } = await invokeEdgeFunctionPost<NotifyCarersOnHypoResult>(
    "notify_carers_on_hypo",
    { hypo_id: params.hypoId, user_id: params.userId },
    env,
    headers,
  );

  if (error) {
    logEdgeInvokeFailure("notify_carers_on_hypo", error.message);
    return { success: false, error: "invoke_failed", detail: error.message };
  }

  const payload = data as NotifyCarersOnHypoResult | null;
  if (!payload || typeof payload.success !== "boolean") {
    return { success: false, error: "invalid_response" };
  }
  return payload;
}
