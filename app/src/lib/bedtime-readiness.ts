/**
 * Bedtime readiness copy and snack logic — guidance-first, derived from inputs.
 */

export type BedtimeReadinessLevel = "steady" | "monitor" | "alert";
export type BedtimeBgTrend = "rising" | "steady" | "falling" | "not_sure";
export type OvernightUsualTrend = "rise" | "steady" | "fall" | "not_sure";

export const BEDTIME_OVERNIGHT_TREND_STORAGE_KEY = "diabeater_bedtime_overnight_usual_trend";

export interface BedtimePersonalizedCopyInput {
  level: BedtimeReadinessLevel;
  bgDisplay: string;
  bgMmol: number;
  targetLowMmol: number;
  targetHighMmol: number;
  bgTrend: BedtimeBgTrend;
  recentHypos: boolean;
  exercisedToday: boolean;
  /** True when today's session is late, hard, or stacked with other overnight risks. */
  exerciseOvernightCaution: boolean;
  hadAlcohol: boolean;
  foodPhrase: string | null;
  foodHours: number | null;
  foodSelected: boolean;
  bolusPhrase: string | null;
  insulinHours: number | null;
  insulinSelected: boolean;
  carbs: number | null;
  sleepHours: number | null;
  concernCount: number;
  cautionCount: number;
  concernLabels: string[];
  cautionLabels: string[];
  isPumpUser: boolean;
  sickDayActive: boolean;
  sickDaySeverity?: string;
  travelModeActive: boolean;
  travelTimezoneShift?: number | null;
  mdiBasalForBed: "morning" | "evening" | null;
  basalClockSummary: string | null;
  overnightUsualTrend: OvernightUsualTrend;
  usesClosedLoop?: boolean;
  pumpIobUnits?: number | null;
  pumpRecentSiteChange?: boolean;
  pumpDisconnectedRecently?: boolean;
  pumpExerciseActivityOn?: boolean;
}

export interface BedtimeBgGlance {
  display: string;
  trendLabel: string;
  rangeLabel: string;
}

export interface BedtimePersonalizedCopy {
  title: string;
  headline: string;
  bgGlance: BedtimeBgGlance;
  guidance: string[];
  /** Flattened for logs / screen readers */
  messageBullets: string[];
  tips: string[];
  snack: { grams: number; reason: string } | null;
}

export function hoursSinceSelectPhrase(raw: string): string {
  switch (raw) {
    case "0.5":
      return "less than an hour";
    case "1":
      return "about 1 hour";
    case "2":
      return "about 2 hours";
    case "3":
      return "about 3 hours";
    case "4":
      return "four or more hours";
    default:
      return "a while";
  }
}

export function formatBedtimeBgDisplay(bgMmol: number, bgUnits: "mmol/L" | "mg/dL"): string {
  if (bgUnits === "mg/dL") return `${Math.round(bgMmol * 18)} mg/dL`;
  return `${Math.round(bgMmol * 10) / 10} mmol/L`;
}

export function buildBedtimeBgGlance(ctx: BedtimePersonalizedCopyInput): BedtimeBgGlance {
  let rangeLabel = "In range";
  if (ctx.bgMmol < ctx.targetLowMmol - 1) rangeLabel = "Below range";
  else if (ctx.bgMmol < ctx.targetLowMmol) rangeLabel = "Lower end";
  else if (ctx.bgMmol > ctx.targetHighMmol + 3) rangeLabel = "Above range";
  else if (ctx.bgMmol > ctx.targetHighMmol) rangeLabel = "Slightly high";

  const trendLabel =
    ctx.bgTrend === "falling"
      ? "Falling"
      : ctx.bgTrend === "rising"
        ? "Rising"
        : ctx.bgTrend === "steady"
          ? "Stable"
          : "Trend not set";

  return { display: ctx.bgDisplay, trendLabel, rangeLabel };
}

export function isBedtimeBgAboveTarget(bgMmol: number, targetHighMmol: number): boolean {
  return bgMmol > targetHighMmol;
}

export function isBedtimeBgWellAboveTarget(bgMmol: number, targetHighMmol: number): boolean {
  return bgMmol > targetHighMmol + 2;
}

