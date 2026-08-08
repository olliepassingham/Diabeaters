import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  analyzeBedtimeOvernight,
  bedtimeOvernightSummaryFromInsight,
  entriesToOvernightReadings,
  filterEntriesToSleepWindow,
  overnightSummariesDiffer,
  type BedtimeOvernightInsight,
} from "@/lib/bedtime-overnight-analysis";
import { resolveOvernightReviewTarget, type OvernightReviewTarget } from "@/lib/bedtime-overnight-window";
import { withTimeout } from "@/lib/cgm/async-timeout";
import { fetchLiveCgmHistory } from "@/lib/cgm/live-cgm-history";
import { liveCgmOvernightMessage } from "@/lib/cgm/live-cgm-source";
import { hasLiveCgmCredentials, readCgmPreferences } from "@/lib/cgm/preferences";
import type { BgUnits } from "@/lib/cgm/types";
import { resolveUserTargetBgRange } from "@/lib/target-bg-range";
import { storage, type BedtimeLog } from "@/lib/storage";

const FETCH_TIMEOUT_MS = 18_000;

export type BedtimeLastNightStatus =
  | "loading"
  | "ready"
  | "no_cgm"
  | "no_window"
  | "no_readings"
  | "error";

/** Content key so callers that pass a fresh `JSON.parse` array each render do not restart the fetch. */
export function bedtimeLogsContentKey(logs: BedtimeLog[]): string {
  return logs.map((l) => `${l.id}:${l.date}:${l.hoursUntilSleep ?? ""}`).join("|");
}

export function useBedtimeLastNight(logs: BedtimeLog[], units: BgUnits): {
  insight: BedtimeOvernightInsight | null;
  log: BedtimeLog | null;
  reviewTarget: OvernightReviewTarget | null;
  status: BedtimeLastNightStatus;
  message: string | null;
  connected: boolean;
  refresh: () => void;
} {
  const connected = hasLiveCgmCredentials(readCgmPreferences());
  const logsRef = useRef(logs);
  logsRef.current = logs;
  const logsKey = bedtimeLogsContentKey(logs);
  const reviewTarget = useMemo(
    () => resolveOvernightReviewTarget(logsRef.current),
    [logsKey],
  );
  const reviewKey = reviewTarget
    ? `${reviewTarget.source}:${reviewTarget.window.startMs}:${reviewTarget.window.endMs}`
    : "none";

  const [insight, setInsight] = useState<BedtimeOvernightInsight | null>(null);
  const [status, setStatus] = useState<BedtimeLastNightStatus>(connected ? "loading" : "no_cgm");
  const [message, setMessage] = useState<string | null>(connected ? null : liveCgmOvernightMessage());
  const loadGeneration = useRef(0);

  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;

    const apply = (fn: () => void) => {
      if (generation !== loadGeneration.current) return;
      fn();
    };

    if (!connected) {
      apply(() => {
        setInsight(null);
        setStatus("no_cgm");
        setMessage(liveCgmOvernightMessage());
      });
      return;
    }

    if (!reviewTarget) {
      apply(() => {
        setInsight(null);
        setStatus("no_window");
        setMessage("Your estimated sleep window has not finished yet. Check again after you wake up.");
      });
      return;
    }

    const { log, window } = reviewTarget;
    const minutesBack = Math.min(1440, Math.ceil((Date.now() - window.startMs) / 60_000) + 60);
    const { low: targetLow, high: targetHigh } = resolveUserTargetBgRange(storage.getSettings(), units);

    apply(() => {
      setStatus("loading");
      setMessage(null);
    });

    try {
      const result = await withTimeout(
        fetchLiveCgmHistory({ minutes: minutesBack, maxCount: 288 }),
        FETCH_TIMEOUT_MS,
        "Could not load overnight glucose history.",
      );
      if (!result) {
        apply(() => {
          setInsight(null);
          setStatus("no_cgm");
          setMessage(liveCgmOvernightMessage());
        });
        return;
      }

      const inWindow = filterEntriesToSleepWindow(result.entries, window);
      const readings = entriesToOvernightReadings(inWindow, units);
      if (readings.length === 0) {
        apply(() => {
          setInsight(null);
          setStatus("no_readings");
          setMessage(
            reviewTarget.source === "bedtime_log"
              ? "No glucose points loaded for that sleep window yet. Sharing can lag — tap refresh in a moment, or check again when your CGM app shows the night."
              : "No glucose points loaded for last night (about 11pm–7am) yet. Tap refresh shortly, or confirm Share is on in Settings → CGM.",
          );
        });
        return;
      }
      const next = analyzeBedtimeOvernight(log, readings, window, targetLow, targetHigh, units);
      if (!next) {
        apply(() => {
          setInsight(null);
          setStatus("error");
          setMessage("Could not summarise overnight readings.");
        });
        return;
      }
      if (log) {
        const summary = bedtimeOvernightSummaryFromInsight(next);
        if (overnightSummariesDiffer(log.overnightCgmSummary, summary) && summary) {
          storage.updateBedtimeLog(log.id, { overnightCgmSummary: summary });
        }
      }
      apply(() => {
        setInsight(next);
        setStatus("ready");
        setMessage(null);
      });
    } catch (e) {
      apply(() => {
        setInsight(null);
        setStatus("error");
        setMessage(e instanceof Error ? e.message : "Could not load overnight review.");
      });
    }
  }, [connected, reviewTarget, reviewKey, units]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    insight,
    log: reviewTarget?.log ?? null,
    reviewTarget,
    status,
    message,
    connected,
    refresh: () => void load(),
  };
}
