import { useId, useMemo } from "react";
import { chartYDomain, type CgmChartPoint } from "@/lib/cgm/cgm-chart";
import { CGM_CHART_OVERLAY_COLORS, type CgmChartOverlay } from "@/lib/cgm/cgm-chart-overlays";
import type { NearFutureProjectionResult } from "@/lib/cgm/near-future-projection";
import type { BgUnits } from "@/lib/cgm/types";
import { formatTargetBgInput } from "@/lib/hypo-context";
import {
  buildGlucoseRangePathSegments,
  computeGlucoseRangeStatus,
  glucoseRangeChartStroke,
  type GlucoseRangeStatus,
} from "@/lib/live-glucose-range";
import { cn } from "@/lib/utils";

type CgmGlucoseChartProps = {
  points: CgmChartPoint[];
  units: BgUnits;
  targetLow?: number;
  targetHigh?: number;
  overlays?: CgmChartOverlay[];
  /** Optional educational near-future estimate, rendered as a subtle dashed extension of the trend line. */
  projection?: NearFutureProjectionResult | null;
  className?: string;
};

const WIDTH = 320;
const HEIGHT = 200;
const PAD = { top: 12, right: 10, bottom: 28, left: 36 };
/** Share of the plot width reserved for the projected (+15/+30 min) segment. */
const FUTURE_ZONE_RATIO = 0.26;
const FALLBACK_STROKE = "hsl(var(--chart-2))";

function scaleX(index: number, count: number, width: number, offset = PAD.left): number {
  if (count <= 1) return offset + width / 2;
  return offset + (index / (count - 1)) * width;
}

function scaleY(value: number, min: number, max: number, innerHeight: number): number {
  if (max <= min) return PAD.top + innerHeight / 2;
  const ratio = (value - min) / (max - min);
  return PAD.top + innerHeight * (1 - ratio);
}

function scaleXByTime(timeMs: number, startMs: number, endMs: number, width: number, offset = PAD.left): number {
  if (endMs <= startMs) return offset + width / 2;
  const ratio = (timeMs - startMs) / (endMs - startMs);
  const clamped = Math.max(0, Math.min(1, ratio));
  return offset + clamped * width;
}

