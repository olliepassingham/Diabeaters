import type { CgmHistoryPoint } from "@/lib/cgm/cgm-history-store";
import type { BgUnits } from "@/lib/cgm/types";
import { convertGlucoseValue } from "@/lib/cgm/units";

export type OsSurfaceGlucose = {
  glucoseValue: number;
  glucoseUnits: BgUnits;
  glucoseTrend: string | null;
  glucoseRecordedAt: string;
};

/** Last local history point in the user's display units — glance only, not a CGM alarm. */
export function osSurfaceGlucoseFromHistory(
  history: CgmHistoryPoint[],
  units: BgUnits,
): OsSurfaceGlucose | null {
  const last = history[history.length - 1];
  if (!last || !Number.isFinite(last.valueMgDl) || last.valueMgDl <= 0) return null;
  if (!Number.isFinite(last.recordedAtMs)) return null;
  return {
    glucoseValue: convertGlucoseValue(last.valueMgDl, "mg/dL", units),
    glucoseUnits: units,
    glucoseTrend: null,
    glucoseRecordedAt: new Date(last.recordedAtMs).toISOString(),
  };
}
