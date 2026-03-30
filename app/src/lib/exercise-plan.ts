/**
 * Rule-based exercise planning copy — not medical advice.
 * Heuristics are conservative; users must confirm with their care team.
 */

export interface ExercisePlanResult {
  duration: number;
  intensity: string;
  exerciseType: string;
  summary: string;
  pre: {
    targetBg: string;
    lowThreshold: string;
    carbsIfLow: number;
    bolusReduction: string;
    snackIdeas: string[];
    timing: string;
    /** Food/insulin context — shown above generic pre rows. */
    contextualNotes?: string[];
  };
  during: {
    carbsNeeded: number;
    needsCarbs: boolean;
    carbFrequency: string;
    checkBg: boolean;
    tips: string[];
  };
  post: {
    carbs: number;
    protein: string;
    bolusReduction: string;
    snackIdeas: string[];
    timing: string;
  };
  recovery: {
    monitorHours: string;
    tips: string[];
  };
  pumpTips: {
    pre: string[];
    during: string[];
    post: string[];
    recovery: string[];
  };
}

/** Nutrition pattern relative to the session (optional in UI). */
export type ExerciseNutritionContext = "fasted" | "ate_recently" | "about_to_eat" | "snack_only";

/** Time since last bolus or meal insulin (optional). */
export type LastInsulinTiming = "none" | "lt_1h" | "h1_2" | "h2_4" | "gt_4h";

export interface ExercisePlanContext {
  /** Planner keys: cardio, strength, hiit, yoga, walking, sports, swimming */
  exerciseType: string;
  durationMinutes: number;
  intensity: "light" | "moderate" | "intense";
  /** Minutes until session starts (from "Starting in…"). */
  minutesUntilStart: number;
  bgUnits?: string;
  nutritionContext?: ExerciseNutritionContext;
  /** When ate_recently / snack_only: minutes since last meal or snack. */
  minutesSinceLastMeal?: number;
  /** When about_to_eat: minutes until planned meal. */
  minutesUntilNextMeal?: number;
  approximateCarbsGrams?: number;
  lastInsulinTiming?: LastInsulinTiming;
  /** Current BG if user entered it. */
  currentBg?: number;
  /** Local hour 0–23 for evening / overnight recovery copy. */
  hourOfDay?: number;
}

const EXERCISE_LABELS: Record<string, string> = {
  cardio: "Cardio",
  strength: "Strength",
  hiit: "HIIT",
  yoga: "Yoga",
  walking: "Walking",
  swimming: "Swimming",
  sports: "Sports",
  exercise: "Exercise",
};

function normalizeType(key: string): string {
  const k = key.toLowerCase();
  if (k === "hiit") return "HIIT";
  return EXERCISE_LABELS[k] ? k : "exercise";
}

function displayType(key: string): string {
  const k = key.toLowerCase();
  if (k === "hiit") return "HIIT";
  return EXERCISE_LABELS[k] || key;
}

function isBgLow(value: number, bgUnits: string): boolean {
  return bgUnits === "mmol/L" ? value < 5.6 : value < 100;
}

function isBgHigh(value: number, bgUnits: string): boolean {
  return bgUnits === "mmol/L" ? value > 13.9 : value > 250;
}

/** Recent meal insulin on board — higher hypo risk during activity. */
function hasRecentInsulin(timing: LastInsulinTiming | undefined): boolean {
  return timing === "lt_1h" || timing === "h1_2";
}

function hasModerateInsulin(timing: LastInsulinTiming | undefined): boolean {
  return timing === "h2_4";
}

function baseCarbsAndBolus(
  intensity: "light" | "moderate" | "intense",
  duration: number,
): { preExerciseCarbs: number; duringCarbs: number; postExerciseCarbs: number; bolusReduction: string } {
  let preExerciseCarbs = 0;
  let duringCarbs = 0;
  let postExerciseCarbs = 0;
  let bolusReduction = "";

  switch (intensity) {
    case "light":
      preExerciseCarbs = duration < 30 ? 0 : 15;
      duringCarbs = duration > 60 ? 15 : 0;
      postExerciseCarbs = 15;
      bolusReduction = "15-25%";
      break;
    case "moderate":
      preExerciseCarbs = duration < 20 ? 10 : 20;
      duringCarbs = duration > 45 ? Math.round(duration / 30) * 15 : 0;
      postExerciseCarbs = 20;
      bolusReduction = "25-35%";
      break;
    case "intense":
      preExerciseCarbs = 25;
      duringCarbs = duration > 30 ? Math.round(duration / 30) * 20 : 0;
      postExerciseCarbs = 30;
      bolusReduction = "35-50%";
      break;
  }
  return { preExerciseCarbs, duringCarbs, postExerciseCarbs, bolusReduction };
}

