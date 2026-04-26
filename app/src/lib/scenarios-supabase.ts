import { getSupabase } from "@/lib/supabase";
import { storage } from "@/lib/storage";

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

/** Current JSON `state` for the signed-in patient (read-merge before upsert). */
export async function fetchScenarioStateForUser(scenarioKey: string): Promise<Record<string, unknown> | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const userId = await getAuthedUserId();
  if (!userId) return null;

  const key = scenarioKey.trim();
  if (!key) return null;

  const { data, error } = await supabase
    .from("scenarios")
    .select("state")
    .eq("user_id", userId)
    .eq("scenario_key", key)
    .maybeSingle();

  if (error && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn("scenarios: fetch state failed", error);
  }
  const st = data?.state;
  return st && typeof st === "object" ? (st as Record<string, unknown>) : null;
}

export type SickDayDeactivateCloudOptions = {
  endedAt?: string;
  /** Episode start; pass from local state before clearing so cloud history stays accurate. */
  startedAt?: string | null;
  lastCheckAt?: string | null;
};

/**
 * Writes `sick_day_active: false` (and clears patient-side sick fields) to the linked `scenarios` row.
 * Call this whenever Sick Day ends from **any** UI (dashboard strip, banner, full page) so supporters do not keep
 * seeing temperatures / meds — they read this row from Supabase.
 */
export async function syncSickDayDeactivatedToCloud(options?: SickDayDeactivateCloudOptions): Promise<void> {
  const remote = await fetchScenarioStateForUser("sick_day");
  const preservedCarerTemps = Array.isArray(remote?.carer_temp_recent) ? remote!.carer_temp_recent : [];
  const preservedCarerNotes = Array.isArray(remote?.carer_med_notes) ? remote!.carer_med_notes : [];
  const endedAt = options?.endedAt ?? new Date().toISOString();
  const startedAt =
    options?.startedAt !== undefined
      ? options.startedAt
      : (typeof remote?.started_at === "string" ? remote.started_at : null) ??
        (typeof remote?.activated_at === "string" ? remote.activated_at : null);
  const lastCheckAt =
    options?.lastCheckAt !== undefined
      ? options.lastCheckAt
      : typeof remote?.last_check_at === "string"
        ? remote.last_check_at
        : null;

  await upsertScenario({
    scenarioKey: "sick_day",
    title: "Sick day",
    label: "Sick day mode (off)",
    state: {
      sick_day_active: false,
      sickDayActive: false,
      started_at: startedAt,
      ended_at: endedAt,
      inputs_summary: null,
      meds_next_due: null,
      meds_active: [],
      temp_recent: [],
      temp_latest: null,
      medication_dose_log: [],
      last_check_at: lastCheckAt,
      carer_temp_recent: preservedCarerTemps,
      carer_med_notes: preservedCarerNotes,
    },
  });
}

/**
 * If this device has sick day off but Supabase still marks it active, push the inactive snapshot.
 * Heals stale cloud rows after older builds ended sick day only locally (supporters read the cloud row).
 */
export async function repairSickDayCloudIfLocalInactive(): Promise<void> {
  if (!getSupabase()) return;
  const local = storage.getScenarioState();
  if (local.sickDayActive) return;

  const remote = await fetchScenarioStateForUser("sick_day");
  if (!remote) return;

  const cloudSaysActive = remote.sick_day_active === true || remote.sickDayActive === true;
  if (!cloudSaysActive) return;

  const priorEnded =
    (typeof remote.ended_at === "string" && remote.ended_at.trim() ? remote.ended_at : null) ??
    (typeof remote.deactivated_at === "string" && remote.deactivated_at.trim() ? remote.deactivated_at : null);
  const priorEndedMs = priorEnded ? new Date(priorEnded).getTime() : NaN;
  const endedAt =
    priorEnded && !Number.isNaN(priorEndedMs) && priorEndedMs <= Date.now() ? priorEnded : undefined;

  const startedAt =
    (typeof remote.started_at === "string" ? remote.started_at : null) ??
    (typeof remote.activated_at === "string" ? remote.activated_at : null) ??
    null;
  const lastCheckAt = typeof remote.last_check_at === "string" ? remote.last_check_at : null;

  await syncSickDayDeactivatedToCloud({ endedAt, startedAt, lastCheckAt });
}

