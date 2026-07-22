import { useEffect, useRef, useState } from "react";

import {
  analyzeBedtimeOvernight,
  entriesToOvernightReadings,
  filterEntriesToSleepWindow,
  type BedtimeOvernightInsight,
} from "@/lib/bedtime-overnight-analysis";
import { computeBedtimeSleepWindow } from "@/lib/bedtime-overnight-window";
import { withTimeout } from "@/lib/cgm/async-timeout";
import { fetchLiveCgmHistory } from "@/lib/cgm/live-cgm-history";
import { hasLiveCgmCredentials, readCgmPreferences } from "@/lib/cgm/preferences";
import type { BgUnits } from "@/lib/cgm/types";
import { resolveUserTargetBgRange } from "@/lib/target-bg-range";
import { storage, type BedtimeLog } from "@/lib/storage";

const FETCH_TIMEOUT_MS = 18_000;

/**
 * CGM-derived overnight insight for one specific bedtime log — lets the "How did last
 * night go?" check-in pre-fill from real sensor data for connected users instead of
 * asking them to re-type what the app can already see (the separate "Last night" card
 * on the Bedtime page computes the same thing, but for whichever night is most recently
 * reviewable, not necessarily the exact log this check-in is asking about).
 */
export function useBedtimeOutcomeCgmInsight(
  log: BedtimeLog | null,
  units: BgUnits,
): { insight: BedtimeOvernightInsight | null; loading: boolean } {
  const [insight, setInsight] = useState<BedtimeOvernightInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);

  useEffect(() => {
    const gen = ++generation.current;
    setInsight(null);

    if (!log || !hasLiveCgmCredentials(readCgmPreferences())) {
      setLoading(false);
      return;
    }
    const window = computeBedtimeSleepWindow(log);
    if (!window) {
      setLoading(false);
      return;
    }

    const minutesBack = Math.min(1440, Math.ceil((Date.now() - window.startMs) / 60_000) + 60);
    const { low: targetLow, high: targetHigh } = resolveUserTargetBgRange(storage.getSettings(), units);
    setLoading(true);

    void (async () => {
      try {
        const result = await withTimeout(
          fetchLiveCgmHistory({ minutes: minutesBack, maxCount: 288 }),
          FETCH_TIMEOUT_MS,
          "Could not load overnight glucose history.",
        );
        if (generation.current !== gen) return;
        if (!result) {
          setInsight(null);
          return;
        }
        const inWindow = filterEntriesToSleepWindow(result.entries, window);
        const readings = entriesToOvernightReadings(inWindow, units);
        if (readings.length === 0) {
          setInsight(null);
          return;
        }
        setInsight(analyzeBedtimeOvernight(log, readings, window, targetLow, targetHigh, units));
      } catch {
        if (generation.current === gen) setInsight(null);
      } finally {
        if (generation.current === gen) setLoading(false);
      }
    })();
  }, [log?.id, units]);

  return { insight, loading };
}
