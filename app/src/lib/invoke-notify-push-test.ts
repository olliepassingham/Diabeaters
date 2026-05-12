import {
  getBearerAuthHeadersForEdgeFunctions,
  invokeEdgeFunctionPost,
} from "@/lib/edge-function-invoke-auth";
import { logEdgeInvokeFailure } from "@/lib/dev-log";
import { getSupabase, getSupabaseUrlAndAnonKey } from "@/lib/supabase";

export async function invokeNotifyPushTest(): Promise<{
  success: boolean;
  error?: string;
  detail?: string;
  tokens?: number;
  delivered_push?: number;
  http_status?: number;
  failure_channel?: string;
  apns_environment?: string;
  apns_bundle_id?: string;
  apns_host?: string;
}> {
  const supabase = getSupabase();
  const env = getSupabaseUrlAndAnonKey();
  if (!supabase || !env) return { success: false, error: "supabase_not_configured" };

  const headers = await getBearerAuthHeadersForEdgeFunctions(supabase);
  if (!headers) return { success: false, error: "no_session", detail: "Sign in to test push." };

  const { data, error } = await invokeEdgeFunctionPost<{
    success?: boolean;
    error?: string;
    detail?: string;
    tokens?: number;
    delivered_push?: number;
    http_status?: number;
    failure_channel?: string;
    apns_environment?: string;
    apns_bundle_id?: string;
    apns_host?: string;
  }>("notify_push_test", {}, env, headers);

  if (error) {
    logEdgeInvokeFailure("notify_push_test", error.message);
    return { success: false, error: "invoke_failed", detail: error.message };
  }

  const payload = data as
    | {
        success?: boolean;
        error?: string;
        detail?: string;
        tokens?: number;
        delivered_push?: number;
        http_status?: number;
        failure_channel?: string;
        apns_environment?: string;
        apns_bundle_id?: string;
        apns_host?: string;
      }
    | null;
  if (!payload || typeof payload.success !== "boolean") {
    return { success: false, error: "invalid_response" };
  }

  return {
    success: payload.success,
    error: payload.error,
    detail: payload.detail,
    tokens: payload.tokens,
    delivered_push: payload.delivered_push,
    http_status: payload.http_status,
    failure_channel: payload.failure_channel,
    apns_environment: payload.apns_environment,
    apns_bundle_id: payload.apns_bundle_id,
    apns_host: payload.apns_host,
  };
}

