import type { ExerciseBgTrend } from "@/lib/storage";

/** Identifies which bridge supplied a glucose reading. */
export type CgmSourceId = "health_platform" | "nightscout" | "libre_link_up" | "dexcom_share";

export type BgUnits = "mmol/L" | "mg/dL";

/** Normalised glucose sample for tool prefill and display. */
export type GlucoseReading = {
  value: number;
  units: BgUnits;
  /** When the CGM/OS recorded the sample (ISO 8601). */
  recordedAt: string;
  source: CgmSourceId;
  /** Human label, e.g. "Apple Health" or "Dexcom via Health". */
  sourceLabel: string;
  /** Optional trend when the bridge exposes it (HealthKit usually does not). */
  trend: ExerciseBgTrend | null;
  /** Minutes between `recordedAt` and fetch time. */
  ageMinutes: number;
  isStale: boolean;
  /** Shown when `isStale` or reading is old but still offered. */
  stalenessNote: string | null;
};

export type CgmAvailability = {
  available: boolean;
  reason?: string;
};

export type CgmAccessResult = {
  granted: boolean;
  error?: string;
};
