import { getSupabase } from "@/lib/supabase";

export type ScenarioUpsertInput = {
  scenarioKey: string;
  title?: string | null;
  label?: string | null;
  state?: Record<string, unknown> | null;
};

async function getAuthedUserId(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}

/**
 * Upsert a single scenario row for the current user.
 * Requires DB unique index: (user_id, scenario_key).
 * Best-effort: if Supabase isn't configured/authenticated, no-op.
 */
export async function upsertScenario(input: ScenarioUpsertInput): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const userId = await getAuthedUserId();
  if (!userId) return;

  const scenario_key = input.scenarioKey.trim();
  if (!scenario_key) return;

  const payload: Record<string, unknown> = {
    user_id: userId,
    scenario_key,
    title: input.title ?? null,
    label: input.label ?? null,
    state: input.state ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("scenarios")
    .upsert(payload, { onConflict: "user_id,scenario_key" });

  if (error && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn("scenarios: upsert failed", error);
  }
}

