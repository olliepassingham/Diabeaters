import {
  getBearerAuthHeadersForEdgeFunctions,
  invokeEdgeFunctionPost,
} from "@/lib/edge-function-invoke-auth";
import { logEdgeInvokeFailure } from "./dev-log";
import { getSupabase, getSupabaseUrlAndAnonKey } from "./supabase";

export type SupporterCgmShareResult = {
  success: boolean;
  action?: string;
  error?: string;
  detail?: string;
  reason?: string;
};

export async function invokeSupporterCgmShare(
  body:
    | { action: "unregister" }
    | {
        action: "register";
        dexcom_server: "eu" | "us" | "jp";
        dexcom_username: string;
        dexcom_password: string;
        bg_units: "mmol/L" | "mg/dL";
        target_low: number | null;
        target_high: number | null;
      },
): Promise<SupporterCgmShareResult> {
  const supabase = getSupabase();
  const env = getSupabaseUrlAndAnonKey();
  if (!supabase || !env) return { success: false, error: "supabase_not_configured" };

  const headers = await getBearerAuthHeadersForEdgeFunctions(supabase);
  if (!headers) return { success: false, error: "no_session" };

  const { data, error } = await invokeEdgeFunctionPost<SupporterCgmShareResult>(
    "supporter_cgm_share",
    body,
    env,
    headers,
  );
  if (error) {
    logEdgeInvokeFailure("supporter_cgm_share", error.message);
    return { success: false, error: "invoke_failed", detail: error.message };
  }
  const payload = data as SupporterCgmShareResult | null;
  if (!payload || typeof payload.success !== "boolean") return { success: false, error: "invalid_response" };
  return payload;
}
