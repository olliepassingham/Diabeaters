import { calculateExercisePlan, type ExercisePlanContext } from "@/lib/exercise-plan";
import {
  encodeExerciseAlertFuel,
  resolveExerciseCgmAlertAim,
  resolveExerciseCgmAlertThreshold,
} from "@/lib/exercise-cgm-alert-thresholds";
import { getBodyWeightKgFromProfile } from "@/lib/body-weight";
import { resolveCarbSource } from "@/lib/carb-source-preferences";
import type { ExerciseAlertFuelCarb } from "@/lib/exercise-cgm-alert-thresholds";
import { hypoRangeThreshold } from "@/lib/exercise-hypo-auto";
import { bgForPlannerFromActiveSession } from "@/lib/exercise-planner-href";
import { hasDexcomShareCredentials, readCgmPreferences } from "@/lib/cgm/preferences";
import { normalizeBgUnits } from "@/lib/alcohol-night-tool";
import { invokeExerciseCgmMonitor } from "@/lib/invoke-exercise-cgm-monitor";
import { storage, type ActiveExerciseSession } from "@/lib/storage";

const REGISTER_REFRESH_MS = 15 * 60_000;

let lastRegistered: { sessionId: string; at: number; fingerprint: string } | null = null;
let unregisterInFlight: string | null = null;

function savedExerciseCarb(
  profile: Parameters<typeof resolveCarbSource>[0],
): ExerciseAlertFuelCarb | null {
  const resolved =
    resolveCarbSource(profile, "exercise_during") ?? resolveCarbSource(profile, "exercise_on_hand");
  if (!resolved) return null;
  if (resolved.kind === "favorite") {
    return { carbsPerServing: resolved.favorite.carbsPerServing, label: resolved.favorite.label };
  }
  if (resolved.treatment === "glucose_tablets") return { carbsPerServing: 4, label: "glucose tablets" };
  if (resolved.treatment === "jelly_babies") return { carbsPerServing: 5, label: "jelly babies" };
  if (resolved.treatment === "sweets") return { carbsPerServing: 5, label: "sweets" };
  if (resolved.treatment === "glucose_gel") return { carbsPerServing: 15, label: "glucose gel" };
  return null;
}

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

function shouldRegisterAgain(sessionId: string, fingerprint: string): boolean {
  if (!lastRegistered || lastRegistered.sessionId !== sessionId) return true;
  if (lastRegistered.fingerprint !== fingerprint) return true;
  return Date.now() - lastRegistered.at >= REGISTER_REFRESH_MS;
}

export async function registerExerciseCgmServerMonitor(session: ActiveExerciseSession): Promise<void> {
  if (!shouldUseExerciseCgmServerMonitor(session)) return;

  const prefs = readCgmPreferences();
  const username = prefs.dexcomShareUsername?.trim();
  const password = prefs.dexcomSharePassword;
  if (!username || !password) return;

  const profile = storage.getProfile();
  const bgUnits = normalizeBgUnits(profile?.bgUnits) as "mmol/L" | "mg/dL";
  const notif = storage.getNotificationSettings();
  const userSettings = storage.getSettings();
  const threshold = resolveExerciseCgmAlertThreshold(notif, bgUnits);
  const aim = resolveExerciseCgmAlertAim(notif, bgUnits);
  const weightKg = getBodyWeightKgFromProfile(profile) ?? 70;
  const carbLine = encodeExerciseAlertFuel(aim, weightKg, savedExerciseCarb(profile));
  const fingerprint = `${threshold}|${aim}|${notif.exerciseCgmAlertTrendAware !== false}|${carbLine}`;
  const clinicalHypoThreshold = hypoRangeThreshold(userSettings, bgUnits);

  if (!shouldRegisterAgain(session.id, fingerprint)) return;

  let carbsIfLow: number | undefined;
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
    lastRegistered = { sessionId: session.id, at: Date.now(), fingerprint };
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
