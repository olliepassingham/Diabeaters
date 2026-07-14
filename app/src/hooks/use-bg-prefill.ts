import { useCallback, useEffect, useRef, useState } from "react";
import { getBgPrefill, type BgPrefillResult } from "@/lib/cgm/prefill";
import { maybePublishLiveGlucoseForSupporters } from "@/lib/cgm/live-glucose-sync";
import { withTimeout } from "@/lib/cgm/async-timeout";
import { isCgmPrefillActive } from "@/lib/cgm/preferences";
import { normalizeBgUnits } from "@/lib/alcohol-night-tool";
import { storage } from "@/lib/storage";

const PREFILL_HARD_TIMEOUT_MS = 16_000;
const LIVE_CGM_POLL_MS = 5 * 60_000;

export type UseBgPrefillOptions = {
  /** When CGM is enabled, re-fetch on this interval (e.g. status strip live chip). */
  pollIntervalMs?: number;
};

export function useBgPrefill(options?: UseBgPrefillOptions): {
  prefill: BgPrefillResult | null;
  loading: boolean;
  refresh: () => void;
} {
  const [prefill, setPrefill] = useState<BgPrefillResult | null>(null);
  const [loading, setLoading] = useState(true);
  const loadIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++loadIdRef.current;
    const profile = storage.getProfile();
    const units = normalizeBgUnits(profile?.bgUnits);
    setLoading(true);
    try {
      const result = await withTimeout(
        getBgPrefill(units),
        PREFILL_HARD_TIMEOUT_MS,
        "BG prefill check timed out.",
      );
      if (requestId === loadIdRef.current) {
        setPrefill(result);
        if (result?.fromCgm && result.reading) {
          void maybePublishLiveGlucoseForSupporters(result.reading);
        }
      }
    } catch {
      if (requestId === loadIdRef.current) setPrefill(null);
    } finally {
      if (requestId === loadIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const intervalMs = options?.pollIntervalMs;
    if (!intervalMs || !isCgmPrefillActive()) return;
    const id = window.setInterval(() => void load(), intervalMs);
    return () => window.clearInterval(id);
  }, [load, options?.pollIntervalMs]);

  return { prefill, loading, refresh: () => void load() };
}
