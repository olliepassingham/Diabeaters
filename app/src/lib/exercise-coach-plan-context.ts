import type { ActiveExerciseSession, ExerciseBgTrend } from "@/lib/storage";
import type { ExercisePlanContext, ExerciseHistoryBias } from "@/lib/exercise-plan";

/** Build {@link ExercisePlanContext} from guided coach session inputs. */
export function buildExercisePlanContextFromCoachSession(input: {
  session: ActiveExerciseSession;
  bgUnits: string;
  currentBg?: number;
  bgTrend?: ExerciseBgTrend | null;
  historyBias?: ExerciseHistoryBias | null;
}): ExercisePlanContext {
  const { session } = input;
  const ctx: ExercisePlanContext = {
    exerciseType: session.exerciseType,
    durationMinutes: session.durationMinutes,
    intensity: session.intensity,
    minutesUntilStart: 30,
    bgUnits: input.bgUnits,
    hourOfDay: new Date().getHours(),
  };

  if (input.currentBg != null && Number.isFinite(input.currentBg)) {
    ctx.currentBg = input.currentBg;
  }
  if (input.bgTrend && input.bgTrend !== "not_sure") {
    ctx.bgTrend = input.bgTrend;
  }

  if (session.preRapidInsulin2h === "yes") ctx.lastInsulinTiming = "lt_1h";
  else if (session.preRapidInsulin2h === "no") ctx.lastInsulinTiming = "none";

  if (session.preSleepHours != null) ctx.sleepHoursLastNight = session.preSleepHours;
  if (session.preHydration) ctx.hydration = session.preHydration;
  if (session.preFeelingOff != null) ctx.feelingOff = session.preFeelingOff;
  if (session.preEnvironments?.length) ctx.environments = [...session.preEnvironments];
  if (session.preCompetitive != null) ctx.competitive = session.preCompetitive;
  if (session.preCaffeine2h != null) ctx.caffeineLast2h = session.preCaffeine2h;
  if (session.preAlcoholLastNight != null) ctx.alcoholLastNight = session.preAlcoholLastNight;
  if (session.preGlp1Last24h != null) ctx.glp1Last24h = session.preGlp1Last24h;
  if (session.preBetaBlockerToday != null) ctx.betaBlockerToday = session.preBetaBlockerToday;
  if (session.preIobUnits != null) ctx.iobUnits = session.preIobUnits;

  if (input.historyBias) {
    ctx.historyBias = input.historyBias;
  }

  if (session.preFasted) {
    ctx.nutritionContext = "fasted";
  } else if (session.prefuelMinutesAgo != null) {
    const mins = session.prefuelMinutesAgo;
    ctx.minutesSinceLastMeal = mins;
    const grams = session.prefuelGrams;
    if (grams != null && grams >= 0) {
      ctx.approximateCarbsGrams = grams;
      ctx.nutritionContext = grams > 0 && grams < 45 ? "snack_only" : "ate_recently";
    } else {
      ctx.nutritionContext = mins <= 90 ? "ate_recently" : undefined;
    }
  }

  return ctx;
}
