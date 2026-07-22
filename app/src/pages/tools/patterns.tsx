import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, CheckCircle2, Info, LineChart, Radio, Sparkles, X } from "lucide-react";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { OverlappingBarChart } from "@/components/patterns/overlapping-bar-chart";
import { WeeklyTrendChart } from "@/components/patterns/weekly-trend-chart";
import { GlucoseDayOverlayChart } from "@/components/patterns/glucose-day-overlay-chart";
import { computePatternInsights, type PatternInsightTone } from "@/lib/insights/pattern-insights";
import {
  computeHourlyHypoComparison,
  computeWeekdayHypoComparison,
  computeWeeklyTrend,
} from "@/lib/insights/pattern-charts";
import { dismissPatternInsight, listDismissedPatternInsightIds } from "@/lib/insights/insights-dismiss";
import { storage } from "@/lib/storage";
import { isCgmPrefillActive } from "@/lib/cgm/preferences";
import { fetchLiveCgmHistory } from "@/lib/cgm/live-cgm-history";
import { countCgmLocalHistoryDays, getCgmLocalHistory } from "@/lib/cgm/cgm-history-store";
import { buildGlucoseDayOverlay } from "@/lib/cgm/glucose-day-overlay";
import { resolveUserTargetBgRange } from "@/lib/target-bg-range";
import { normalizeBgUnits } from "@/lib/alcohol-night-tool";

const TONE_ICONS: Record<PatternInsightTone, React.ReactNode> = {
  attention: <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400" />,
  positive: <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />,
  neutral: <Info className="h-4 w-4 text-muted-foreground" />,
};

/** Below this many distinct local-calendar days, the overlay is too thin to show meaningful pattern shape. */
const MIN_DAYS_FOR_OVERLAY = 3;