/** True when overnight rise is plausible from trend, pattern, morning MDI, or missed pump basal. */
export function isOvernightRiseLikely(ctx: {
  bgMmol: number;
  targetHighMmol: number;
  bgTrend: BedtimeBgTrend;
  overnightUsualTrend: OvernightUsualTrend;
  mdiBasalForBed: "morning" | "evening" | null;
  isPumpUser: boolean;
  pumpMissedBasal?: boolean;
}): boolean {
  const aboveTarget = isBedtimeBgAboveTarget(ctx.bgMmol, ctx.targetHighMmol);
  if (ctx.overnightUsualTrend === "rise") return true;
  if (ctx.bgTrend === "rising" && aboveTarget) return true;
  if (!ctx.isPumpUser && ctx.mdiBasalForBed === "morning" && ctx.bgTrend !== "falling") return true;
  if (ctx.isPumpUser && ctx.pumpMissedBasal) return true;
  return false;
}

/** Hours after a session when a typical workout still commonly changes the night. */
const BEDTIME_EXERCISE_RECENT_HOURS = 8;
/** Longer sessions keep delayed hypo risk even if they were earlier in the day. */
const BEDTIME_EXERCISE_LONG_MINUTES = 75;

export type BedtimeExerciseSessionHint = {
  endedAt?: string | null;
  intensity?: "light" | "moderate" | "intense" | null;
  durationMinutes?: number | null;
  exerciseType?: string | null;
  feltSymptomsDuring?: boolean;
} | null;

function hoursSinceEnded(endedAt: string | null | undefined, nowMs: number): number | null {
  if (!endedAt?.trim()) return null;
  const t = new Date(endedAt).getTime();
  if (!Number.isFinite(t)) return null;
  return (nowMs - t) / 3_600_000;
}

/**
 * Usual daily training should not, on its own, block “ready for sleep”.
 * Raise overnight caution when the session is recent, hard/long, or stacked with other night risks.
 */
export function bedtimeExerciseRaisesOvernightCaution(input: {
  exercisedToday: boolean;
  bgTrend: BedtimeBgTrend;
  recentHypos: boolean;
  hadAlcohol: boolean;
  session?: BedtimeExerciseSessionHint;
  nowMs?: number;
}): boolean {
  if (!input.exercisedToday) return false;
  if (input.recentHypos || input.hadAlcohol || input.bgTrend === "falling") return true;

  const session = input.session;
  if (!session) return false;

  if (session.feltSymptomsDuring) return true;
  if (session.intensity === "intense" || session.exerciseType === "hiit") return true;
  if ((session.durationMinutes ?? 0) >= BEDTIME_EXERCISE_LONG_MINUTES) return true;

  const hoursAgo = hoursSinceEnded(session.endedAt, input.nowMs ?? Date.now());
  if (hoursAgo != null && hoursAgo >= 0 && hoursAgo <= BEDTIME_EXERCISE_RECENT_HOURS) return true;

  return false;
}

/**
 * Factor counts are a base; this applies bedtime-specific floors and combos
 * (e.g. above-target BG should not read as fully "ready").
 */
export function resolveBedtimeReadinessLevel(input: {
  concernCount: number;
  cautionCount: number;
  bgMmol: number;
  targetHighMmol: number;
  bgTrend: BedtimeBgTrend;
  mdiBasalForBed: "morning" | "evening" | null;
  overnightUsualTrend: OvernightUsualTrend;
  isPumpUser: boolean;
  pumpMissedBasal?: boolean;
}): BedtimeReadinessLevel {
  let level: BedtimeReadinessLevel;
  if (input.concernCount >= 2 || (input.concernCount >= 1 && input.cautionCount >= 2)) {
    level = "alert";
  } else if (input.cautionCount >= 2 || input.concernCount >= 1) {
    level = "monitor";
  } else {
    level = "steady";
  }

  const aboveTarget = isBedtimeBgAboveTarget(input.bgMmol, input.targetHighMmol);
  const wellAbove = isBedtimeBgWellAboveTarget(input.bgMmol, input.targetHighMmol);
  const riseLikely = isOvernightRiseLikely(input);

  if (aboveTarget && level === "steady") level = "monitor";
  if (wellAbove && riseLikely && level === "monitor") level = "alert";
  if (aboveTarget && riseLikely && level === "steady") level = "monitor";

  return level;
}

