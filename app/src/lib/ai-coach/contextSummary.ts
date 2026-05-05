/**
 * Builds the privacy-minimised `lastFortnight` summary sent to the AI Coach
 * Edge Function. Numbers and booleans only — no free-text notes, names, or
 * destinations.
 */

import { normalizeDateOfBirthInput } from "@/lib/user-age";
import { isCommunityAccountProfile, storage } from "@/lib/storage";
import {
  isPharmacyOpenAt,
  nextPharmacyOpeningAt,
  pharmacyDayLabel,
  pharmacyDayKeyForDate,
  formatPharmacyHHmm,
  pharmacyOpenIntervalsForDay,
} from "@/lib/pharmacy";

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

export type AiCoachPharmacyStatusWire = {
  /** True when a pharmacy exists and has at least a name. */
  configured: boolean;
  /** Null when not configured. */
  openNow: boolean | null;
  /** Minutes from now until next opening, null when unknown / not configured. */
  nextOpensInMinutes: number | null;
  /** Minutes from now until close when currently open, else null. */
  closesInMinutes: number | null;
  /** E.g. "Today (Tue): 09:00–17:30" or "Today (Tue): Closed". */
  todaySummary: string | null;
  /** E.g. "Tomorrow (Wed): 09:00–13:00, 14:00–18:00" or "Tomorrow (Wed): Closed". */
  tomorrowSummary: string | null;
};

export interface AiCoachClientPayload {
  lastFortnight: AiCoachLastFortnightWire;
  ratiosAreSet: boolean;
  bgUnits: string | null;
  /** `YYYY-MM-DD` when stored locally; omitted when unset or invalid. */
  dateOfBirth?: string;
  /** Client-computed pharmacy status (server cannot infer timezone in v1). */
  pharmacyStatus: AiCoachPharmacyStatusWire;
}

/**
 * Aggregates local-only signals into the wire shape expected by
 * `supabase/functions/ai_coach/index.ts`.
 */
export function buildAiCoachClientPayload(): AiCoachClientPayload {
  if (isCommunityAccountProfile(storage.getProfile())) {
    return {
      lastFortnight: {
        bgReadings: 0,
        estimatedTimeInRangePct: null,
        hypoCount: 0,
        severeHypoCount: 0,
        highCount: 0,
        exerciseSessions: 0,
        sickDayActive: false,
        travelModeActive: false,
      },
      ratiosAreSet: false,
      bgUnits: null,
      pharmacyStatus: {
        configured: false,
        openNow: null,
        nextOpensInMinutes: null,
        closesInMinutes: null,
        todaySummary: null,
        tomorrowSummary: null,
      },
    };
  }

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

  const dateOfBirth = normalizeDateOfBirthInput(profile?.dateOfBirth) ?? undefined;

  const pharmacy = storage.getPharmacy();
  const pharmacyConfigured = Boolean(pharmacy?.name?.trim());
  let pharmacyStatus: AiCoachPharmacyStatusWire = {
    configured: pharmacyConfigured,
    openNow: null,
    nextOpensInMinutes: null,
    closesInMinutes: null,
    todaySummary: null,
    tomorrowSummary: null,
  };
  if (pharmacyConfigured && pharmacy) {
    const now = new Date();
    const todayKey = pharmacyDayKeyForDate(now);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = pharmacyDayKeyForDate(tomorrow);

    const formatDayLine = (label: "Today" | "Tomorrow", key: string): string => {
      // Key is PharmacyDayKey, but we keep it generic to avoid extra imports.
      const k = key as any;
      const intervals = pharmacyOpenIntervalsForDay((pharmacy as any).hours?.[k]);
      const dayLabel = pharmacyDayLabel(k, "short");
      if (!intervals || intervals.length === 0) return `${label} (${dayLabel}): Closed`;
      const parts = intervals.map((iv: any) => `${formatPharmacyHHmm(iv.start)}–${formatPharmacyHHmm(iv.end)}`);
      return `${label} (${dayLabel}): ${parts.join(", ")}`;
    };

    const openNow = isPharmacyOpenAt(pharmacy, now);
    const next = nextPharmacyOpeningAt(pharmacy, now);
    const nextOpensInMinutes =
      next && Number.isFinite(next.getTime())
        ? Math.max(0, Math.round((next.getTime() - now.getTime()) / 60_000))
        : null;

    let closesInMinutes: number | null = null;
    if (openNow) {
      const key = pharmacyDayKeyForDate(now);
      const intervals = pharmacyOpenIntervalsForDay(pharmacy.hours[key]);
      const nowM = now.getHours() * 60 + now.getMinutes();
      const cur = intervals.find((iv) => nowM >= iv.start && nowM < iv.end) ?? null;
      if (cur) {
        closesInMinutes = Math.max(0, cur.end - nowM);
      }
    }

    pharmacyStatus = {
      configured: true,
      openNow,
      nextOpensInMinutes,
      closesInMinutes,
      todaySummary: formatDayLine("Today", todayKey),
      tomorrowSummary: formatDayLine("Tomorrow", tomorrowKey),
    };
  }

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
    pharmacyStatus,
    ...(dateOfBirth ? { dateOfBirth } : {}),
  };
}
