import type { ExerciseBgTrend, ExerciseType, LastExerciseSummary } from "@/lib/storage";

const MAX_CONTEXT_EXTRAS = 2;
const MAX_PANEL_ACTIONS = 3;

export type PostExerciseActionKind =
  | "insulin"
  | "carbs"
  | "overnight"
  | "trend"
  | "session"
  | "context";

export type PostExerciseActionTip = {
  id: string;
  kind: PostExerciseActionKind;
  title: string;
  detail: string;
};

export type PostExerciseTipPanel = {
  /** What to watch for — not a load-tier label. */
  headline: string;
  sessionLine: string | null;
  actions: PostExerciseActionTip[];
};

function formatActionLine(tip: PostExerciseActionTip): string {
  return `${tip.title} — ${tip.detail}`;
}

function bgTrendContextTip(ctx: NonNullable<LastExerciseSummary["context"]>): PostExerciseActionTip | null {
  const t: ExerciseBgTrend | undefined =
    ctx.recoveryExerciseTrend ?? ctx.duringExerciseTrend ?? ctx.preExerciseTrend;
  if (!t || t === "not_sure") return null;
  if (t === "falling") {
    return {
      id: "trend-falling",
      kind: "trend",
      title: "You trended down",
      detail: "Recheck before tightening insulin.",
    };
  }
  if (t === "rising") {
    return {
      id: "trend-rising",
      kind: "trend",
      title: "You trended up",
      detail: "Confirm the trend before correcting.",
    };
  }
  return {
    id: "trend-steady",
    kind: "trend",
    title: "Checks looked steadier",
    detail: "Still watch if you add meal insulin.",
  };
}

function sessionContextActionTips(summary: LastExerciseSummary | null): PostExerciseActionTip[] {
  if (!summary?.context) return [];
  const c = summary.context;
  const candidates: PostExerciseActionTip[] = [];

  if (c.feltSymptomsDuring) {
    candidates.push({
      id: "symptoms",
      kind: "context",
      title: "You had symptoms",
      detail: "Treat hypos by plan, not by feel.",
    });
  }
  if (c.betaBlockerToday) {
    candidates.push({
      id: "beta-blocker",
      kind: "context",
      title: "Beta blocker today",
      detail: "Trust CGM or meter, not adrenaline signs.",
    });
  }
  if (c.alcoholLastNight) {
    candidates.push({
      id: "alcohol-last-night",
      kind: "context",
      title: "Alcohol last night",
      detail: "Extra care with corrections and overnight.",
    });
  }
  if (c.alcoholTonight) {
    candidates.push({
      id: "alcohol-tonight",
      kind: "context",
      title: "Alcohol later",
      detail: "Pair with your evening plan.",
    });
  }
  if (c.fasted) {
    candidates.push({
      id: "fasted",
      kind: "context",
      title: "Trained fasted",
      detail: "Watch delayed lows after meal boluses.",
    });
  }
  if (c.glp1Last24h) {
    candidates.push({
      id: "glp1",
      kind: "context",
      title: "GLP-1 recently",
      detail: "Align boluses with your clinician’s plan.",
    });
  }
  const bedtimeHours = c.bedtimeInHours;
  if (typeof bedtimeHours === "number" && Number.isFinite(bedtimeHours) && bedtimeHours <= 4) {
    candidates.push(
      bedtimeHours <= 1
        ? {
            id: "bedtime-soon",
            kind: "overnight",
            title: "Bedtime soon",
            detail: "Run Bedtime check before you turn in.",
          }
        : {
            id: "bedtime-later",
            kind: "overnight",
            title: `Bedtime in about ${Math.round(bedtimeHours)}h`,
            detail: "Run Bedtime check tonight.",
          },
    );
  }
  const carbsDuring = c.midCarbsGramsTotal;
  if (typeof carbsDuring === "number" && carbsDuring >= 20) {
    candidates.push({
      id: "carbs-during",
      kind: "carbs",
      title: `~${Math.round(carbsDuring)}g during the session`,
      detail: "Confirm the trend before extra insulin.",
    });
  }
  if (c.competitive) {
    candidates.push({
      id: "competitive",
      kind: "session",
      title: "Competitive session",
      detail: "A delayed dip can follow once effort stops.",
    });
  }
  if (c.environment === "outdoor_hot") {
    candidates.push({
      id: "hot",
      kind: "context",
      title: "Hot conditions",
      detail: "Recheck before bold insulin changes.",
    });
  }
  if (c.environment === "outdoor_cold") {
    candidates.push({
      id: "cold",
      kind: "context",
      title: "Cold conditions",
      detail: "Warm fingers and sensor before acting.",
    });
  }
  const sleep = c.sleepHoursLastNight;
  if (typeof sleep === "number" && sleep > 0 && sleep <= 5) {
    candidates.push({
      id: "short-sleep",
      kind: "overnight",
      title: "Short sleep",
      detail: "Favour gentle corrections overnight.",
    });
  }
  const trend = bgTrendContextTip(c);
  if (trend) candidates.push(trend);

  return candidates;
}

/**
 * Short educational lines derived from the last session’s optional context (pre/during/recovery).
 * Used by the status strip; capped so the panel stays scannable.
 */