function buildHeadline(ctx: BedtimePersonalizedCopyInput): string {
  const aboveTarget = isBedtimeBgAboveTarget(ctx.bgMmol, ctx.targetHighMmol);
  const wellAbove = isBedtimeBgWellAboveTarget(ctx.bgMmol, ctx.targetHighMmol);
  const riseLikely = isOvernightRiseLikely(ctx);

  if (ctx.level === "alert") {
    if (aboveTarget && riseLikely) {
      return "Glucose is above target and may climb further overnight — plan before sleep.";
    }
    if (ctx.bgMmol >= ctx.targetLowMmol && ctx.bgMmol <= ctx.targetHighMmol) {
      return "Glucose looks fine now, but overnight risk is elevated from what you shared.";
    }
    if (ctx.bgMmol < ctx.targetLowMmol) {
      return "Glucose is low for your targets — treat and plan an overnight check.";
    }
    return "Several overnight risks are in play — extra caution is sensible tonight.";
  }
  if (ctx.level === "monitor") {
    if (aboveTarget && riseLikely) {
      return "Above target now, with signs you may drift higher overnight.";
    }
    if (aboveTarget) {
      return "Above your target range — worth a plan before you sleep.";
    }
    if (ctx.recentHypos && ctx.concernCount === 1 && ctx.cautionCount === 0) {
      return "A recent hypo warrants caution overnight, even with glucose in range now.";
    }
    return "Mostly on track — a few factors are worth staying aware of overnight.";
  }
  return "Your inputs look reasonable for sleep tonight.";
}

function pushUnique(lines: string[], line: string) {
  if (!lines.includes(line)) lines.push(line);
}

