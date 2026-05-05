/**
 * Server-trusted input helpers for the AI Coach Edge Function.
 *
 * These helpers move safety-critical decisions off the request body and onto
 * server-derived state:
 *   - `deriveServerAudience` — only allows `supporter` when the JWT subject is
 *     actually linked as a carer for at least one patient (a row in
 *     `public.carer_links`). The body's `audience` is ignored for `supporter`
 *     unless that link exists.
 *   - `EMPTY_LAST_FORTNIGHT` / `serverPlaceholderLastFortnight` — zero baseline
 *     used when building server-trusted `lastFortnight` input (see
 *     `trustedContextFromDb.ts`). Client-supplied `lastFortnight` is ignored for
 *     the model to prevent tampering.
 */

import type { CoachAudience } from "./types.ts";
import type { LastFortnightInput } from "./contextPacker.ts";

/**
 * Server-trusted audience derivation.
 *
 * @param requestedAudience  Audience the client asked for (body-supplied).
 * @param hasCarerLink       Whether the caller is a carer in `public.carer_links`.
 * @returns                  `"supporter"` only when both the request asked for
 *                           it AND the caller has a real carer link. Otherwise
 *                           always `"patient"` — a non-linked user cannot
 *                           pretend to be talking from a supporter context.
 */
export function deriveServerAudience(
  requestedAudience: CoachAudience,
  hasCarerLink: boolean,
): CoachAudience {
  if (requestedAudience === "supporter" && hasCarerLink) return "supporter";
  return "patient";
}

/**
 * Zeroed `lastFortnight` placeholder. The post-filter and system prompt are
 * built so the model honestly says "I can't see enough data yet to spot a
 * pattern" rather than inventing one when this is in place.
 */
export const EMPTY_LAST_FORTNIGHT: LastFortnightInput = {
  bgReadings: 0,
  estimatedTimeInRangePct: null,
  hypoCount: 0,
  severeHypoCount: 0,
  highCount: 0,
  exerciseSessions: 0,
  sickDayActive: false,
  travelModeActive: false,
};

/** Always returns a fresh copy of the empty placeholder (defensive). */
export function serverPlaceholderLastFortnight(): LastFortnightInput {
  return { ...EMPTY_LAST_FORTNIGHT };
}
