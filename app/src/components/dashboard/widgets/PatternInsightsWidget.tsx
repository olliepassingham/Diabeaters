import { useMemo } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { Link } from "wouter";
import { WidgetCard } from "./WidgetCard";
import type { DashboardWidgetLayoutProps } from "./types";
import { isCompactLayout } from "./types";
import { storage } from "@/lib/storage";
import { computePatternInsights } from "@/lib/insights/pattern-insights";
import { computeHourlyHypoComparison } from "@/lib/insights/pattern-charts";
import { listDismissedPatternInsightIds } from "@/lib/insights/insights-dismiss";
import { OverlappingBarChart } from "@/components/patterns/overlapping-bar-chart";

const MIN_HYPOS_FOR_CHART = 3;

/**
 * Home widget: leads with a small "when lows happen" chart (time-of-day, last
 * 30 days vs the 30 days before) instead of a wall of text, so patterns are
 * something you glance at rather than read. Full breakdown + dismissible
 * insight detail lives on the "Your patterns" page this links through to.
 */
export function PatternInsightsWidget(props: DashboardWidgetLayoutProps) {
  const compact = isCompactLayout(props);

  const hypos = useMemo(() => storage.getHypoTreatments(), []);
  const exerciseOutcomes = useMemo(() => storage.getExerciseOutcomes(), []);

  const hypoDates = useMemo(
    () => hypos.map((h) => new Date(h.timestamp)).filter((d) => !Number.isNaN(d.getTime())),
    [hypos],
  );

  const hourlyBuckets = useMemo(() => computeHourlyHypoComparison(hypoDates, new Date()), [hypoDates]);
  const hasChartData = hypos.length >= MIN_HYPOS_FOR_CHART;

  const topInsight = useMemo(() => {
    const dismissed = new Set(listDismissedPatternInsightIds());
    return computePatternInsights({ hypos, exerciseOutcomes }, 3).find((i) => !dismissed.has(i.id)) ?? null;
  }, [hypos, exerciseOutcomes]);

  if (!hasChartData && !topInsight) return null;

  return (
    <WidgetCard data-testid="widget-pattern-insights">
      <CardHeader className="p-4 pb-2 md:p-6 md:pb-3">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" />
            <CardTitle className="text-h3 text-foreground">Your patterns</CardTitle>
          </div>
          {hasChartData ? (
            <span className="shrink-0 text-xs text-muted-foreground">Lows by time of day</span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 md:px-6 md:pb-6 space-y-3">
        {hasChartData ? (
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
