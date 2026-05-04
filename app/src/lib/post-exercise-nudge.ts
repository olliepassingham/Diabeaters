import type { ExerciseIntensity, ExerciseType, LastExerciseSummary } from "@/lib/storage";

export type PostExerciseLoadTier = "light" | "moderate" | "heavy";

/**
 * Coarse load estimate for educational copy only — not dosing.
 * Uses type, intensity, duration, and optional session context (RPE, symptoms).
 */
export function inferPostExerciseLoadTier(summary: LastExerciseSummary | null): PostExerciseLoadTier {
  if (!summary) return "moderate";

  const { exerciseType, intensity, durationMinutes, context } = summary;
  let score = typeBaseScore(exerciseType);
  if (intensity === "light") score -= 1;
  else if (intensity === "moderate") score += 1;
  else if (intensity === "intense") score += 2;
  if (durationMinutes >= 26 && durationMinutes <= 45) score += 1;
  else if (durationMinutes >= 46 && durationMinutes <= 60) score += 2;
  else if (durationMinutes > 60) score += 3;
  const rpe = context?.midRpe;
  if (typeof rpe === "number" && Number.isFinite(rpe) && rpe >= 8) score += 1;
  if (context?.feltSymptomsDuring) score += 1;

  if (score <= 3) return "light";
  if (score <= 6) return "moderate";
  return "heavy";
}

function typeBaseScore(t: ExerciseType): number {
  switch (t) {
    case "yoga":
      return 1;
    case "walking":
      return 2;
    case "strength":
    case "court":
    case "field":
    case "swimming":
      return 3;
    case "cardio":
      return 4;
    case "hiit":
      return 5;
    default:
      return 3;
  }
}

export function formatLastExerciseSummaryLine(summary: LastExerciseSummary | null): string | null {
  if (!summary) return null;
  const name = summary.exerciseName?.trim() || "Workout";
  return `${name} · ${summary.intensity} · ${summary.durationMinutes} min`;
}

export type PostExerciseEducationalCopy = {
  /** Short label for status strip badge subtitle */
  stripHint: string;
  adviserLead: string;
  adviserDetail: string;
  hypoDetail: string;
  correctionDetail: string;
  bullets: string[];
};

export function getPostExerciseEducationalCopy(
  tier: PostExerciseLoadTier,
  opts?: { mentionOvernight?: boolean },
): PostExerciseEducationalCopy {
  const overnight =
    opts?.mentionOvernight ??
    (() => {
      const h = new Date().getHours();
      return h >= 17 || h < 5;
    })();

  const overnightPhrase = overnight
    ? " Overnight and early-morning lows are still possible for some people."
    : "";

  if (tier === "light") {
    return {
      stripHint: "Lower intensity — still stay aware",
      adviserLead: "Recent lighter activity",
      adviserDetail:
        "You may have a little extra insulin sensitivity for a while. Usual meal boluses are often fine, but stay alert if you stack corrections or train again today." +
        overnightPhrase,
      hypoDetail:
        "After lighter sessions, delayed lows are less common for many people, but they can still happen — keep your usual hypo options nearby." +
        overnightPhrase,
      correctionDetail:
        "After lighter activity, be slightly more careful if you correct often in one day — your team’s plan still comes first." +
        overnightPhrase,
      bullets: [
        "Hydrate and eat normally unless your BG is trending down.",
        "If you plan another workout today, repeat your usual pre-exercise checks.",
      ],
    };
  }

  if (tier === "moderate") {
    return {
      stripHint: "Moderate load — watch sensitivity",
      adviserLead: "Recent exercise",
      adviserDetail:
        "Sensitivity can be higher for many people for several hours after a typical session. Take extra care with corrections and stacked boluses, and watch for delayed lows." +
        overnightPhrase,
      hypoDetail:
        "After moderate exercise, delayed lows are possible for up to about 24 hours for some people — keep fast carbs nearby and consider extra checks." +
        overnightPhrase,
      correctionDetail:
        "You may be more insulin sensitive for up to about 24 hours. Be cautious stacking corrections and watch for delayed lows." +
        overnightPhrase,
      bullets: [
        "Spread corrections cautiously; check IOB or your pump’s advice if you use one.",
        "If BG is falling toward bedtime, favour your hypo plan and your team’s overnight guidance.",
      ],
    };
  }

  return {
    stripHint: "Harder session — higher hypo risk window",
    adviserLead: "Recent harder or longer exercise",
    adviserDetail:
      "Long or intense sessions often raise hypo risk for longer — insulin sensitivity can stay higher for many hours. Be conservative with corrections and plan food and checks with extra margin." +
      overnightPhrase,
    hypoDetail:
      "After harder or longer workouts, delayed lows are more likely for some people for up to about 24 hours — keep fast carbs close and consider more frequent checks." +
      overnightPhrase,
    correctionDetail:
      "After intense or long exercise, insulin sensitivity may stay higher for hours. Avoid aggressive correction stacking; watch for delayed lows, especially overnight." +
      overnightPhrase,
    bullets: [
      "Prioritise slow corrections and extra BG checks over “catching up fast” on insulin.",
      "If you use a pump, discuss temporary basal or profile changes with your team for hard training days.",
    ],
  };
}

