/**
 * Meal & ratios "meal impact" predictor — a rule-based, offline engine that turns a
 * quick description of a meal's composition into a typical absorption pattern
 * (quick spike vs slow release) plus qualitative management tips.
 *
 * Deliberately not personalized or clinical: no food database, no numeric dosing
 * changes, no claims about a user's exact response. Always framed as "typical
 * pattern only" — consistent with the rest of the app's meal tools.
 */

export type MealCarbType = "liquid_sugars" | "quick_refined" | "fruit" | "starchy" | "balanced" | "unsure";

export const MEAL_CARB_TYPE_OPTIONS: { value: MealCarbType; label: string; hint: string }[] = [
  { value: "liquid_sugars", label: "Sugary drink or juice", hint: "Fastest-acting" },
  { value: "quick_refined", label: "Refined carbs", hint: "White bread, cereal, sweets" },
  { value: "fruit", label: "Mostly fruit", hint: "Natural sugars + some fibre" },
  { value: "starchy", label: "Starchy", hint: "Pasta, rice, potatoes" },
  { value: "balanced", label: "Balanced plate", hint: "Carb + veg + some protein" },
  { value: "unsure", label: "Not sure / mixed", hint: "We'll assume a typical mix" },
];

export type MealComposition = {
  carbType: MealCarbType;
  hasFat: boolean;
  hasProtein: boolean;
  hasFibre: boolean;
};

export const DEFAULT_MEAL_COMPOSITION: MealComposition = {
  carbType: "balanced",
  hasFat: false,
  hasProtein: false,
  hasFibre: false,
};

export type MealImpactPattern = "quick_spike" | "fast_rise" | "steady_rise" | "slow_extended" | "spike_then_tail";

export type MealImpactChartParams = {
  /** Total time window shown on the illustrative curve, in hours. */
  totalHours: number;
  peakTimeHours: number;
  peakSigma: number;
  /** 0-1, relative height of the main peak. */
  peakHeight: number;
  tailTimeHours?: number;
  tailSigma?: number;
  /** 0-1, relative height of the delayed second rise, when present. */
  tailHeight?: number;
};

export type MealImpactProfile = {
  composition: MealComposition;
  pattern: MealImpactPattern;
  patternLabel: string;
  /** Short label for when the main rise typically peaks, e.g. "~15-30 min". */
  peakWindowLabel: string;
  /** True when fat is present — digestion slows and a delayed second rise is common. */
  tailRisk: boolean;
  /** Short label for the delayed-rise window, only set when tailRisk is true. */
  tailWindowLabel?: string;
  /** 0 (fast) to 1 (slow) — drives the Fast/Slow visual language used elsewhere in the app. */
  slowScore: number;
  managementTips: string[];
  chart: MealImpactChartParams;
};

type CarbTypeBase = {
  slowScore: number;
  peakHours: number;
  sigma: number;
};

const CARB_TYPE_BASE: Record<MealCarbType, CarbTypeBase> = {
  liquid_sugars: { slowScore: 0.04, peakHours: 0.35, sigma: 0.2 },
  quick_refined: { slowScore: 0.16, peakHours: 0.55, sigma: 0.28 },
  fruit: { slowScore: 0.26, peakHours: 0.7, sigma: 0.32 },
  starchy: { slowScore: 0.4, peakHours: 1.0, sigma: 0.42 },
  balanced: { slowScore: 0.5, peakHours: 1.3, sigma: 0.5 },
  unsure: { slowScore: 0.5, peakHours: 1.1, sigma: 0.45 },
};

const PATTERN_LABELS: Record<MealImpactPattern, string> = {
  quick_spike: "Quick spike",
  fast_rise: "Fast rise",
  steady_rise: "Steady rise",
  slow_extended: "Slow & extended",
  spike_then_tail: "Spike, then a delayed tail",
};

const PEAK_WINDOW_LABELS: Record<MealImpactPattern, string> = {
  quick_spike: "~15-30 min",
  fast_rise: "~30-60 min",
  steady_rise: "~1-2 h",
  slow_extended: "~2-4 h",
  spike_then_tail: "~20-45 min",
};

const TAIL_WINDOW_LABEL = "~3-6 h later";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Classifies the pattern using both the carb type's own speed (before fat/protein
 * adjustments) and the final adjusted score — so a fast carb (e.g. chocolate, a
 * sugary drink with cream) eaten alongside fat still reads as "spike, then a
 * delayed tail" rather than being averaged down into a generic "steady rise".
 */
