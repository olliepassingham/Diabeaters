import type { BedtimeActionSuggested, BedtimeLog } from "@/lib/storage";

/**
 * Educational-only insights derived from a user's own logged bedtime outcomes. These never feed
 * back into the correction-dose calculation — only into copy/tips shown alongside future checks.
 */
export type BedtimeOutcomeContext = {
  exercisedToday: boolean;
  hadAlcohol: boolean;
  recentHypos: boolean;
  actionSuggested: BedtimeActionSuggested;
  bgTrend: "rising" | "steady" | "falling" | "not_sure";
};

/** Need at least this many matching logged nights before we say anything — avoids noisy, low-confidence tips. */
const MIN_MATCHING_NIGHTS = 3;
/** Only surface a tip when one outcome clearly dominates the matching nights. */
const MAJORITY_THRESHOLD = 0.6;
/** Only look at reasonably recent nights so old patterns don't dominate. */
const LOOKBACK_DAYS = 60;
const MIN_ACCURACY_LOGS = 3;

function matchesContext(log: BedtimeLog, context: BedtimeOutcomeContext): boolean {
  if (!log.outcome) return false;
  if (log.exercisedToday !== context.exercisedToday) return false;
  if (log.hadAlcohol !== context.hadAlcohol) return false;
  if ((log.actionSuggested ?? "none") !== context.actionSuggested) return false;
  return true;
}

function describeContext(context: BedtimeOutcomeContext): string {
  const parts: string[] = [];
  if (context.exercisedToday) parts.push("exercise");
  if (context.hadAlcohol) parts.push("alcohol");
  if (context.actionSuggested === "correction") parts.push("a correction");
  else if (context.actionSuggested === "snack") parts.push("a bedtime snack");
  if (parts.length === 0) return "nights like tonight";
  return `nights like tonight (${parts.join(" + ")})`;
}

/**
 * Looks for a clear majority outcome among the user's own logged nights that share tonight's key
 * factors, and phrases it as an awareness prompt — never as a reason to change the dose above.
 */
export function buildOutcomePatternTip(logs: BedtimeLog[], context: BedtimeOutcomeContext): string | null {
  const cutoffMs = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const matching = logs.filter((log) => new Date(log.date).getTime() >= cutoffMs && matchesContext(log, context));
  if (matching.length < MIN_MATCHING_NIGHTS) return null;

  const counts: Record<string, number> = { steady: 0, went_low: 0, went_high: 0, not_sure: 0 };
  for (const log of matching) {
    const feel = log.outcome!.overnightFeel;
    counts[feel] = (counts[feel] ?? 0) + 1;
  }

  const total = matching.length;
  const [topFeel, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]!;
  if (topCount / total < MAJORITY_THRESHOLD) return null;

  const label = describeContext(context);
  if (topFeel === "went_low") {
    return `On ${label}, you've gone low ${topCount} of ${total} logged nights. Keep hypo treatments nearby, and mention this pattern to your care team — tonight's dose maths stays as calculated.`;
  }
  if (topFeel === "went_high") {
    return `On ${label}, you've woken high ${topCount} of ${total} logged nights. Worth a care-team chat about overnight insulin; we still won't change tonight's dose from this.`;
  }
  if (topFeel === "steady") {
    return `On ${label}, you've stayed steady ${topCount} of ${total} logged nights — we'll keep using that as context for nights like this.`;
  }
  return null;
}

/** Did the tool's readiness verdict roughly match what the user later reported happened? */
function outcomeMatchedReadiness(log: BedtimeLog): boolean | null {
  if (!log.outcome) return null;
  const { overnightFeel } = log.outcome;
  if (overnightFeel === "not_sure") return null;
  if (log.readinessLevel === "steady") return overnightFeel === "steady";
  return overnightFeel !== "steady";
}

/** Short summary of how many logged nights matched the tool's readiness verdict — purely descriptive. */
export function summarizeOutcomeAccuracy(logs: BedtimeLog[]): string | null {
  const evaluated = logs
    .map((log) => ({ log, matched: outcomeMatchedReadiness(log) }))
    .filter((entry): entry is { log: BedtimeLog; matched: boolean } => entry.matched !== null);
  if (evaluated.length < MIN_ACCURACY_LOGS) return null;

  const matchedCount = evaluated.filter((e) => e.matched).length;
  return `You've logged how ${evaluated.length} night${evaluated.length !== 1 ? "s" : ""} went; ${matchedCount} matched what you expected.`;
}

