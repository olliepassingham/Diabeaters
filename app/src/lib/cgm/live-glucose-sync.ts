import { bgPrefillFromReading } from "@/lib/cgm/prefill";
import type { CgmSourceId, GlucoseReading } from "@/lib/cgm/types";
import { assessReadingStaleness } from "@/lib/cgm/staleness";
import { patientHasLiveGlucoseSharingEnabled, upsertPatientLiveGlucose } from "@/lib/carers";
import type { CloudPatientLiveGlucoseRow } from "@/lib/carers.types";
import { invokeNotifyCarersOnLiveGlucose } from "@/lib/invoke-notify-carers-live-glucose";
import { computeGlucoseRangeStatus } from "@/lib/live-glucose-range";
import { resolveUserTargetBgRange } from "@/lib/target-bg-range";
import { storage } from "@/lib/storage";

let shareEnabledCache: { at: number; value: boolean } | null = null;
const SHARE_CHECK_TTL_MS = 5 * 60_000;

let lastPublishedKey: string | null = null;

async function shouldPublishLiveGlucose(): Promise<boolean> {
  const now = Date.now();
  if (shareEnabledCache && now - shareEnabledCache.at < SHARE_CHECK_TTL_MS) {
    return shareEnabledCache.value;
  }
  const value = await patientHasLiveGlucoseSharingEnabled();
  shareEnabledCache = { at: now, value };
  return value;
}

/** Invalidate after supporter scope changes on Family & supporters. */
export function invalidateLiveGlucoseShareCache(): void {
  shareEnabledCache = null;
}

function sourceFromLabel(label: string): CgmSourceId {
  if (/libre/i.test(label)) return "libre_link_up";
  if (/dexcom/i.test(label)) return "dexcom_share";
  return "dexcom_share";
}

export function cloudLiveGlucoseToReading(row: CloudPatientLiveGlucoseRow): GlucoseReading {
  const { ageMinutes, isStale, stalenessNote } = assessReadingStaleness(row.recorded_at);
  return {
    value: row.value,
    units: row.units,
    recordedAt: row.recorded_at,
    source: sourceFromLabel(row.source_label),
    sourceLabel: row.source_label,
    trend: row.trend,
    ageMinutes,
    isStale,
    stalenessNote,
  };
}

export function cloudLiveGlucoseToPrefill(row: CloudPatientLiveGlucoseRow) {
  return bgPrefillFromReading(cloudLiveGlucoseToReading(row));
}

/** Publish latest on-device CGM reading for linked supporters when sharing is enabled. */
export async function maybePublishLiveGlucoseForSupporters(reading: GlucoseReading): Promise<void> {
  if (!(await shouldPublishLiveGlucose())) return;

  const publishKey = `${reading.recordedAt}:${reading.value}:${reading.units}`;
  if (lastPublishedKey === publishKey) return;

  const { low: targetLow, high: targetHigh } = resolveUserTargetBgRange(storage.getSettings(), reading.units);
  const rangeStatus = computeGlucoseRangeStatus(reading.value, targetLow, targetHigh);

  const { error } = await upsertPatientLiveGlucose({
    value: reading.value,
    units: reading.units,
    trend: reading.trend,
    sourceLabel: reading.sourceLabel,
    recordedAt: reading.recordedAt,
    targetLow,
    targetHigh,
    rangeStatus,
  });
  if (error) {
    return;
  }

  lastPublishedKey = publishKey;
  void invokeNotifyCarersOnLiveGlucose();
}
