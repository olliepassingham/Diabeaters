/**
 * Output post-filter (server-side, post-LLM).
 *
 * Implements §8 of docs/regulatory/ai_coach_system_prompt.md. Runs against
 * every `reply` returned by the LLM. Failure causes one of:
 *   - rewrite (length cap, dropped href)
 *   - refuse  (numeric dose, ratio, ISF, target, CGM-arrow action)
 *
 * Pure logic — runs under both Deno and Vitest.
 */

import {
  ALLOWED_HREFS,
  type AllowedHref,
  type CoachAction,
  type CoachContext,
  type CoachReply,
  type PostFilterStatus,
} from "./types.ts";

export type PostFilterProfileGate = Pick<CoachContext["profile"], "ageBand" | "ageYears">;

function isHrefBlockedByAge(href: string, profile: PostFilterProfileGate): boolean {
  if (href === "/scenarios/alcohol") {
    if (profile.ageBand === "under18") return true;
    if (profile.ageYears != null && profile.ageYears < 18) return true;
    return false;
  }
  if (href === "/scenarios/driving") {
    if (profile.ageYears != null) return profile.ageYears < 17;
    if (profile.ageBand === "under18") return true;
    return false;
  }
  return false;
}

export interface PostFilterResult {
  status: PostFilterStatus;
  /** Human-readable reasons; logged but not surfaced to the user. */
  reasons: string[];
  /** Reply after rewriting / refusing. */
  reply: CoachReply;
}

const REPLY_MAX_CHARS = 1500;
const TARGET_WINDOW = 10;

const INSULIN_TERMS = [
  "insulin",
  "bolus",
  "basal",
  "correction",
  "fast acting",
  "fast-acting",
  "long acting",
  "long-acting",
  "lantus",
  "tresiba",
  "novorapid",
  "humalog",
  "fiasp",
  "levemir",
  "toujeo",
];

const RATIO_TERMS = ["carb", "ratio", "i:c", "ic"];

const ISF_TERMS = ["drop", "fall", "reduce", "sensitivity", "isf", "correction"];

const TARGET_TERMS = ["aim", "target", "should be", "shoot for", "stick to"];

const CGM_ARROW_TOKENS = /(↑↑|↓↓|two\s+arrows?\s+(up|down)|three\s+arrows?\s+(up|down))/i;
const CGM_ACTION_TOKENS = /\b(correct|bolus|reduce|drop|increase|inject)\b/i;

const NUMERIC_DOSE_DIGITS =
  /\b(?:about|approximately|approx\.?|around|roughly|maybe|try)?\s*\d{1,3}(?:\.\d+)?\s*(?:u|units|iu)\b/i;

const NUMERIC_DOSE_WORDS =
  /\b(?:half|one|two|three|four|five|six|seven|eight|nine|ten|a|an)\s+(?:unit|units|u)\b/i;

const RATIO_REGEX = /\b1\s*(?::|to)\s*\d{1,2}\b/;
const ISF_REGEX = /\b\d{1,2}\s*(?:mmol|mg)\s*\/?\s*(?:l|dl)\b/i;
const BG_UNIT_REGEX = /\b(?:mmol\s*\/?\s*l|mg\s*\/?\s*dl)\b/i;
const NUMBER_REGEX = /\b\d{1,2}(?:\.\d+)?\b/;

function nearAnyTerm(
  haystack: string,
  match: RegExpExecArray,
  terms: readonly string[],
  windowChars: number,
): boolean {
  const lower = haystack.toLowerCase();
  const start = Math.max(0, match.index - windowChars);
  const end = Math.min(lower.length, match.index + match[0].length + windowChars);
  const window = lower.slice(start, end);
  return terms.some((t) => window.includes(t));
}

function hasNumericDose(reply: string): boolean {
  const digits = NUMERIC_DOSE_DIGITS.exec(reply);
  if (digits && nearAnyTerm(reply, digits, INSULIN_TERMS, 80)) return true;
  const words = NUMERIC_DOSE_WORDS.exec(reply);
  if (words && nearAnyTerm(reply, words, INSULIN_TERMS, 80)) return true;
  return false;
}

function hasRatio(reply: string): boolean {
  const m = RATIO_REGEX.exec(reply);
  if (!m) return false;
  return nearAnyTerm(reply, m, RATIO_TERMS, 80);
}

function hasIsf(reply: string): boolean {
  const m = ISF_REGEX.exec(reply);
  if (!m) return false;
  return nearAnyTerm(reply, m, ISF_TERMS, 80);
}

function hasPersonalTarget(reply: string): boolean {
  // Personal target = aim/target/etc. WITH a number AND a BG unit, all within
  // a small window. Pure educational ranges that mention only "ranges set by
  // your team" without a number, or numbers without units, fall through.
  const lower = reply.toLowerCase();
  for (const term of TARGET_TERMS) {
    let from = 0;
    while (true) {
      const idx = lower.indexOf(term, from);
      if (idx < 0) break;
      const start = Math.max(0, idx - TARGET_WINDOW * 8);
      const end = Math.min(lower.length, idx + term.length + TARGET_WINDOW * 8);
      const window = reply.slice(start, end);
      if (NUMBER_REGEX.test(window) && BG_UNIT_REGEX.test(window)) {
        return true;
      }
      from = idx + term.length;
    }
  }
  return false;
}