function pumpTipsForIntensity(intensity: "light" | "moderate" | "intense"): ExercisePlanResult["pumpTips"] {
  if (intensity === "light") {
    return {
      pre: ["Consider a 20-30% temporary basal reduction starting 60 min before"],
      during: ["Your pump's current basal may be sufficient for light activity"],
      post: ["Resume normal basal rate after light exercise"],
      recovery: ["No overnight basal change typically needed for light exercise"],
    };
  }
  if (intensity === "moderate") {
    return {
      pre: ["Set a temporary basal rate at 50-70% (30-50% reduction) starting 60-90 min before exercise"],
      during: ["If BG drops below target, reduce or suspend temp basal"],
      post: ["Keep temp basal running at 70-80% for 1-2 hours after exercise"],
      recovery: ["Consider running basal at 80-90% overnight if exercised in the evening"],
    };
  }
  return {
    pre: ["Set a temporary basal rate at 30-50% (50-70% reduction) starting 60-90 min before exercise"],
    during: [
      "Be ready to suspend pump briefly if BG drops rapidly",
      "Some people disconnect for water sports - discuss with your team first",
    ],
    post: ["Keep temp basal at 60-70% for 2-3 hours post-exercise"],
    recovery: ["Run basal at 70-80% overnight - intense exercise increases hypo risk for up to 24 hours"],
  };
}

/**
 * Primary API: structured exercise + optional food/insulin context.
 */
export function calculateExercisePlan(context: ExercisePlanContext, _settings?: unknown): ExercisePlanResult {
  const bgUnits = context.bgUnits || "mmol/L";
  const duration = Math.max(5, Math.min(300, Math.round(context.durationMinutes || 45)));
  const intensity = context.intensity;
  const typeKey = normalizeType(context.exerciseType);

  let { preExerciseCarbs, duringCarbs, postExerciseCarbs, bolusReduction } = baseCarbsAndBolus(intensity, duration);

  // Fasted + harder effort: small bump to "if low" carb suggestion floor (not a meal replacement).
  if (context.nutritionContext === "fasted" && intensity !== "light") {
    preExerciseCarbs = Math.max(preExerciseCarbs, 10);
  }

  // Large recent meal + carbs reported: slight bump to "have carbs ready" during long sessions.
  const carbs = context.approximateCarbsGrams;
  if (carbs != null && carbs >= 60 && duration > 40 && (context.nutritionContext === "ate_recently" || context.nutritionContext === "snack_only")) {
    duringCarbs = Math.max(duringCarbs, 15);
  }

  // Recent insulin + moderate/heavy activity: ensure user has glucose on hand.
  if (hasRecentInsulin(context.lastInsulinTiming) && (intensity === "moderate" || intensity === "intense")) {
    duringCarbs = Math.max(duringCarbs, 15);
  }

  const idealStart = bgUnits === "mmol/L" ? "7-10" : "126-180";
  const lowThreshold = bgUnits === "mmol/L" ? "5.6" : "100";

  let preTimingShort =
    context.minutesUntilStart >= 90 ? "Planning ahead" : context.minutesUntilStart >= 45 ? "30–60 min before" : "Starting soon";

  let snackPre = ["Banana", "Toast with peanut butter", "Oat bar"];
  if (context.nutritionContext === "fasted") {
    snackPre = ["Small fruit", "Crackers", "Half a sports drink"];
  }
  if (context.nutritionContext === "snack_only") {
    snackPre = ["Rice cakes", "Fruit", "Yoghurt"];
  }

  const preTips: string[] = [];
  if (context.minutesUntilStart >= 90) {
    preTips.push("You have lead time — use it to steady BG and discuss adjustments with your team if unsure.");
  } else if (context.minutesUntilStart < 45) {
    preTips.push("Starting soon — prioritise in-range BG and quick fuel if needed.");
  }
  if (context.currentBg != null && !Number.isNaN(context.currentBg)) {
    if (isBgLow(context.currentBg, bgUnits)) {
      preTips.push(
        "Treat low BG before starting — delay exercise until you are safely back in range (confirm targets with your care team).",
      );
    } else if (isBgHigh(context.currentBg, bgUnits)) {
      preTips.push("If BG is high, follow your team's advice on ketones and fluids before intense effort.");
    }
  }

  if (hasRecentInsulin(context.lastInsulinTiming) && (intensity === "moderate" || intensity === "intense")) {
    preTips.push(
      "Recent meal or correction insulin may still be active — activity can drop BG faster. Avoid stacking aggressive bolus changes unless your team has taught you how.",
    );
  } else if (hasModerateInsulin(context.lastInsulinTiming) && intensity === "intense") {
    preTips.push("Some insulin may still be on board — keep extra fast carbs within reach.");
  }

  if (context.nutritionContext === "fasted" && intensity !== "light") {
    preTips.push("Training fasted: a small carb buffer before harder work can help some people — ask your team what fits your plan.");
  }

  if (context.nutritionContext === "ate_recently" && context.minutesSinceLastMeal != null) {
    preTips.push(
      `About ${context.minutesSinceLastMeal} min since eating — digestion and insulin tail still matter for how BG moves when you move.`,
    );
  }

  if (context.nutritionContext === "about_to_eat" && context.minutesUntilNextMeal != null) {
    preTips.push(
      `Meal in ~${context.minutesUntilNextMeal} min — coordinate bolus and exercise timing with your team so fuel and insulin line up safely.`,
    );
  }

  if (carbs != null && carbs > 0) {
    preTips.push(`You noted ~${carbs}g carbs — pair any bolus changes with your usual ratios and what your team recommends for activity.`);
  }

  if (context.minutesUntilStart >= 75 && intensity !== "light") {
    preTips.push("Extra lead time: good window to set temp basal or snack plan if your team uses those strategies.");
  }

  const duringTips: string[] = [];
  if (duringCarbs > 0) {
    duringTips.push(`Have ${duringCarbs}g fast-acting carbs ready`);
    duringTips.push("Take ~15g if BG starts dropping");
    if (duration > 45) duringTips.push("Check BG around the halfway mark");
  } else {
    duringTips.push("You may not need extra carbs for this session");
    duringTips.push("Keep 15–20g fast glucose nearby just in case");
  }

  if (hasRecentInsulin(context.lastInsulinTiming)) {
    duringTips.push("Insulin on board can make drops feel faster — check earlier than usual if something feels off.");
  }

  let postTiming = "Within 30-60 min after";
  let postSnack = ["Chocolate milk", "Greek yoghurt", "Sandwich"];
  if (context.nutritionContext === "about_to_eat") {
    postTiming = "Line up recovery fuel with your next meal — your team can help you balance bolus for both exercise and food.";
    postSnack = ["Meal with carbs and protein", "Sandwich", "Balanced plate"];
  }

  const recoveryTips = [
    "Monitor BG closely for delayed lows",
    "Consider a small bedtime snack to prevent overnight lows",
    "Have a protein-carb snack before bed if you exercised in the evening",
    "Stay hydrated — dehydration affects BG readings",
  ];

  const hour = context.hourOfDay;
  if (hour != null && hour >= 17 && intensity === "intense") {
    recoveryTips.unshift("Evening hard sessions often raise overnight hypo risk — plan extra checks or snacks if your team agrees.");
  }

  if (hasRecentInsulin(context.lastInsulinTiming) || intensity === "intense") {
    recoveryTips.push("IOB and muscle uptake can interact for many hours — err on the side of more checks after hard or insulin-heavy days.");
  }

  const pumpTips = pumpTipsForIntensity(intensity);
  if (context.minutesUntilStart >= 90 && intensity !== "light") {
    pumpTips.pre = [
      `With ~${context.minutesUntilStart} min until start, you have time to start or adjust a temporary basal as discussed with your team.`,
      ...pumpTips.pre,
    ];
  }

  const summaryParts = [`${duration} min`, intensity, displayType(typeKey)];
  if (context.nutritionContext) {
    const n = { fasted: "fasted", ate_recently: "after recent food", about_to_eat: "before a meal", snack_only: "light snack context" }[context.nutritionContext];
    summaryParts.push(`(${n})`);
  }

  return {
    duration,
    intensity,
    exerciseType: displayType(typeKey),
    summary: summaryParts.join(" "),
    pre: {
      targetBg: idealStart,
      lowThreshold,
      carbsIfLow: preExerciseCarbs,
      bolusReduction,
      snackIdeas: snackPre,
      timing: preTimingShort,
      contextualNotes: preTips.length > 0 ? preTips : undefined,
    },
    during: {
      carbsNeeded: duringCarbs,
      needsCarbs: duringCarbs > 0,
      carbFrequency: "every 30-45 min",
      checkBg: duration > 45 || hasRecentInsulin(context.lastInsulinTiming),
      tips: duringTips,
    },
    post: {
      carbs: postExerciseCarbs,
      protein: "15-20g",
      bolusReduction,
      snackIdeas: postSnack,
      timing: postTiming,
    },
    recovery: {
      monitorHours: "6-24",
      tips: recoveryTips,
    },
    pumpTips,
  };
}

