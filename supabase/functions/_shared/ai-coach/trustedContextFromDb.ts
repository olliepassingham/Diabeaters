/**
 * Server-side, privacy-preserving aggregates for AI Coach context.
 * Uses only counts and canonical supply categories — never free-text notes,
 * treatment strings, supply display names, or raw timestamps in the LLM payload.
 */

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { LastFortnightInput } from "./contextPacker.ts";
import { EMPTY_LAST_FORTNIGHT } from "./serverInputs.ts";
import type { CoachSuppliesSummary } from "./types.ts";

/** Matches app `Supply["type"]` / cloud `category` when synced from Diabeaters. */
export const COACH_ALLOWED_SUPPLY_CATEGORIES = new Set([
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

export type RawSupplyRow = {
  category: string | null;
  quantity: number | null;
  days_remaining_cached: number | null;
};

function normalizeCategory(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const v = String(raw).trim().toLowerCase();
  return v.length > 0 ? v : null;
}

function isCriticalOrEmpty(row: RawSupplyRow): boolean {
  const q = typeof row.quantity === "number" && Number.isFinite(row.quantity) ? row.quantity : 0;
  if (q <= 0) return true;
  const d = row.days_remaining_cached;
  if (typeof d === "number" && Number.isFinite(d) && d <= 3) return true;
  return false;
}

/** Pure aggregation for unit tests and deterministic packing. */
export function buildSuppliesCoachSummary(rows: ReadonlyArray<RawSupplyRow>): CoachSuppliesSummary | undefined {
  if (!rows.length) return undefined;
  const slotsByCategory: Record<string, number> = {};
  let criticalOrEmptySlots = 0;
  for (const row of rows) {
    if (isCriticalOrEmpty(row)) criticalOrEmptySlots += 1;
    const cat = normalizeCategory(row.category);
    const key = cat && COACH_ALLOWED_SUPPLY_CATEGORIES.has(cat) ? cat : "other";
    slotsByCategory[key] = (slotsByCategory[key] ?? 0) + 1;
  }
  return {
    trackedSlots: rows.length,
    criticalOrEmptySlots: Math.min(rows.length, Math.max(0, criticalOrEmptySlots)),
    slotsByCategory,
  };
}

function sinceIsoFortnight(): string {
  return new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
}

/** True when `state[key]` is a JSON boolean/scalar the app uses as “on”. */
export function scenarioStateFlag(state: unknown, keys: readonly string[]): boolean {
  if (!state || typeof state !== "object") return false;
  const o = state as Record<string, unknown>;
  for (const k of keys) {
    const v = o[k];
    if (v === true) return true;
    if (v === 1) return true;
    if (typeof v === "string" && (v === "true" || v === "1")) return true;
  }
  return false;
}

export type ScenarioFlagRow = { scenario_key: string; state: unknown };

/**
 * Derive sick-day / travel mode booleans from `public.scenarios` rows only.
 * Reads known boolean keys inside `state` — never passes titles, labels, or arbitrary JSON to the LLM.
 */
export function deriveScenarioFlagsFromRows(rows: ReadonlyArray<ScenarioFlagRow>): {
  sickDayActive: boolean;
  travelModeActive: boolean;
} {
  let sickDayActive = false;
  let travelModeActive = false;
  for (const row of rows) {
    const key = typeof row.scenario_key === "string" ? row.scenario_key.trim() : "";
    if (key === "sick_day") {
      if (scenarioStateFlag(row.state, ["sick_day_active", "sickDayActive"])) sickDayActive = true;
    } else if (key === "travel") {
      if (scenarioStateFlag(row.state, ["travel_active", "travelModeActive"])) travelModeActive = true;
    }
  }
  return { sickDayActive, travelModeActive };
}

export async function loadCoachScenarioFlags(
  admin: SupabaseClient,
  userId: string,
): Promise<{ sickDayActive: boolean; travelModeActive: boolean }> {
  try {
    const { data, error } = await admin
      .from("scenarios")
      .select("scenario_key, state")
      .eq("user_id", userId)
      .in("scenario_key", ["sick_day", "travel"]);
    if (error) throw error;
    if (!Array.isArray(data)) return { sickDayActive: false, travelModeActive: false };
    const rows: ScenarioFlagRow[] = data.map((r: Record<string, unknown>) => ({
      scenario_key: typeof r.scenario_key === "string" ? r.scenario_key : "",
      state: r.state,
    }));
    return deriveScenarioFlagsFromRows(rows);
  } catch (e) {
    console.warn("[ai_coach] loadCoachScenarioFlags fallback", e);
    return { sickDayActive: false, travelModeActive: false };
  }
}

export async function loadCoachTrustedLastFortnight(
  admin: SupabaseClient,
  userId: string,
): Promise<LastFortnightInput> {
  const since = sinceIsoFortnight();
  try {
    const hypoRes = await admin
      .from("hypo_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since);
    if (hypoRes.error) throw hypoRes.error;
    const hypoCount = typeof hypoRes.count === "number" ? hypoRes.count : 0;

    const bgRes = await admin
      .from("hypo_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since)
      .not("blood_glucose", "is", null);
    if (bgRes.error) throw bgRes.error;
    const bgTagged = typeof bgRes.count === "number" ? bgRes.count : 0;

    return {
      ...EMPTY_LAST_FORTNIGHT,
      hypoCount,
      bgReadings: Math.max(hypoCount, bgTagged),
    };
  } catch (e) {
    console.warn("[ai_coach] loadCoachTrustedLastFortnight fallback", e);
    return { ...EMPTY_LAST_FORTNIGHT };
  }
}

export async function loadCoachSuppliesSummary(
  admin: SupabaseClient,
  userId: string,
): Promise<CoachSuppliesSummary | undefined> {
  try {
    const { data, error } = await admin
      .from("supplies")
      .select("category, quantity, days_remaining_cached")
      .eq("user_id", userId);
    if (error) throw error;
    if (!Array.isArray(data) || data.length === 0) return undefined;
    const rows: RawSupplyRow[] = data.map((r: Record<string, unknown>) => ({
      category: typeof r.category === "string" && r.category.trim() ? r.category : null,
      quantity: typeof r.quantity === "number" ? r.quantity : Number(r.quantity) || 0,
      days_remaining_cached:
        typeof r.days_remaining_cached === "number"
          ? r.days_remaining_cached
          : r.days_remaining_cached == null
            ? null
            : Number(r.days_remaining_cached),
    }));
    return buildSuppliesCoachSummary(rows);
  } catch (e) {
    console.warn("[ai_coach] loadCoachSuppliesSummary skipped", e);
    return undefined;
  }
}
