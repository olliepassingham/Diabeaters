import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { LineChart, Radio, Sparkles } from "lucide-react";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
import { OverlappingBarChart } from "@/components/patterns/overlapping-bar-chart";
import { WeeklyTrendChart } from "@/components/patterns/weekly-trend-chart";
import { GlucoseDayOverlayChart } from "@/components/patterns/glucose-day-overlay-chart";
import { PatternInsightCard } from "@/components/patterns/pattern-insight-card";
import { computePatternInsights } from "@/lib/insights/pattern-insights";
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
import {
  glucoseDayFiltersToOverlayOptions,
  readGlucoseDayFilters,
  writeGlucoseDayFilters,
  type GlucoseDayRange,
} from "@/lib/cgm/glucose-day-filters";
import { resolveUserTargetBgRange } from "@/lib/target-bg-range";
import { normalizeBgUnits } from "@/lib/alcohol-night-tool";

/** Below this many distinct local-calendar days, the overlay is too thin to show meaningful pattern shape. */
const MIN_DAYS_FOR_OVERLAY = 3;

const DAY_RANGE_OPTIONS: { days: GlucoseDayRange; label: string }[] = [
  { days: 3, label: "3 days" },
  { days: 7, label: "7 days" },
  { days: 14, label: "14 days" },
];

const DAY_KIND_OPTIONS: { id: GlucoseDayKind; label: string }[] = [
  { id: "all", label: "All days" },
  { id: "weekdays", label: "Weekdays" },
  { id: "weekends", label: "Weekends" },
];

/** Compact select trigger shared by the three glucose-pattern filters. */
const FILTER_TRIGGER_CLASS =
  "h-9 rounded-lg border-border/60 bg-background/70 px-2.5 text-xs font-medium shadow-none focus:ring-1";

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
  const [filters, setFilters] = useState(() => readGlucoseDayFilters());
  const { dayRange, timeWindowId, dayKind } = filters;
  const cgmConnected = isCgmPrefillActive();
  const timeWindow = glucoseTimeWindowById(timeWindowId);

  useEffect(() => {
    writeGlucoseDayFilters(filters);
  }, [filters]);

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
        ? buildGlucoseDayOverlay(
            getCgmLocalHistory(dayRange),
            units,
            glucoseDayFiltersToOverlayOptions(filters),
          )
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cgmConnected, units, refreshTick, filters],
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
        <div className="grid grid-cols-3 gap-1.5" data-testid="patterns-glucose-filters">
          <Select
            value={String(dayRange)}
            onValueChange={(v) => setFilters((prev) => ({ ...prev, dayRange: Number(v) as GlucoseDayRange }))}
          >
            <SelectTrigger className={FILTER_TRIGGER_CLASS} data-testid="filter-glucose-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAY_RANGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.days} value={String(opt.days)} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={timeWindowId}
            onValueChange={(v) => setFilters((prev) => ({ ...prev, timeWindowId: v as GlucoseTimeWindowId }))}
          >
            <SelectTrigger className={FILTER_TRIGGER_CLASS} data-testid="filter-glucose-time">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GLUCOSE_TIME_WINDOWS.map((opt) => (
                <SelectItem key={opt.id} value={opt.id} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={dayKind}
            onValueChange={(v) => setFilters((prev) => ({ ...prev, dayKind: v as GlucoseDayKind }))}
          >
            <SelectTrigger className={FILTER_TRIGGER_CLASS} data-testid="filter-glucose-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAY_KIND_OPTIONS.map((opt) => (
                <SelectItem key={opt.id} value={opt.id} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
  const weeklyTrendWeeks = 12;
  const weeklyTrend = useMemo(
    () => computeWeeklyTrend(hypoDates, exerciseDates, new Date(), weeklyTrendWeeks),
    [hypoDates, exerciseDates],
  );
  const hourlyTotal = useMemo(() => hourlyBuckets.reduce((sum, b) => sum + b.currentCount, 0), [hourlyBuckets]);
  const weekdayTotal = useMemo(() => weekdayBuckets.reduce((sum, b) => sum + b.currentCount, 0), [weekdayBuckets]);
  const weeklyTrendTotal = useMemo(() => weeklyTrend.reduce((sum, p) => sum + p.hypoCount, 0), [weeklyTrend]);

  const handleDismiss = (id: string) => {
    dismissPatternInsight(id);
    setDismissTick((t) => t + 1);
  };

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    const t = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(t);
  }, []);

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
            <section data-testid="card-patterns-insights" className="space-y-2.5">
              <div className="flex items-end justify-between gap-3 px-0.5">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    From your logs
                  </p>
                  <h2 className="mt-0.5 text-base font-semibold tracking-tight text-foreground">
                    What we've noticed
                  </h2>
                </div>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {visibleInsights.length} note{visibleInsights.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="space-y-2">
                {visibleInsights.map((insight) => (
                  <PatternInsightCard key={insight.id} insight={insight} onDismiss={handleDismiss} />
                ))}
              </div>
            </section>
          ) : null}

          <Card id="when-lows" data-testid="card-patterns-hourly">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">When lows happen</CardTitle>
                <span className="shrink-0 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {hourlyTotal} in last 30 days
                </span>
              </div>
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

          <Card id="which-days" data-testid="card-patterns-weekday">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Which days</CardTitle>
                <span className="shrink-0 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {weekdayTotal} in last 6 weeks
                </span>
              </div>
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
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Weekly trend</CardTitle>
                <span className="shrink-0 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {weeklyTrendTotal} in {weeklyTrendWeeks} weeks
                </span>
              </div>
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