function GlucoseDayPatternCard() {
  const [refreshTick, setRefreshTick] = useState(0);
  const cgmConnected = isCgmPrefillActive();

  // Kick off an immediate ~24h backfill (Dexcom Share / LibreLinkUp only — the
  // only sources with a bulk-history API) so a first-ever visit isn't empty.
  useEffect(() => {
    if (!cgmConnected) return;
    let cancelled = false;
    void fetchLiveCgmHistory({ minutes: 1440, maxCount: 288 })
      .then(() => {
        if (!cancelled) setRefreshTick((t) => t + 1);
      })
      .catch(() => {
        // Best-effort — the page still works from whatever local history already exists.
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
  const series = useMemo(
    () => (cgmConnected ? buildGlucoseDayOverlay(getCgmLocalHistory(7), units, { days: 7 }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cgmConnected, units, refreshTick],
  );

  if (!cgmConnected) {
    return (
      <Card data-testid="card-patterns-glucose-overlay-disconnected">
        <CardContent className="flex items-start gap-3 p-4">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Radio className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-sm font-medium text-foreground">See your daily glucose pattern</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Connect a CGM to see each recent day's glucose overlaid on one chart — a great way to spot a recurring
              spike or dip at a similar time each day.
            </p>
            <Link
              href="/settings/cgm"
              className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
              data-testid="link-patterns-connect-cgm"
            >
              Connect a CGM
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-patterns-glucose-overlay">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Daily glucose pattern</CardTitle>
        <CardDescription className="text-xs leading-snug">
          Each of the last {Math.min(dayCount, 7)} day{Math.min(dayCount, 7) === 1 ? "" : "s"}, overlaid by time of
          day. Today is solid; earlier days fade — a recurring shape most days is worth mentioning to your care team.
          Mealtime shading is a general guide, not your logged meals.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {dayCount < MIN_DAYS_FOR_OVERLAY ? (
          <div className="space-y-3">
            {dayCount > 0 ? (
              <GlucoseDayOverlayChart
                series={series}
                units={units}
                targetRange={targetRange}
                data-testid="chart-patterns-glucose-overlay"
              />
            ) : null}
            <p className="text-xs leading-relaxed text-muted-foreground" data-testid="text-glucose-overlay-building">
              Still building your pattern — {dayCount === 0 ? "no days yet" : `${dayCount} day${dayCount === 1 ? "" : "s"} so far`}.
              Multi-day glucose history isn't available from your CGM in one go, so this fills in gradually as you use
              the app. Check back in a few days for the full picture.
            </p>
          </div>
        ) : (
          <GlucoseDayOverlayChart
            series={series}
            units={units}
            targetRange={targetRange}
            data-testid="chart-patterns-glucose-overlay"
          />
        )}
      </CardContent>
    </Card>
  );
}

export default function PatternsPage() {
  const [dismissTick, setDismissTick] = useState(0);

  const hypos = useMemo(() => storage.getHypoTreatments(), []);
  const exerciseOutcomes = useMemo(() => storage.getExerciseOutcomes(), []);
  const hypoDates = useMemo(
    () => hypos.map((h) => new Date(h.timestamp)).filter((d) => !Number.isNaN(d.getTime())),
    [hypos],
  );
  const exerciseDates = useMemo(
    () => exerciseOutcomes.map((e) => new Date(e.completedAt)).filter((d) => !Number.isNaN(d.getTime())),
    [exerciseOutcomes],
  );

  const insights = useMemo(
    () => computePatternInsights({ hypos, exerciseOutcomes }, 10),
    [hypos, exerciseOutcomes],
  );
  const visibleInsights = useMemo(() => {
    const dismissed = new Set(listDismissedPatternInsightIds());
    return insights.filter((i) => !dismissed.has(i.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insights, dismissTick]);

  const hourlyBuckets = useMemo(() => computeHourlyHypoComparison(hypoDates, new Date()), [hypoDates]);
  const weekdayBuckets = useMemo(() => computeWeekdayHypoComparison(hypoDates, new Date()), [hypoDates]);
  const weeklyTrend = useMemo(
    () => computeWeeklyTrend(hypoDates, exerciseDates, new Date(), 12),
    [hypoDates, exerciseDates],
  );

  const handleDismiss = (id: string) => {
    dismissPatternInsight(id);
    setDismissTick((t) => t + 1);
  };

  const hasEnoughData = hypos.length >= 3;

  return (
    <PageShell variant="standard" className="mx-auto max-w-lg space-y-5" data-testid="page-patterns">
      <PageHeader
        leading={<PageBackButton />}
        title={
          <span className="inline-flex items-center gap-2">
            <LineChart className="h-6 w-6 shrink-0 text-primary" aria-hidden />
            Your patterns
          </span>
        }
      />
      <p className="text-sm leading-snug text-muted-foreground">
        Insights and charts from your logged hypos and exercise sessions on this device — educational only, not
        medical advice.
      </p>

      <GlucoseDayPatternCard />

      {!hasEnoughData ? (
        <EmptyState
          icon={Sparkles}
          title="Not enough data yet"
          description="Log a few hypo treatments from the home dashboard and this page will start finding patterns in when and how often they happen."
        />
      ) : (
        <>
          {visibleInsights.length > 0 ? (
            <Card data-testid="card-patterns-insights">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                  <CardTitle className="text-base">What we've noticed</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {visibleInsights.map((insight) => (
                  <div
                    key={insight.id}
                    data-testid="pattern-insight-row"
                    className="flex items-start gap-2.5 rounded-lg bg-muted/25 px-3 py-2.5"
                  >
                    <span className="mt-0.5 shrink-0" aria-hidden="true">
                      {TONE_ICONS[insight.tone]}
                    </span>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-sm font-medium text-foreground">{insight.title}</p>
                      <p className="text-sm leading-relaxed text-foreground">{insight.body}</p>
                      {insight.actionLabel && insight.actionHref ? (
                        <Link
                          href={insight.actionHref}
                          className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                        >
                          {insight.actionLabel}
                        </Link>
                      ) : null}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 -mr-1"
                      aria-label="Dismiss insight"
                      onClick={() => handleDismiss(insight.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card data-testid="card-patterns-hourly">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">When lows happen</CardTitle>
              <CardDescription className="text-xs leading-snug">
                Time of day, last 30 days vs the 30 days before that. A recurring bar in the same window most weeks
                is worth mentioning to your care team.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OverlappingBarChart
                buckets={hourlyBuckets}
                currentLabel="Last 30 days"
                previousLabel="Previous 30 days"
                labelEvery={2}
                data-testid="chart-patterns-hourly"
              />
            </CardContent>
          </Card>

          <Card data-testid="card-patterns-weekday">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Which days</CardTitle>
              <CardDescription className="text-xs leading-snug">
                Day of week, last 6 weeks vs the 6 weeks before that.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OverlappingBarChart
                buckets={weekdayBuckets}
                currentLabel="Last 6 weeks"
                previousLabel="Previous 6 weeks"
                data-testid="chart-patterns-weekday"
              />
            </CardContent>
          </Card>

          <Card data-testid="card-patterns-weekly-trend">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Weekly trend</CardTitle>
              <CardDescription className="text-xs leading-snug">
                Lows per week over the last 12 weeks, with exercise sessions shaded behind — useful for spotting
                whether more activity lines up with more lows.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WeeklyTrendChart points={weeklyTrend} data-testid="chart-patterns-weekly-trend" />
            </CardContent>
          </Card>
        </>
      )}

      <p className="text-center text-xs text-muted-foreground pb-4">
        Patterns from your own logs on this device — educational only, not medical advice. Bring anything that
        surprises you to your diabetes team.
      </p>
    </PageShell>
  );
}
