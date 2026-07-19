import { useCallback, useEffect, useRef } from "react";
import { applyCgmPrefillToExercise, isFreshCgmPrefill } from "@/lib/cgm/apply-cgm-prefill";
import type { BgPrefillResult } from "@/lib/cgm/prefill";
import { getCgmEmptyHint } from "@/lib/cgm/cgm-empty-hint";
import { isCgmPrefillActive } from "@/lib/cgm/preferences";
import type { ExerciseBgTrend } from "@/lib/storage";
import { EXERCISE_LIVE_CGM_POLL_MS } from "@/lib/exercise-live-cgm-sync";
import { useBgPrefill } from "@/hooks/use-bg-prefill";

export { EXERCISE_LIVE_CGM_POLL_MS as EXERCISE_CGM_POLL_MS } from "@/lib/exercise-live-cgm-sync";

type UseExerciseCgmBgOptions = {
  bgValue: string;
  /** Called when CGM auto-fills or the user taps Use/Update from CGM. */
  onApplyBg: (value: string) => void;
  /** Called when the user types in the BG field (manual). Defaults to onApplyBg if omitted. */
  onChange?: (value: string) => void;
  onApplyTrend?: (trend: ExerciseBgTrend) => void;
  /** When this key changes (e.g. session id + phase), prefer fresh CGM for the new phase. */
  autoApplyKey?: string;
  /** Re-apply when a newer CGM poll arrives (unless the user edited the field). */
  syncOnPoll?: boolean;
};

export function useExerciseCgmBg({
  bgValue,
  onApplyBg,
  onChange,
  onApplyTrend,
  autoApplyKey,
  syncOnPoll = true,
}: UseExerciseCgmBgOptions): {
  prefill: BgPrefillResult | null;
  loading: boolean;
  refresh: () => void;
  cgmActive: boolean;
  emptyHint: string | undefined;
  applyFromCgm: () => void;
  onBgChange: (value: string) => void;
} {
  const { prefill, loading, refresh } = useBgPrefill({ pollIntervalMs: EXERCISE_LIVE_CGM_POLL_MS });
  const cgmActive = isCgmPrefillActive();
  const lastAutoKey = useRef("");
  const lastPollRecordedAt = useRef("");
  const lastCgmAppliedValue = useRef("");
  const userEditedRef = useRef(false);

  const applyFromCgm = useCallback(
    (source: BgPrefillResult) => {
      applyCgmPrefillToExercise(source, onApplyBg, onApplyTrend);
      lastCgmAppliedValue.current = source.value;
      userEditedRef.current = false;
      if (source.reading?.recordedAt) lastPollRecordedAt.current = source.reading.recordedAt;
    },
    [onApplyBg, onApplyTrend],
  );

  const applyLatestFromCgm = useCallback(() => {
    if (!prefill) return;
    applyFromCgm(prefill);
  }, [applyFromCgm, prefill]);

  const onBgChange = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (trimmed && trimmed !== lastCgmAppliedValue.current) {
        userEditedRef.current = true;
      }
      if (!trimmed) userEditedRef.current = false;
      (onChange ?? onApplyBg)(value);
    },
    [onApplyBg, onChange],
  );

  useEffect(() => {
    lastAutoKey.current = "";
    lastPollRecordedAt.current = "";
    lastCgmAppliedValue.current = "";
    userEditedRef.current = false;
  }, [autoApplyKey]);

  // Each phase should use live CGM when linked — not keep a prior-phase carryover.
  useEffect(() => {
    if (!autoApplyKey || !isFreshCgmPrefill(prefill)) return;
    if (lastAutoKey.current === autoApplyKey) return;
    if (userEditedRef.current) return;
    lastAutoKey.current = autoApplyKey;
    applyFromCgm(prefill!);
  }, [autoApplyKey, applyFromCgm, prefill]);

  useEffect(() => {
    if (!syncOnPoll || !isFreshCgmPrefill(prefill)) return;
    const recordedAt = prefill!.reading?.recordedAt;
    if (!recordedAt || recordedAt === lastPollRecordedAt.current) return;
    if (userEditedRef.current) return;
    if (bgValue.trim() && bgValue !== lastCgmAppliedValue.current) return;
    applyFromCgm(prefill!);
  }, [applyFromCgm, bgValue, prefill, syncOnPoll]);

  return {
    prefill,
    loading,
    refresh,
    cgmActive,
    emptyHint: cgmActive ? getCgmEmptyHint() : undefined,
    applyFromCgm: applyLatestFromCgm,
    onBgChange,
  };
}