function buildGuidance(ctx: BedtimePersonalizedCopyInput): string[] {
  const lines: string[] = [];

  if (ctx.level === "alert") {
    const aboveTarget = isBedtimeBgAboveTarget(ctx.bgMmol, ctx.targetHighMmol);
    if (aboveTarget) {
      pushUnique(lines, "Glucose is above target — consider whether a cautious bedtime correction fits your plan.");
      if (isOvernightRiseLikely(ctx)) {
        pushUnique(
          lines,
          ctx.mdiBasalForBed === "morning" && !ctx.isPumpUser
            ? "Morning long-acting may leave less overnight coverage — many people on MDI correct before bed when levels are already high."
            : "Levels may keep rising overnight — a recheck before sleep is sensible.",
        );
      } else if (ctx.overnightUsualTrend === "fall") {
        pushUnique(
          lines,
          "You usually drop overnight, so we've kept any correction smaller and aimed a bit higher to protect against a later low.",
        );
      }
    }
    if (ctx.recentHypos && ctx.exerciseOvernightCaution) {
      pushUnique(lines, "Exercise and a recent hypo both raise the chance of lows overnight.");
    } else if (ctx.recentHypos) {
      pushUnique(lines, "A recent hypo means staying alert overnight, even when glucose looks OK now.");
    }
    if (ctx.hadAlcohol) {
      pushUnique(lines, "Alcohol can cause delayed lows — plan an extra check if you can.");
    }
    if (ctx.exerciseOvernightCaution && !ctx.recentHypos) {
      pushUnique(lines, "Exercise today can keep hypo risk higher for many hours.");
    }
    if (ctx.bgTrend === "falling" && !aboveTarget) {
      pushUnique(lines, "A falling trend may continue overnight — keep treatment close.");
    }
    if (ctx.foodSelected && ctx.foodHours != null && ctx.foodHours < 2 && ctx.foodPhrase) {
      pushUnique(lines, `Food was only ${ctx.foodPhrase} ago — glucose may still move before sleep.`);
    }
    if (ctx.insulinSelected && ctx.insulinHours != null && ctx.insulinHours < 2 && ctx.bolusPhrase) {
      pushUnique(lines, `Mealtime insulin ${ctx.bolusPhrase} ago may still be active — avoid over-correcting.`);
    }
    if (ctx.isPumpUser && (ctx.pumpIobUnits ?? 0) >= 1.5) {
      pushUnique(lines, "Pump IOB is still significant — avoid stacking a bedtime correction on active insulin.");
    }
    if (ctx.pumpDisconnectedRecently) {
      pushUnique(lines, "Missed basal while disconnected can let glucose climb — recheck before sleep.");
    }
    if (ctx.pumpRecentSiteChange) {
      pushUnique(lines, "A fresh site can absorb unpredictably for a few hours — recheck if glucose moves.");
    }
    if (ctx.sleepHours != null && ctx.sleepHours > 1) {
      pushUnique(lines, "Recheck right before bed — you still have time for glucose to shift.");
    }
    pushUnique(lines, "Set a small-hours reminder if you can (many people use around 2–3am).");
    pushUnique(lines, "Keep fast-acting glucose beside the bed.");
    if (ctx.bgMmol < ctx.targetLowMmol) {
      pushUnique(lines, "Consider a small snack before sleep if that matches your care plan.");
    }
    return lines.slice(0, 4);
  }

  if (ctx.level === "monitor") {
    const aboveTarget = isBedtimeBgAboveTarget(ctx.bgMmol, ctx.targetHighMmol);
    const riseLikely = isOvernightRiseLikely(ctx);

    if (aboveTarget) {
      pushUnique(
        lines,
        "You are above target before sleep — staying in range overnight usually needs a plan, not waiting it out.",
      );
      if (riseLikely) {
        pushUnique(
          lines,
          ctx.mdiBasalForBed === "morning" && !ctx.isPumpUser
            ? "Morning long-acting can mean less coverage overnight for many people on MDI — a cautious correction may fit your plan."
            : "Your trend or usual overnight pattern suggests levels may climb — recheck before sleep.",
        );
      } else if (ctx.overnightUsualTrend === "fall") {
        pushUnique(
          lines,
          "You usually drop overnight, so we've kept any correction smaller and aimed a bit higher to protect against a later low.",
        );
      } else {
        pushUnique(lines, "If you usually correct at bedtime, use your care team's approach — we show a cautious estimate when your settings allow.");
      }
      if (ctx.bgTrend === "rising") {
        pushUnique(lines, "Glucose is still rising — a recheck in 30–60 minutes can confirm the direction.");
      }
    }

    if (ctx.recentHypos) {
      pushUnique(lines, "Keep hypo treatment within reach — a recent hypo increases overnight risk.");
    }
    if (ctx.exerciseOvernightCaution) {
      pushUnique(lines, "Have a snack nearby in case exercise-related lows appear overnight.");
    }
    if (ctx.hadAlcohol) {
      pushUnique(lines, "Alcohol can delay lows — a gentle overnight check is reasonable.");
    }
    if (ctx.bgTrend === "falling" && !aboveTarget) {
      pushUnique(lines, "Falling glucose now — recheck before sleep or keep carbs handy.");
    }
    if (ctx.foodSelected && ctx.foodHours != null && ctx.foodHours < 2 && ctx.foodPhrase) {
      pushUnique(lines, `Digestion may still be raising glucose (food ${ctx.foodPhrase} ago).`);
    }
    if (ctx.insulinSelected && ctx.insulinHours != null && ctx.insulinHours < 2 && ctx.bolusPhrase) {
      pushUnique(lines, `Active mealtime insulin (${ctx.bolusPhrase} ago) may still lower glucose.`);
    }
    if (ctx.isPumpUser && (ctx.pumpIobUnits ?? 0) >= 1.5) {
      pushUnique(lines, "Pump IOB is still working — a smaller or no correction is often safer.");
    }
    if (ctx.pumpDisconnectedRecently) {
      pushUnique(lines, "Time off the pump can mean missed basal — watch for a rise.");
    }
    if (ctx.pumpExerciseActivityOn) {
      pushUnique(lines, "Exercise or temp target still on at bedtime can keep insulin lower overnight.");
    }
    if (ctx.sleepHours != null && ctx.sleepHours > 1.5) {
      pushUnique(lines, "Run this check again closer to lights-out.");
    }
    if (ctx.hadAlcohol || ctx.recentHypos || ctx.exerciseOvernightCaution || ctx.bgTrend === "falling") {
      pushUnique(lines, "Consider setting a phone alarm for an overnight glucose check.");
    }
    if (lines.length === 0) {
      pushUnique(lines, "Stay mindful overnight and follow your usual plan if you feel unwell.");
    } else if (!aboveTarget) {
      pushUnique(lines, "Follow your care plan if you feel low — this is guidance, not dosing advice.");
    }
    return lines.slice(0, 4);
  }

  const aboveTarget = isBedtimeBgAboveTarget(ctx.bgMmol, ctx.targetHighMmol);
  if (aboveTarget) {
    pushUnique(lines, "Glucose is above target — this check would normally flag a bedtime plan.");
  } else {
    pushUnique(lines, "Nothing major flagged from this check — trust how you feel.");
  }
  if (ctx.bgTrend === "rising") {
    pushUnique(lines, "Glucose is rising — a quick recheck before sleep is sensible.");
  }
  if (!ctx.foodSelected || !ctx.insulinSelected) {
    pushUnique(lines, "Adding food and insulin timing next time sharpens overnight advice.");
  }
  return lines.slice(0, 3);
}

