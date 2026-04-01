import { getSupabase } from "@/lib/supabase";

export async function invokeNotifyScenarioStarted(params: {
  scenarioKey: "sick_day" | "travel";
  title: string;
  summary?: string | null;
}): Promise<{ success: boolean; error?: string; detail?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: "supabase_not_configured" };

  const { data, error } = await supabase.functions.invoke("notify_scenario_started", {
    body: {
      scenario_key: params.scenarioKey,
      title: params.title,
      summary: params.summary ?? null,
    },
  });

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

