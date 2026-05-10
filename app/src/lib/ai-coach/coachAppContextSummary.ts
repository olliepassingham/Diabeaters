/**
 * Read-only helpers for Beatie (AI coach) deep links and supply aggregation.
 * Supply aggregation mirrors `buildSuppliesCoachSummary` in
 * `supabase/functions/_shared/ai-coach/trustedContextFromDb.ts`.
 */

import type { CoachTopicSlug } from "@/lib/ai-coach/topics";
import type { Supply } from "@/lib/storage";
import { storage } from "@/lib/storage";

/** Matches Edge Function `CoachSuppliesSummary` (counts / categories only). */
export type CoachSuppliesSummaryWire = {
  trackedSlots: number;
  criticalOrEmptySlots: number;
  slotsByCategory: Record<string, number>;
};

const COACH_ALLOWED_SUPPLY_CATEGORIES = new Set([
  "needle",
  "insulin",
  "insulin_short",
  "insulin_long",
  "insulin_vial",
  "cgm",
  "infusion_set",
  "reservoir",
  "other",
]);

function normalizeCategory(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const v = String(raw).trim().toLowerCase();
  return v.length > 0 ? v : null;
}

function isCriticalOrEmptyForCoach(quantity: number, daysRemaining: number): boolean {
  const q = Number.isFinite(quantity) ? quantity : 0;
  if (q <= 0) return true;
  if (Number.isFinite(daysRemaining) && daysRemaining <= 3) return true;
  return false;
}

/**
 * Same aggregation as `buildSuppliesCoachSummary` on the server; uses live
 * local supplies and runway (e.g. tests and tooling).
 */
export function buildSuppliesCoachSummaryFromSupplies(supplies: Supply[]): CoachSuppliesSummaryWire | undefined {
  if (!supplies.length) return undefined;
  const slotsByCategory: Record<string, number> = {};
  let criticalOrEmptySlots = 0;
  for (const supply of supplies) {
    const adjusted = storage.getAdjustedQuantity(supply);
    const q = Math.floor(adjusted);
    const daysRemaining = storage.getDaysRemaining(supply);
    if (isCriticalOrEmptyForCoach(q, daysRemaining)) criticalOrEmptySlots += 1;
    const cat = normalizeCategory(supply.type);
    const key = cat && COACH_ALLOWED_SUPPLY_CATEGORIES.has(cat) ? cat : "other";
    slotsByCategory[key] = (slotsByCategory[key] ?? 0) + 1;
  }
  return {
    trackedSlots: supplies.length,
    criticalOrEmptySlots: Math.min(supplies.length, Math.max(0, criticalOrEmptySlots)),
    slotsByCategory,
  };
}

export function pickCoachTopicSlugFromScenarioState(): CoachTopicSlug {
  const s = storage.getScenarioState();
  if (s.pumpFailureActive) return "pump-failure";
  if (s.sickDayActive) return "sick-day";
  if (s.travelModeActive) return "travel";
  return "general";
}
