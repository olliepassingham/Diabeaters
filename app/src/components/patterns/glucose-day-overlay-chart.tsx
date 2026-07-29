import { useMemo } from "react";
import type { GlucoseDaySeries } from "@/lib/cgm/glucose-day-overlay";
import type { BgUnits } from "@/lib/cgm/types";
import { cn } from "@/lib/utils";

type GlucoseDayOverlayChartProps = {
  series: GlucoseDaySeries[];
  units: BgUnits;
  targetRange: { low: number; high: number };
  /** Inclusive start of the visible x-axis in minutes since midnight. */
  minuteStart?: number;
  /** Exclusive end of the visible x-axis in minutes since midnight. */
  minuteEnd?: number;
  className?: string;
  "data-testid"?: string;
};

const WIDTH = 320;
const HEIGHT = 200;
const PAD = { top: 10, right: 10, bottom: 28, left: 30 };
const MINUTES_PER_DAY = 24 * 60;

/** Generic typical UK mealtime windows — visual anchors on the full-day view only. */
const MEALTIME_BANDS: { label: string; startMinute: number; endMinute: number }[] = [
  { label: "Breakfast", startMinute: 7 * 60, endMinute: 9 * 60 },
  { label: "Lunch", startMinute: 12 * 60, endMinute: 14 * 60 },
  { label: "Dinner", startMinute: 18 * 60, endMinute: 20 * 60 },
];

function hourTickLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

function buildHourTicks(minuteStart: number, minuteEnd: number): number[] {
  const spanHours = (minuteEnd - minuteStart) / 60;
  const step = spanHours <= 6 ? 1 : spanHours <= 12 ? 2 : 6;
  const firstHour = Math.ceil(minuteStart / 60);
  const lastHour = Math.floor(minuteEnd / 60);
  const ticks: number[] = [];
  for (let h = firstHour; h <= lastHour; h += step) {
    ticks.push(h);
  }
  if (ticks.length === 0) ticks.push(Math.round(minuteStart / 60));
  return ticks;
}

/**
 * Each recent day's glucose trace plotted on a shared time-of-day axis —
 * so a recurring shape (e.g. a spike most mornings) is visible at a glance.
 * Older days fade out; the most recent day is drawn last, solid, on top.
 */
export function GlucoseDayOverlayChart({
  series,
  units,
  targetRange,
  minuteStart = 0,
  minuteEnd = MINUTES_PER_DAY,
  className,
  "data-testid": testId,
}: GlucoseDayOverlayChartProps) {
  const viewStart = Math.max(0, Math.min(MINUTES_PER_DAY - 1, minuteStart));
  const viewEnd = Math.max(viewStart + 1, Math.min(MINUTES_PER_DAY, minuteEnd));
  const viewSpan = viewEnd - viewStart;
  const showMealBands = viewStart === 0 && viewEnd === MINUTES_PER_DAY;

  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;

  const { yMin, yMax } = useMemo(() => {
    const values = series.flatMap((s) => s.segments.flatMap((seg) => seg.map((p) => p.value)));
    const pad = units === "mmol/L" ? 1 : 20;
    const dataMin = values.length > 0 ? Math.min(...values) : targetRange.low;
    const dataMax = values.length > 0 ? Math.max(...values) : targetRange.high;
    return {
      yMin: Math.max(0, Math.min(dataMin, targetRange.low) - pad),
      yMax: Math.max(dataMax, targetRange.high) + pad,
    };
  }, [series, targetRange, units]);

  const xFor = (minuteOfDay: number) => PAD.left + ((minuteOfDay - viewStart) / viewSpan) * innerWidth;
  const yFor = (value: number) => PAD.top + innerHeight - ((value - yMin) / (yMax - yMin)) * innerHeight;

  const yTicks = useMemo(() => {
    const round = units === "mmol/L" ? (n: number) => Math.round(n * 2) / 2 : (n: number) => Math.round(n / 10) * 10;
    return [yMin, (yMin + yMax) / 2, yMax].map(round);
  }, [yMin, yMax, units]);

  const hourTicks = useMemo(() => buildHourTicks(viewStart, viewEnd), [viewStart, viewEnd]);
  const mostRecentCount = Math.max(1, series.length);

  return (
    <div className={cn("w-full", className)} data-testid={testId}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full min-h-[200px] text-muted-foreground"
        role="img"
        aria-label={`Glucose over the day, overlaid across ${series.length} recent day${series.length === 1 ? "" : "s"}, most recent day highlighted`}
      >
        {showMealBands
          ? MEALTIME_BANDS.map((band) => (
              <rect
                key={band.label}
                x={xFor(band.startMinute)}
                y={PAD.top}
                width={xFor(band.endMinute) - xFor(band.startMinute)}
                height={innerHeight}
                fill="currentColor"
                fillOpacity={0.05}
              />
            ))
          : null}

        <rect
          x={PAD.left}
          y={yFor(targetRange.high)}
          width={innerWidth}
          height={Math.max(0, yFor(targetRange.low) - yFor(targetRange.high))}
          fill="#22c55e"
          fillOpacity={0.08}
        />

        {yTicks.map((tick, i) => (
          <g key={`y-${i}`}>
            <line
              x1={PAD.left}
              y1={yFor(tick)}
              x2={WIDTH - PAD.right}
              y2={yFor(tick)}
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeDasharray="4 4"
            />
            <text x={PAD.left - 4} y={yFor(tick) + 3} textAnchor="end" fontSize="8" fill="currentColor">
              {tick}
            </text>
          </g>
        ))}

        {series.map((day, index) => {
          const opacity = mostRecentCount === 1 ? 1 : 0.15 + 0.7 * (index / (mostRecentCount - 1));
          const strokeWidth = day.isMostRecent ? 2.25 : 1.5;
          return (
            <g key={day.dateKey} data-testid={`glucose-overlay-day-${day.dateKey}`}>
              {day.segments.map((segment, segIndex) => {
                if (segment.length < 2) return null;
                const path = segment
                  .map((p, i) => `${i === 0 ? "M" : "L"}${xFor(p.minuteOfDay).toFixed(1)},${yFor(p.value).toFixed(1)}`)
                  .join(" ");
                return (
                  <path
                    key={segIndex}
                    d={path}
                    fill="none"
                    stroke={day.isMostRecent ? "hsl(var(--chart-2))" : "currentColor"}
                    strokeOpacity={day.isMostRecent ? 1 : opacity}
                    strokeWidth={strokeWidth}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                );
              })}
            </g>
          );
        })}

        {hourTicks.map((hour) => (
          <text
            key={hour}
            x={xFor(hour * 60)}
            y={HEIGHT - PAD.bottom + 14}
            textAnchor="middle"
            fontSize="8"
            fill="currentColor"
          >
            {hourTickLabel(hour)}
          </text>
        ))}
      </svg>

      <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "hsl(var(--chart-2))" }} aria-hidden />
          Today
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/30" aria-hidden />
          Earlier days
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: "#22c55e", opacity: 0.5 }} aria-hidden />
          Target
        </span>
      </div>
    </div>
  );
}
