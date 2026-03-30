/**
 * Calls Edge Function `notify_carers_on_hypo` with the active session.
 */
import { getSupabase } from "./supabase";
import type { NotifyCarersOnHypoResult } from "./carer-notify-types";

export async function invokeNotifyCarersOnHypo(params: {
  hypoId: string;
  userId: string;
}): Promise<NotifyCarersOnHypoResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: "supabase_not_configured" };
  }

  const { data, error } = await supabase.functions.invoke("notify_carers_on_hypo", {
    body: { hypo_id: params.hypoId, user_id: params.userId },
  });

  if (error) {
    console.warn("[invokeNotifyCarersOnHypo]", error.message);
    return { success: false, error: "invoke_failed", detail: error.message };
  }

  const payload = data as NotifyCarersOnHypoResult | null;
  if (!payload || typeof payload.success !== "boolean") {
    return { success: false, error: "invalid_response" };
  }
  return payload;
}
