import { useCallback, useEffect, useRef } from "react";
import { applyCgmPrefillToExercise, isFreshCgmPrefill } from "@/lib/cgm/apply-cgm-prefill";
import type { BgPrefillResult } from "@/lib/cgm/prefill";
import { getCgmEmptyHint } from "@/lib/cgm/cgm-empty-hint";
import { isCgmPrefillActive } from "@/lib/cgm/preferences";
import type { ExerciseBgTrend } from "@/lib/storage";
import { useBgPrefill } from "@/hooks/use-bg-prefill";

export const EXERCISE_CGM_POLL_MS = 5 * 60_000;

type UseExerciseCgmBgOptions = {
  bgValue: string;
  onApplyBg: (value: string) => void;
  onApplyTrend?: (trend: ExerciseBgTrend) => void;
  /** When this key changes (e.g. session id + phase), try auto-fill from CGM once. */
  autoApplyKey?: string;
  /** Re-apply when a newer CGM poll arrives (unless the user edited the field). */
  syncOnPoll?: boolean;
};

export function useExerciseCgmBg({
  bgValue,
  onApplyBg,
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
  const { prefill, loading, refresh } = useBgPrefill({ pollIntervalMs: EXERCISE_CGM_POLL_MS });
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
      onApplyBg(value);
    },
    [onApplyBg],
  );

  useEffect(() => {
    lastAutoKey.current = "";
    lastPollRecordedAt.current = "";
    lastCgmAppliedValue.current = "";
    userEditedRef.current = false;
  }, [autoApplyKey]);

  useEffect(() => {
    if (!autoApplyKey || !isFreshCgmPrefill(prefill)) return;
    if (bgValue.trim()) return;
    if (lastAutoKey.current === autoApplyKey) return;
    lastAutoKey.current = autoApplyKey;
    applyFromCgm(prefill!);
  }, [autoApplyKey, applyFromCgm, bgValue, prefill]);

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