export function CgmGlucoseChart({
  points,
  units,
  targetLow,
  targetHigh,
  overlays = [],
  projection,
  className,
}: CgmGlucoseChartProps) {
  const gradientId = useId().replace(/:/g, "");
  const futureGradientId = useId().replace(/:/g, "");
  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;

  const hasProjection = Boolean(projection) && points.length > 0;
  const futureWidth = hasProjection ? innerWidth * FUTURE_ZONE_RATIO : 0;
  const historyWidth = innerWidth - futureWidth;

  const [yMin, yMax] = useMemo(() => {
    const extras = projection
      ? [projection.at15Min, projection.at30Min, ...(projection.path?.map((p) => p.value) ?? [])]
      : [];
    return chartYDomain(points, units, extras);
  }, [points, units, projection]);

  const historyCoords = useMemo(() => {
    return points.map((p, i) => ({
      x: scaleX(i, points.length, historyWidth),
      y: scaleY(p.value, yMin, yMax, innerHeight),
      value: p.value,
    }));
  }, [points, yMin, yMax, historyWidth, innerHeight]);

  const linePath = useMemo(() => {
    if (historyCoords.length === 0) return "";
    return historyCoords
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");
  }, [historyCoords]);

  const yTicks = useMemo(() => {
    const steps = 4;
    return Array.from({ length: steps + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / steps);
  }, [yMin, yMax]);

  const xLabelIndices = useMemo(() => {
    if (points.length <= 1) return [0];
    if (points.length <= 4) {
      // When projecting, skip the last history tick — it sits on the "now" divider
      // and collides with +15m / +30m on narrow screens.
      return hasProjection
        ? points.map((_, i) => i).filter((i) => i < points.length - 1)
        : points.map((_, i) => i);
    }
    if (hasProjection) {
      return [0, Math.floor(points.length / 2)];
    }
    return [0, Math.floor(points.length / 2), points.length - 1];
  }, [points, hasProjection]);

  const refLines = [targetLow, targetHigh].filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const hasTargetBand =
    typeof targetLow === "number" && typeof targetHigh === "number" && targetHigh > targetLow;

  const pointStatuses = useMemo(() => {
    if (!hasTargetBand) return points.map(() => "in_range" as GlucoseRangeStatus);
    return points.map((p) => computeGlucoseRangeStatus(p.value, targetLow!, targetHigh!));
  }, [points, hasTargetBand, targetLow, targetHigh]);

  const historyStrokeSegments = useMemo(() => {
    if (!hasTargetBand || historyCoords.length < 2) return null;
    return buildGlucoseRangePathSegments(historyCoords, targetLow!, targetHigh!);
  }, [hasTargetBand, historyCoords, targetLow, targetHigh]);

  const latestStatus = pointStatuses[pointStatuses.length - 1] ?? "in_range";
  const chartStartMs = points[0]?.timeMs ?? 0;
  const chartEndMs = points[points.length - 1]?.timeMs ?? chartStartMs;
  const areaStroke = hasTargetBand ? glucoseRangeChartStroke(latestStatus) : FALLBACK_STROKE;

  const future = useMemo(() => {
    if (!hasProjection || !projection) return null;
    const xNow = PAD.left + historyWidth;
    const lastValue = points[points.length - 1]?.value ?? projection.currentDisplay;
    const yNow = scaleY(lastValue, yMin, yMax, innerHeight);
    const samples =
      projection.path?.length
        ? projection.path
        : [
            { minutesAhead: 15, value: projection.at15Min },
            { minutesAhead: 30, value: projection.at30Min },
          ];
    const maxAhead = Math.max(...samples.map((s) => s.minutesAhead), 30);
    const coords = [
      { x: xNow, y: yNow, value: lastValue, minutesAhead: 0 },
      ...samples.map((s) => {
        const x = xNow + (s.minutesAhead / maxAhead) * futureWidth;
        const y = scaleY(s.value, yMin, yMax, innerHeight);
        return { x, y, minutesAhead: s.minutesAhead, value: s.value };
      }),
    ];
    const x15 = coords.find((c) => c.minutesAhead === 15)?.x ?? xNow + futureWidth * 0.5;
    const y15 = coords.find((c) => c.minutesAhead === 15)?.y ?? scaleY(projection.at15Min, yMin, yMax, innerHeight);
    const status15 = hasTargetBand
      ? computeGlucoseRangeStatus(projection.at15Min, targetLow!, targetHigh!)
      : ("in_range" as const);
    const last = coords[coords.length - 1]!;
    const x30 = last.x;
    const y30 = last.y;
    const status30 = hasTargetBand
      ? computeGlucoseRangeStatus(last.value, targetLow!, targetHigh!)
      : ("in_range" as const);
    const futureLinePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
    const areaPath = `${futureLinePath} L${x30.toFixed(1)},${(PAD.top + innerHeight).toFixed(1)} L${xNow.toFixed(1)},${(PAD.top + innerHeight).toFixed(1)} Z`;
    const strokeSegments =
      hasTargetBand && coords.length >= 2
        ? buildGlucoseRangePathSegments(coords, targetLow!, targetHigh!)
        : null;
    const endStroke = hasTargetBand ? glucoseRangeChartStroke(status30) : FALLBACK_STROKE;
    return {
      xNow,
      yNow,
      x15,
      y15,
      x30,
      y30,
      status15,
      status30,
      linePath: futureLinePath,
      areaPath,
      strokeSegments,
      endStroke,
    };
  }, [
    hasProjection,
    projection,
    historyWidth,
    futureWidth,
    points,
    yMin,
    yMax,
    innerHeight,
    hasTargetBand,
    targetLow,
    targetHigh,
  ]);

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
            <stop offset="0%" stopColor={areaStroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={areaStroke} stopOpacity="0.02" />
          </linearGradient>
          {future ? (
            <linearGradient id={`${futureGradientId}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={future.endStroke} stopOpacity="0.14" />
              <stop offset="100%" stopColor={future.endStroke} stopOpacity="0" />
            </linearGradient>
          ) : null}
        </defs>

        {overlays.map((overlay) => {
          const x1 = scaleXByTime(overlay.startMs, chartStartMs, chartEndMs, historyWidth);
          const x2 = scaleXByTime(overlay.endMs, chartStartMs, chartEndMs, historyWidth);
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
            d={`${linePath} L${scaleX(points.length - 1, points.length, historyWidth).toFixed(1)},${(PAD.top + innerHeight).toFixed(1)} L${PAD.left},${(PAD.top + innerHeight).toFixed(1)} Z`}
            fill={`url(#${gradientId})`}
            stroke="none"
          />
        ) : null}

        {historyStrokeSegments ? (
          historyStrokeSegments.map((seg) => (
            <path
              key={`hist-${seg.status}`}
              d={seg.d}
              fill="none"
              stroke={glucoseRangeChartStroke(seg.status)}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeOpacity={0.9}
            />
          ))
        ) : (
          <path
            d={linePath}
            fill="none"
            stroke={FALLBACK_STROKE}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeOpacity={0.85}
          />
        )}

        {future ? (
          <g data-testid="cgm-chart-projection">
            <line
              x1={future.xNow}
              y1={PAD.top}
              x2={future.xNow}
              y2={PAD.top + innerHeight}
              stroke="currentColor"
              strokeOpacity={0.16}
              strokeDasharray="2 3"
              strokeWidth={1}
            />
            <path d={future.areaPath} fill={`url(#${futureGradientId}-fill)`} stroke="none" />
            {future.strokeSegments ? (
              future.strokeSegments.map((seg) => (
                <path
                  key={`proj-${seg.status}`}
                  d={seg.d}
                  fill="none"
                  stroke={glucoseRangeChartStroke(seg.status)}
                  strokeWidth={2}
                  strokeDasharray="4.5 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity={0.9}
                />
              ))
            ) : (
              <path
                d={future.linePath}
                fill="none"
                stroke={FALLBACK_STROKE}
                strokeWidth={2}
                strokeDasharray="4.5 4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={0.75}
              />
            )}
            <circle
              cx={future.x15}
              cy={future.y15}
              r={2.75}
              fill="hsl(var(--background))"
              stroke={hasTargetBand ? glucoseRangeChartStroke(future.status15) : FALLBACK_STROKE}
              strokeOpacity={0.7}
              strokeWidth={1.5}
            />
            <circle
              cx={future.x30}
              cy={future.y30}
              r={7}
              fill={hasTargetBand ? glucoseRangeChartStroke(future.status30) : FALLBACK_STROKE}
              fillOpacity={0.12}
            />
            <circle
              cx={future.x30}
              cy={future.y30}
              r={3.25}
              fill="hsl(var(--background))"
              stroke={hasTargetBand ? glucoseRangeChartStroke(future.status30) : FALLBACK_STROKE}
              strokeOpacity={0.75}
              strokeWidth={1.5}
            />
            <text
              x={(future.xNow + future.x30) / 2}
              y={PAD.top + 8}
              textAnchor="middle"
              fontSize="7.5"
              fontStyle="italic"
              fill="currentColor"
              fillOpacity={0.5}
            >
              projected
            </text>
          </g>
        ) : null}

        {points.map((p, i) => {
          const status = pointStatuses[i] ?? "in_range";
          const isLatest = i === points.length - 1;
          const r = isLatest ? 5 : points.length > 40 ? 0 : 2.5;
          return (
            <circle
              key={`${p.recordedAt}-${i}`}
              cx={scaleX(i, points.length, historyWidth)}
              cy={scaleY(p.value, yMin, yMax, innerHeight)}
              r={r}
              fill={hasTargetBand ? glucoseRangeChartStroke(status) : FALLBACK_STROKE}
              stroke={isLatest ? "hsl(var(--background))" : "none"}
              strokeWidth={isLatest ? 2 : 0}
            />
          );
        })}

        {xLabelIndices.map((i) => {
          const p = points[i];
          if (!p) return null;
          const x = scaleX(i, points.length, historyWidth);
          // Keep the first label from clipping off the left; mid labels stay centred.
          const anchor = i === 0 ? "start" : "middle";
          return (
            <text
              key={`${p.recordedAt}-x`}
              x={x}
              y={HEIGHT - 8}
              textAnchor={anchor}
              fontSize="8.5"
              fill="currentColor"
              fillOpacity={0.85}
            >
              {p.timeLabel}
            </text>
          );
        })}

        {future ? (
          <>
            <text
              x={future.x15}
              y={HEIGHT - 8}
              textAnchor="middle"
              fontSize="8"
              fill="currentColor"
              fillOpacity={0.55}
            >
              +15
            </text>
            <text
              x={Math.min(future.x30, WIDTH - PAD.right)}
              y={HEIGHT - 8}
              textAnchor="end"
              fontSize="8"
              fill="currentColor"
              fillOpacity={0.55}
            >
              +30
            </text>
          </>
        ) : null}
      </svg>

      {points.length > 0 ? (
        <p className="mt-1 text-center text-[11px] text-muted-foreground">
          Latest: {formatTargetBgInput(points[points.length - 1]!.value, units)} {units}
          {future ? (
            <span className="italic text-muted-foreground/70">
              {" "}
              · dashed line: educational projection, not a prediction
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
