import {
  getBearerAuthHeadersForEdgeFunctions,
  invokeEdgeFunctionPost,
} from "@/lib/edge-function-invoke-auth";
import { logEdgeInvokeFailure } from "@/lib/dev-log";
import { getSupabase, getSupabaseUrlAndAnonKey } from "@/lib/supabase";

export type NotifySupporterAppointmentRemindersResult = {
  success: boolean;
  error?: string;
  detail?: string;
  reminders_attempted?: number;
  delivered_inapp?: number;
  delivered_push?: number;
};

/** Ask the server to notify linked supporters for this patient's due appointment windows. */
export async function invokeNotifySupporterAppointmentReminders(): Promise<NotifySupporterAppointmentRemindersResult> {
  const supabase = getSupabase();
  const env = getSupabaseUrlAndAnonKey();
  if (!supabase || !env) return { success: false, error: "supabase_not_configured" };

  const headers = await getBearerAuthHeadersForEdgeFunctions(supabase);
  if (!headers) return { success: false, error: "no_session" };

  const { data, error } = await invokeEdgeFunctionPost<NotifySupporterAppointmentRemindersResult>(
    "notify_supporter_appointment_reminders",
    {},
    env,
    headers,
  );

  if (error) {
    logEdgeInvokeFailure("notify_supporter_appointment_reminders", error.message);
    return { success: false, error: "invoke_failed", detail: error.message };
  }

  const payload = data as NotifySupporterAppointmentRemindersResult | null;
  if (!payload || typeof payload.success !== "boolean") {
    return { success: false, error: "invalid_response" };
  }
  return payload;
}
