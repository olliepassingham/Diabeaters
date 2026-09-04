/**
 * Single source of truth for trip length and travel stock buffer math
 * (holiday prep coverage, supplies travel extras, travel packing list).
 */

/** Target days-of-cover for holiday prep bars = ceil(tripDays × this). */
export const HOLIDAY_SUPPLY_COVERAGE_TRIP_MULTIPLIER = 2;

export type TravelTypeForBuffer = "domestic" | "international";
export type AccessRiskForBuffer = "easy" | "limited" | "unsure";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Calendar days between two YYYY-MM-DD (or ISO date) strings, both at local midnight.
 * Same rule as holiday prep / trip duration in the travel wizard.
 */
export function tripCalendarDaysBetween(startDateStr: string, endDateStr: string): number {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return 1;
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY);
  return Math.max(1, diffDays);
}

export function holidaySupplyDaysNeeded(calendarTripDays: number): number {
  return Math.max(1, Math.ceil(calendarTripDays * HOLIDAY_SUPPLY_COVERAGE_TRIP_MULTIPLIER));
}

/**
 * Days of cover to aim for before/during a trip.
 * Uses the same domestic/international + pharmacy-access buffers as packing
 * (defaults to domestic + easy access when no plan is saved yet).
 */
export function tripSupplyDaysNeeded(params: {
  calendarTripDays: number;
  plan?: unknown;
}): number {
  const days = Math.max(1, params.calendarTripDays);
  const buffer = travelPlanStockBufferMultiplier(params.plan);
  return Math.max(1, Math.ceil(days * buffer));
}

export type TravelLandingSupplyRow = {
  supply: { name: string };
  daysRemaining: number;
  calendarTripDays: number;
  daysNeeded: number;
  shortfall: number;
};

export type TravelLandingSupplySummary = {
  daysNeeded: number;
  calendarTripDays: number;
  shortfallCount: number;
  hasShortfall: boolean;
  /** Primary line: how many days of cover to pack for. */
  title: string;
  /** Secondary line: trip length + stock status or worst shortfall. */
  detail: string;
};

/**
 * Concrete Travel landing copy for supply coverage (avoids vague "looks covered").
 * `daysNeeded` already includes the travel buffer used by Supply Tracker.
 */
export function formatTravelLandingSupplySummary(
  coverage: TravelLandingSupplyRow[],
): TravelLandingSupplySummary | null {
  if (coverage.length === 0) return null;

  const daysNeeded = coverage[0].daysNeeded;
  const calendarTripDays = coverage[0].calendarTripDays;
  const shortfalls = coverage
    .filter((row) => row.shortfall > 0)
    .sort((a, b) => b.shortfall - a.shortfall || a.supply.name.localeCompare(b.supply.name));
  const shortfallCount = shortfalls.length;
  const title = `Need ${daysNeeded} days of supplies`;

  if (shortfallCount === 0) {
    const finiteRemaining = coverage
      .map((row) => row.daysRemaining)
      .filter((days) => Number.isFinite(days) && days < 999);
    const lowestStock = finiteRemaining.length > 0 ? Math.min(...finiteRemaining) : null;
    return {
      daysNeeded,
      calendarTripDays,
      shortfallCount: 0,
      hasShortfall: false,
      title,
      detail:
        lowestStock != null
          ? `${calendarTripDays}-day trip + buffer · lowest stock ${lowestStock}d`
          : `${calendarTripDays}-day trip + buffer · stock covers the target`,
    };
  }

  const worst = shortfalls[0];
  const others = shortfallCount - 1;
  return {
    daysNeeded,
    calendarTripDays,
    shortfallCount,
    hasShortfall: true,
    title,
    detail:
      others > 0
        ? `${worst.supply.name}: ${worst.shortfall}d short · +${others} more`
        : `${worst.supply.name}: ${worst.shortfall}d short`,
  };
}

/** YYYY-MM-DD local calendar date from a Date. */
export function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Suggest ordering by the earlier of:
 * - departure minus prescription lead time
 * - stock run-out minus lead time
 * Returns null when stock is effectively unlimited.
 */
export function tripSupplyOrderByDate(params: {
  departureDate: string;
  daysRemaining: number;
  leadTimeDays?: number;
  /** Optional “today” for tests (local midnight). */
  today?: Date;
}): string | null {
  if (params.daysRemaining >= 999) return null;
  const lead = Math.max(0, params.leadTimeDays ?? 5);
  const today = params.today ? new Date(params.today) : new Date();
  today.setHours(0, 0, 0, 0);

  const departure = new Date(params.departureDate);
  if (!Number.isFinite(departure.getTime())) return null;
  departure.setHours(0, 0, 0, 0);

  const byTrip = new Date(departure);
  byTrip.setDate(byTrip.getDate() - lead);

  const byStock = new Date(today);
  byStock.setDate(byStock.getDate() + Math.max(0, params.daysRemaining) - lead);

  const orderBy = byTrip.getTime() <= byStock.getTime() ? byTrip : byStock;
  if (orderBy.getTime() < today.getTime()) return formatLocalYmd(today);
  return formatLocalYmd(orderBy);
}

