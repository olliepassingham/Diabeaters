/**
 * Proactive supporter hypo check-ins — patient responds; optional link to hypo_logs row.
 */
import {
  getBearerAuthHeadersForEdgeFunctions,
  invokeEdgeFunctionPost,
} from "@/lib/edge-function-invoke-auth";
import { logEdgeInvokeFailure } from "./dev-log";
import { notifyInAppNotificationsChanged } from "./in-app-notifications-events";
import { getSupabase } from "./supabase";

export type HypoCheckInStatus = "pending" | "ok" | "treating" | "hypo_logged";

export type HypoCheckInRow = {
  id: string;
  carer_id: string;
  patient_id: string;
  status: HypoCheckInStatus;
  hypo_log_id: string | null;
  created_at: string;
  responded_at: string | null;
};

export type PendingHypoCheckIn = {
  id: string;
  carer_id: string;
  carer_name: string;
  created_at: string;
};

export type HypoCheckInResponse = "ok" | "treating" | "hypo_logged";

function mapCheckInRow(row: Record<string, unknown>): HypoCheckInRow {
  return {
    id: String(row.id),
    carer_id: String(row.carer_id),
    patient_id: String(row.patient_id),
    status: String(row.status) as HypoCheckInStatus,
    hypo_log_id: row.hypo_log_id != null ? String(row.hypo_log_id) : null,
    created_at: String(row.created_at),
    responded_at: row.responded_at != null ? String(row.responded_at) : null,
  };
}

export function checkInIdFromNotificationData(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const id = typeof d.check_in_id === "string" ? d.check_in_id.trim() : "";
  return id || null;
}

export function carerNameFromCheckInNotification(data: unknown): string {
  if (!data || typeof data !== "object") return "Your supporter";
  const d = data as Record<string, unknown>;
  const name = typeof d.carer_name === "string" ? d.carer_name.trim() : "";
  return name || "Your supporter";
}

export function formatHypoCheckInStatusLabel(status: HypoCheckInStatus): string {
  switch (status) {
    case "pending":
      return "Waiting for reply";
    case "ok":
      return "They replied they're OK";
    case "treating":
      return "They're treating it";
    case "hypo_logged":
      return "They logged a hypo";
    default:
      return status;
  }
}

let pendingHypoCheckInForLog: string | null = null;

export function setPendingHypoCheckInForLog(checkInId: string | null): void {
  pendingHypoCheckInForLog = checkInId?.trim() || null;
}

export function consumePendingHypoCheckInForLog(): string | null {
  const id = pendingHypoCheckInForLog;
  pendingHypoCheckInForLog = null;
  return id;
}

export function friendlyCreateCheckInError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("pending_exists")) {
    return "You already have a check-in waiting for a reply.";
  }
  if (m.includes("rate_limited")) {
    return "Please wait about 15 minutes before sending another check-in.";
  }
  if (m.includes("daily_limit")) {
    return "Daily check-in limit reached. Try again tomorrow or call them directly.";
  }
  if (m.includes("scope_denied") || m.includes("not_linked")) {
    return "Hypo alerts are not enabled for this link.";
  }
  if (m.includes("schema cache") || m.includes("could not find the function")) {
    return "This feature is not set up on the server yet. Apply the hypo check-ins database migration, then reload the API schema in Supabase.";
  }
  return message;
}

export async function createHypoCheckIn(
  patientId: string,
): Promise<{ data: HypoCheckInRow | null; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const id = patientId.trim();
  if (!id) return { data: null, error: new Error("Missing patient id") };

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user?.id) return { data: null, error: new Error("Not signed in") };

  const { data, error } = await supabase.rpc("create_hypo_check_in", { p_patient_id: id });
  if (error) return { data: null, error: new Error(error.message) };

  const row = data as Record<string, unknown> | null;
  if (!row) return { data: null, error: new Error("No check-in returned") };

  const mapped = mapCheckInRow(row);
  void invokeNotifyPatientHypoCheckIn({ checkInId: mapped.id });
  notifyInAppNotificationsChanged({ skipPageRefresh: true });
  return { data: mapped, error: null };
}

