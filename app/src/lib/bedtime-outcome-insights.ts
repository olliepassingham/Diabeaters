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
    return `From your own nights: on ${label}, you've logged going low ${topCount} of ${total} times — worth mentioning to your care team, not a reason to skip a suggested correction.`;
  }
  if (topFeel === "went_high") {
    return `From your own nights: on ${label}, you've logged going high ${topCount} of ${total} times — a pattern worth flagging to your care team.`;
  }
  if (topFeel === "steady") {
    return `From your own nights: on ${label}, you've stayed steady ${topCount} of ${total} times — good context for what's working for you.`;
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
