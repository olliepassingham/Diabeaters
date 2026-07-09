import { Capacitor } from "@capacitor/core";

import { cgmTrendForExercise } from "@/lib/cgm/apply-cgm-trend";
import { isCgmPrefillActive } from "@/lib/cgm/preferences";
import { getBgPrefill } from "@/lib/cgm/prefill";
import type { GlucoseReading } from "@/lib/cgm/types";
import { calculateExercisePlan, type ExercisePlanContext } from "@/lib/exercise-plan";
import {
  computeExerciseHypoSuggestion,
  hypoRangeThreshold,
  isBgBelowHypoThreshold,
  needsImmediateExerciseBgTreatment,
} from "@/lib/exercise-hypo-auto";
import { resolveExerciseCgmAlertThreshold } from "@/lib/exercise-cgm-alert-thresholds";
import { formatTargetBgInput } from "@/lib/hypo-context";
import { normalizeBgUnits } from "@/lib/alcohol-night-tool";
import { showNativeSystemNotificationNow } from "@/lib/native-system-notifications";
import { bgForPlannerFromActiveSession } from "@/lib/exercise-planner-href";
import {
  storage,
  type ActiveExerciseSession,
  type ExerciseBgTrend,
  type NotificationSettings,
  type UserProfile,
  type UserSettings,
} from "@/lib/storage";

export const EXERCISE_CGM_ALERT_POLL_MS = 2 * 60_000;
export const EXERCISE_CGM_ALERT_COOLDOWN_MS = 12 * 60_000;

export type ExerciseCgmAlertReason = "below_threshold" | "falling_toward" | "clinical_hypo";

export type ExerciseCgmAlertEvaluation = {
  shouldAlert: boolean;
  reason?: ExerciseCgmAlertReason;
  carbsGrams?: number;
  carbLine?: string;
};

type CooldownState = {
  atMs: number;
  bg: number;
  reason: ExerciseCgmAlertReason;
};

const cooldownBySession = new Map<string, CooldownState>();

function parsePlanNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value == null) return null;
  const n = parseFloat(String(value).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function trendArrow(trend: ExerciseBgTrend | null | undefined): string {
  if (trend === "rising") return "↑";
  if (trend === "falling") return "↓";
  if (trend === "flat") return "→";
  return "";
}

function exercisePlanForSession(session: ActiveExerciseSession, bgUnits: string) {
  const bg = bgForPlannerFromActiveSession(session);
  const ctx: ExercisePlanContext = {
    exerciseType: session.exerciseType,
    durationMinutes: session.durationMinutes,
    intensity: session.intensity,
    minutesUntilStart: 30,
    bgUnits,
    currentBg: bg ?? undefined,
    hourOfDay: new Date().getHours(),
  };
  if (session.preEnvironments?.length) ctx.environments = [...session.preEnvironments];
  try {
    return calculateExercisePlan(ctx, storage.getSettings());
  } catch {
    return null;
  }
}

export function evaluateExerciseCgmAlert(input: {
  bg: number;
  bgUnits: "mmol/L" | "mg/dL";
  trend: ExerciseBgTrend | null;
  threshold: number;
  trendAware: boolean;
  userSettings: UserSettings;
  profile: Partial<UserProfile>;
  carbsIfLow?: number;
}): ExerciseCgmAlertEvaluation {
  const { bg, bgUnits, threshold, trendAware, userSettings, profile, carbsIfLow } = input;
  const trend = trendAware ? input.trend : null;

  const context = {
    trend,
    phase: "active" as const,
    exerciseLowThreshold: threshold,
    carbsIfLow,
  };

  if (!needsImmediateExerciseBgTreatment(bg, userSettings, bgUnits, context)) {
    return { shouldAlert: false };
  }

  const clinicalHypo = isBgBelowHypoThreshold(bg, userSettings, bgUnits);
  let reason: ExerciseCgmAlertReason = "below_threshold";
  if (clinicalHypo) {
    reason = "clinical_hypo";
  } else if (bg >= threshold && trend === "falling" && trendAware) {
    reason = "falling_toward";
  }

  const suggestion = computeExerciseHypoSuggestion(bg, userSettings, bgUnits, profile, context);
  if (!suggestion) return { shouldAlert: false };

  return {
    shouldAlert: true,
    reason,
    carbsGrams: suggestion.carbsGrams,
    carbLine: suggestion.primaryTreatmentLine ?? `about ${suggestion.carbsGrams}g fast carbs`,
  };
}

export function shouldSkipExerciseCgmAlertDueToCooldown(
  sessionId: string,
  bg: number,
  threshold: number,
  bgUnits: "mmol/L" | "mg/dL",
): boolean {
  const prev = cooldownBySession.get(sessionId);
  if (!prev) return false;
  if (Date.now() - prev.atMs < EXERCISE_CGM_ALERT_COOLDOWN_MS) return true;

  const clearMargin = bgUnits === "mmol/L" ? 0.4 : 7;
  if (bg >= threshold + clearMargin) {
    cooldownBySession.delete(sessionId);
    return false;
  }
  return Date.now() - prev.atMs < EXERCISE_CGM_ALERT_COOLDOWN_MS;
}

export function markExerciseCgmAlertShown(
  sessionId: string,
  bg: number,
  reason: ExerciseCgmAlertReason,
): void {
  cooldownBySession.set(sessionId, { atMs: Date.now(), bg, reason });
}

export function resetExerciseCgmAlertCooldown(sessionId?: string): void {
  if (sessionId) cooldownBySession.delete(sessionId);
  else cooldownBySession.clear();
}

export function buildExerciseCgmAlertCopy(input: {
  bg: number;
  bgUnits: "mmol/L" | "mg/dL";
  trend: ExerciseBgTrend | null;
  evaluation: ExerciseCgmAlertEvaluation;
  exerciseName?: string;
}): { title: string; body: string } {
  const bgLabel = formatTargetBgInput(input.bg, input.bgUnits);
  const arrow = trendArrow(input.trend);
  const carbPart = input.evaluation.carbLine ?? "fast carbs";
  const sessionLabel = input.exerciseName?.trim() ? ` during ${input.exerciseName.trim()}` : "";

  if (input.evaluation.reason === "clinical_hypo") {
    return {
      title: "Exercise: treat low BG",
      body: `BG ${bgLabel}${arrow ? ` ${arrow}` : ""}${sessionLabel} — ${carbPart}. Confirm on meter/CGM before treating.`,
    };
  }

  return {
    title: "Exercise: carbs may help",
    body: `BG ${bgLabel}${arrow ? ` ${arrow}` : ""}${sessionLabel} — ${carbPart}. Open your exercise guide to review.`,
  };
}

function notificationsAllowed(settings: NotificationSettings): boolean {
  return settings.enabled && settings.exerciseCgmAlerts !== false && settings.hypoAlerts !== false;
}

async function showExerciseCgmAlertNotification(input: {
  session: ActiveExerciseSession;
  reading: GlucoseReading;
  evaluation: ExerciseCgmAlertEvaluation;
  bgUnits: "mmol/L" | "mg/dL";
  trend: ExerciseBgTrend | null;
}): Promise<void> {
  const copy = buildExerciseCgmAlertCopy({
    bg: input.reading.value,
    bgUnits: input.bgUnits,
    trend: input.trend,
    evaluation: input.evaluation,
    exerciseName: input.session.exerciseName,
  });

  const tag = `exercise-cgm-alert-${input.session.id}`;
  const deepLink = "/scenarios/exercise";

  await showNativeSystemNotificationNow({
    title: copy.title,
    body: copy.body,
    deepLink,
    tag,
    channelId: "diabeaters_scenarios",
  });

  if (!Capacitor.isNativePlatform() && typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(copy.title, { body: copy.body, tag });
    } catch {
      // ignore
    }
  }
}

