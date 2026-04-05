import {
  getBearerAuthHeadersForEdgeFunctions,
  invokeEdgeFunctionPost,
} from "@/lib/edge-function-invoke-auth";
import { getSupabase, getSupabaseUrlAndAnonKey } from "@/lib/supabase";

export async function invokeNotifyScenarioStarted(params: {
  scenarioKey: "sick_day" | "travel";
  title: string;
  summary?: string | null;
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
    "notify_scenario_started",
    {
      scenario_key: params.scenarioKey,
      title: params.title,
      summary: params.summary ?? null,
    },
    env,
    headers,
  );

  if (error) {
    console.warn("[invokeNotifyScenarioStarted]", error.message);
    return { success: false, error: "invoke_failed", detail: error.message };
  }
  const payload = data as { success?: boolean; error?: string; detail?: string } | null;
  if (!payload || typeof payload.success !== "boolean") {
    return { success: false, error: "invalid_response" };
  }
  return { success: payload.success, error: payload.error, detail: payload.detail };
}

