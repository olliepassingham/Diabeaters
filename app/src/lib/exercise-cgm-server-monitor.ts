import { calculateExercisePlan, type ExercisePlanContext } from "@/lib/exercise-plan";
import { resolveExerciseCgmAlertThreshold } from "@/lib/exercise-cgm-alert-thresholds";
import { computeExerciseHypoSuggestion, hypoRangeThreshold } from "@/lib/exercise-hypo-auto";
import { bgForPlannerFromActiveSession } from "@/lib/exercise-planner-href";
import { hasDexcomShareCredentials, readCgmPreferences } from "@/lib/cgm/preferences";
import { normalizeBgUnits } from "@/lib/alcohol-night-tool";
import { invokeExerciseCgmMonitor } from "@/lib/invoke-exercise-cgm-monitor";
import { storage, type ActiveExerciseSession } from "@/lib/storage";

const REGISTER_REFRESH_MS = 15 * 60_000;

let lastRegistered: { sessionId: string; at: number } | null = null;
let unregisterInFlight: string | null = null;

function parsePlanNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value == null) return null;
  const n = parseFloat(String(value).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function shouldUseExerciseCgmServerMonitor(session: ActiveExerciseSession | null): boolean {
  if (!session || session.phase !== "active" || !session.exerciseStartedAt) return false;
  const prefs = readCgmPreferences();
  if (!hasDexcomShareCredentials(prefs)) return false;

  const notif = storage.getNotificationSettings();
  if (!notif.enabled || notif.exerciseCgmAlerts === false || notif.hypoAlerts === false) return false;
  if (!notif.pushNotifications) return false;

  return true;
}

function shouldRegisterAgain(sessionId: string): boolean {
  if (!lastRegistered || lastRegistered.sessionId !== sessionId) return true;
  return Date.now() - lastRegistered.at >= REGISTER_REFRESH_MS;
}

export async function registerExerciseCgmServerMonitor(session: ActiveExerciseSession): Promise<void> {
  if (!shouldUseExerciseCgmServerMonitor(session)) return;
  if (!shouldRegisterAgain(session.id)) return;

  const prefs = readCgmPreferences();
  const username = prefs.dexcomShareUsername?.trim();
  const password = prefs.dexcomSharePassword;
  if (!username || !password) return;

  const profile = storage.getProfile();
  const bgUnits = normalizeBgUnits(profile?.bgUnits) as "mmol/L" | "mg/dL";
  const notif = storage.getNotificationSettings();
  const userSettings = storage.getSettings();
  const threshold = resolveExerciseCgmAlertThreshold(notif, bgUnits);
  const clinicalHypoThreshold = hypoRangeThreshold(userSettings, bgUnits);

  let carbsIfLow: number | undefined;
  let carbLine: string | undefined;
  try {
    const bg = bgForPlannerFromActiveSession(session) ?? threshold;
    const planCtx: ExercisePlanContext = {
      exerciseType: session.exerciseType,
      durationMinutes: session.durationMinutes,
      intensity: session.intensity,
      minutesUntilStart: 30,
      bgUnits,
      currentBg: bg,
      hourOfDay: new Date().getHours(),
    };
    if (session.preEnvironments?.length) planCtx.environments = [...session.preEnvironments];
    const plan = calculateExercisePlan(planCtx, userSettings);
    carbsIfLow = parsePlanNumber(plan.pre.carbsIfLow) ?? undefined;
    const suggestion = computeExerciseHypoSuggestion(bg, userSettings, bgUnits, profile ?? {}, {
      phase: "active",
      exerciseLowThreshold: threshold,
      carbsIfLow,
    });
    carbLine = suggestion?.primaryTreatmentLine;
  } catch {
    // optional plan context
  }

  const server =
    prefs.dexcomShareServer === "us" ? "us" : prefs.dexcomShareServer === "jp" ? "jp" : "eu";

  const result = await invokeExerciseCgmMonitor({
    action: "register",
    session_id: session.id,
    exercise_name: session.exerciseName,
    dexcom_server: server,
    dexcom_username: username,
    dexcom_password: password,
    bg_units: bgUnits,
    alert_threshold: threshold,
    trend_aware: notif.exerciseCgmAlertTrendAware !== false,
    clinical_hypo_threshold: clinicalHypoThreshold,
    carbs_if_low: carbsIfLow ?? null,
    carb_line: carbLine ?? null,
    exercise_started_at: session.exerciseStartedAt!,
    duration_minutes: session.durationMinutes,
    recovery_minutes: session.recoveryMinutes,
  });

  if (result.success) {
    lastRegistered = { sessionId: session.id, at: Date.now() };
  }
}

export async function unregisterExerciseCgmServerMonitor(sessionId: string): Promise<void> {
  if (!sessionId) return;
  if (unregisterInFlight === sessionId) return;
  unregisterInFlight = sessionId;
  try {
    await invokeExerciseCgmMonitor({ action: "unregister", session_id: sessionId });
    if (lastRegistered?.sessionId === sessionId) lastRegistered = null;
  } finally {
    if (unregisterInFlight === sessionId) unregisterInFlight = null;
  }
}

export function resetExerciseCgmServerMonitorState(): void {
  lastRegistered = null;
  unregisterInFlight = null;
}

/** @internal test helper */
export function __testOnlyLastRegisteredSession(): string | null {
  return lastRegistered?.sessionId ?? null;
}
