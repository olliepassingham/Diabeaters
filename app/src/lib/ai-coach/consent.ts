/**
 * AI Coach consent — stored on `public.profiles` (server-side) so the Edge
 * Function can gate calls before any LLM transfer.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Bump when in-app consent copy materially changes (re-prompt users). */
export const AI_COACH_CONSENT_VERSION = "2026-05-01";

export async function fetchAiCoachConsentAt(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("ai_coach_consent_at")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  const raw = (data as { ai_coach_consent_at?: string | null }).ai_coach_consent_at;
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

export async function acceptAiCoachConsent(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ error: string | null }> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({
      ai_coach_consent_at: now,
      ai_coach_consent_version: AI_COACH_CONSENT_VERSION,
    })
    .eq("id", userId);

  if (error) {
    return { error: error.message || "update_failed" };
  }
  return { error: null };
}
