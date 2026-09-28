import { hypoTreatmentsInRollingHours } from "@/lib/hypo-context";
import { formatTargetBgInput } from "@/lib/hypo-context";
import { normalizeBgUnits } from "@/lib/alcohol-night-tool";
import { storage, type UserSettings } from "@/lib/storage";

export type DrivingBgPrefill = {
  value: string;
  source: string;
};

/** Most recent usable BG for the driving check (newest first). */
export function getDrivingBgPrefill(): DrivingBgPrefill | null {
  const profile = storage.getProfile();
  const units = normalizeBgUnits(profile?.bgUnits);

  const active = storage.getActiveExercise();
  const latestExerciseBg = latestLoggedExerciseBg(active);
  if (latestExerciseBg != null) {
    return {
      value: formatTargetBgInput(latestExerciseBg, units),
      source: "From your active exercise session",
    };
  }

  const hypos = storage.getHypoTreatments();
  const sorted = [...hypos].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  for (const h of sorted) {
    if (h.glucoseLevel != null && Number.isFinite(h.glucoseLevel)) {
      return {
        value: formatTargetBgInput(h.glucoseLevel, units),
        source: "From your latest hypo log",
      };
    }
  }

  const bedtime = storage.getBedtimeLogs();
  if (bedtime.length > 0) {
    const latest = [...bedtime].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    if (latest.currentBg != null && Number.isFinite(latest.currentBg)) {
      const logUnits = normalizeBgUnits(latest.bgUnits);
      return {
        value: formatTargetBgInput(latest.currentBg, logUnits),
        source: "From your latest bedtime log",
      };
    }
  }

  return null;
}

/** Newest logged check in the open workout, so recovery does not offer the starting reading. */
function latestLoggedExerciseBg(
  active: ReturnType<typeof storage.getActiveExercise>,
): number | null {
  if (!active) return null;
  const points: { value: number; atMs: number }[] = [];
  const push = (value: number | undefined, at: string | undefined, skipped?: boolean) => {
    if (skipped || value == null || !Number.isFinite(value)) return;
    const atMs = at ? new Date(at).getTime() : 0;
    points.push({ value, atMs: Number.isFinite(atMs) ? atMs : 0 });
  };
  push(active.preBg, active.preBgAt, active.preBgSkipped);
  push(active.midBg, active.midBgAt, active.midBgSkipped);
  push(active.recoveryBg, active.recoveryBgAt);
  points.sort((a, b) => b.atMs - a.atMs);
  return points[0]?.value ?? null;
}

export function formatDrivingTargetRange(settings: UserSettings | undefined, bgUnits: "mmol/L" | "mg/dL"): string | null {
  const low = settings?.targetBgLow;
  const high = settings?.targetBgHigh;
  if (typeof low !== "number" || typeof high !== "number" || low <= 0 || high < low) return null;
  const fmt = (n: number) => formatTargetBgInput(n, bgUnits);
  return `Your target range: ${fmt(low)}–${fmt(high)} ${bgUnits}`;
}

/** Hypos logged in the last few hours — for form nudge only. */
export function getRecentHypoForDriving(hoursBack = 4): { at: string; glucoseLevel?: number } | null {
  const recent = hypoTreatmentsInRollingHours(storage.getHypoTreatments(), hoursBack);
  if (recent.length === 0) return null;
  const latest = [...recent].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  return {
    at: latest.timestamp,
    glucoseLevel: latest.glucoseLevel,
  };
}
