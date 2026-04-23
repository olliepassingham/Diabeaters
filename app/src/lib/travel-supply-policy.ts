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
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY);
  return Math.max(1, diffDays);
}

export function holidaySupplyDaysNeeded(calendarTripDays: number): number {
  return Math.max(1, Math.ceil(calendarTripDays * HOLIDAY_SUPPLY_COVERAGE_TRIP_MULTIPLIER));
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
