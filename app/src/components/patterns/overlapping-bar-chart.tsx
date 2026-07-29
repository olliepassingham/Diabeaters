import { useId, useMemo } from "react";
import type { ComparisonBucket } from "@/lib/insights/pattern-charts";
import { cn } from "@/lib/utils";

type OverlappingBarChartProps = {
  buckets: ComparisonBucket[];
  currentLabel: string;
  previousLabel: string;
  /** Every Nth label is shown on the x-axis to avoid crowding (e.g. weekday charts show all). */
  labelEvery?: number;
  className?: string;
  "data-testid"?: string;
};

const WIDTH = 320;
const HEIGHT = 168;
const PAD = { top: 10, right: 8, bottom: 26, left: 26 };

/**
 * Grouped-but-overlapping comparison bars: a wider, translucent bar for the
 * previous period sits behind a narrower, solid bar for the current period —
 * so the two periods visually overlap within each category slot instead of
 * sitting side by side.
 */
export function OverlappingBarChart({
  buckets,
  currentLabel,
  previousLabel,
  labelEvery = 1,
  className,
  "data-testid": testId,
}: OverlappingBarChartProps) {
  const gradientId = useId().replace(/:/g, "");
  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const maxCount = Math.max(1, ...buckets.map((b) => Math.max(b.currentCount, b.previousCount)));

  const slotWidth = buckets.length > 0 ? innerWidth / buckets.length : innerWidth;
  const wideBarWidth = Math.max(4, slotWidth * 0.62);
  const narrowBarWidth = Math.max(3, slotWidth * 0.34);

  const yTicks = useMemo(() => {
    const steps = maxCount <= 4 ? maxCount : 4;
    return Array.from({ length: steps + 1 }, (_, i) => Math.round((maxCount * i) / steps));
  }, [maxCount]);

  const barHeight = (count: number) => (maxCount === 0 ? 0 : (count / maxCount) * innerHeight);
  const yFor = (count: number) => PAD.top + innerHeight - barHeight(count);

  return (
    <div className={cn("w-full", className)} data-testid={testId}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full min-h-[168px] text-muted-foreground"
        role="img"
        aria-label={`Comparison chart: ${currentLabel} vs ${previousLabel}, by ${buckets.length} categories`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity="0.95" />
            <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id={`${gradientId}-prev`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => {
          const y = yFor(tick);
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

        {buckets.map((bucket, i) => {
          const centerX = PAD.left + slotWidth * (i + 0.5);
          return (
            <g key={bucket.key} data-testid={`bar-group-${bucket.key}`}>
              <rect
                x={centerX - wideBarWidth / 2}
                y={yFor(bucket.previousCount)}
                width={wideBarWidth}
                height={barHeight(bucket.previousCount)}
                fill={`url(#${gradientId}-prev)`}
                rx={3}
              />
              <rect
                x={centerX - narrowBarWidth / 2}
                y={yFor(bucket.currentCount)}
                width={narrowBarWidth}
                height={barHeight(bucket.currentCount)}
                fill={`url(#${gradientId})`}
                rx={2}
              />
              {i % labelEvery === 0 ? (
                <text
                  x={centerX}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  fontSize="8"
                  fill="currentColor"
                >
                  {bucket.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      <div className="mt-1.5 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: "hsl(var(--chart-2))" }} aria-hidden />
          {currentLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-muted-foreground/30" aria-hidden />
          {previousLabel}
        </span>
      </div>
    </div>
  );
}
