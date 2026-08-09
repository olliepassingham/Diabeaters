/**
 * Shared types for the AI Coach.
 *
 * Imported by both the Deno Edge Function (`supabase/functions/ai_coach/index.ts`)
 * and Vitest specs in this directory. No Deno- or browser-specific code here.
 *
 * See docs/regulatory/ai_coach_system_prompt.md §3 (context block) and §4 (output
 * contract).
 */

export type InterceptorCategory =
  | "acute_glycaemic"
  | "disordered_eating_with_insulin"
  | "emergency_services"
  | "safeguarding";

export type AuditCategory =
  | InterceptorCategory
  | "llm"
  | "rate_limited"
  | "consent_required"
  | "llm_disabled"
  | "llm_error"
  | "post_filter_refused"
  | "invalid_request"
  | "feed_scheduled_post"
  | "feed_scheduled_skipped";

export type PostFilterStatus = "pass" | "rewritten" | "refused" | "n/a";

/**
 * Who the coach is talking to — selects which canonical system prompt is used
 * (see docs/regulatory/ai_coach_system_prompt.md §2 vs §2b).
 *
 * - `patient`   — default; the signed-in user has T1D themselves.
 * - `supporter` — Supporter Mode (carer / partner / family / friend). Same hard
 *                 rules and href allow-list, but the prompt is reworded to
 *                 address the supporter and never recommend overriding the
 *                 supported person's plan.
 *
 * Client-asserted today; server-side detection (e.g. via `linked_carers`) is a
 * follow-up. Safety guardrails do not depend on this flag.
 */
export type CoachAudience = "patient" | "supporter";

/** Trip intent mirrored from `scenarios.state` when travel is active — enum only, no free text. */
export type CoachTravelTripStyle = "relax" | "active" | "city" | "remote" | "family";

export type AllowedHref =
  | "/"
  | "/tools"
  | "/scenarios"
  | "/community"
  | "/community/setup"
  | "/community/messages"
  | "/account"
  | "/appointments"
  | "/adviser"
  | "/adviser?tab=meal"
  | "/adviser?tab=meal&split=1"
  | "/adviser?tab=ratios"
  | "/scenarios/exercise"
  | "/scenarios/travel"
  | "/scenarios/sick-day"
  | "/scenarios/alcohol"
  | "/scenarios/driving"
  | "/scenarios/pump-failure"
  | "/scenarios/bedtime"
  | "/tools/hypo-help"
  | "/tools/correction"
  | "/tools/tips"
  | "/tools/activity"
  | "/tools/patterns"
  | "/tools/hypo-history"
  | "/tools/glucose-converter"
  | "/tools/achievements"
  | "/tools/cgm-live"
  | "/education"
  | "/settings"
  | "/settings/usage"
  | "/settings/ratios"
  | "/settings/cgm"
  | "/settings/notifications"
  | "/settings/pharmacy"
  | "/settings/emergency"
  | "/help-now"
  | "/emergency-card"
  | "/supplies"
  | "/routines";

export const ALLOWED_HREFS: ReadonlyArray<AllowedHref> = [
  "/",
  "/tools",
  "/scenarios",
  "/community",
  "/community/setup",
  "/community/messages",
  "/account",
  "/appointments",
  "/adviser",
  "/adviser?tab=meal",
  "/adviser?tab=meal&split=1",
  "/adviser?tab=ratios",
  "/scenarios/exercise",
  "/scenarios/travel",
  "/scenarios/sick-day",
  "/scenarios/alcohol",
  "/scenarios/driving",
  "/scenarios/pump-failure",
  "/scenarios/bedtime",
  "/tools/hypo-help",
  "/tools/correction",
  "/tools/tips",
  "/tools/activity",
  "/tools/patterns",
  "/tools/hypo-history",
  "/tools/glucose-converter",
  "/tools/achievements",
  "/tools/cgm-live",
  "/education",
  "/settings",
  "/settings/usage",
  "/settings/ratios",
  "/settings/cgm",
  "/settings/notifications",
  "/settings/pharmacy",
  "/settings/emergency",
  "/help-now",
  "/emergency-card",
  "/supplies",
  "/routines",
] as const;

