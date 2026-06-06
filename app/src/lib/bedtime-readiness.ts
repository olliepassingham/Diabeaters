/**
 * Bedtime readiness copy and snack logic — guidance-first, derived from inputs.
 */

export type BedtimeReadinessLevel = "steady" | "monitor" | "alert";
export type BedtimeBgTrend = "rising" | "steady" | "falling" | "not_sure";

export interface BedtimePersonalizedCopyInput {
  level: BedtimeReadinessLevel;
  bgDisplay: string;
  bgMmol: number;
  targetLowMmol: number;
  targetHighMmol: number;
  bgTrend: BedtimeBgTrend;
  recentHypos: boolean;
  exercisedToday: boolean;
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

function buildHeadline(ctx: BedtimePersonalizedCopyInput): string {
  if (ctx.level === "alert") {
    if (ctx.bgMmol >= ctx.targetLowMmol && ctx.bgMmol <= ctx.targetHighMmol) {
      return "Glucose looks fine now, but overnight risk is elevated from what you shared.";
    }
    if (ctx.bgMmol < ctx.targetLowMmol) {
      return "Glucose is low for your targets — treat and plan an overnight check.";
    }
    return "Several overnight risks are in play — extra caution is sensible tonight.";
  }
  if (ctx.level === "monitor") {
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
    if (ctx.recentHypos && ctx.exercisedToday) {
      pushUnique(lines, "Exercise and a recent hypo both raise the chance of lows overnight.");
    } else if (ctx.recentHypos) {
      pushUnique(lines, "A recent hypo means staying alert overnight, even when glucose looks OK now.");
    }
    if (ctx.hadAlcohol) {
      pushUnique(lines, "Alcohol can cause delayed lows — plan an extra check if you can.");
    }
    if (ctx.exercisedToday && !ctx.recentHypos) {
      pushUnique(lines, "Exercise today can keep hypo risk higher for many hours.");
    }
    if (ctx.bgTrend === "falling") {
      pushUnique(lines, "A falling trend may continue overnight — keep treatment close.");
    }
    if (ctx.foodSelected && ctx.foodHours != null && ctx.foodHours < 2 && ctx.foodPhrase) {
      pushUnique(lines, `Food was only ${ctx.foodPhrase} ago — glucose may still move before sleep.`);
    }
    if (ctx.insulinSelected && ctx.insulinHours != null && ctx.insulinHours < 2 && ctx.bolusPhrase) {
      pushUnique(lines, `Mealtime insulin ${ctx.bolusPhrase} ago may still be active — avoid over-correcting.`);
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
    if (ctx.recentHypos) {
      pushUnique(lines, "Keep hypo treatment within reach — a recent hypo increases overnight risk.");
    }
    if (ctx.exercisedToday) {
      pushUnique(lines, "Have a snack nearby in case exercise-related lows appear overnight.");
    }
    if (ctx.hadAlcohol) {
      pushUnique(lines, "Alcohol can delay lows — a gentle overnight check is reasonable.");
    }
    if (ctx.bgTrend === "falling") {
      pushUnique(lines, "Falling glucose now — recheck before sleep or keep carbs handy.");
    }
    if (ctx.foodSelected && ctx.foodHours != null && ctx.foodHours < 2 && ctx.foodPhrase) {
      pushUnique(lines, `Digestion may still be raising glucose (food ${ctx.foodPhrase} ago).`);
    }
    if (ctx.insulinSelected && ctx.insulinHours != null && ctx.insulinHours < 2 && ctx.bolusPhrase) {
      pushUnique(lines, `Active mealtime insulin (${ctx.bolusPhrase} ago) may still lower glucose.`);
    }
    if (ctx.sleepHours != null && ctx.sleepHours > 1.5) {
      pushUnique(lines, "Run this check again closer to lights-out.");
    }
    if (ctx.hadAlcohol || ctx.recentHypos || ctx.exercisedToday || ctx.bgTrend === "falling") {
      pushUnique(lines, "Consider setting a phone alarm for an overnight glucose check.");
    }
    if (lines.length === 0) {
      pushUnique(lines, "Stay mindful overnight and follow your usual plan if you feel unwell.");
    } else {
      pushUnique(lines, "Follow your care plan if you feel low — this is guidance, not dosing advice.");
    }
    return lines.slice(0, 4);
  }

  pushUnique(lines, "Nothing major flagged from this check — trust how you feel.");
  if (ctx.bgTrend === "rising") {
    pushUnique(lines, "Glucose is rising — a quick recheck before sleep is sensible.");
  }
  if (!ctx.foodSelected || !ctx.insulinSelected) {
    pushUnique(lines, "Adding food and insulin timing next time sharpens overnight advice.");
  }
  return lines.slice(0, 3);
}

export function resolveBedtimeSnack(ctx: BedtimePersonalizedCopyInput): { grams: number; reason: string } | null {
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
    if (ctx.isPumpUser && ctx.exercisedToday) {
      tips.push("Some teams use a slightly lower temp basal overnight after exercise — only if yours agrees");
    }
  }

  if (ctx.level === "monitor" || ctx.level === "alert") {
    tips.push("If you wake feeling off, check glucose before going back to sleep");
  }

  if (ctx.level === "steady" && ctx.isPumpUser) {
    tips.push("Your pump basal carries overnight unless you have changed temp basals");
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
        ? "Worth keeping an eye on"
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
