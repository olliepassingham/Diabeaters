import { useMemo } from "react";
import { Activity, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { CgmGlucoseChart } from "@/components/cgm-glucose-chart";
import { Button } from "@/components/ui/button";
import type { CgmChartPoint } from "@/lib/cgm/cgm-chart";
import { getCgmLocalHistory } from "@/lib/cgm/cgm-history-store";
import { convertGlucoseValue } from "@/lib/cgm/units";
import type { BgUnits } from "@/lib/cgm/types";
import { formatTargetBgInput } from "@/lib/hypo-context";
import { resolveUserTargetBgRange } from "@/lib/target-bg-range";
import { storage } from "@/lib/storage";
import { useCgmHistory } from "@/hooks/use-cgm-history";

function localPoints(units: BgUnits): CgmChartPoint[] {
  return getCgmLocalHistory(0.5).map((point) => ({
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

function EmptyCgmChart({
  units,
  targetLow,
  targetHigh,
}: {
  units: BgUnits;
  targetLow: number;
  targetHigh: number;
}) {
  const ticks = units === "mmol/L" ? [3, 6, 9, 12, 15] : [54, 108, 162, 216, 270];
  const min = ticks[0]!;
  const max = ticks[ticks.length - 1]!;
  const y = (value: number) => 12 + (1 - (value - min) / (max - min)) * 154;

  return (
    <div className="relative mt-2" data-testid="home-cgm-empty-graph">
      <svg
        viewBox="0 0 320 200"
        className="h-auto w-full min-h-[200px] text-muted-foreground"
        role="img"
        aria-label="Blank 12-hour glucose chart, connect CGM to add readings"
      >
        <rect
          x="36"
          y={y(targetHigh)}
          width="274"
          height={Math.max(0, y(targetLow) - y(targetHigh))}
          rx="2"
          fill="#10b981"
          fillOpacity="0.08"
        />
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1="36"
              y1={y(tick)}
              x2="310"
              y2={y(tick)}
              stroke="currentColor"
              strokeOpacity="0.12"
              strokeDasharray="4 4"
            />
            <text x="30" y={y(tick) + 3} textAnchor="end" fontSize="9" fill="currentColor">
              {units === "mmol/L" ? tick.toFixed(1) : tick}
            </text>
          </g>
        ))}
        {[36, 173, 310].map((x) => (
          <line
            key={x}
            x1={x}
            y1="12"
            x2={x}
            y2="166"
            stroke="currentColor"
            strokeOpacity="0.07"
          />
        ))}
        <text x="36" y="190" textAnchor="start" fontSize="9" fill="currentColor" fillOpacity="0.8">
          12h ago
        </text>
        <text x="173" y="190" textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity="0.8">
          6h ago
        </text>
        <text x="310" y="190" textAnchor="end" fontSize="9" fill="currentColor" fillOpacity="0.8">
          Now
        </text>
      </svg>
      <div className="pointer-events-none absolute inset-x-10 top-1/2 -translate-y-1/2 text-center">
        <Activity className="mx-auto h-5 w-5 text-primary/55" aria-hidden />
        <p className="mt-1 text-xs font-medium text-foreground/75">Your glucose trend will appear here</p>
      </div>
    </div>
  );
}

export function HomeCgmGraph() {
  const history = useCgmHistory("12h");
  const { units, connected, sourceLabel, loading, refresh } = history;
  const savedPoints = useMemo(() => localPoints(units), [units]);
  const points = history.points.length ? history.points : savedPoints;
  const target = useMemo(() => resolveUserTargetBgRange(storage.getSettings(), units), [units]);

  const latest = points[points.length - 1];

  return (
    <section
      className="relative overflow-hidden border-b border-border/35 pb-5 pt-2"
      data-testid="home-cgm-graph"
      aria-labelledby="home-cgm-title"
    >
      <div className="mb-1 flex items-start justify-between gap-3 px-1">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" aria-hidden />
            <h2
              id="home-cgm-title"
              className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
            >
              Glucose · 12 hours
            </h2>
          </div>
          {latest ? (
            <div className="mt-2 flex items-end gap-2">
              <p className="font-display text-5xl font-semibold leading-none tracking-[-0.04em] tabular-nums text-foreground">
                {formatTargetBgInput(latest.value, units)}
              </p>
              <div className="pb-1">
                <p className="text-sm font-medium text-muted-foreground">{units}</p>
                <p className="text-[11px] text-muted-foreground">
                  {sourceLabel ?? "On this device"}
                </p>
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={refresh}
            disabled={loading}
            aria-label="Refresh glucose graph"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden />
            )}
          </Button>
          <Button asChild variant="ghost" size="icon" className="h-10 w-10 rounded-full">
            <Link href={connected ? "/tools/cgm-live" : "/settings/cgm"} aria-label="Open glucose trends">
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>

      {points.length > 1 ? (
        <CgmGlucoseChart
          points={points}
          units={units}
          targetLow={target.low}
          targetHigh={target.high}
          className="-mx-1 w-[calc(100%+0.5rem)] [&_svg]:min-h-[220px] [&>p]:hidden"
        />
      ) : (
        <Link
          href={connected ? "/tools/cgm-live" : "/settings/cgm"}
          className="group block"
        >
          <EmptyCgmChart units={units} targetLow={target.low} targetHigh={target.high} />
          <div className="-mt-2 text-center">
            <p className="text-sm font-medium text-primary group-hover:underline">
              {connected ? "Waiting for glucose history" : "Connect your CGM"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {connected
                ? "Your 12-hour trend will appear here after readings arrive."
                : "Add your CGM in Settings to fill this graph."}
            </p>
          </div>
        </Link>
      )}

      {history.error && savedPoints.length > 1 ? (
        <p className="mt-1 text-center text-xs text-muted-foreground">
          Live refresh unavailable — showing saved readings.
        </p>
      ) : null}
    </section>
  );
}
