import { useId, useMemo, useState } from "react";
import {
  buildCgmHistoryAxisTicks,
  chartYDomain,
  formatCgmHistoryAxisLabel,
  type CgmChartPoint,
} from "@/lib/cgm/cgm-chart";
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

export type InsulinChartSample = { timeMs: number; units: number };

export type InsulinChartMark = {
  id: string;
  timeMs: number;
  label: string;
  tone: "taken" | "due";
};

type CgmGlucoseChartProps = {
  points: CgmChartPoint[];
  units: BgUnits;
  targetLow?: number;
  targetHigh?: number;
  overlays?: CgmChartOverlay[];
  /** Optional educational near-future estimate, rendered as a subtle dashed extension of the trend line. */
  projection?: NearFutureProjectionResult | null;
  timelineEvents?: CgmTimelineEvent[];
  /** Rapid-insulin estimate, drawn on its own scale over the glucose plot. */
  insulinSeries?: InsulinChartSample[];
  insulinMarks?: InsulinChartMark[];
  /** Used when the insulin line needs to extend past the last glucose reading. */
  xDomain?: { startMs: number; endMs: number };
  className?: string;
};

export type CgmTimelineEvent = {
  id: string;
  timeMs: number;
  label: string;
  detail: string;
  status: "planned" | "confirmed";
};

const WIDTH = 320;
const HEIGHT = 200;
const PAD = { top: 12, right: 10, bottom: 28, left: 36 };
/** Share of the plot width reserved for the projected (+15/+30 min) segment. */
const FUTURE_ZONE_RATIO = 0.26;
const FALLBACK_STROKE = "hsl(var(--chart-2))";

function scaleY(value: number, min: number, max: number, innerHeight: number): number {
  if (max <= min) return PAD.top + innerHeight / 2;
  const ratio = (value - min) / (max - min);
  return PAD.top + innerHeight * (1 - ratio);
}

const INSULIN_LANE_EXTRA = 52;
const INSULIN_LANE_HEIGHT = 40;

function clipActiveInsulin(samples: InsulinChartSample[]): InsulinChartSample[] {
  const first = samples.findIndex((sample) => sample.units > 0.05);
  if (first < 0) return [];
  let last = first;
  for (let i = samples.length - 1; i >= first; i--) {
    if (samples[i]!.units > 0.05) {
      last = i;
      break;
    }
  }
  const end = Math.min(samples.length - 1, last + 1);
  return samples.slice(first, end + 1);
}

function scaleXByTime(timeMs: number, startMs: number, endMs: number, width: number, offset = PAD.left): number {
  if (endMs <= startMs) return offset + width / 2;
  const ratio = (timeMs - startMs) / (endMs - startMs);
  const clamped = Math.max(0, Math.min(1, ratio));
  return offset + clamped * width;
}

function InsulinTimeline({
  samples,
  marks,
  peak,
  startMs,
  endMs,
  width,
  laneTop,
  fadeId,
}: {
  samples: InsulinChartSample[];
  marks: InsulinChartMark[];
  peak: number;
  startMs: number;
  endMs: number;
  width: number;
  laneTop: number;
  fadeId: string;
}) {
  const baseline = laneTop + INSULIN_LANE_HEIGHT;
  const coords =
    peak > 0.05
      ? clipActiveInsulin(samples)
          .filter((sample) => sample.timeMs >= startMs && sample.timeMs <= endMs)
          .map((sample) => ({
            x: scaleXByTime(sample.timeMs, startMs, endMs, width),
            y: laneTop + INSULIN_LANE_HEIGHT * (1 - sample.units / peak),
          }))
      : [];
  const shape =
    coords.length >= 2
      ? `${coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ")} L${coords[coords.length - 1]!.x.toFixed(1)},${baseline.toFixed(1)} L${coords[0]!.x.toFixed(1)},${baseline.toFixed(1)} Z`
      : null;
  const start = coords[0];
  const tip = coords[coords.length - 1];

  return (
    <g data-testid="cgm-insulin-estimate">
      {shape && start && tip ? (
        <>
          <defs>
            <linearGradient id={fadeId} x1={start.x} y1="0" x2={tip.x} y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#d97706" stopOpacity="0.95" />
              <stop offset="78%" stopColor="#d97706" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#d97706" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <path d={shape} fill={`url(#${fadeId})`} stroke="none" />
          <line
            x1={start.x}
            y1={baseline}
            x2={tip.x}
            y2={baseline}
            stroke="#d97706"
            strokeOpacity={0.35}
          />
        </>
      ) : null}
      {marks.map((mark) => {
        const x = scaleXByTime(mark.timeMs, startMs, endMs, width);
        const taken = mark.tone === "taken";
        return (
          <g key={mark.id} data-testid={`insulin-mark-${mark.id}`}>
            <title>{mark.label}</title>
            <circle
              cx={x}
              cy={baseline}
              r={6.5}
              fill={taken ? "#d97706" : "hsl(var(--background))"}
              stroke="#d97706"
              strokeWidth={1.25}
            />
            <text
              x={x}
              y={baseline + 2.4}
              textAnchor="middle"
              fontSize="7"
              fontWeight={700}
              fill={taken ? "#fff" : "#d97706"}
            >
              L
            </text>
          </g>
        );
      })}
    </g>
  );
}

