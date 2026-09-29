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
import { getCgmLocalHistory } from "@/lib/cgm/cgm-history-store";
import { hasLiveCgmCredentials, readCgmPreferences } from "@/lib/cgm/preferences";
import type { BgUnits } from "@/lib/cgm/types";
import { convertGlucoseValue } from "@/lib/cgm/units";
import { normalizeBgUnits } from "@/lib/alcohol-night-tool";
import { storage } from "@/lib/storage";

const HISTORY_TIMEOUT_MS = 16_000;

function localChartPoints(range: CgmHistoryRange, units: BgUnits): CgmChartPoint[] {
  const rangeDef = CGM_HISTORY_RANGES.find((item) => item.id === range) ?? CGM_HISTORY_RANGES[0];
  const sinceDays = rangeDef.minutes / (24 * 60);
  return getCgmLocalHistory(sinceDays).map((point) => ({
    recordedAt: new Date(point.recordedAtMs).toISOString(),
    timeMs: point.recordedAtMs,
    timeLabel: new Date(point.recordedAtMs).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }),
    value:
      units === "mmol/L"
        ? convertGlucoseValue(point.valueMgDl, "mg/dL", "mmol/L")
        : Math.round(point.valueMgDl),
    valueMgDl: point.valueMgDl,
    trend: null,
  }));
}

export function useCgmHistory(range: CgmHistoryRange): {
  points: CgmChartPoint[];
  units: BgUnits;
  loading: boolean;
  error: string | null;
  connected: boolean;
  sourceLabel: string | null;
  refresh: () => void;
} {
  const units = normalizeBgUnits(storage.getProfile()?.bgUnits);
  const connected = hasLiveCgmCredentials(readCgmPreferences());
  const [points, setPoints] = useState<CgmChartPoint[]>(() => localChartPoints(range, units));
  const [loading, setLoading] = useState(() => connected && localChartPoints(range, units).length === 0);
  const [error, setError] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);

  const load = useCallback(async () => {
    const saved = localChartPoints(range, units);
    if (saved.length > 0) setPoints(saved);

    if (!connected) {
      setPoints(saved);
      setSourceLabel(null);
      setError(liveCgmConnectMessage());
      setLoading(false);
      return;
    }

    const rangeDef = CGM_HISTORY_RANGES.find((r) => r.id === range) ?? CGM_HISTORY_RANGES[0];
    setLoading(saved.length === 0);
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
        if (saved.length === 0) {
          setPoints([]);
          setSourceLabel(null);
          setError(liveCgmConnectMessage());
        } else {
          setPoints(saved);
          setError("Live refresh unavailable — showing saved readings.");
        }
        return;
      }
      const chartPoints = liveCgmHistoryToChartPoints(result.entries, units, range);
      if (chartPoints.length === 0) {
        setPoints(saved);
        if (saved.length === 0) {
          setSourceLabel(null);
          setError("No readings in this window. Check your sensor is active and sharing is on.");
        } else {
          setSourceLabel(result.sourceLabel);
        }
        return;
      }
      setSourceLabel(result.sourceLabel);
      setPoints(chartPoints);
    } catch (e) {
      if (saved.length === 0) {
        setPoints([]);
        setSourceLabel(null);
      } else {
        setPoints(saved);
      }
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