/** Bedtime pump card — educational only; `lastSessionSuffix` e.g. " (Run · moderate · 30 min)". */
export function getPumpBedtimePostExerciseLine(
  tier: PostExerciseLoadTier,
  lastSessionSuffix: string | null,
): string {
  const tail = lastSessionSuffix ?? "";
  if (tier === "light") {
    return `After lighter activity, delayed overnight lows are less common for many people${tail}. If glucose is trending down, your team may still suggest a modest basal change — follow your written pump plan.`;
  }
  if (tier === "heavy") {
    return `After a demanding session, consider a temporary basal rate at about 80–90% for roughly 4–6 hours overnight to reduce post-exercise hypo risk${tail}.`;
  }
  return `Consider a temporary basal rate at 80–90% for 4–6 hours overnight to reduce post-exercise hypo risk${tail}.`;
}

/** Bedtime MDI card when user marked exercise — educational only. */
export function getMdiBedtimePostExerciseLine(tier: PostExerciseLoadTier): string {
  if (tier === "light") {
    return "After lighter activity, many people manage with their usual overnight routine — still keep hypo treatment within reach.";
  }
  if (tier === "heavy") {
    return "After harder sessions on injections, be cautious with evening and overnight corrections; ask your team about temporary meal or basal tweaks if lows cluster.";
  }
  return "Be cautious stacking meal and correction doses after exercise — keep fast carbs nearby for a possible delayed low.";
}

/** Profile insulin mode for post-exercise tips (status strip / banners). */
export type InsulinDeliveryForTips = "pump" | "pen" | "unknown";

export function insulinDeliveryForPostExerciseTips(
  profile: { insulinDeliveryMethod?: string } | null | undefined,
): InsulinDeliveryForTips {
  const m = String(profile?.insulinDeliveryMethod ?? "").toLowerCase();
  if (m === "pump") return "pump";
  if (m === "pen") return "pen";
  return "unknown";
}

function exerciseTailTip(summary: LastExerciseSummary | null): string | null {
  if (!summary) return null;
  switch (summary.exerciseType) {
    case "hiit":
    case "cardio":
      return "Sustained or high-intensity cardio often raises the chance of delayed lows — an extra check before bed can help.";
    case "strength":
      return "After strength work, glucose can drift unpredictably while muscles refuel — respond to trends rather than chasing numbers quickly.";
    case "yoga":
    case "walking":
      return "Lower-impact sessions disturb glucose less for many people, but a late-day downward trend still deserves your usual caution.";
    case "court":
    case "field":
    case "swimming":
      return "Mixed bursts and endurance can both affect sensitivity — watch for a delayed dip later on.";
    default:
      return null;
  }
}

/**
 * Tips for the home status strip (expanded). Uses last session + load tier + pump vs pen vs unknown.
 */
export function getPostExercisePersonalizedTipBullets(
  tier: PostExerciseLoadTier,
  summary: LastExerciseSummary | null,
  delivery: InsulinDeliveryForTips,
  opts?: { mentionOvernight?: boolean },
): string[] {
  const overnight =
    opts?.mentionOvernight ??
    (() => {
      const h = new Date().getHours();
      return h >= 17 || h < 5;
    })();

  const primary = (() => {
    if (tier === "light") {
      if (delivery === "pump") {
        return "Hydrate and refuel as your BG allows. Lighter sessions usually shift sensitivity only a little — still check IOB before stacking boluses on your pump.";
      }
      if (delivery === "pen") {
        return "Hydrate and refuel as your BG allows. Lighter sessions usually shift sensitivity only a little — still go easy stacking meal and correction doses the same day.";
      }
      return "Hydrate and refuel as your BG allows. Lighter sessions usually shift sensitivity only a little — still be careful stacking extra insulin the same day.";
    }
    if (tier === "moderate") {
      if (delivery === "pump") {
        return "For several hours you may run more insulin-sensitive than usual — spread corrections and weigh IOB or your pump bolus calculator before topping up.";
      }
      if (delivery === "pen") {
        return "For several hours you may run more insulin-sensitive than usual — space correction and meal doses rather than stacking injections.";
      }
      return "For several hours you may run more insulin-sensitive than usual — avoid stacking extra insulin doses without your team’s plan.";
    }
    if (delivery === "pump") {
      return "Hard or long sessions can extend the hypo risk window — favour gradual corrections, watch IOB, and ask your team about temporary basal changes on heavy training days.";
    }
    if (delivery === "pen") {
      return "Hard or long sessions can extend the hypo risk window — avoid aggressive correction or meal dose stacking; keep fast carbs within reach for many hours.";
    }
    return "Hard or long sessions can extend the hypo risk window — be cautious with extra insulin and keep fast carbs within reach for many hours.";
  })();

  const secondary = overnight
    ? "If glucose is trending down toward bedtime, follow your hypo plan and any overnight guidance from your diabetes team."
    : "Keep fast carbs within reach for several hours, and repeat your usual pre-exercise checks if you train again today.";

  const tail = exerciseTailTip(summary);
  return tail ? [primary, secondary, tail] : [primary, secondary];
}