let runLock = false;

export async function runExerciseCgmAlertNotifier(): Promise<void> {
  if (runLock) return;
  runLock = true;
  try {
    const session = storage.getActiveExercise();
    if (!session || session.phase !== "active" || !session.exerciseStartedAt) return;
    if (!isCgmPrefillActive()) return;

    const notifSettings = storage.getNotificationSettings();
    if (!notificationsAllowed(notifSettings)) return;

    const profile = storage.getProfile() ?? {};
    const bgUnits = normalizeBgUnits(profile.bgUnits);
    const userSettings = storage.getSettings();
    const threshold = resolveExerciseCgmAlertThreshold(notifSettings, bgUnits);
    const trendAware = notifSettings.exerciseCgmAlertTrendAware !== false;

    const prefill = await getBgPrefill(bgUnits);
    if (!prefill?.fromCgm || !prefill.reading) return;
    if (prefill.reading.isStale) return;

    const trend = cgmTrendForExercise(prefill.reading.trend) ?? null;
    const plan = exercisePlanForSession(session, bgUnits);
    const carbsIfLow = plan ? parsePlanNumber(plan.pre.carbsIfLow) ?? undefined : undefined;

    const evaluation = evaluateExerciseCgmAlert({
      bg: prefill.reading.value,
      bgUnits,
      trend,
      threshold,
      trendAware,
      userSettings,
      profile,
      carbsIfLow,
    });
    if (!evaluation.shouldAlert || !evaluation.reason) return;

    if (
      shouldSkipExerciseCgmAlertDueToCooldown(session.id, prefill.reading.value, threshold, bgUnits)
    ) {
      return;
    }

    await showExerciseCgmAlertNotification({
      session,
      reading: prefill.reading,
      evaluation,
      bgUnits,
      trend,
    });
    markExerciseCgmAlertShown(session.id, prefill.reading.value, evaluation.reason);
  } finally {
    runLock = false;
  }
}

/** @internal test helper */
export function __testOnlyHypoThreshold(settings: UserSettings, bgUnits: "mmol/L" | "mg/dL"): number {
  return hypoRangeThreshold(settings, bgUnits);
}