export function CgmGlucoseChart({
  points,
  units,
  targetLow,
  targetHigh,
  overlays = [],
  projection,
  timelineEvents = [],
  insulinSeries = [],
  insulinMarks = [],
  xDomain,
  className,
}: CgmGlucoseChartProps) {
  const [selectedTimelineEventId, setSelectedTimelineEventId] = useState<string | null>(null);
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

  const chartStartMs = xDomain?.startMs ?? points[0]?.timeMs ?? 0;
  const chartEndMs = xDomain?.endMs ?? points[points.length - 1]?.timeMs ?? chartStartMs;
  const insulinPeak = insulinSeries.reduce((max, sample) => Math.max(max, sample.units), 0);
  const showInsulin = insulinPeak > 0.05 || insulinMarks.length > 0;
  const svgHeight = showInsulin ? HEIGHT + INSULIN_LANE_EXTRA : HEIGHT;
  const insulinLaneTop = PAD.top + innerHeight + 18;
  const insulinFadeId = `${gradientId}-insulin`;
  const nowMs = Date.now();
  const showNowMarker = showInsulin && chartEndMs - nowMs > 15 * 60_000 && nowMs > chartStartMs;
  const visibleTimelineEvents = useMemo(
    () =>
      timelineEvents.filter(
        (event) => Number.isFinite(event.timeMs) && event.timeMs >= chartStartMs && event.timeMs <= chartEndMs,
      ),
    [timelineEvents, chartStartMs, chartEndMs],
  );
  const selectedTimelineEvent =
    visibleTimelineEvents.find((event) => event.id === selectedTimelineEventId) ?? null;

  const historyCoords = useMemo(() => {
    return points.map((p) => ({
      x: scaleXByTime(p.timeMs, chartStartMs, chartEndMs, historyWidth),
      y: scaleY(p.value, yMin, yMax, innerHeight),
      value: p.value,
    }));
  }, [points, chartStartMs, chartEndMs, yMin, yMax, historyWidth, innerHeight]);

  const axisTicks = useMemo(
    () => buildCgmHistoryAxisTicks(chartStartMs, chartEndMs),
    [chartStartMs, chartEndMs],
  );

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
        viewBox={`0 0 ${WIDTH} ${svgHeight}`}
        className="h-auto w-full min-h-[200px] text-muted-foreground"
        role="img"
        aria-label={
          showInsulin
            ? `Glucose chart with rapid insulin running out underneath, ${points.length} readings`
            : `Glucose trend chart, ${points.length} readings`
        }
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

        {points.length > 1 && historyCoords.length > 1 ? (
          <path
            d={`${linePath} L${historyCoords[historyCoords.length - 1]!.x.toFixed(1)},${(PAD.top + innerHeight).toFixed(1)} L${historyCoords[0]!.x.toFixed(1)},${(PAD.top + innerHeight).toFixed(1)} Z`}
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
          const coord = historyCoords[i];
          if (!coord) return null;
          return (
            <circle
              key={`${p.recordedAt}-${i}`}
              cx={coord.x}
              cy={coord.y}
              r={r}
              fill={hasTargetBand ? glucoseRangeChartStroke(status) : FALLBACK_STROKE}
              stroke={isLatest ? "hsl(var(--background))" : "none"}
              strokeWidth={isLatest ? 2 : 0}
            />
          );
        })}

        {visibleTimelineEvents.map((event) => {
          const x = scaleXByTime(event.timeMs, chartStartMs, chartEndMs, historyWidth);
          const confirmed = event.status === "confirmed";
          return (
            <g
              key={event.id}
              role="button"
              tabIndex={0}
              aria-label={`${event.label}, ${event.detail}`}
              className="cursor-pointer outline-none"
              onClick={() => setSelectedTimelineEventId((current) => (current === event.id ? null : event.id))}
              onKeyDown={(keyboardEvent) => {
                if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                  keyboardEvent.preventDefault();
                  setSelectedTimelineEventId((current) => (current === event.id ? null : event.id));
                }
              }}
              data-testid={`cgm-timeline-event-${event.id}`}
            >
              <title>{`${event.label}: ${event.detail}`}</title>
              <rect x={x - 10} y={PAD.top} width={20} height={innerHeight} fill="transparent" />
              <line
                x1={x}
                y1={PAD.top + 13}
                x2={x}
                y2={PAD.top + innerHeight}
                stroke="hsl(var(--primary))"
                strokeOpacity={confirmed ? 0.35 : 0.2}
                strokeDasharray={confirmed ? "3 3" : "2 4"}
              />
              <circle
                cx={x}
                cy={PAD.top + 11}
                r={8}
                fill={confirmed ? "hsl(var(--primary))" : "hsl(var(--background))"}
                stroke="hsl(var(--primary))"
                strokeWidth={1.25}
                strokeOpacity={confirmed ? 0.9 : 0.6}
              />
              <text
                x={x}
                y={PAD.top + 13.5}
                textAnchor="middle"
                fontSize="7"
                fontWeight={700}
                fill={confirmed ? "hsl(var(--primary-foreground))" : "hsl(var(--primary))"}
              >
                M
              </text>
            </g>
          );
        })}

        {showNowMarker ? (
          <g data-testid="cgm-insulin-now">
            <line
              x1={scaleXByTime(nowMs, chartStartMs, chartEndMs, historyWidth)}
              y1={PAD.top}
              x2={scaleXByTime(nowMs, chartStartMs, chartEndMs, historyWidth)}
              y2={PAD.top + innerHeight}
              stroke="currentColor"
              strokeOpacity={0.28}
              strokeDasharray="2 3"
            />
            <text
              x={scaleXByTime(nowMs, chartStartMs, chartEndMs, historyWidth)}
              y={PAD.top + 9}
              textAnchor="middle"
              fontSize="8"
              fontWeight={600}
              fill="currentColor"
            >
              Now
            </text>
          </g>
        ) : null}

        {showInsulin ? (
          <InsulinTimeline
            samples={insulinSeries}
            marks={insulinMarks}
            peak={insulinPeak}
            startMs={chartStartMs}
            endMs={chartEndMs}
            width={historyWidth}
            laneTop={insulinLaneTop}
            fadeId={insulinFadeId}
          />
        ) : null}

        {axisTicks.map((ms) => {
          const x = scaleXByTime(ms, chartStartMs, chartEndMs, historyWidth);
          const historyRight = PAD.left + historyWidth;
          if (future && historyRight - x < 10) return null;
          const anchor = x < PAD.left + 14 ? "start" : x > historyRight - 14 ? "end" : "middle";
          return (
            <g key={ms}>
              <line
                x1={x}
                y1={PAD.top}
                x2={x}
                y2={PAD.top + innerHeight}
                stroke="currentColor"
                strokeOpacity={0.08}
              />
              <text
                x={x}
                y={svgHeight - 8}
                textAnchor={anchor}
                fontSize="9"
                fill="currentColor"
                fillOpacity={0.85}
              >
                {formatCgmHistoryAxisLabel(ms)}
              </text>
            </g>
          );
        })}

        {future ? (
          <>
            <text
              x={future.x15}
              y={svgHeight - 8}
              textAnchor="middle"
              fontSize="9"
              fill="currentColor"
              fillOpacity={0.55}
            >
              +15
            </text>
            <text
              x={Math.min(future.x30, WIDTH - PAD.right)}
              y={svgHeight - 8}
              textAnchor="end"
              fontSize="9"
              fill="currentColor"
              fillOpacity={0.55}
            >
              +30
            </text>
          </>
        ) : null}
      </svg>

      {selectedTimelineEvent ? (
        <div
          className="mx-3 -mt-1 flex items-center justify-between gap-3 rounded-xl bg-primary/[0.07] px-3 py-2 text-xs"
          data-testid="cgm-timeline-event-detail"
        >
          <span className="min-w-0">
            <span className="font-semibold text-foreground">{selectedTimelineEvent.label}</span>
            <span className="ml-1.5 text-muted-foreground">{selectedTimelineEvent.detail}</span>
          </span>
          <span className="shrink-0 capitalize text-primary">{selectedTimelineEvent.status}</span>
        </div>
      ) : null}

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
