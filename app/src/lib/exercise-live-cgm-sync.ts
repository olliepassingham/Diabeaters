import { cgmTrendForExercise } from "@/lib/cgm/apply-cgm-trend";
import { isCgmPrefillActive } from "@/lib/cgm/preferences";
import { getBgPrefill, type BgPrefillResult } from "@/lib/cgm/prefill";
import { normalizeBgUnits } from "@/lib/alcohol-night-tool";
import { storage, type ActiveExerciseSession } from "@/lib/storage";

/** Poll interval while exercise is active — keeps session BG and alerts aligned with live CGM. */
export const EXERCISE_LIVE_CGM_POLL_MS = 90_000;

export function shouldSyncLiveCgmToSession(session: ActiveExerciseSession): boolean {
  return (
    session.phase === "active" &&
    Boolean(session.exerciseStartedAt) &&
    session.midBgSource !== "manual" &&
    isCgmPrefillActive()
  );
}

/**
 * Writes the latest fresh CGM reading into the active exercise session (midBg / midTrend).
 * Skips when the user manually logged mid-session BG.
 */
export async function syncLiveCgmToActiveExerciseSession(): Promise<BgPrefillResult | null> {
  const session = storage.getActiveExercise();
  if (!session || !shouldSyncLiveCgmToSession(session)) return null;

  const profile = storage.getProfile() ?? {};
  const bgUnits = normalizeBgUnits(profile.bgUnits);
  const prefill = await getBgPrefill(bgUnits);
  if (!prefill?.fromCgm || !prefill.reading || prefill.reading.isStale) return null;

  const bg = prefill.reading.value;
  const at = prefill.reading.recordedAt;
  const trend = cgmTrendForExercise(prefill.reading.trend) ?? session.midTrend;

  if (session.midBg === bg && session.midBgAt === at && session.midBgSource === "cgm") {
    return prefill;
  }

  storage.updateActiveExercise({
    midBg: bg,
    midTrend: trend,
    midBgAt: at,
    midBgSource: "cgm",
  });
  return prefill;
}