export async function respondHypoCheckIn(params: {
  checkInId: string;
  response: HypoCheckInResponse;
  hypoLogId?: string | null;
}): Promise<{ data: HypoCheckInRow | null; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const checkInId = params.checkInId.trim();
  if (!checkInId) return { data: null, error: new Error("Missing check-in id") };

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user?.id) return { data: null, error: new Error("Not signed in") };

  const { data, error } = await supabase.rpc("respond_hypo_check_in", {
    p_check_in_id: checkInId,
    p_response: params.response,
    p_hypo_log_id: params.hypoLogId ?? null,
  });

  if (error) return { data: null, error: new Error(error.message) };

  const row = data as Record<string, unknown> | null;
  if (!row) return { data: null, error: new Error("No response returned") };

  const mapped = mapCheckInRow(row);
  void invokeNotifyCarerHypoCheckInResponse({ checkInId: mapped.id });
  notifyInAppNotificationsChanged({ skipPageRefresh: true });
  return { data: mapped, error: null };
}

export async function fetchPendingHypoCheckIns(): Promise<{
  data: PendingHypoCheckIn[];
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: [], error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user?.id) return { data: [], error: null };

  const { data, error } = await supabase.rpc("list_pending_hypo_check_ins");
  if (error) return { data: [], error: new Error(error.message) };

  const rows = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    carer_id: String(row.carer_id),
    carer_name: String(row.carer_name ?? "Your supporter"),
    created_at: String(row.created_at),
  }));
  return { data: rows, error: null };
}

export async function fetchHypoCheckInsForCarer(
  patientId: string,
  limit = 5,
): Promise<{ data: HypoCheckInRow[]; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { data: [], error: new Error("Supabase not configured") };

  const { data, error } = await supabase.rpc("list_hypo_check_ins_for_carer", {
    p_patient_id: patientId,
    p_limit: limit,
  });
  if (error) return { data: [], error: new Error(error.message) };

  const rows = ((data ?? []) as Record<string, unknown>[]).map((row) =>
    mapCheckInRow({
      id: row.id,
      carer_id: "",
      patient_id: patientId,
      status: row.status,
      hypo_log_id: row.hypo_log_id,
      created_at: row.created_at,
      responded_at: row.responded_at,
    }),
  );
  return { data: rows, error: null };
}

type NotifyResult = { success: boolean; error?: string; detail?: string };

async function invokeNotifyPatientHypoCheckIn(params: { checkInId: string }): Promise<NotifyResult> {
  const { getSupabaseUrlAndAnonKey } = await import("./supabase");
  const supabase = getSupabase();
  const env = getSupabaseUrlAndAnonKey();
  if (!supabase || !env) return { success: false, error: "supabase_not_configured" };

  const headers = await getBearerAuthHeadersForEdgeFunctions(supabase);
  if (!headers) return { success: false, error: "no_session" };

  const { data, error } = await invokeEdgeFunctionPost<NotifyResult>(
    "notify_patient_hypo_check_in",
    { check_in_id: params.checkInId },
    env,
    headers,
  );

  if (error) {
    logEdgeInvokeFailure("notify_patient_hypo_check_in", error.message);
    return { success: false, error: "invoke_failed", detail: error.message };
  }
  return (data as NotifyResult) ?? { success: false, error: "invalid_response" };
}

async function invokeNotifyCarerHypoCheckInResponse(params: { checkInId: string }): Promise<NotifyResult> {
  const { getSupabaseUrlAndAnonKey } = await import("./supabase");
  const supabase = getSupabase();
  const env = getSupabaseUrlAndAnonKey();
  if (!supabase || !env) return { success: false, error: "supabase_not_configured" };

  const headers = await getBearerAuthHeadersForEdgeFunctions(supabase);
  if (!headers) return { success: false, error: "no_session" };

  const { data, error } = await invokeEdgeFunctionPost<NotifyResult>(
    "notify_carer_hypo_check_in_response",
    { check_in_id: params.checkInId },
    env,
    headers,
  );

  if (error) {
    logEdgeInvokeFailure("notify_carer_hypo_check_in_response", error.message);
    return { success: false, error: "invoke_failed", detail: error.message };
  }
  return (data as NotifyResult) ?? { success: false, error: "invalid_response" };
}
