/**
 * Calls Edge Function `notify_patient_hypo_acknowledged` after a supporter acknowledges a hypo log.
 */
import {
  getBearerAuthHeadersForEdgeFunctions,
  invokeEdgeFunctionPost,
} from "@/lib/edge-function-invoke-auth";
import { logEdgeInvokeFailure } from "./dev-log";
import { getSupabase, getSupabaseUrlAndAnonKey } from "./supabase";

export type NotifyPatientHypoAcknowledgedResult = {
  success: boolean;
  delivered_inapp?: number;
  delivered_push?: number;
  error?: string;
  detail?: string;
};

export async function invokeNotifyPatientHypoAcknowledged(params: {
  hypoLogId: string;
}): Promise<NotifyPatientHypoAcknowledgedResult> {
  const supabase = getSupabase();
  const env = getSupabaseUrlAndAnonKey();
  if (!supabase || !env) {
    return { success: false, error: "supabase_not_configured" };
  }

  const headers = await getBearerAuthHeadersForEdgeFunctions(supabase);
  if (!headers) {
    return { success: false, error: "no_session", detail: "Sign in to send alerts." };
  }

  const { data, error } = await invokeEdgeFunctionPost<NotifyPatientHypoAcknowledgedResult>(
    "notify_patient_hypo_acknowledged",
    { hypo_log_id: params.hypoLogId },
    env,
    headers,
  );

  if (error) {
    logEdgeInvokeFailure("notify_patient_hypo_acknowledged", error.message);
    return { success: false, error: "invoke_failed", detail: error.message };
  }

  const payload = data as NotifyPatientHypoAcknowledgedResult | null;
  if (!payload || typeof payload.success !== "boolean") {
    return { success: false, error: "invalid_response" };
  }
  return payload;
}