function hasCgmArrowAction(reply: string): boolean {
  // Same sentence: split on period / question mark / exclamation, then check
  // both an arrow token and an action verb appear in the same chunk.
  const sentences = reply.split(/[.!?]+/);
  for (const s of sentences) {
    if (CGM_ARROW_TOKENS.test(s) && CGM_ACTION_TOKENS.test(s)) return true;
  }
  return false;
}

function isAllowedHref(href: string): href is AllowedHref {
  return (ALLOWED_HREFS as readonly string[]).includes(href);
}

function filterActions(
  actions: CoachAction[] | undefined,
  profileGate?: PostFilterProfileGate,
): {
  cleaned: CoachAction[];
  dropped: number;
} {
  if (!Array.isArray(actions) || actions.length === 0) {
    return { cleaned: [], dropped: 0 };
  }
  const cleaned: CoachAction[] = [];
  let dropped = 0;
  for (const a of actions) {
    if (!a || typeof a.label !== "string" || typeof a.href !== "string") {
      dropped += 1;
      continue;
    }
    if (!isAllowedHref(a.href)) {
      dropped += 1;
      continue;
    }
    if (profileGate && isHrefBlockedByAge(a.href, profileGate)) {
      dropped += 1;
      continue;
    }
    cleaned.push({ label: a.label, href: a.href });
  }
  // Cap at 3 per §4.
  if (cleaned.length > 3) {
    dropped += cleaned.length - 3;
    cleaned.splice(3);
  }
  return { cleaned, dropped };
}

const REFUSAL_REPLY: CoachReply = {
  reply:
    "I cannot give specific clinical advice like that. Your diabetes team is the right place to set or change doses, ratios, or targets. The Meal Adviser in this app uses your own ratios and targets, so it will be more accurate than I can be. If something feels off, it is also a great thing to bring up at your next appointment.",
  suggestedQuestions: [
    "What patterns from the last fortnight would you bring to your team?",
    "What questions would you ask about your current ratios?",
  ],
  suggestedNextActions: [{ label: "Open Meal Adviser", href: "/adviser?tab=meal" }],
  deferToTeam: true,
};

/**
 * Applies §8 to the LLM's reply.
 *
 * - Hard refuses (returns REFUSAL_REPLY) when a clinical-numeric pattern fires.
 * - Rewrites by truncating when reply is too long.
 * - Always strips any `suggestedNextActions` whose href isn't in the allow-list.
 * - Optionally strips age-gated scenario routes when `profileGate` is set.
 */
export function applyPostFilter(
  reply: CoachReply,
  profileGate?: PostFilterProfileGate,
): PostFilterResult {
  const reasons: string[] = [];

  if (typeof reply?.reply !== "string") {
    return {
      status: "refused",
      reasons: ["invalid_reply_shape"],
      reply: REFUSAL_REPLY,
    };
  }

  if (hasNumericDose(reply.reply)) reasons.push("numeric_dose");
  if (hasRatio(reply.reply)) reasons.push("ratio");
  if (hasIsf(reply.reply)) reasons.push("isf");
  if (hasPersonalTarget(reply.reply)) reasons.push("personal_target");
  if (hasCgmArrowAction(reply.reply)) reasons.push("cgm_arrow_action");

  if (reasons.length > 0) {
    return { status: "refused", reasons, reply: REFUSAL_REPLY };
  }

  let textOut = reply.reply;
  let rewritten = false;
  if (textOut.length > REPLY_MAX_CHARS) {
    textOut = textOut.slice(0, REPLY_MAX_CHARS).trimEnd();
    rewritten = true;
    reasons.push("length_cap");
  }

  const { cleaned: cleanedActions, dropped } = filterActions(reply.suggestedNextActions, profileGate);
  if (dropped > 0) {
    rewritten = true;
    reasons.push(`dropped_${dropped}_action${dropped === 1 ? "" : "s"}`);
  }

  const suggestedQuestions = Array.isArray(reply.suggestedQuestions)
    ? reply.suggestedQuestions.filter((q) => typeof q === "string").slice(0, 4)
    : [];

  const out: CoachReply = {
    reply: textOut,
    suggestedQuestions,
    suggestedNextActions: cleanedActions,
    deferToTeam: Boolean(reply.deferToTeam),
  };

  return {
    status: rewritten ? "rewritten" : "pass",
    reasons,
    reply: out,
  };
}

export const __test_internals = {
  hasNumericDose,
  hasRatio,
  hasIsf,
  hasPersonalTarget,
  hasCgmArrowAction,
  filterActions,
  REFUSAL_REPLY,
};