export type OvernightCheckinAnswers = {
  overnightFeel: NonNullable<BedtimeLog["outcome"]>["overnightFeel"];
  followedAction?: NonNullable<BedtimeLog["outcome"]>["followedAction"] | null;
  morningBg?: number | null;
};

export type OvernightCheckinTakeaway = {
  headline: string;
  body: string;
  recommendations: string[];
  nextCheckNote: string;
};

export type LastNightCheckRecap = {
  bgLine: string;
  actionLine: string | null;
  contextChips: string[];
};

function actionPhrase(action: BedtimeActionSuggested | undefined): string | null {
  if (action === "correction") return "a bedtime correction";
  if (action === "snack") return "a bedtime snack";
  return null;
}

function contextFromLog(log: BedtimeLog): BedtimeOutcomeContext {
  return {
    exercisedToday: log.exercisedToday,
    hadAlcohol: log.hadAlcohol,
    recentHypos: Boolean(log.recentHypos),
    actionSuggested: log.actionSuggested ?? "none",
    bgTrend: log.bgTrend ?? "not_sure",
  };
}

function countSimilarFeelNights(
  logs: BedtimeLog[],
  log: BedtimeLog,
  feel: OvernightCheckinAnswers["overnightFeel"],
): number {
  if (feel === "not_sure") return 0;
  const cutoffMs = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const context = contextFromLog(log);
  return logs.filter((row) => {
    if (row.id === log.id) return false;
    if (new Date(row.date).getTime() < cutoffMs) return false;
    if (!matchesContext(row, context)) return false;
    return row.outcome?.overnightFeel === feel;
  }).length;
}

export function describeLastNightCheck(log: BedtimeLog): LastNightCheckRecap {
  const bgLine = `Bedtime check was ${log.currentBg} ${log.bgUnits}`;
  const action = actionPhrase(log.actionSuggested);
  const actionLine = action
    ? `We suggested ${action}`
    : log.actionSuggested === "missing_isf"
      ? "No correction shown — insulin sensitivity factor isn't set"
      : "No extra action was suggested";
  const contextChips: string[] = [];
  if (log.exercisedToday) contextChips.push("Exercise");
  if (log.hadAlcohol) contextChips.push("Alcohol");
  if (log.recentHypos) contextChips.push("Recent hypos");
  if (log.sickDayActive) contextChips.push("Sick day");
  if (log.travelModeActive) contextChips.push("Travel");
  return { bgLine, actionLine, contextChips };
}

function nextCheckNote(log: BedtimeLog): string {
  const parts: string[] = [];
  if (log.exercisedToday) parts.push("exercise");
  if (log.hadAlcohol) parts.push("alcohol");
  const action = actionPhrase(log.actionSuggested);
  if (action) parts.push(action.replace(/^a /, ""));
  if (parts.length === 0) {
    return "On your next bedtime check, we'll use this as context in the tips — it never changes how a correction dose is calculated.";
  }
  return `Next time a bedtime check looks like this (${parts.join(" + ")}), we'll surface this as a tip. It never changes how a correction dose is calculated.`;
}

/**
 * Immediate, educational takeaway from this night's answers. Never feeds the correction-dose maths.
 */