function classifyPattern(baseSlowScore: number, adjustedSlowScore: number, tailRisk: boolean): MealImpactPattern {
  const isFastBaseCarb = baseSlowScore < 0.2;
  if (tailRisk && isFastBaseCarb) return "spike_then_tail";
  if (adjustedSlowScore < 0.15) return "quick_spike";
  if (adjustedSlowScore < 0.35) return "fast_rise";
  if (adjustedSlowScore < 0.62) return "steady_rise";
  return "slow_extended";
}

function buildManagementTips(pattern: MealImpactPattern, tailRisk: boolean, hasFibre: boolean): string[] {
  const tips: string[] = [];

  switch (pattern) {
    case "quick_spike":
    case "fast_rise":
      tips.push(
        "Fast-digesting carbs like this often raise glucose quickly — many people pre-bolus a little before eating so insulin has time to start working. Your diabetes team sets your exact timing.",
      );
      tips.push("Check BG 1-2 hours after this meal to see how it's tracking.");
      break;
    case "steady_rise":
      tips.push(
        "A more balanced meal like this tends to raise glucose gradually — a normal bolus at the start of the meal usually lines up reasonably well.",
      );
      break;
    case "slow_extended":
    case "spike_then_tail":
      tips.push(
        "Fat and protein slow digestion and can push some of the rise hours later than usual — the split-dose calculator can help spread insulin to match.",
      );
      tips.push("Set a reminder to check BG 3-5 hours after this meal, not just at the usual 2-hour mark.");
      break;
  }

  if (tailRisk) {
    tips.push("Watch for a possible delayed rise several hours later — this is common after fatty meals like pizza, curry, or takeaway.");
  }

  if (hasFibre) {
    tips.push("Fibre can smooth out the rise a little, but the total carbs still matter most for your dose.");
  }

  tips.push("Typical pattern only — everyone's response varies, so use your own BG checks to see what's real for you.");

  return tips;
}

function buildChartParams(
  pattern: MealImpactPattern,
  peakHours: number,
  sigma: number,
  slowScore: number,
  tailRisk: boolean,
): MealImpactChartParams {
  const peakHeight = clamp(1 - slowScore * 0.4, 0.55, 0.97);

  if (!tailRisk) {
    return {
      totalHours: 4,
      peakTimeHours: peakHours,
      peakSigma: sigma,
      peakHeight,
    };
  }

  const tailTimeHours = Math.min(5.6, peakHours + 3.2);
  return {
    totalHours: 6,
    peakTimeHours: peakHours,
    peakSigma: sigma,
    peakHeight,
    tailTimeHours,
    tailSigma: 0.9,
    tailHeight: pattern === "spike_then_tail" ? 0.5 : 0.4,
  };
}

/** Computes a typical absorption pattern + management tips from a meal's composition. */
export function computeMealImpact(composition: MealComposition): MealImpactProfile {
  const base = CARB_TYPE_BASE[composition.carbType];

  let slowScore = base.slowScore;
  let peakHours = base.peakHours;
  let sigma = base.sigma;

  if (composition.hasFat) {
    slowScore += 0.28;
    peakHours += 0.4;
    sigma += 0.25;
  }
  if (composition.hasProtein) {
    slowScore += 0.12;
    peakHours += 0.15;
    sigma += 0.1;
  }
  if (composition.hasFibre) {
    slowScore -= 0.08;
    sigma += 0.05;
  }

  slowScore = clamp(slowScore, 0.03, 0.95);
  peakHours = clamp(peakHours, 0.25, 3);
  sigma = clamp(sigma, 0.2, 1.1);

  const tailRisk = composition.hasFat;
  const pattern = classifyPattern(base.slowScore, slowScore, tailRisk);

  return {
    composition,
    pattern,
    patternLabel: PATTERN_LABELS[pattern],
    peakWindowLabel: PEAK_WINDOW_LABELS[pattern],
    tailRisk,
    tailWindowLabel: tailRisk ? TAIL_WINDOW_LABEL : undefined,
    slowScore,
    managementTips: buildManagementTips(pattern, tailRisk, composition.hasFibre),
    chart: buildChartParams(pattern, peakHours, sigma, slowScore, tailRisk),
  };
}

/** Short human-readable summary for activity logs, e.g. "Balanced plate + fat + protein". */
export function mealCompositionSummaryLabel(composition: MealComposition): string {
  const base = MEAL_CARB_TYPE_OPTIONS.find((o) => o.value === composition.carbType)?.label ?? composition.carbType;
  const extras: string[] = [];
  if (composition.hasFat) extras.push("fat");
  if (composition.hasProtein) extras.push("protein");
  if (composition.hasFibre) extras.push("fibre");
  return extras.length > 0 ? `${base} + ${extras.join(" + ")}` : base;
}
