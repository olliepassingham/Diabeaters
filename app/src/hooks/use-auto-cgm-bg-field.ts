import { useCallback, useEffect, useRef } from "react";
import { applyCgmPrefillToExercise, isFreshCgmPrefill } from "@/lib/cgm/apply-cgm-prefill";
import type { BgPrefillResult } from "@/lib/cgm/prefill";
import { getCgmEmptyHint } from "@/lib/cgm/cgm-empty-hint";
import { isCgmPrefillActive } from "@/lib/cgm/preferences";
import type { ExerciseBgTrend } from "@/lib/storage";
import { useSessionBgPrefill } from "@/hooks/use-session-bg-prefill";

type UseAutoCgmBgFieldOptions = {
  bgValue: string;
  onApplyBg: (value: string) => void;
  onApplyTrend?: (trend: ExerciseBgTrend) => void;
  /** When set, auto-fill once from fresh CGM if the field is empty. */
  autoApplyKey?: string;
  /** Re-apply when a newer CGM poll arrives (unless the user edited the field). */
  syncOnPoll?: boolean;
  pollIntervalMs?: number;
};

/** Auto-apply live CGM (or supporter live BG) into a BG field when empty; respects manual edits. */
export function useAutoCgmBgField({
  bgValue,
  onApplyBg,
  onApplyTrend,
  autoApplyKey,
  syncOnPoll = false,
  pollIntervalMs,
}: UseAutoCgmBgFieldOptions): {
  prefill: BgPrefillResult | null;
  loading: boolean;
  refresh: () => void;
  cgmActive: boolean;
  emptyHint: string | undefined;
  applyFromCgm: () => void;
  onBgChange: (value: string) => void;
  fromSupporter: boolean;
} {
  const { prefill, loading, refresh, fromSupporter } = useSessionBgPrefill({ pollIntervalMs });
  const deviceCgmActive = isCgmPrefillActive();
  const cgmActive = fromSupporter || deviceCgmActive;
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

  const emptyHint = fromSupporter
    ? "No recent live glucose from your linked person yet."
    : deviceCgmActive
      ? getCgmEmptyHint()
      : undefined;

  return {
    prefill,
    loading,
    refresh,
    cgmActive,
    emptyHint,
    applyFromCgm: applyLatestFromCgm,
    onBgChange,
    fromSupporter,
  };
}