/** Matches travel packing list: more spare stock when flying long-haul / abroad. */
export function travelPackingBufferMultiplier(travelType: TravelTypeForBuffer): number {
  return travelType === "international" ? 2 : 1.5;
}

/** Extra stock when pharmacy access at destination is uncertain. */
export function travelAccessBufferMultiplier(accessRisk: AccessRiskForBuffer): number {
  return accessRisk === "limited" ? 1.5 : accessRisk === "unsure" ? 1.3 : 1;
}

export function travelStockBufferCombined(params: {
  travelType: TravelTypeForBuffer;
  accessRisk: AccessRiskForBuffer;
}): number {
  return travelPackingBufferMultiplier(params.travelType) * travelAccessBufferMultiplier(params.accessRisk);
}

/**
 * Buffer used with daily depletion rate × trip days (supplies "travel extras", etc.).
 * Reads optional fields from persisted travel plan; defaults to domestic + easy access.
 */
export function travelPlanStockBufferMultiplier(plan: unknown): number {
  if (!plan || typeof plan !== "object") {
    return travelStockBufferCombined({ travelType: "domestic", accessRisk: "easy" });
  }
  const p = plan as Record<string, unknown>;
  const travelType: TravelTypeForBuffer = p.travelType === "international" ? "international" : "domestic";
  const accessRisk: AccessRiskForBuffer =
    p.accessRisk === "limited" || p.accessRisk === "unsure" ? p.accessRisk : "easy";
  return travelStockBufferCombined({ travelType, accessRisk });
}

// --- Weather → packing / warnings (Travel wizard inputs) ---

export type TravelWeatherChange = "warmer" | "colder" | "similar" | "unknown";
export type TravelWeatherSeverity = "slight" | "moderate" | "extreme";

export interface TravelWeatherPlanSlice {
  weatherChange: TravelWeatherChange;
  weatherSeverity: TravelWeatherSeverity;
}

function isWeatherMeaningful(plan: TravelWeatherPlanSlice): boolean {
  return plan.weatherChange === "warmer" || plan.weatherChange === "colder";
}

/** Scale hypo treatment count vs baseline (2 treatments/day × trip). */
export function travelWeatherHypoTreatmentsMultiplier(plan: TravelWeatherPlanSlice): number {
  if (!isWeatherMeaningful(plan)) return 1;
  const bump =
    plan.weatherSeverity === "extreme" ? 1.45 : plan.weatherSeverity === "moderate" ? 1.25 : 1.12;
  return bump;
}

/** Extra tape for sites in heat; modest bump in cold (dry skin / adhesion). */
export function travelWeatherAdhesivePiecesMultiplier(plan: TravelWeatherPlanSlice): number {
  if (!isWeatherMeaningful(plan)) return 1;
  if (plan.weatherChange === "warmer") {
    return plan.weatherSeverity === "extreme" ? 1.6 : plan.weatherSeverity === "moderate" ? 1.35 : 1.15;
  }
  return plan.weatherSeverity === "extreme" ? 1.25 : plan.weatherSeverity === "moderate" ? 1.12 : 1.05;
}

/** Slightly more meter checks when climate shifts. */
export function travelWeatherTestStripMultiplier(plan: TravelWeatherPlanSlice): number {
  if (!isWeatherMeaningful(plan)) return 1;
  return plan.weatherSeverity === "extreme" ? 1.2 : plan.weatherSeverity === "moderate" ? 1.1 : 1.05;
}

/** Extra CGM sensors for adhesive failures in heat. */
export function travelWeatherCgmSpareExtraCount(plan: TravelWeatherPlanSlice): number {
  if (plan.weatherChange !== "warmer") return 0;
  return plan.weatherSeverity === "extreme" || plan.weatherSeverity === "moderate" ? 1 : 0;
}

/** Warmer climates can increase pump/CGM power use slightly. */
export function travelWeatherPumpPowerMultiplier(plan: TravelWeatherPlanSlice): number {
  if (plan.weatherChange !== "warmer") return 1;
  if (plan.weatherSeverity === "extreme") return 1.2;
  if (plan.weatherSeverity === "moderate") return 1.1;
  return 1;
}

export type TravelWeatherRiskWarning = {
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
};

