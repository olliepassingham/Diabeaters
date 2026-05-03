/**
 * Client-side types for the AI Coach API (must match the Edge Function JSON).
 *
 * Canonical field definitions live in `supabase/functions/_shared/ai-coach/types.ts`.
 */

export type CoachTurn = {
  role: "user" | "assistant";
  content: string;
};

/**
 * Who the coach is talking to.
 *
 * - `patient`  — default; the signed-in user who has T1D themselves.
 * - `supporter` — Supporter Mode (carer / partner / family). The same hard
 *                 rules apply, but the prompt is reworded to address the
 *                 supporter, not the person with diabetes.
 *
 * Client-asserted only for now; safety guardrails do not depend on this.
 */
export type CoachAudience = "patient" | "supporter";

export type CoachAction = {
  label: string;
  href: string;
};

export type AuditCategory =
  | "acute_glycaemic"
  | "disordered_eating_with_insulin"
  | "emergency_services"
  | "safeguarding"
  | "llm"
  | "rate_limited"
  | "consent_required"
  | "llm_disabled"
  | "llm_error"
  | "post_filter_refused"
  | "invalid_request";

export type PostFilterStatus = "pass" | "rewritten" | "refused" | "n/a";

export type CoachResponse = {
  reply: string;
  suggestedQuestions: string[];
  suggestedNextActions: CoachAction[];
  deferToTeam: boolean;
  category: AuditCategory;
  postFilter?: PostFilterStatus;
};
