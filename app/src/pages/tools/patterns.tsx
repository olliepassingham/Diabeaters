import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, CheckCircle2, Info, LineChart, Radio, Sparkles, X } from "lucide-react";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
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
import {
  buildGlucoseDayOverlay,
  glucoseTimeWindowById,
  GLUCOSE_TIME_WINDOWS,
  type GlucoseDayKind,
  type GlucoseTimeWindowId,
} from "@/lib/cgm/glucose-day-overlay";
import { resolveUserTargetBgRange } from "@/lib/target-bg-range";
import { normalizeBgUnits } from "@/lib/alcohol-night-tool";
import { cn } from "@/lib/utils";

const TONE_ICONS: Record<PatternInsightTone, React.ReactNode> = {
  attention: <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400" />,
  positive: <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />,
  neutral: <Info className="h-4 w-4 text-muted-foreground" />,
};

/** Below this many distinct local-calendar days, the overlay is too thin to show meaningful pattern shape. */
const MIN_DAYS_FOR_OVERLAY = 3;

const DAY_RANGE_OPTIONS = [
  { days: 3, label: "3d" },
  { days: 7, label: "7d" },
  { days: 14, label: "14d" },
] as const;

const DAY_KIND_OPTIONS: { id: GlucoseDayKind; label: string }[] = [
  { id: "all", label: "All days" },
  { id: "weekdays", label: "Weekdays" },
  { id: "weekends", label: "Weekends" },
];

function FilterPill({
  selected,
  onClick,
  children,
  testId,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={selected ? "default" : "outline"}
      className={cn("h-8 rounded-full px-3 text-xs font-medium shadow-none", !selected && "bg-background/60")}
      onClick={onClick}
      aria-pressed={selected}
      data-testid={testId}
    >
      {children}
    </Button>
  );
}

function PatternsInfoDialog() {
  return (
    <PageInfoDialog
      title="About Your patterns"
      description="Charts from glucose and logs on this device — educational only, not medical advice."
    >
      <InfoSection title="Daily glucose pattern">
        <p>
          Each recent day is drawn on the same time-of-day axis so recurring spikes or dips stand out. Today is solid;
          earlier days fade. Use the day range, time-of-day, and weekday filters to zoom into the hours that matter.
        </p>
      </InfoSection>
      <InfoSection title="Hypo charts">
        <p>
          When lows happen, which days, and weekly trend come from hypo treatments and exercise sessions you have logged
          in the app on this phone.
        </p>
      </InfoSection>
      <InfoSection title="Care team">
        <p>
          Patterns are a conversation starter with your diabetes team — not a diagnosis or dosing instruction.
        </p>
      </InfoSection>
    </PageInfoDialog>
  );
}

function GlucoseDayPatternCard() {
  const [refreshTick, setRefreshTick] = useState(0);
  const [dayRange, setDayRange] = useState<3 | 7 | 14>(7);
  const [timeWindowId, setTimeWindowId] = useState<GlucoseTimeWindowId>("all");
  const [dayKind, setDayKind] = useState<GlucoseDayKind>("all");
  const cgmConnected = isCgmPrefillActive();
  const timeWindow = glucoseTimeWindowById(timeWindowId);

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
    () => (cgmConnected ? countCgmLocalHistoryDays(dayRange) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cgmConnected, refreshTick, dayRange],
  );
  const series = useMemo(
    () =>
      cgmConnected
        ? buildGlucoseDayOverlay(getCgmLocalHistory(dayRange), units, {
            days: dayRange,
            minuteStart: timeWindow.minuteStart,
            minuteEnd: timeWindow.minuteEnd,
            dayKind,
          })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cgmConnected, units, refreshTick, dayRange, timeWindow.minuteStart, timeWindow.minuteEnd, dayKind],
  );

  if (!cgmConnected) {
    return (
      <Card data-testid="card-patterns-glucose-overlay-disconnected">
        <CardContent className="flex items-start gap-3 p-4">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Radio className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-sm font-medium text-foreground">Daily glucose pattern</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Connect a CGM to overlay recent days and spot recurring spikes or dips.
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
      <CardHeader className="space-y-3 pb-2">
        <CardTitle className="text-base">Daily glucose</CardTitle>
        <div className="space-y-2" data-testid="patterns-glucose-filters">
          <div className="flex flex-wrap gap-1.5">
            {DAY_RANGE_OPTIONS.map((opt) => (
              <FilterPill
                key={opt.days}
                selected={dayRange === opt.days}
                onClick={() => setDayRange(opt.days)}
                testId={`filter-glucose-days-${opt.days}`}
              >
                {opt.label}
              </FilterPill>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {GLUCOSE_TIME_WINDOWS.map((opt) => (
              <FilterPill
                key={opt.id}
                selected={timeWindowId === opt.id}
                onClick={() => setTimeWindowId(opt.id)}
                testId={`filter-glucose-time-${opt.id}`}
              >
                {opt.label}
              </FilterPill>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DAY_KIND_OPTIONS.map((opt) => (
              <FilterPill
                key={opt.id}
                selected={dayKind === opt.id}
                onClick={() => setDayKind(opt.id)}
                testId={`filter-glucose-kind-${opt.id}`}
              >
                {opt.label}
              </FilterPill>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {dayCount < MIN_DAYS_FOR_OVERLAY ? (
          <div className="space-y-3">
            {series.length > 0 ? (
              <GlucoseDayOverlayChart
                series={series}
                units={units}
                targetRange={targetRange}
                minuteStart={timeWindow.minuteStart}
                minuteEnd={timeWindow.minuteEnd}
                data-testid="chart-patterns-glucose-overlay"
              />
            ) : null}
            <p className="text-xs leading-relaxed text-muted-foreground" data-testid="text-glucose-overlay-building">
              Still building — {dayCount === 0 ? "no days yet" : `${dayCount} day${dayCount === 1 ? "" : "s"} so far`}.
              Check back as more readings accumulate on this device.
            </p>
          </div>
        ) : series.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="text-glucose-overlay-empty-filter">
            No readings in this window. Try a wider day range or time of day.
          </p>
        ) : (
          <GlucoseDayOverlayChart
            series={series}
            units={units}
            targetRange={targetRange}
            minuteStart={timeWindow.minuteStart}
            minuteEnd={timeWindow.minuteEnd}
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
        actions={<PatternsInfoDialog />}
      />

      <GlucoseDayPatternCard />

      {!hasEnoughData ? (
        <EmptyState
          icon={Sparkles}
          title="Not enough data yet"
          description="Log a few hypo treatments and this page will start finding patterns in when they happen."
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
            </CardHeader>
            <CardContent>
              <WeeklyTrendChart points={weeklyTrend} data-testid="chart-patterns-weekly-trend" />
            </CardContent>
          </Card>
        </>
      )}
    </PageShell>
  );
}
