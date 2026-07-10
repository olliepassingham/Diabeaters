import {
  getBearerAuthHeadersForEdgeFunctions,
  invokeEdgeFunctionPost,
} from "@/lib/edge-function-invoke-auth";
import { logEdgeInvokeFailure } from "./dev-log";
import { getSupabase, getSupabaseUrlAndAnonKey } from "./supabase";

export type ExerciseCgmMonitorAction = "register" | "unregister";

export type ExerciseCgmMonitorRegisterBody = {
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

export type ExerciseCgmMonitorUnregisterBody = {
  action: "unregister";
  session_id: string;
};

export type ExerciseCgmMonitorResult = {
  success: boolean;
  action?: string;
  error?: string;
  detail?: string;
};

export async function invokeExerciseCgmMonitor(
  body: ExerciseCgmMonitorRegisterBody | ExerciseCgmMonitorUnregisterBody,
): Promise<ExerciseCgmMonitorResult> {
  const supabase = getSupabase();
  const env = getSupabaseUrlAndAnonKey();
  if (!supabase || !env) {
    return { success: false, error: "supabase_not_configured" };
  }

  const headers = await getBearerAuthHeadersForEdgeFunctions(supabase);
  if (!headers) {
    return { success: false, error: "no_session" };
  }

  const { data, error } = await invokeEdgeFunctionPost<ExerciseCgmMonitorResult>(
    "exercise_cgm_monitor",
    body,
    env,
    headers,
  );

  if (error) {
    logEdgeInvokeFailure("exercise_cgm_monitor", error.message);
    return { success: false, error: "invoke_failed", detail: error.message };
  }

  const payload = data as ExerciseCgmMonitorResult | null;
  if (!payload || typeof payload.success !== "boolean") {
    return { success: false, error: "invalid_response" };
  }
  return payload;
}
