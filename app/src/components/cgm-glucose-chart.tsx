import { useId, useMemo } from "react";
import { chartYDomain, type CgmChartPoint } from "@/lib/cgm/cgm-chart";
import type { BgUnits } from "@/lib/cgm/types";
import { formatTargetBgInput } from "@/lib/hypo-context";
import { cn } from "@/lib/utils";

type CgmGlucoseChartProps = {
  points: CgmChartPoint[];
  units: BgUnits;
  targetLow?: number;
  targetHigh?: number;
  className?: string;
};

const WIDTH = 320;
const HEIGHT = 200;
const PAD = { top: 12, right: 8, bottom: 28, left: 36 };

function scaleX(index: number, count: number, innerWidth: number): number {
  if (count <= 1) return PAD.left + innerWidth / 2;
  return PAD.left + (index / (count - 1)) * innerWidth;
}

function scaleY(value: number, min: number, max: number, innerHeight: number): number {
  if (max <= min) return PAD.top + innerHeight / 2;
  const ratio = (value - min) / (max - min);
  return PAD.top + innerHeight * (1 - ratio);
}

export function CgmGlucoseChart({ points, units, targetLow, targetHigh, className }: CgmGlucoseChartProps) {
  const gradientId = useId().replace(/:/g, "");
  const [yMin, yMax] = useMemo(() => chartYDomain(points, units), [points, units]);
  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;

  const linePath = useMemo(() => {
    if (points.length === 0) return "";
    return points
      .map((p, i) => {
        const x = scaleX(i, points.length, innerWidth);
        const y = scaleY(p.value, yMin, yMax, innerHeight);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [points, yMin, yMax, innerWidth, innerHeight]);

  const yTicks = useMemo(() => {
    const steps = 4;
    return Array.from({ length: steps + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / steps);
  }, [yMin, yMax]);

  const xLabelIndices = useMemo(() => {
    if (points.length <= 1) return [0];
    if (points.length <= 4) return points.map((_, i) => i);
    return [0, Math.floor(points.length / 2), points.length - 1];
  }, [points]);

  const refLines = [targetLow, targetHigh].filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  return (
    <div className={cn("w-full", className)} data-testid="cgm-glucose-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full min-h-[200px] text-muted-foreground"
        role="img"
        aria-label={`Glucose trend chart, ${points.length} readings`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity="0.35" />
            <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => {
          const y = scaleY(tick, yMin, yMax, innerHeight);
          return (
            <g key={tick}>
              <line
                x1={PAD.left}
                y1={y}
                x2={WIDTH - PAD.right}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.12}
                strokeDasharray="4 4"
              />
              <text x={PAD.left - 6} y={y + 3} textAnchor="end" fontSize="9" fill="currentColor">
                {units === "mmol/L" ? tick.toFixed(1) : Math.round(tick)}
              </text>
            </g>
          );
        })}

        {refLines.map((value) => (
          <line
            key={`target-${value}`}
            x1={PAD.left}
            y1={scaleY(value, yMin, yMax, innerHeight)}
            x2={WIDTH - PAD.right}
            y2={scaleY(value, yMin, yMax, innerHeight)}
            stroke="currentColor"
            strokeOpacity={0.35}
            strokeDasharray="6 4"
          />
        ))}

        {points.length > 1 ? (
          <path
            d={`${linePath} L${scaleX(points.length - 1, points.length, innerWidth).toFixed(1)},${(PAD.top + innerHeight).toFixed(1)} L${PAD.left},${(PAD.top + innerHeight).toFixed(1)} Z`}
            fill={`url(#${gradientId})`}
            stroke="none"
          />
        ) : null}

        <path
          d={linePath}
          fill="none"
          stroke="hsl(var(--chart-2))"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((p, i) => (
          <circle
            key={`${p.recordedAt}-${i}`}
            cx={scaleX(i, points.length, innerWidth)}
            cy={scaleY(p.value, yMin, yMax, innerHeight)}
            r={points.length > 40 ? 0 : 2.5}
            fill="hsl(var(--chart-2))"
          />
        ))}

        {xLabelIndices.map((i) => {
          const p = points[i];
          if (!p) return null;
          return (
            <text
              key={`${p.recordedAt}-x`}
              x={scaleX(i, points.length, innerWidth)}
              y={HEIGHT - 8}
              textAnchor="middle"
              fontSize="9"
              fill="currentColor"
            >
              {p.timeLabel}
            </text>
          );
        })}
      </svg>

      {points.length > 0 ? (
        <p className="mt-1 text-center text-[11px] text-muted-foreground">
          Latest: {formatTargetBgInput(points[points.length - 1]!.value, units)} {units}
        </p>
      ) : null}
    </div>
  );
}
