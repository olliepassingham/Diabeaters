/**
 * Hard keyword interceptor (server-side, pre-LLM).
 *
 * Implements §6 of docs/regulatory/ai_coach_system_prompt.md. If a category
 * matches, the server returns a deterministic payload (see `responses.ts`)
 * without calling the LLM.
 *
 * Priority order when multiple categories match: safeguarding wins over
 * acute (life-safety + welfare beats glycaemic) which wins over emergency
 * services (just a number/phrase) which wins over disordered eating.
 *
 * Pure logic only — runs under both Deno and Vitest.
 */

import type { InterceptorCategory } from "./types.ts";

export interface InterceptorMatch {
  category: InterceptorCategory;
  matchedTerm: string;
}

const SAFEGUARDING_PATTERNS: readonly RegExp[] = [
  /\bsuicid/i,
  /\bkill\s+myself\b/i,
  /\bhurt\s+myself\b/i,
  /\bend\s+(it|my\s+life)\b/i,
  /\bself[-\s]?harm/i,
  /\bharm\s+myself\b/i,
  /\babuse\b/i,
  /\bunsafe\s+at\s+home\b/i,
];

/**
 * Acute glycaemic patterns that always fire when matched. Keto-related
 * queries are split out into `KETOACIDOSIS_HARD` (always intercept) and
 * `KETONES_CONDITIONAL` (only with reporting intent).
 */
const ACUTE_HARD_PATTERNS: readonly RegExp[] = [
  // Only the diabetic sense — \b before the optional group prevents matches
  // inside hypothyroid, hypotension, hypovolaemia, hypoxia.
  /\bhypo(s|glycaemic|glycaemia|glycemic|glycemia)?\b/i,
  /\bsevere\s+low\b/i,
  /\bpassing\s+out\b/i,
  /\bpassed\s+out\b/i,
  /\bunconscious\b/i,
  /\bconvulsion\b/i,
  /\bseizure\b/i,
  /\bseizing\b/i,
  /\bfitting\b/i,
  /\bdka\b/i,
  /\bketoacidos(is|es)\b/i,
  /\bvomit/i,
  /can'?t\s+keep\s+(fluids|water)\s+down/i,
];

/** Conditional rule: bare `ketones?` only intercepts with reporting intent nearby. */
const KETONES_CONDITIONAL = /\bketones?\b/i;

/**
 * Tokens that, when present within a small word window of `ketones?`, signal
 * the user is reporting their ketone state rather than asking about ketones
 * conceptually. Educational queries ("what are ketones?", "how do I check
 * ketones?") fall through to the LLM.
 */
const KETONE_REPORTING_TERMS: readonly RegExp[] = [
  /^\d+(\.\d+)?$/,
  /^mmol$/i,
  /^mg\/?dl?$/i,
  /^have$/i,
  /^got$/i,
  /^high$/i,
  /^raised$/i,
  /^elevated$/i,
  /^positive$/i,
  /^detected$/i,
];

const KETONE_WINDOW_TOKENS = 10;

const DISORDERED_EATING_PATTERNS: readonly RegExp[] = [
  // Verb ... insulin/long-acting/specific brand. The verb/state list is broad
  // because patients describe restriction in many ways.
  /\b(skip(ped|ping)?|stop(ped|ping)?|miss(ed|ing)?|omit(ted|ting)?|reduce[ds]?|restrict(ing|ed)?|cut(ting)?\s+back\s+on)\s+(my\s+|the\s+)?(insulin|bolus|basal|lantus|tresiba|novorapid|humalog|fiasp|levemir|toujeo|long[-\s]?acting|fast[-\s]?acting)\b/i,
  /\b(eating\s+disorder|disordered\s+eating|t1de|diabulimia|bulimi[ac]|anorexi[ac])\b/i,
  /\b(use|using)\s+insulin\s+to\s+(lose|control)\s+weight\b/i,
];

const EMERGENCY_SERVICES_PATTERNS: readonly RegExp[] = [
  /\b999\b/,
  /\b911\b/,
  /\bambulance\b/i,
  /\ba&e\b/i,
  /\ba\s+and\s+e\b/i,
  /\bemergency\s+room\b/i,
  /\ber\s+now\b/i,
];

/**
 * Tokenise a message into lowercase word-ish chunks for the ketone window
 * check. Splits on whitespace and strips trailing punctuation; keeps embedded
 * punctuation (e.g. `mg/dl`, `2.4`) so the reporting-intent regexes match.
 */
function tokenise(message: string): string[] {
  return message
    .split(/\s+/)
    .map((t) => t.replace(/^[^\w/.&-]+|[^\w/.&-]+$/g, "").toLowerCase())
    .filter((t) => t.length > 0);
}

function ketonesWithReportingIntent(message: string): RegExpExecArray | null {
  const flat = KETONES_CONDITIONAL.exec(message);
  if (!flat) return null;

  const tokens = tokenise(message);
  const ketoneTokenIndices: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (/^ketones?$/i.test(tokens[i])) {
      ketoneTokenIndices.push(i);
    }
  }
  if (ketoneTokenIndices.length === 0) return null;

  for (const ketoneIdx of ketoneTokenIndices) {
    const lo = Math.max(0, ketoneIdx - KETONE_WINDOW_TOKENS);
    const hi = Math.min(tokens.length - 1, ketoneIdx + KETONE_WINDOW_TOKENS);
    for (let j = lo; j <= hi; j++) {
      if (j === ketoneIdx) continue;
      const tok = tokens[j];
      if (KETONE_REPORTING_TERMS.some((re) => re.test(tok))) {
        return flat;
      }
    }
  }
  return null;
}

function firstMatch(
  patterns: readonly RegExp[],
  message: string,
): RegExpExecArray | null {
  for (const re of patterns) {
    const m = re.exec(message);
    if (m) return m;
  }
  return null;
}

/**
 * Returns the first matching category by priority order, or null if the
 * message should reach the LLM.
 */
export function intercept(message: string): InterceptorMatch | null {
  if (typeof message !== "string" || message.trim().length === 0) return null;

  // 1. Safeguarding wins over everything (life-safety + welfare).
  const safeguard = firstMatch(SAFEGUARDING_PATTERNS, message);
  if (safeguard) {
    return { category: "safeguarding", matchedTerm: safeguard[0] };
  }

  // 2. Acute glycaemic events (hard list + conditional ketones).
  const acuteHard = firstMatch(ACUTE_HARD_PATTERNS, message);
  if (acuteHard) {
    return { category: "acute_glycaemic", matchedTerm: acuteHard[0] };
  }
  const ketones = ketonesWithReportingIntent(message);
  if (ketones) {
    return { category: "acute_glycaemic", matchedTerm: ketones[0] };
  }

  // 3. Disordered eating with insulin (T1DE / diabulimia / insulin omission).
  const disordered = firstMatch(DISORDERED_EATING_PATTERNS, message);
  if (disordered) {
    return {
      category: "disordered_eating_with_insulin",
      matchedTerm: disordered[0],
    };
  }

  // 4. Emergency services (lowest priority — just a number / phrase).
  const emergency = firstMatch(EMERGENCY_SERVICES_PATTERNS, message);
  if (emergency) {
    return { category: "emergency_services", matchedTerm: emergency[0] };
  }

  return null;
}