/** Parse legacy free-text (tests / migration). Prefer calculateExercisePlan(ExercisePlanContext). */
export function calculateExercisePlanFromMessage(message: string, bgUnits: string = "mmol/L"): ExercisePlanResult {
  const durationMatch = message.match(/(\d+)\s*(?:min|minute)/i);
  const duration = durationMatch ? parseInt(durationMatch[1]!, 10) : 45;
  const lower = message.toLowerCase();
  const intensity: "light" | "moderate" | "intense" = lower.includes("intense") || lower.includes("hard")
    ? "intense"
    : lower.includes("light") || lower.includes("easy")
      ? "light"
      : "moderate";

  let exerciseType = "exercise";
  if (lower.includes("cardio") || lower.includes("run") || lower.includes("cycl")) exerciseType = "cardio";
  else if (lower.includes("strength") || lower.includes("weight")) exerciseType = "strength";
  else if (lower.includes("hiit")) exerciseType = "hiit";
  else if (lower.includes("yoga") || lower.includes("stretch")) exerciseType = "yoga";
  else if (lower.includes("walk")) exerciseType = "walking";
  else if (lower.includes("swim")) exerciseType = "swimming";
  else if (lower.includes("sport")) exerciseType = "sports";

  return calculateExercisePlan(
    {
      exerciseType,
      durationMinutes: duration,
      intensity,
      minutesUntilStart: 60,
      bgUnits,
    },
    undefined,
  );
}