export function buildTravelWeatherRiskWarnings(plan: TravelWeatherPlanSlice): TravelWeatherRiskWarning[] {
  const out: TravelWeatherRiskWarning[] = [];
  if (!isWeatherMeaningful(plan)) return out;

  if (plan.weatherChange === "warmer") {
    if (plan.weatherSeverity === "extreme") {
      out.push({
        title: "Hot destination — insulin, sites, and hypos",
        description:
          "Heat can speed insulin absorption from infusion sites or pens and increase hypo risk. Carry fast-acting glucose at all times, hydrate, keep insulin out of direct sun/hot cars, and plan more frequent checks for the first days after arrival.",
        severity: "high",
      });
    } else if (plan.weatherSeverity === "moderate") {
      out.push({
        title: "Warmer climate",
        description:
          "Warmer weather can change how insulin feels day to day. Keep hypo treatment within reach, protect pumps/CGM from heat, and monitor more closely while you adjust.",
        severity: "medium",
      });
    } else {
      out.push({
        title: "Slightly warmer than home",
        description:
          "A modest temperature rise can still nudge absorption. Keep usual hypo kit handy and watch for early signs of lows when active outdoors.",
        severity: "low",
      });
    }
  } else {
    if (plan.weatherSeverity === "extreme") {
      out.push({
        title: "Cold destination — insulin and devices",
        description:
          "Insulin must not freeze (including in checked luggage or a cold hold). Keep insulin in cabin bags close to you, allow pens/vials to warm naturally before use, and protect devices and batteries from extreme cold.",
        severity: "high",
      });
    } else if (plan.weatherSeverity === "moderate") {
      out.push({
        title: "Colder climate",
        description:
          "Cold can affect comfort rotating sites and device battery life. Keep insulin from freezing, warm sites gently before insertion, and pack spare power for pumps/CGM if you will be outside for long stretches.",
        severity: "medium",
      });
    } else {
      out.push({
        title: "Slightly colder than home",
        description:
          "Small temperature drops are usually manageable, but site adhesion and battery life can change. Keep insulin in carry-on and add a layer of routine checks while you settle in.",
        severity: "low",
      });
    }
  }

  return out;
}

/** Read climate fields from persisted travel wizard JSON (defaults if missing / old saves). */
export function travelWeatherPlanSliceFromStoredPlan(plan: unknown): TravelWeatherPlanSlice {
  if (!plan || typeof plan !== "object") {
    return { weatherChange: "unknown", weatherSeverity: "moderate" };
  }
  const p = plan as Record<string, unknown>;
  const wc = p.weatherChange;
  const ws = p.weatherSeverity;
  const weatherChange: TravelWeatherChange =
    wc === "warmer" || wc === "colder" || wc === "similar" || wc === "unknown" ? wc : "unknown";
  const weatherSeverity: TravelWeatherSeverity =
    ws === "slight" || ws === "moderate" || ws === "extreme" ? ws : "moderate";
  return { weatherChange, weatherSeverity };
}

export type TravelIntervalSettings = {
  cgmDays: number;
  siteChangeDays: number;
  reservoirChangeDays: number;
};

/**
 * Extra demand factor for travel shortfall math (supplies page + prescription travel extras),
 * aligned with packing-list weather nudges (conservative).
 */
export function travelWeatherSupplyShortfallMultiplier(
  supplyType: string,
  plan: TravelWeatherPlanSlice,
  tripDays: number,
  intervals: TravelIntervalSettings,
): number {
  let mult = 1;
  const cgmDays = intervals.cgmDays || 14;

  if (supplyType === "cgm" && tripDays > 0) {
    const extra = travelWeatherCgmSpareExtraCount(plan);
    if (extra > 0) {
      const baseSensors = Math.ceil(tripDays / cgmDays);
      if (baseSensors > 0) mult *= (baseSensors + extra) / baseSensors;
    }
  }

  if (supplyType === "infusion_set") {
    if (plan.weatherChange === "warmer" && plan.weatherSeverity === "extreme") mult *= 1.12;
    else if (plan.weatherChange === "warmer" && plan.weatherSeverity === "moderate") mult *= 1.06;
  }

  if (supplyType === "reservoir") {
    if (plan.weatherChange === "warmer" && plan.weatherSeverity === "extreme") mult *= 1.08;
    else if (plan.weatherChange === "warmer" && plan.weatherSeverity === "moderate") mult *= 1.04;
  }

  if (
    supplyType === "insulin" ||
    supplyType === "insulin_short" ||
    supplyType === "insulin_long" ||
    supplyType === "insulin_vial"
  ) {
    const h = travelWeatherHypoTreatmentsMultiplier(plan);
    mult *= 1 + (h - 1) * 0.3;
  }

  if (supplyType === "needle") {
    const h = travelWeatherHypoTreatmentsMultiplier(plan);
    mult *= 1 + (h - 1) * 0.2;
  }

  return mult;
}
