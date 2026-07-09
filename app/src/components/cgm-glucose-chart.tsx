import { useId, useMemo } from "react";
import { chartYDomain, type CgmChartPoint } from "@/lib/cgm/cgm-chart";
import { CGM_CHART_OVERLAY_COLORS, type CgmChartOverlay } from "@/lib/cgm/cgm-chart-overlays";
import type { BgUnits } from "@/lib/cgm/types";
import { formatTargetBgInput } from "@/lib/hypo-context";
import { computeGlucoseRangeStatus, glucoseRangeChartStroke, type GlucoseRangeStatus } from "@/lib/live-glucose-range";
import { cn } from "@/lib/utils";

type CgmGlucoseChartProps = {
  points: CgmChartPoint[];
  units: BgUnits;
  targetLow?: number;
  targetHigh?: number;
  overlays?: CgmChartOverlay[];
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

function scaleXByTime(timeMs: number, startMs: number, endMs: number, innerWidth: number): number {
  if (endMs <= startMs) return PAD.left + innerWidth / 2;
  const ratio = (timeMs - startMs) / (endMs - startMs);
  const clamped = Math.max(0, Math.min(1, ratio));
  return PAD.left + clamped * innerWidth;
}

export function CgmGlucoseChart({ points, units, targetLow, targetHigh, overlays = [], className }: CgmGlucoseChartProps) {
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
  const hasTargetBand =
    typeof targetLow === "number" && typeof targetHigh === "number" && targetHigh > targetLow;

  const pointStatuses = useMemo(() => {
    if (!hasTargetBand) return points.map(() => "in_range" as GlucoseRangeStatus);
    return points.map((p) => computeGlucoseRangeStatus(p.value, targetLow!, targetHigh!));
  }, [points, hasTargetBand, targetLow, targetHigh]);

  const latestStatus = pointStatuses[pointStatuses.length - 1] ?? "in_range";
  const chartStartMs = points[0]?.timeMs ?? 0;
  const chartEndMs = points[points.length - 1]?.timeMs ?? chartStartMs;

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

        {overlays.map((overlay) => {
          const x1 = scaleXByTime(overlay.startMs, chartStartMs, chartEndMs, innerWidth);
          const x2 = scaleXByTime(overlay.endMs, chartStartMs, chartEndMs, innerWidth);
          const width = Math.max(2, x2 - x1);
          const colors = CGM_CHART_OVERLAY_COLORS[overlay.kind];
          return (
            <rect
              key={overlay.id}
              x={x1}
              y={PAD.top}
              width={width}
              height={innerHeight}
              fill={colors.fill}
              fillOpacity={colors.opacity}
              data-overlay-kind={overlay.kind}
            />
          );
        })}

        {hasTargetBand ? (
          <rect
            x={PAD.left}
            y={scaleY(targetHigh!, yMin, yMax, innerHeight)}
            width={innerWidth}
            height={Math.max(0, scaleY(targetLow!, yMin, yMax, innerHeight) - scaleY(targetHigh!, yMin, yMax, innerHeight))}
            fill="#10b981"
            fillOpacity={0.12}
            rx={2}
          />
        ) : null}

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
            stroke="#10b981"
            strokeOpacity={0.55}
            strokeWidth={1.25}
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
          stroke={hasTargetBand ? glucoseRangeChartStroke(latestStatus) : "hsl(var(--chart-2))"}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeOpacity={0.85}
        />

        {points.map((p, i) => {
          const status = pointStatuses[i] ?? "in_range";
          const isLatest = i === points.length - 1;
          const r = isLatest ? 5 : points.length > 40 ? 0 : 2.5;
          return (
            <circle
              key={`${p.recordedAt}-${i}`}
              cx={scaleX(i, points.length, innerWidth)}
              cy={scaleY(p.value, yMin, yMax, innerHeight)}
              r={r}
              fill={hasTargetBand ? glucoseRangeChartStroke(status) : "hsl(var(--chart-2))"}
              stroke={isLatest ? "hsl(var(--background))" : "none"}
              strokeWidth={isLatest ? 2 : 0}
            />
          );
        })}

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