/**
 * A carb snack is a hypo-prevention tool. It should never be suggested when glucose is already
 * above the target range — a snack in that situation would push levels higher, which is exactly
 * the mistake this function used to make when a momentary "falling" arrow was read in isolation.
 * A bedtime correction (see bedtime-correction-dose.ts) is the coherent alternative when BG is
 * high, so the two recommendations are mutually exclusive by construction.
 */
export function resolveBedtimeSnack(ctx: BedtimePersonalizedCopyInput): { grams: number; reason: string } | null {
  const aboveTarget = ctx.bgMmol > ctx.targetHighMmol;
  if (aboveTarget) return null;

  if (ctx.bgMmol < ctx.targetLowMmol) {
    return {
      grams: 10,
      reason: "Below your target range",
    };
  }
  if (ctx.bgTrend === "falling") {
    return {
      grams: 5,
      reason: "Falling trend overnight",
    };
  }
  if (ctx.overnightUsualTrend === "fall" && ctx.bgMmol < ctx.targetLowMmol + 1) {
    return {
      grams: 5,
      reason: "You usually drop overnight and are near the low end of range",
    };
  }
  if (ctx.recentHypos && ctx.bgMmol < ctx.targetLowMmol + 1) {
    return {
      grams: 5,
      reason: "Recent hypo with glucose on the lower side",
    };
  }
  if (ctx.recentHypos && ctx.exercisedToday && ctx.hadAlcohol) {
    return {
      grams: 5,
      reason: "Recent hypo with exercise and alcohol",
    };
  }
  if (ctx.recentHypos && ctx.exercisedToday) {
    return {
      grams: 5,
      reason: "Recent hypo after exercise today",
    };
  }
  if (ctx.recentHypos && ctx.hadAlcohol) {
    return {
      grams: 5,
      reason: "Recent hypo with alcohol",
    };
  }
  return null;
}

function buildTips(ctx: BedtimePersonalizedCopyInput): string[] {
  const tips: string[] = [];

  if (ctx.level === "alert") {
    if (ctx.isPumpUser && ctx.hadAlcohol) tips.push("Check pump IOB before any correction at night");
    if (ctx.isPumpUser && ctx.exerciseOvernightCaution && !ctx.usesClosedLoop) {
      tips.push("Some teams use a slightly lower temp basal overnight after exercise — only if yours agrees");
    }
    if (ctx.usesClosedLoop) {
      tips.push("If Sleep activity is on, let the loop work overnight rather than stacking a manual correction");
    }
  }

  if (ctx.level === "monitor" || ctx.level === "alert") {
    tips.push("If you wake feeling off, check glucose before going back to sleep");
  }

  if (ctx.level === "steady" && ctx.exercisedToday) {
    tips.push("You trained today — keep carbs nearby if nights after exercise sometimes dip");
  }

  if (ctx.level === "steady" && ctx.isPumpUser) {
    tips.push(
      ctx.usesClosedLoop
        ? "Your loop basal carries overnight unless Sleep or Exercise activity is set differently"
        : "Your pump basal carries overnight unless you have changed temp basals",
    );
  } else if (ctx.level === "steady" && ctx.mdiBasalForBed === "evening" && ctx.basalClockSummary) {
    tips.push(`Evening long-acting (around ${ctx.basalClockSummary}) often supports steadier nights on MDI`);
  }

  return tips;
}

export function buildBedtimePersonalizedCopy(ctx: BedtimePersonalizedCopyInput): BedtimePersonalizedCopy {
  const bgGlance = buildBedtimeBgGlance(ctx);
  const headline = buildHeadline(ctx);
  const guidance = buildGuidance(ctx);
  const tips = buildTips(ctx);
  const snack = resolveBedtimeSnack(ctx);

  const title =
    ctx.level === "alert"
      ? "Extra attention overnight"
      : ctx.level === "monitor"
        ? isBedtimeBgAboveTarget(ctx.bgMmol, ctx.targetHighMmol)
          ? "Above target before bed"
          : "Worth keeping an eye on"
        : "Looking good for sleep";

  return {
    title,
    headline,
    bgGlance,
    guidance,
    messageBullets: [headline, ...guidance],
    tips,
    snack,
  };
}
