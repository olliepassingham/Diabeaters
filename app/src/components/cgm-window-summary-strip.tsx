import { InfoTooltip } from "@/components/info-tooltip";
import type { BgUnits } from "@/lib/cgm/types";
import {
  TIR_BAND_LABELS,
  TIR_BAND_ORDER,
  type GlucoseTirBand,
  type GlucoseWindowSummary,
  veryHighThreshold,
  veryLowThreshold,
} from "@/lib/cgm/window-summary";
import { formatTargetBgInput } from "@/lib/hypo-context";
import { cn } from "@/lib/utils";

const BAND_BAR_CLASS: Record<GlucoseTirBand, string> = {
  very_high: "bg-orange-600 dark:bg-orange-500",
  high: "bg-amber-400 dark:bg-amber-400",
  in_range: "bg-emerald-500 dark:bg-emerald-400",
  low: "bg-rose-300 dark:bg-rose-400/80",
  very_low: "bg-rose-700 dark:bg-rose-500",
};

const BAND_DOT_CLASS: Record<GlucoseTirBand, string> = {
  very_high: "bg-orange-600 dark:bg-orange-500",
  high: "bg-amber-400",
  in_range: "bg-emerald-500 dark:bg-emerald-400",
  low: "bg-rose-300 dark:bg-rose-400",
  very_low: "bg-rose-700 dark:bg-rose-500",
};

type CgmWindowSummaryStripProps = {
  summary: GlucoseWindowSummary;
  units: BgUnits;
  targetLow: number;
  targetHigh: number;
};

export function CgmWindowSummaryStrip({
  summary,
  units,
  targetLow,
  targetHigh,
}: CgmWindowSummaryStripProps) {
  const avgLabel = formatTargetBgInput(summary.average, units);
  const vLow = formatTargetBgInput(veryLowThreshold(units), units);
  const vHigh = formatTargetBgInput(veryHighThreshold(units), units);

  return (
    <div
      className="space-y-2.5 rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5"
      data-testid="cgm-window-summary"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">This window</p>
        <div className="flex items-center gap-1">
          <p className="text-xs tabular-nums text-muted-foreground">
            Target {formatTargetBgInput(targetLow, units)}–{formatTargetBgInput(targetHigh, units)} {units}
          </p>
          <InfoTooltip
            term="This window"
            explanation={`Average and time-in-range for the chart range only (not a clinic report). In range uses your saved targets. Very low is below ${vLow} ${units}; very high is above ${vHigh} ${units} (international consensus bands). Educational only — confirm on your CGM app.`}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] text-muted-foreground">Average</p>
          <p className="text-lg font-semibold tabular-nums tracking-tight text-foreground" data-testid="cgm-window-average">
            {avgLabel} <span className="text-sm font-medium text-muted-foreground">{units}</span>
          </p>
        </div>
        <p className="pb-0.5 text-sm tabular-nums text-foreground" data-testid="cgm-window-tir">
          <span className="font-semibold">{summary.percents.in_range}%</span>
          <span className="text-muted-foreground"> in range</span>
        </p>
      </div>

      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted/40"
        role="img"
        aria-label={`Time in range: ${summary.percents.in_range}% in range, ${summary.percents.high}% high, ${summary.percents.very_high}% very high, ${summary.percents.low}% low, ${summary.percents.very_low}% very low`}
      >
        {TIR_BAND_ORDER.map((band) => {
          const pct = summary.percents[band];
          if (pct <= 0) return null;
          return (
            <div
              key={band}
              className={cn("h-full min-w-[2px]", BAND_BAR_CLASS[band])}
              style={{ width: `${pct}%` }}
              title={`${TIR_BAND_LABELS[band]} ${pct}%`}
            />
          );
        })}
      </div>

      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-5">
        {TIR_BAND_ORDER.map((band) => (
          <li key={band} className="flex min-w-0 items-center gap-1.5 text-[11px] leading-tight">
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", BAND_DOT_CLASS[band])} aria-hidden />
            <span className="truncate text-muted-foreground">{TIR_BAND_LABELS[band]}</span>
            <span
              className={cn(
                "ml-auto tabular-nums text-foreground",
                band === "in_range" && "font-semibold",
              )}
            >
              {summary.percents[band]}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