/** A single conversation turn; used both client-side and on the wire. */
export interface CoachTurn {
  role: "user" | "assistant";
  content: string;
}

export interface CoachAction {
  label: string;
  href: string;
}

export interface CoachReply {
  reply: string;
  suggestedQuestions: string[];
  suggestedNextActions: CoachAction[];
  deferToTeam: boolean;
}

/**
 * The privacy-minimised context block built server-side and prepended to the
 * LLM prompt. Mirrors §3 of the spec. Numbers and small enums only — never
 * names, emails, postcodes, raw timestamps, or free-text notes.
 */
export interface CoachContext {
  profile: {
    /**
     * Decade band for adults (≥ 18), or `under18` when DOB implies the account
     * holder is under 18, or `unknown` when DOB is missing or invalid.
     */
    ageBand: "under18" | "18-29" | "30-39" | "40-49" | "50-59" | "60+" | "unknown";
    /** Whole years since DOB in UTC; null when DOB is unknown or invalid. */
    ageYears: number | null;
    deliveryMethod: "mdi" | "pump" | "unknown";
    bgUnits: "mmol/L" | "mg/dL" | "unknown";
    carbUnits: "grams" | "portions" | "unknown";
    cgmUse: "yes" | "no" | "unknown";
    /** Pump automation / loop flag; `not_applicable` when `deliveryMethod` is not `pump`. */
    closedLoop: "yes" | "no" | "not_applicable" | "unknown";
    diagnosedYearsAgo: number | null;
  };
  /**
   * Optional client-computed pharmacy opening status.
   * v1 cannot safely derive this server-side because `profiles.pharmacy` hours
   * are stored as local-time `HH:mm` without an IANA timezone.
   */
  pharmacy?: {
    configured: boolean;
    openNow: boolean | null;
    nextOpensInMinutes: number | null;
    closesInMinutes: number | null;
  };
  lastFortnight: {
    bgReadings: number;
    estimatedTimeInRangePct: number | null;
    hypoCount: number;
    severeHypoCount: number;
    highCount: number;
    exerciseSessions: number;
    sickDayActive: boolean;
    travelModeActive: boolean;
    /** Present only when travel mode is active and a known style was saved to the travel scenario row. */
    travelTripStyle?: CoachTravelTripStyle;
  };
  /**
   * Optional supply snapshot from `public.supplies` (server-read only).
   * Category is the app’s canonical supply type string; no product names or notes.
   */
  supplies?: CoachSuppliesSummary;
  ratiosAreSet: boolean;
  /** Empty when the user has logged < ~14 days of data; the model is told to admit this. */
  dataSparse: boolean;
}

/** Aggregated supply rows for Coach — counts and enums only. */
export interface CoachSuppliesSummary {
  trackedSlots: number;
  criticalOrEmptySlots: number;
  slotsByCategory: Record<string, number>;
}

/** Body the client POSTs to the Edge Function. */
export interface CoachRequest {
  /** Latest user message. */
  message: string;
  /** Recent conversation turns for continuity (client-managed; we cap on the server). */
  history?: CoachTurn[];
  /** Pre-computed `lastFortnight` summary from localStorage. */
  lastFortnight: CoachContext["lastFortnight"];
  /** Whether the user has any saved meal ratios. */
  ratiosAreSet: boolean;
  /** Optional. Defaults to `patient`. Selects patient vs supporter system prompt. */
  audience?: CoachAudience;
  /**
   * Optional `YYYY-MM-DD` from the device when `profiles.date_of_birth` is not
   * synced yet; server prefers the cloud value when both exist.
   */
  dateOfBirth?: string | null;
  /**
   * Optional client-computed pharmacy status; see `CoachContext.pharmacy`.
   * Server sanitises but does not attempt timezone conversion in v1.
   */
  pharmacyStatus?: CoachContext["pharmacy"];
}

/**
 * Server response shape. Always 200 once the request body parses; failures
 * are surfaced through `category` (e.g. `rate_limited`, `llm_disabled`).
 */
export interface CoachResponse extends CoachReply {
  category: AuditCategory;
  /** Set when the post-filter rewrote or refused the LLM's reply. */
  postFilter?: PostFilterStatus;
}
