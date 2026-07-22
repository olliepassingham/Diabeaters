import { useMemo } from "react";
import type { GlucoseDaySeries } from "@/lib/cgm/glucose-day-overlay";
import type { BgUnits } from "@/lib/cgm/types";
import { cn } from "@/lib/utils";

type GlucoseDayOverlayChartProps = {
  series: GlucoseDaySeries[];
  units: BgUnits;
  targetRange: { low: number; high: number };
  className?: string;
  "data-testid"?: string;
};

const WIDTH = 320;
const HEIGHT = 200;
const PAD = { top: 10, right: 10, bottom: 34, left: 30 };
const MINUTES_PER_DAY = 24 * 60;

/** Generic typical UK mealtime windows, in minutes since midnight — a visual anchor only, not logged data. */
const MEALTIME_BANDS: { label: string; startMinute: number; endMinute: number }[] = [
  { label: "Breakfast", startMinute: 7 * 60, endMinute: 9 * 60 },
  { label: "Lunch", startMinute: 12 * 60, endMinute: 14 * 60 },
  { label: "Dinner", startMinute: 18 * 60, endMinute: 20 * 60 },
];

const HOUR_TICKS = [0, 6, 12, 18, 24];

function hourTickLabel(hour: number): string {
  if (hour === 0 || hour === 24) return "12am";
  if (hour === 12) return "12pm";
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

/**
 * Each recent day's glucose trace plotted on a shared 24h time-of-day axis —
 * so a recurring shape (e.g. a spike most mornings) is visible at a glance.
 * Same hand-rolled SVG language as the other Patterns charts. Older days fade
 * out; the most recent day is drawn last, solid, on top.
 */
export function GlucoseDayOverlayChart({
  series,
  units,
  targetRange,
  className,
  "data-testid": testId,
}: GlucoseDayOverlayChartProps) {
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

  const xFor = (minuteOfDay: number) => PAD.left + (minuteOfDay / MINUTES_PER_DAY) * innerWidth;
  const yFor = (value: number) => PAD.top + innerHeight - ((value - yMin) / (yMax - yMin)) * innerHeight;

  const yTicks = useMemo(() => {
    const round = units === "mmol/L" ? (n: number) => Math.round(n * 2) / 2 : (n: number) => Math.round(n / 10) * 10;
    return [yMin, (yMin + yMax) / 2, yMax].map(round);
  }, [yMin, yMax, units]);

  const mostRecentCount = Math.max(1, series.length);

  return (
    <div className={cn("w-full", className)} data-testid={testId}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full min-h-[200px] text-muted-foreground"
        role="img"
        aria-label={`Glucose over the day, overlaid across ${series.length} recent day${series.length === 1 ? "" : "s"}, most recent day highlighted`}
      >
        {/* Typical mealtime bands — a visual anchor only, not logged meal data */}
        {MEALTIME_BANDS.map((band) => (
          <rect
            key={band.label}
            x={xFor(band.startMinute)}
            y={PAD.top}
            width={xFor(band.endMinute) - xFor(band.startMinute)}
            height={innerHeight}
            fill="currentColor"
            fillOpacity={0.05}
          />
        ))}

        {/* Target range band */}
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

        {HOUR_TICKS.map((hour) => (
          <text
            key={hour}
            x={xFor(hour * 60)}
            y={HEIGHT - PAD.bottom + 12}
            textAnchor="middle"
            fontSize="8"
            fill="currentColor"
          >
            {hourTickLabel(hour)}
          </text>
        ))}

        {MEALTIME_BANDS.map((band) => (
          <text
            key={`label-${band.label}`}
            x={xFor((band.startMinute + band.endMinute) / 2)}
            y={HEIGHT - PAD.bottom + 24}
            textAnchor="middle"
            fontSize="7"
            fill="currentColor"
            opacity={0.7}
          >
            {band.label}
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
          Earlier this week
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: "#22c55e", opacity: 0.5 }} aria-hidden />
          Target range
        </span>
      </div>
    </div>
  );
}
