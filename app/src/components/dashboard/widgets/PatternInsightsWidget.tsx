import { useEffect, useMemo, useState } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { WidgetCard } from "./WidgetCard";
import type { DashboardWidgetLayoutProps } from "./types";
import { isCompactLayout } from "./types";
import { storage } from "@/lib/storage";
import { computePatternInsights } from "@/lib/insights/pattern-insights";
import { computeHourlyHypoComparison } from "@/lib/insights/pattern-charts";
import { listDismissedPatternInsightIds } from "@/lib/insights/insights-dismiss";
import { OverlappingBarChart } from "@/components/patterns/overlapping-bar-chart";
import { GlucoseDayOverlayChart } from "@/components/patterns/glucose-day-overlay-chart";
import { isCgmPrefillActive } from "@/lib/cgm/preferences";
import { fetchLiveCgmHistory } from "@/lib/cgm/live-cgm-history";
import { countCgmLocalHistoryDays, getCgmLocalHistory } from "@/lib/cgm/cgm-history-store";
import { buildGlucoseDayOverlay } from "@/lib/cgm/glucose-day-overlay";
import { resolveUserTargetBgRange } from "@/lib/target-bg-range";
import { normalizeBgUnits } from "@/lib/alcohol-night-tool";

const MIN_HYPOS_FOR_CHART = 3;
const MIN_DAYS_FOR_OVERLAY = 1;

/**
 * Home widget: leads with the overlapping daily glucose pattern chart when
 * CGM history is available (same view as "Your patterns", without the long
 * explanation). Falls back to the hypo time-of-day chart when there's no
 * glucose history yet.
 */
export function PatternInsightsWidget(props: DashboardWidgetLayoutProps) {
  const compact = isCompactLayout(props);
  const [refreshTick, setRefreshTick] = useState(0);
  const cgmConnected = isCgmPrefillActive();

  useEffect(() => {
    if (!cgmConnected) return;
    let cancelled = false;
    void fetchLiveCgmHistory({ minutes: 1440, maxCount: 288 })
      .then(() => {
        if (!cancelled) setRefreshTick((t) => t + 1);
      })
      .catch(() => {
        // Best-effort — widget still works from whatever local history exists.
      });
    return () => {
      cancelled = true;
    };
  }, [cgmConnected]);

  const units = normalizeBgUnits(storage.getProfile()?.bgUnits);
  const targetRange = useMemo(() => resolveUserTargetBgRange(storage.getSettings(), units), [units]);

  const dayCount = useMemo(
    () => (cgmConnected ? countCgmLocalHistoryDays(7) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cgmConnected, refreshTick],
  );
  const glucoseSeries = useMemo(
    () => (cgmConnected ? buildGlucoseDayOverlay(getCgmLocalHistory(7), units, { days: 7 }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cgmConnected, units, refreshTick],
  );
  const hasGlucoseChart = cgmConnected && dayCount >= MIN_DAYS_FOR_OVERLAY && glucoseSeries.length > 0;

  const hypos = useMemo(() => storage.getHypoTreatments(), []);
  const exerciseOutcomes = useMemo(() => storage.getExerciseOutcomes(), []);
  const hypoDates = useMemo(
    () => hypos.map((h) => new Date(h.timestamp)).filter((d) => !Number.isNaN(d.getTime())),
    [hypos],
  );
  const hourlyBuckets = useMemo(() => computeHourlyHypoComparison(hypoDates, new Date()), [hypoDates]);
  const hasHypoChart = !hasGlucoseChart && hypos.length >= MIN_HYPOS_FOR_CHART;

  const topInsight = useMemo(() => {
    if (hasGlucoseChart) return null;
    const dismissed = new Set(listDismissedPatternInsightIds());
    return computePatternInsights({ hypos, exerciseOutcomes }, 3).find((i) => !dismissed.has(i.id)) ?? null;
  }, [hasGlucoseChart, hypos, exerciseOutcomes]);

  if (!hasGlucoseChart && !hasHypoChart && !topInsight && !cgmConnected) return null;

  // CGM connected but history still empty — keep a light teaser so the widget
  // doesn't vanish while the pattern is still building.
  const showBuildingTeaser = cgmConnected && !hasGlucoseChart && !hasHypoChart && !topInsight;

  return (
    <WidgetCard data-testid="widget-pattern-insights">
      <CardHeader className="p-4 pb-2 md:p-6 md:pb-3">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {hasGlucoseChart ? (
              <LineChart className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
            )}
            <CardTitle className="text-h3 text-foreground">Your patterns</CardTitle>
          </div>
          {hasGlucoseChart ? (
            <span className="shrink-0 text-xs text-muted-foreground">Daily glucose</span>
          ) : hasHypoChart ? (
            <span className="shrink-0 text-xs text-muted-foreground">Lows by time of day</span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 md:px-6 md:pb-6 space-y-3">
        {hasGlucoseChart ? (
          <GlucoseDayOverlayChart
            series={glucoseSeries}
            units={units}
            targetRange={targetRange}
            className={compact ? "[&_svg]:min-h-[140px]" : undefined}
            data-testid="chart-widget-glucose-overlay"
          />
        ) : null}

        {hasHypoChart ? (
          <OverlappingBarChart
            buckets={hourlyBuckets}
            currentLabel="Last 30 days"
            previousLabel="Previous 30 days"
            labelEvery={2}
            className={compact ? "[&_svg]:min-h-[120px]" : undefined}
            data-testid="chart-widget-pattern-hourly"
          />
        ) : null}

        {topInsight ? (
          <p className="text-sm leading-snug text-foreground/90" data-testid="pattern-insight-summary">
            <span className="font-medium">{topInsight.title}.</span>{" "}
            <span className="text-muted-foreground">{topInsight.body}</span>
          </p>
        ) : null}

        {showBuildingTeaser ? (
          <p className="text-sm leading-snug text-muted-foreground" data-testid="text-widget-glucose-building">
            Still building your daily glucose pattern — check back in a few days.
          </p>
        ) : null}

        <Link
          href="/tools/patterns"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
          data-testid="link-view-all-patterns"
        >
          View all patterns
        </Link>
      </CardContent>
    </WidgetCard>
  );
}
