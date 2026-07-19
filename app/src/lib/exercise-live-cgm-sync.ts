import { cgmTrendForExercise } from "@/lib/cgm/apply-cgm-trend";
import { isCgmPrefillActive } from "@/lib/cgm/preferences";
import { getBgPrefill, type BgPrefillResult } from "@/lib/cgm/prefill";
import { normalizeBgUnits } from "@/lib/alcohol-night-tool";
import { storage, type ActiveExerciseSession } from "@/lib/storage";

/** Poll interval while exercise is active — keeps session BG and alerts aligned with live CGM. */
export const EXERCISE_LIVE_CGM_POLL_MS = 90_000;

export function shouldSyncLiveCgmToSession(session: ActiveExerciseSession): boolean {
  if (!isCgmPrefillActive()) return false;
  if (session.phase === "active") {
    return Boolean(session.exerciseStartedAt) && session.midBgSource !== "manual";
  }
  // Pre and recovery: keep live CGM in the session unless the user overrode mid-session
  // during (manual mid source is only relevant for active). Pre/recovery always sync when linked.
  if (session.phase === "pre" || session.phase === "recovery") return true;
  return false;
}

/**
 * Writes the latest fresh CGM reading into the active exercise session for the current phase.
 * Skips during-phase sync when the user manually logged mid-session BG.
 */
export async function syncLiveCgmToActiveExerciseSession(): Promise<BgPrefillResult | null> {
  const session = storage.getActiveExercise();
  if (!session || !shouldSyncLiveCgmToSession(session)) return null;

  const profile = storage.getProfile();
  const bgUnits = normalizeBgUnits(profile?.bgUnits);
  const prefill = await getBgPrefill(bgUnits);
  if (!prefill?.fromCgm || !prefill.reading || prefill.reading.isStale) return null;

  const bg = prefill.reading.value;
  const at = prefill.reading.recordedAt;
  const mappedTrend = cgmTrendForExercise(prefill.reading.trend);

  if (session.phase === "active") {
    const trend = mappedTrend ?? session.midTrend;
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

  if (session.phase === "pre") {
    const trend = mappedTrend ?? session.preTrend;
    if (session.preBg === bg && session.preBgAt === at) return prefill;
    storage.updateActiveExercise({
      preBg: bg,
      preTrend: trend,
      preBgAt: at,
    });
    return prefill;
  }

  // recovery
  const trend = mappedTrend ?? session.recoveryTrend;
  if (session.recoveryBg === bg && session.recoveryBgAt === at) return prefill;
  storage.updateActiveExercise({
    recoveryBg: bg,
    recoveryTrend: trend,
    recoveryBgAt: at,
  });
  return prefill;
}
