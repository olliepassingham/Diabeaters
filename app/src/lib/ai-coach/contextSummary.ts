/**
 * Builds the privacy-minimised `lastFortnight` summary sent to the AI Coach
 * Edge Function. Numbers and booleans only — no free-text notes, names, or
 * destinations.
 */

import { storage } from "@/lib/storage";

const FORTNIGHT_MS = 14 * 24 * 60 * 60 * 1000;

function cutoff(): number {
  return Date.now() - FORTNIGHT_MS;
}

function isRecentIso(iso: string): boolean {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return t >= cutoff();
}

export type AiCoachLastFortnightWire = {
  bgReadings: number;
  estimatedTimeInRangePct: number | null;
  hypoCount: number;
  severeHypoCount: number;
  highCount: number;
  exerciseSessions: number;
  sickDayActive: boolean;
  travelModeActive: boolean;
};

export interface AiCoachClientPayload {
  lastFortnight: AiCoachLastFortnightWire;
  ratiosAreSet: boolean;
  bgUnits: string | null;
}

/**
 * Aggregates local-only signals into the wire shape expected by
 * `supabase/functions/ai_coach/index.ts`.
 */
export function buildAiCoachClientPayload(): AiCoachClientPayload {
  const scenario = storage.getScenarioState();

  const hypos = storage.getHypoTreatments().filter((h) => isRecentIso(h.timestamp));
  const outcomes = storage.getExerciseOutcomes().filter((o) => isRecentIso(o.completedAt));

  const exerciseWithBg = outcomes.filter((o) => o.bgResponse != null).length;
  const bgReadings = hypos.length + exerciseWithBg;

  const settings = storage.getSettings();
  const ratiosAreSet = Boolean(
    (settings.breakfastRatio && settings.breakfastRatio.trim()) ||
      (settings.lunchRatio && settings.lunchRatio.trim()) ||
      (settings.dinnerRatio && settings.dinnerRatio.trim()) ||
      (settings.snackRatio && settings.snackRatio.trim()),
  );

  const profile = storage.getProfile();
  const bgUnitsRaw = profile?.bgUnits?.trim();
  const bgUnits =
    bgUnitsRaw === "mmol/L" || bgUnitsRaw?.toLowerCase() === "mmol/l"
      ? "mmol/L"
      : bgUnitsRaw === "mg/dL" || bgUnitsRaw?.toLowerCase() === "mg/dl"
        ? "mg/dL"
        : null;

  return {
    lastFortnight: {
      bgReadings,
      estimatedTimeInRangePct: null,
      hypoCount: hypos.length,
      severeHypoCount: 0,
      highCount: 0,
      exerciseSessions: outcomes.length,
      sickDayActive: Boolean(scenario.sickDayActive),
      travelModeActive: Boolean(scenario.travelModeActive),
    },
    ratiosAreSet,
    bgUnits,
  };
}
