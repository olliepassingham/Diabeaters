import { CGM_PREFILL_STALE_AGE_MINUTES, CGM_PREFILL_WARN_AGE_MINUTES } from "@/lib/cgm/v1-scope";

export type StalenessAssessment = {
  ageMinutes: number;
  isStale: boolean;
  stalenessNote: string | null;
};

export function assessReadingStaleness(recordedAtIso: string, nowMs = Date.now()): StalenessAssessment {
  const recordedMs = new Date(recordedAtIso).getTime();
  const ageMinutes = Number.isFinite(recordedMs)
    ? Math.max(0, Math.floor((nowMs - recordedMs) / 60_000))
    : Number.POSITIVE_INFINITY;

  if (ageMinutes > CGM_PREFILL_STALE_AGE_MINUTES) {
    return {
      ageMinutes,
      isStale: true,
      stalenessNote: `Reading is about ${formatAgeMinutes(ageMinutes)} old — check your CGM before relying on it.`,
    };
  }

  if (ageMinutes > CGM_PREFILL_WARN_AGE_MINUTES) {
    return {
      ageMinutes,
      isStale: false,
      stalenessNote: `Reading is about ${formatAgeMinutes(ageMinutes)} old (Dexcom may delay Apple Health writes).`,
    };
  }

  return { ageMinutes, isStale: false, stalenessNote: null };
}

export function formatAgeMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 1) return "under a minute";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
