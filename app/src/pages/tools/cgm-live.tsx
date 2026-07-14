import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Activity, Loader2, Minus, Moon, RefreshCw, Settings2, TrendingDown, TrendingUp, Dumbbell } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CgmGlucoseChart } from "@/components/cgm-glucose-chart";
import { InfoTooltip } from "@/components/info-tooltip";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { MedicalNumericOutputDisclaimer } from "@/components/medical-numeric-output-disclaimer";
import { liveCgmConnectMessage } from "@/lib/cgm/live-cgm-source";
import { CGM_HISTORY_RANGES, type CgmHistoryRange } from "@/lib/cgm/cgm-chart";
import {
  chartTimeWindowFromPoints,
  resolveExerciseChartOverlays,
  resolveSleepChartOverlays,
  type CgmChartOverlay,
} from "@/lib/cgm/cgm-chart-overlays";
import { formatTargetBgInput } from "@/lib/hypo-context";
import { formatAgeMinutes } from "@/lib/cgm/staleness";
import { useCgmHistory } from "@/hooks/use-cgm-history";
import {
  computeGlucoseRangeStatus,
  glucoseRangeCardClasses,
  glucoseRangeStatusLabel,
  glucoseRangeValueClasses,
  percentGlucoseInRange,
} from "@/lib/live-glucose-range";
import { resolveUserTargetBgRange } from "@/lib/target-bg-range";
import { storage } from "@/lib/storage";
import { cn } from "@/lib/utils";

function trendIcon(trend: string | null | undefined) {
  if (trend === "rising") return TrendingUp;
  if (trend === "falling") return TrendingDown;
  if (trend === "flat") return Minus;
  return null;
}