export function buildSessionContextTipExtras(summary: LastExerciseSummary | null): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tip of sessionContextActionTips(summary)) {
    if (out.length >= MAX_CONTEXT_EXTRAS) break;
    const line = formatActionLine(tip);
    const key = line.slice(0, 88);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

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
  const m = String(profile?.insulinDeliveryMethod ?? "").trim().toLowerCase();
  if (m === "pump") return "pump";
  if (m === "pen") return "pen";
  return "unknown";
}

function insulinActionTip(tier: PostExerciseLoadTier, delivery: InsulinDeliveryForTips): PostExerciseActionTip {
  if (tier === "light") {
    if (delivery === "pump") {
      return {
        id: "insulin",
        kind: "insulin",
        title: "Check IOB first",
        detail: "Sensitivity only shifts a little.",
      };
    }
    return {
      id: "insulin",
      kind: "insulin",
      title: "Don’t stack doses",
      detail: "Sensitivity only shifts a little.",
    };
  }
  if (tier === "moderate") {
    if (delivery === "pump") {
      return {
        id: "insulin",
        kind: "insulin",
        title: "Don’t stack boluses",
        detail: "Check IOB before topping up.",
      };
    }
    if (delivery === "pen") {
      return {
        id: "insulin",
        kind: "insulin",
        title: "Don’t stack injections",
        detail: "Space meal and correction doses.",
      };
    }
    return {
      id: "insulin",
      kind: "insulin",
      title: "Don’t stack insulin",
      detail: "Recheck before adding more.",
    };
  }
  if (delivery === "pump") {
    return {
      id: "insulin",
      kind: "insulin",
      title: "Go easy on insulin",
      detail: "Ask your team about a temp basal.",
    };
  }
  return {
    id: "insulin",
    kind: "insulin",
    title: "Go easy on insulin",
    detail: "Avoid stacking meal and correction doses.",
  };
}

function safetyActionTip(overnight: boolean): PostExerciseActionTip {
  if (overnight) {
    return {
      id: "overnight",
      kind: "overnight",
      title: "Watch overnight",
      detail: "If falling toward bed, follow your hypo plan.",
    };
  }
  return {
    id: "carbs",
    kind: "carbs",
    title: "Keep fast carbs close",
    detail: "Delayed lows can still show up later.",
  };
}

function exerciseTypeActionTip(
  summary: LastExerciseSummary | null,
  tier: PostExerciseLoadTier,
): PostExerciseActionTip | null {
  if (!summary) return null;
  switch (summary.exerciseType) {
    case "hiit":
    case "cardio":
      return {
        id: "type-cardio",
        kind: "session",
        title: "Cardio delayed lows",
        detail: "An extra check before bed helps.",
      };
    case "strength":
      return {
        id: "type-strength",
        kind: "session",
        title: "Muscles are refuelling",
        detail: "Follow the trend — don’t chase numbers.",
      };
    case "yoga":
    case "walking":
      if (tier === "heavy") {
        return {
          id: "type-long-low-impact",
          kind: "session",
          title: "Long or brisk session",
          detail: "Still a wider hypo-risk window — watch slides.",
        };
      }
      return null;
    case "court":
    case "field":
    case "swimming":
      return {
        id: "type-mixed",
        kind: "session",
        title: "Mixed effort",
        detail: "Watch for a delayed dip later.",
      };
    default:
      return null;
  }
}

function postExerciseHeadline(tier: PostExerciseLoadTier): string {
  if (tier === "light") return "Slight extra sensitivity";
  if (tier === "moderate") return "Insulin may hit harder for hours";
  return "Higher delayed-low risk today";
}

/**
 * Compact actions for the status-strip tips panel. Always insulin + safety,
 * plus at most one personalised extra (logged context wins over exercise type).
 */
export function getPostExerciseTipPanel(
  tier: PostExerciseLoadTier,
  summary: LastExerciseSummary | null,
  delivery: InsulinDeliveryForTips,
  opts?: { mentionOvernight?: boolean },
): PostExerciseTipPanel {
  const overnight =
    opts?.mentionOvernight ??
    (() => {
      const h = new Date().getHours();
      return h >= 17 || h < 5;
    })();

  const extra = sessionContextActionTips(summary)[0] ?? exerciseTypeActionTip(summary, tier);
  const actions = [insulinActionTip(tier, delivery), safetyActionTip(overnight), extra].filter(
    (tip): tip is PostExerciseActionTip => Boolean(tip),
  );

  return {
    headline: postExerciseHeadline(tier),
    sessionLine: formatLastExerciseSummaryLine(summary),
    actions: actions.slice(0, MAX_PANEL_ACTIONS),
  };
}

/**
 * Tips for the home status strip (expanded). Uses last session + load tier + pump vs pen vs unknown,
 * plus one line from pre/during/recovery context when the user logged it.
 */
export function getPostExercisePersonalizedTipBullets(
  tier: PostExerciseLoadTier,
  summary: LastExerciseSummary | null,
  delivery: InsulinDeliveryForTips,
  opts?: { mentionOvernight?: boolean },
): string[] {
  return getPostExerciseTipPanel(tier, summary, delivery, opts).actions.map(formatActionLine);
}
