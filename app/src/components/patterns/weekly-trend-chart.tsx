import { useId, useMemo } from "react";
import type { WeeklyTrendPoint } from "@/lib/insights/pattern-charts";
import { cn } from "@/lib/utils";

type WeeklyTrendChartProps = {
  points: WeeklyTrendPoint[];
  className?: string;
  "data-testid"?: string;
};

const WIDTH = 320;
const HEIGHT = 168;
const PAD = { top: 10, right: 8, bottom: 26, left: 26 };

/**
 * Weekly hypo-count line overlaid on light exercise-session bars, so a
 * recurring "more lows the week I exercised more" pattern is visible at a
 * glance without needing a separate chart.
 */
export function WeeklyTrendChart({ points, className, "data-testid": testId }: WeeklyTrendChartProps) {
  const gradientId = useId().replace(/:/g, "");
  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;

  const maxHypo = Math.max(1, ...points.map((p) => p.hypoCount));
  const maxExercise = Math.max(1, ...points.map((p) => p.exerciseCount));

  const slotWidth = points.length > 0 ? innerWidth / points.length : innerWidth;
  const barWidth = Math.max(4, slotWidth * 0.55);

  const xFor = (i: number) => PAD.left + slotWidth * (i + 0.5);
  const yForHypo = (count: number) => PAD.top + innerHeight - (count / maxHypo) * innerHeight;
  const yForExercise = (count: number) => PAD.top + innerHeight - (count / maxExercise) * innerHeight * 0.9;

  const linePath = useMemo(() => {
    return points
      .map((p, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yForHypo(p.hypoCount).toFixed(1)}`)
      .join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- xFor/yForHypo depend only on stable inputs above
  }, [points, maxHypo]);

  const areaPath = useMemo(() => {
    if (points.length < 2) return "";
    const baseline = PAD.top + innerHeight;
    const top = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yForHypo(p.hypoCount).toFixed(1)}`)
      .join(" ");
    return `${top} L${xFor(points.length - 1).toFixed(1)},${baseline} L${xFor(0).toFixed(1)},${baseline} Z`;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- xFor/yForHypo depend only on stable inputs above
  }, [points, maxHypo]);

  const yTicks = useMemo(() => {
    const steps = maxHypo <= 4 ? maxHypo : 4;
    return Array.from({ length: steps + 1 }, (_, i) => Math.round((maxHypo * i) / steps));
  }, [maxHypo]);

  const labelIndices = useMemo(() => {
    if (points.length <= 6) return points.map((_, i) => i);
    const step = Math.ceil(points.length / 6);
    return points.map((_, i) => i).filter((i) => i % step === 0 || i === points.length - 1);
  }, [points]);

  return (
    <div className={cn("w-full", className)} data-testid={testId}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full min-h-[168px] text-muted-foreground"
        role="img"
        aria-label={`Weekly lows trend over ${points.length} weeks, with exercise sessions overlaid`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity="0.28" />
            <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${gradientId}-ex`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => {
          const y = yForHypo(tick);
          return (
            <g key={tick}>
              <line
                x1={PAD.left}
                y1={y}
                x2={WIDTH - PAD.right}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.1}
                strokeDasharray="4 4"
              />
              <text x={PAD.left - 5} y={y + 3} textAnchor="end" fontSize="8" fill="currentColor">
                {tick}
              </text>
            </g>
          );
        })}

        {points.map((p, i) => {
          if (p.exerciseCount === 0) return null;
          const x = xFor(i);
          return (
            <rect
              key={`ex-${p.weekStartMs}`}
              x={x - barWidth / 2}
              y={yForExercise(p.exerciseCount)}
              width={barWidth}
              height={PAD.top + innerHeight - yForExercise(p.exerciseCount)}
              fill={`url(#${gradientId}-ex)`}
              rx={2.5}
            />
          );
        })}

        {points.length > 1 ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}

        {points.length > 1 ? (
          <path
            d={linePath}
            fill="none"
            stroke="hsl(var(--chart-2))"
            strokeWidth={2.25}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}

        {points.map((p, i) => {
          const isLast = i === points.length - 1;
          return (
            <g key={`pt-${p.weekStartMs}`}>
              {isLast && p.hypoCount > 0 ? (
                <circle cx={xFor(i)} cy={yForHypo(p.hypoCount)} r={6} fill="hsl(var(--chart-2))" fillOpacity={0.2} />
              ) : null}
              <circle
                cx={xFor(i)}
                cy={yForHypo(p.hypoCount)}
                r={p.hypoCount > 0 ? (isLast ? 3.5 : 3) : 1.5}
                fill="hsl(var(--chart-2))"
                stroke={isLast ? "hsl(var(--card))" : "none"}
                strokeWidth={isLast ? 1.5 : 0}
              />
            </g>
          );
        })}

        {labelIndices.map((i) => {
          const p = points[i];
          if (!p) return null;
          return (
            <text key={`x-${p.weekStartMs}`} x={xFor(i)} y={HEIGHT - 8} textAnchor="middle" fontSize="8" fill="currentColor">
              {p.label}
            </text>
          );
        })}
      </svg>

      <div className="mt-1.5 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "hsl(var(--chart-2))" }} aria-hidden />
          Lows per week
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: "#0ea5e9", opacity: 0.5 }} aria-hidden />
          Exercise sessions
        </span>
      </div>
    </div>
  );
}
