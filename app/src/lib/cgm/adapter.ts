import type {
  CgmAccessResult,
  CgmAvailability,
  CgmSourceId,
  GlucoseReading,
  BgUnits,
} from "@/lib/cgm/types";

/** Bridge that can supply glucose readings to Diabeaters tools. */
export type CgmAdapter = {
  id: CgmSourceId;
  label: string;
  description: string;
  /** Whether this adapter can run on the current device. */
  isAvailable(): Promise<CgmAvailability>;
  /** Request OS or service permissions. */
  requestAccess(): Promise<CgmAccessResult>;
  /** Check permissions without prompting (when supported). */
  checkAccess(): Promise<CgmAccessResult>;
  /** Latest non-stale (per adapter rules) reading in the user's units. */
  getLatestReading(userUnits: BgUnits): Promise<GlucoseReading | null>;
};