export default function CgmLivePage() {
  const [range, setRange] = useState<CgmHistoryRange>("12h");
  const [highlightSleep, setHighlightSleep] = useState(false);
  const [highlightExercise, setHighlightExercise] = useState(false);
  const { points, units, loading, error, connected, sourceLabel, refresh } = useCgmHistory(range);
  const settings = storage.getSettings();
  const { low: targetLow, high: targetHigh } = resolveUserTargetBgRange(settings, units);

  const latest = points.length > 0 ? points[points.length - 1] : null;
  const latestStatus = latest ? computeGlucoseRangeStatus(latest.value, targetLow, targetHigh) : null;
  const inRangePercent = percentGlucoseInRange(
    points.map((p) => p.value),
    targetLow,
    targetHigh,
  );
  const TrendIcon = trendIcon(latest?.trend ?? null);

  const chartWindow = useMemo(() => chartTimeWindowFromPoints(points), [points]);

  const sleepOverlays = useMemo(() => {
    if (!highlightSleep || !chartWindow) return [];
    return resolveSleepChartOverlays({
      bedtimeLogs: storage.getBedtimeLogs(),
      windowStartMs: chartWindow.startMs,
      windowEndMs: chartWindow.endMs,
    });
  }, [highlightSleep, chartWindow, points]);

  const exerciseOverlays = useMemo(() => {
    if (!highlightExercise || !chartWindow) return [];
    return resolveExerciseChartOverlays({
      outcomes: storage.getExerciseOutcomes(),
      activeSession: storage.getActiveExercise(),
      windowStartMs: chartWindow.startMs,
      windowEndMs: chartWindow.endMs,
    });
  }, [highlightExercise, chartWindow, points]);

  const chartOverlays = useMemo((): CgmChartOverlay[] => {
    return [...sleepOverlays, ...exerciseOverlays].sort((a, b) => a.startMs - b.startMs);
  }, [sleepOverlays, exerciseOverlays]);

  const showOverlayHints = highlightSleep || highlightExercise;

  return (
    <PageShell variant="standard" density="compact" className="space-y-4" data-testid="cgm-live-page">
      <PageHeader
        leading={<PageBackButton />}
        title="Glucose trends"
        actions={
          <InfoTooltip
            term="On this device"
            explanation="Near-live CGM readings are fetched for this chart on your phone only. They are not stored in the Diabeaters cloud."
          />
        }
      />

      {!connected ? (
        <Alert>
          <AlertDescription className="text-sm space-y-3">
            <p>{liveCgmConnectMessage()}</p>
            <Button asChild size="sm" data-testid="button-cgm-live-open-settings">
              <Link href="/settings/cgm">
                <Settings2 className="mr-2 h-4 w-4" aria-hidden />
                Open CGM settings
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className={cn("overflow-hidden rounded-2xl shadow-none", latestStatus ? glucoseRangeCardClasses(latestStatus) : undefined)}>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base font-medium text-muted-foreground">Now</CardTitle>
              {latestStatus ? (
                <Badge
                  variant="secondary"
                  className="rounded-full border-0 bg-background/60 text-xs font-medium"
                  data-testid="cgm-live-range-status"
                >
                  {glucoseRangeStatusLabel(latestStatus)}
                </Badge>
              ) : null}
            </div>
            {loading && !latest ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading…
              </div>
            ) : latest ? (
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <p
                  className={cn(
                    "text-3xl font-semibold tabular-nums tracking-tight",
                    latestStatus ? glucoseRangeValueClasses(latestStatus) : undefined,
                  )}
                  data-testid="cgm-live-current-value"
                >
                  {formatTargetBgInput(latest.value, units)}{" "}
                  <span className="text-lg font-medium text-muted-foreground">{units}</span>
                </p>
                {TrendIcon && latest.trend ? (
                  <span className="inline-flex items-center gap-1 text-sm capitalize text-muted-foreground">
                    <TrendIcon className="h-4 w-4" aria-hidden />
                    {latest.trend}
                  </span>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {sourceLabel ?? "CGM"} · {formatAgeMinutes(Math.max(0, Math.floor((Date.now() - latest.timeMs) / 60_000)))} ago
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recent reading</p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={refresh}
            disabled={loading || !connected}
            aria-label="Refresh glucose chart"
            data-testid="button-cgm-live-refresh"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Chart time range">
            {CGM_HISTORY_RANGES.map((option) => (
              <Button
                key={option.id}
                type="button"
                size="sm"
                variant={range === option.id ? "default" : "outline"}
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => setRange(option.id)}
                data-testid={`button-cgm-range-${option.id}`}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Highlight</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Chart highlights">
              <Button
                type="button"
                size="sm"
                variant={highlightSleep ? "default" : "outline"}
                className="h-8 rounded-full px-3 text-xs gap-1.5"
                onClick={() => setHighlightSleep((v) => !v)}
                data-testid="button-cgm-highlight-sleep"
              >
                <Moon className="h-3.5 w-3.5" aria-hidden />
                Sleep
              </Button>
              <Button
                type="button"
                size="sm"
                variant={highlightExercise ? "default" : "outline"}
                className="h-8 rounded-full px-3 text-xs gap-1.5"
                onClick={() => setHighlightExercise((v) => !v)}
                data-testid="button-cgm-highlight-exercise"
              >
                <Dumbbell className="h-3.5 w-3.5" aria-hidden />
                Exercise
              </Button>
            </div>
          </div>

          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {points.length > 0 ? (
            <>
              <CgmGlucoseChart
                points={points}
                units={units}
                targetLow={targetLow}
                targetHigh={targetHigh}
                overlays={chartOverlays}
              />
              {showOverlayHints ? (
                <div className="space-y-1 text-[11px] text-muted-foreground">
                  {highlightSleep ? (
                    <p data-testid="cgm-sleep-overlay-hint">
                      {sleepOverlays.length > 0
                        ? `Indigo bands: estimated sleep from ${sleepOverlays.length} bedtime check${sleepOverlays.length === 1 ? "" : "s"} in this window.`
                        : "No bedtime checks with sleep in this window — log one in Bedtime to see estimated sleep here."}
                    </p>
                  ) : null}
                  {highlightExercise ? (
                    <p data-testid="cgm-exercise-overlay-hint">
                      {exerciseOverlays.length > 0
                        ? `Blue bands: exercise logged in this window (${exerciseOverlays.map((o) => o.label).join(", ")}). Times are approximate from session duration.`
                        : "No exercise logged in this window — use Exercise to start a guided session."}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {inRangePercent != null ? (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">{inRangePercent}%</span> in target for this window
                  </p>
                  <div className="flex items-center gap-1">
                    <p className="tabular-nums text-muted-foreground">
                      Target {formatTargetBgInput(targetLow, units)}–{formatTargetBgInput(targetHigh, units)} {units}
                    </p>
                    <InfoTooltip
                      term="Chart key"
                      explanation="Green band: your target range. Optional indigo (sleep) and blue (exercise) bands come from bedtime checks and logged workouts on this device. Dots use green (in range), amber (low), or orange (high)."
                    />
                  </div>
                </div>
              ) : (
                <div className="flex justify-end">
                  <InfoTooltip
                    term="Chart key"
                    explanation="Green band: your target range. Optional indigo (sleep) and blue (exercise) bands come from bedtime checks and logged workouts on this device. Dots use green (in range), amber (low), or orange (high)."
                  />
                </div>
              )}
            </>
          ) : loading ? (
            <div className="flex min-h-[220px] items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Loading chart…
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
        <Activity className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <p>
          For awareness only — always confirm on your CGM app or reader before treating a low or high. Readings stay
          on this device; Diabeaters does not upload CGM data to the cloud.
        </p>
      </div>

      <MedicalNumericOutputDisclaimer compact collapsible />
    </PageShell>
  );
}
