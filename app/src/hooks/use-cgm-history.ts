import { useCallback, useEffect, useState } from "react";
import {
  CGM_HISTORY_RANGES,
  liveCgmHistoryToChartPoints,
  type CgmChartPoint,
  type CgmHistoryRange,
} from "@/lib/cgm/cgm-chart";
import { withTimeout } from "@/lib/cgm/async-timeout";
import { liveCgmConnectMessage } from "@/lib/cgm/live-cgm-source";
import { fetchLiveCgmHistory } from "@/lib/cgm/live-cgm-history";
import { hasLiveCgmCredentials, readCgmPreferences } from "@/lib/cgm/preferences";
import type { BgUnits } from "@/lib/cgm/types";
import { normalizeBgUnits } from "@/lib/alcohol-night-tool";
import { storage } from "@/lib/storage";

const HISTORY_TIMEOUT_MS = 16_000;

export function useCgmHistory(range: CgmHistoryRange): {
  points: CgmChartPoint[];
  units: BgUnits;
  loading: boolean;
  error: string | null;
  connected: boolean;
  sourceLabel: string | null;
  refresh: () => void;
} {
  const [points, setPoints] = useState<CgmChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const units = normalizeBgUnits(storage.getProfile()?.bgUnits);
  const connected = hasLiveCgmCredentials(readCgmPreferences());

  const load = useCallback(async () => {
    if (!connected) {
      setPoints([]);
      setSourceLabel(null);
      setError(liveCgmConnectMessage());
      setLoading(false);
      return;
    }

    const rangeDef = CGM_HISTORY_RANGES.find((r) => r.id === range) ?? CGM_HISTORY_RANGES[0];
    setLoading(true);
    setError(null);
    try {
      const result = await withTimeout(
        fetchLiveCgmHistory({
          minutes: rangeDef.minutes,
          maxCount: rangeDef.maxCount,
        }),
        HISTORY_TIMEOUT_MS,
        "Glucose history took too long to load.",
      );
      if (!result) {
        setPoints([]);
        setSourceLabel(null);
        setError(liveCgmConnectMessage());
        return;
      }
      const chartPoints = liveCgmHistoryToChartPoints(result.entries, units, range);
      setSourceLabel(result.sourceLabel);
      setPoints(chartPoints);
      if (chartPoints.length === 0) {
        setError("No readings in this window. Check your sensor is active and sharing is on.");
      }
    } catch (e) {
      setPoints([]);
      setSourceLabel(null);
      setError(e instanceof Error ? e.message : "Could not load glucose history.");
    } finally {
      setLoading(false);
    }
  }, [connected, range, units]);

  useEffect(() => {
    void load();
  }, [load]);

  return { points, units, loading, error, connected, sourceLabel, refresh: () => void load() };
}