export function buildOvernightCheckinTakeaway(
  log: BedtimeLog,
  answers: OvernightCheckinAnswers,
  logs: BedtimeLog[] = [],
): OvernightCheckinTakeaway {
  const feel = answers.overnightFeel;
  const followed = answers.followedAction ?? "n_a";
  const action = log.actionSuggested ?? "none";
  const similarPast = countSimilarFeelNights(logs, log, feel);
  const similarIncludingTonight = feel === "not_sure" ? similarPast : similarPast + 1;
  const repeatNote =
    similarIncludingTonight >= 2
      ? `That's ${similarIncludingTonight} similar nights in the last 60 days.`
      : null;

  const recs: string[] = [];
  let headline = "Thanks — this helps tailor your next check";
  let body = "We'll keep this with last night's check so future tips can reflect what actually happened.";

  if (feel === "went_low" && action === "correction" && followed === "yes") {
    headline = "Correction taken, still went low";
    body = "Taking the suggested correction and still going low is useful to know — it can mean overnight insulin was stronger than usual.";
    recs.push("Keep fast-acting hypo treatment by the bed on similar nights.");
    recs.push("If this keeps happening, ask your care team about bedtime target or insulin sensitivity — we won't change the dose maths ourselves.");
  } else if (feel === "went_low" && action === "correction" && (followed === "no" || followed === "partially")) {
    headline = "Low overnight, correction not fully taken";
    body = "The low wasn't from taking the full suggested correction, so other overnight factors are more likely.";
    recs.push("Keep hypo treatment nearby tonight if the evening looks similar.");
    recs.push("Worth mentioning basal, exercise, or alcohol timing to your care team.");
  } else if (feel === "went_low" && action === "snack" && followed === "yes") {
    headline = "Snack taken, still went low";
    body = "A bedtime snack didn't prevent a low — useful context for your team, not a reason to skip food if you usually need it.";
    recs.push("Keep hypo treatment by the bed.");
    recs.push("Ask your care team whether overnight insulin, not the snack size, needs a look.");
  } else if (feel === "went_low") {
    headline = "Low overnight";
    body = log.exercisedToday || log.hadAlcohol
      ? "Lows after exercise or alcohol are common — this log helps us warn you on nights that look the same."
      : "Logging the low means we can warn you when a future bedtime check looks like last night.";
    recs.push("Keep hypo treatment nearby on similar nights.");
    recs.push("If lows repeat, talk to your care team before changing insulin.");
  } else if (feel === "went_high" && action === "correction" && followed === "no") {
    headline = "High after skipping the correction";
    body = "You skipped the suggested correction and woke high. That's a pattern we'll remind you about — still your call on the night.";
    recs.push("On similar nights we'll highlight that the suggestion is there for a reason.");
    recs.push("If skipping and waking high becomes a habit, your care team can help you decide what to change.");
  } else if (feel === "went_high" && action === "correction" && followed === "yes") {
    headline = "Correction taken, still woke high";
    body = "Following the suggestion and still waking high is worth a care-team chat (sensitivity, duration, or basal) — we won't tweak the dose maths from this.";
    recs.push("Mention this pattern at your next review.");
    recs.push("We'll flag similar nights so you can double-check the suggestion rather than stacking extra insulin yourself.");
  } else if (feel === "went_high" && action === "snack" && followed === "yes") {
    headline = "Snack taken, woke high";
    body = "The bedtime snack may have been more than you needed, or glucose rose for another overnight reason.";
    recs.push("Worth comparing snack size with your care team if this repeats.");
    recs.push("We'll note this when a future check also suggests a snack.");
  } else if (feel === "went_high") {
    headline = "High overnight";
    body = "Waking high after last night's check is useful context for the next time the evening looks similar.";
    recs.push("If this repeats, ask your care team about overnight insulin — don't stack extra corrections from this screen.");
  } else if (feel === "steady" && (followed === "yes" || followed === "n_a")) {
    headline = "That combo worked overnight";
    body = action === "correction" || action === "snack"
      ? `You followed the suggested ${action === "snack" ? "snack" : "correction"} and stayed steady — we'll treat that as a positive pattern.`
      : "A steady night after this kind of check is exactly the context we want for next time.";
    recs.push("We'll keep this as a 'what's working' note on similar bedtime checks.");
  } else if (feel === "steady" && (followed === "no" || followed === "partially")) {
    headline = "Steady, without following the suggestion";
    body = "One steady night after skipping isn't a rule — we'll still remember it as context, not as a reason to ignore a future suggestion.";
    recs.push("Keep treating each night on its own merits.");
    recs.push("If this becomes a pattern, your care team can help you decide whether the suggestion is usually needed.");
  } else {
    headline = "Even a rough sense helps";
    body = "If you can add how it felt or a morning reading next time, we can be more specific.";
    recs.push("We'll still store this against last night's check.");
  }

  if (repeatNote) recs.unshift(repeatNote);
  if (recs.length === 0) {
    recs.push("We'll use this the next time a bedtime check looks like last night.");
  }

  return {
    headline,
    body,
    recommendations: recs.slice(0, 3),
    nextCheckNote: nextCheckNote(log),
  };
}
