import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  ArrowRight,
  Calendar,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Moon,
  ChevronRight,
} from "lucide-react";
import { Link } from "wouter";
import {
  DIABEATER_ACTIVE_USER_CHANGED_EVENT,
  DIABEATER_SCENARIO_STATE_CHANGED_EVENT,
  storage,
  type HolidayPrep,
  type Supply,
  type ScenarioState,
} from "@/lib/storage";
import {
  getTodayGlanceLine,
  shouldOmitHeroGlanceLineDuplicatingTodayCard,
  shouldOmitTodayCardGlanceBanner,
  type HealthStatus,
} from "@/lib/dashboard-health-status";
import { collectAllActivityEvents, getActivityWeekSummary } from "@/lib/activity-history";
import { computeStreakStats } from "@/lib/activity-streaks";
import { prefetchToolsDestinationHref } from "@/lib/tools-route-prefetch";
import { tripStyleLabel } from "@/lib/travel-active-guidance";
import { cn } from "@/lib/utils";

/**
 * Today's "at a glance" surface: one soft card holding the supply status row (when nothing needs
 * attention) alongside the activity/streak summary, instead of two separately bordered boxes.
 */
export function SupplyTrackerTodaySection({ healthStatus }: { healthStatus: HealthStatus }) {
  const [supplies, setSupplies] = useState<Supply[]>(() => storage.getSupplies());
  const [scenarioState, setScenarioState] = useState<ScenarioState>(() => storage.getScenarioState());

  useEffect(() => {
    const refresh = () => {
      setSupplies(storage.getSupplies());
      setScenarioState(storage.getScenarioState());
    };
    refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", refresh);
    window.addEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, refresh);
    window.addEventListener(DIABEATER_SCENARIO_STATE_CHANGED_EVENT, refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, refresh);
      window.removeEventListener(DIABEATER_SCENARIO_STATE_CHANGED_EVENT, refresh);
    };
  }, []);

  const suppliesNeedingAttentionCount = useMemo(
    () =>
      supplies.filter((s) => {
        const st = storage.getSupplyStatus(s);
        return st === "critical" || st === "low";
      }).length,
    [supplies],
  );
  const hideSupplyShortcutCard = suppliesNeedingAttentionCount > 0;

  return (
    <section className="animate-fade-in-up" style={{ animationDelay: "80ms" }}>
      <Card
        variant="glass"
        className="dashboard-card-hover overflow-hidden rounded-2xl"
        data-testid="dashboard-today-overview-card"
      >
        <div
          className={cn(
            "grid grid-cols-1",
            !hideSupplyShortcutCard && "divide-y divide-border/50 sm:grid-cols-2 sm:divide-x sm:divide-y-0",
          )}
        >
          {!hideSupplyShortcutCard ? (
            <SupplyStatusContent supplies={supplies} scenarioState={scenarioState} />
          ) : null}
          <TodayAtAGlanceContent supplyShortcutHidden={hideSupplyShortcutCard} healthStatus={healthStatus} />
        </div>
      </Card>
    </section>
  );
}

/** Presentational supply status row — shared by the standalone entry card and the merged Today card. */
function SupplyStatusContent({
  supplies,
  scenarioState,
}: {
  supplies: Supply[];
  scenarioState: ScenarioState;
}) {
  let worst: "critical" | "low" | "ok" = "ok";
  let minDays: number | null = null;
  if (supplies.length > 0) {
    for (const s of supplies) {
      const d = storage.getDaysRemaining(s);
      if (d >= 999) continue;
      const st = storage.getSupplyStatus(s);
      if (st === "critical") worst = "critical";
      else if (st === "low" && worst === "ok") worst = "low";
      if (minDays === null || d < minDays) minDays = d;
    }
  }

  const statusLabel =
    supplies.length === 0
      ? "No supplies yet"
      : worst === "critical"
        ? "Low stock — reorder soon"
        : worst === "low"
          ? "Some items running low"
          : "Stock OK";

  const daysLine =
    supplies.length === 0
      ? "Tap to open Supply Tracker and add your stock."
      : minDays !== null
        ? `${minDays} day${minDays === 1 ? "" : "s"} until shortest run-out (estimate)`
        : "Open tracker for detailed days remaining";

  const scenarioLine = (() => {
    if (scenarioState.travelModeActive && scenarioState.sickDayActive) return "Travel and sick day guides active";
    if (scenarioState.travelModeActive) return "Travel guide active";
    if (scenarioState.sickDayActive) return "Sick day guide active";
    return null;
  })();

  const toneTint =
    supplies.length === 0
      ? ""
      : worst === "critical"
        ? "bg-red-500/[0.05] dark:bg-red-950/20"
        : worst === "low"
          ? "bg-amber-500/[0.05] dark:bg-amber-950/15"
          : "";

  return (
    <Link href="/supplies" className="block" data-testid="dashboard-supply-tracker-card">
      <div
        className={cn(
          "dashboard-card-hover flex items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/25 dark:hover:bg-muted/10",
          toneTint,
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
            <Package className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="font-semibold text-foreground">{statusLabel}</p>
            <p className="text-sm text-muted-foreground">{daysLine}</p>
            {scenarioLine ? <p className="text-xs text-muted-foreground">{scenarioLine}</p> : null}
          </div>
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
      </div>
    </Link>
  );
}

/** Standalone version of the supply status row, kept for any other place that wants it on its own. */
export function SupplyTrackerEntryCard() {
  const [supplies, setSupplies] = useState<Supply[]>(() => storage.getSupplies());
  const [scenarioState, setScenarioState] = useState<ScenarioState>(() => storage.getScenarioState());

  useEffect(() => {
    const refresh = () => {
      setSupplies(storage.getSupplies());
      setScenarioState(storage.getScenarioState());
    };
    refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", refresh);
    window.addEventListener(DIABEATER_SCENARIO_STATE_CHANGED_EVENT, refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(DIABEATER_SCENARIO_STATE_CHANGED_EVENT, refresh);
    };
  }, []);

  return (
    <Card
      variant="glass"
      className="dashboard-card-hover overflow-hidden rounded-2xl"
      data-testid="dashboard-supply-entry-card"
    >
      <SupplyStatusContent supplies={supplies} scenarioState={scenarioState} />
    </Card>
  );
}

function TodayAtAGlanceContent(props: { supplyShortcutHidden?: boolean; healthStatus: HealthStatus }) {
  const supplyShortcutHidden = props.supplyShortcutHidden === true;
  const { healthStatus } = props;
  const [supplies, setSupplies] = useState<Supply[]>(() => storage.getSupplies());
  const [scenarioState, setScenarioState] = useState<ScenarioState>(() => storage.getScenarioState());
  const [activityTick, setActivityTick] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setSupplies(storage.getSupplies());
      setScenarioState(storage.getScenarioState());
      setActivityTick((t) => t + 1);
    };
    refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", refresh);
    window.addEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, refresh);
    window.addEventListener(DIABEATER_SCENARIO_STATE_CHANGED_EVENT, refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, refresh);
      window.removeEventListener(DIABEATER_SCENARIO_STATE_CHANGED_EVENT, refresh);
    };
  }, []);

  const suppliesNeedingAttention = useMemo(
    () =>
      supplies
        .filter((s) => {
          const st = storage.getSupplyStatus(s);
          return st === "critical" || st === "low";
        })
        .sort((a, b) => {
          const o = (x: Supply) => (storage.getSupplyStatus(x) === "critical" ? 0 : 1);
          return o(a) - o(b);
        }),
    [supplies],
  );
  const hour = new Date().getHours();
  const isEvening = hour >= 19 || hour < 6;

  const parseISODateOnly = (dateStr: string | undefined): Date | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const daysUntil = (dateStr: string | undefined): number | null => {
    const d = parseISODateOnly(dateStr);
    if (!d) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const status = useMemo(() => getTodayGlanceLine(supplies, scenarioState), [supplies, scenarioState]);

  const activityWeek = useMemo(
    () => getActivityWeekSummary(collectAllActivityEvents()),
    [activityTick],
  );

  const habitStreaks = useMemo(() => {
    const events = collectAllActivityEvents();
    return {
      bedtime: computeStreakStats(events, "bedtime_check"),
      exercise: computeStreakStats(events, "exercise_session"),
      showingUp: computeStreakStats(events, "app_check_in"),
    };
  }, [activityTick]);

  const showSupplyAttentionRows = suppliesNeedingAttention.length > 0;
  const omitDuplicateStockBanner =
    showSupplyAttentionRows &&
    (status.message === "Critical supplies need attention" || status.message === "Some supplies are running low");

  const worstSupplyAttention = useMemo(() => {
    if (!suppliesNeedingAttention.length) return null as null | "critical" | "low";
    return suppliesNeedingAttention.some((s) => storage.getSupplyStatus(s) === "critical") ? "critical" : "low";
  }, [suppliesNeedingAttention]);

  const holidayPrep: HolidayPrep | null = storage.getHolidayPrep?.() ?? null;
  const departDays = holidayPrep ? daysUntil(holidayPrep.departureDate) : null;
  const showTripCountdown = holidayPrep && departDays !== null && departDays >= 0 && departDays <= 7;
  const showTravelCard = Boolean(showTripCountdown) || scenarioState.travelModeActive;
  const travelPlan: unknown = storage.getTravelPlan?.() ?? null;
  const travelType =
    travelPlan &&
    typeof travelPlan === "object" &&
    "travelType" in travelPlan &&
    (travelPlan as { travelType?: unknown }).travelType &&
    (((travelPlan as { travelType?: unknown }).travelType as string) === "domestic" ||
      ((travelPlan as { travelType?: unknown }).travelType as string) === "international")
      ? ((travelPlan as { travelType?: unknown }).travelType as "domestic" | "international")
      : null;
  const travelDestination =
    holidayPrep?.destination?.trim() ||
    scenarioState.travelDestination?.trim() ||
    (travelPlan &&
    typeof travelPlan === "object" &&
    "destination" in travelPlan &&
    typeof (travelPlan as { destination?: unknown }).destination === "string"
      ? (travelPlan as { destination: string }).destination.trim()
      : "") ||
    "Trip";
  const travelSubtitleParts: string[] = [];
  if (showTripCountdown && departDays !== null) {
    travelSubtitleParts.push(departDays === 0 ? "Departs today" : `Departs in ${departDays}d`);
  }
  if (scenarioState.travelModeActive) {
    travelSubtitleParts.push(
      scenarioState.travelEndDate
        ? `Active until ${new Date(scenarioState.travelEndDate).toLocaleDateString("en-GB")}`
        : "Travel mode active",
    );
  }
  const tripStyleShort = tripStyleLabel(scenarioState.travelTripStyle);
  if (tripStyleShort) travelSubtitleParts.push(tripStyleShort);
  const travelSubtitle = travelSubtitleParts.join(" · ");
  const omitTravelStatusBanner =
    showTravelCard && shouldOmitHeroGlanceLineDuplicatingTodayCard(status, supplies, scenarioState);

  const omitHeroAlignedGlanceBanner = shouldOmitTodayCardGlanceBanner(
    status,
    supplies,
    scenarioState,
    healthStatus,
  );

  const hideVisibleGlanceBanner =
    omitDuplicateStockBanner || omitTravelStatusBanner || omitHeroAlignedGlanceBanner;

  const supplyBlock = (
    <div
      className={
        worstSupplyAttention === "critical"
          ? "rounded-lg bg-red-500/[0.07] px-2 py-1.5 dark:bg-red-950/25"
          : worstSupplyAttention === "low"
            ? "rounded-lg bg-amber-500/[0.08] px-2 py-1.5 dark:bg-amber-950/20"
            : "rounded-lg bg-muted/25 px-2 py-1.5 dark:bg-muted/15"
      }
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Supplies</p>
        {supplyShortcutHidden ? (
          <Link
            href="/supplies"
            className="text-[11px] font-medium text-primary underline-offset-2 hover:underline"
            data-testid="link-today-open-supplies"
          >
            Open tracker
          </Link>
        ) : null}
      </div>
      <ul className="space-y-1">
        {suppliesNeedingAttention.slice(0, 4).map((supply) => {
          const st = storage.getSupplyStatus(supply);
          return (
            <li key={supply.id} className="flex min-h-9 items-center justify-between gap-2 text-sm leading-tight">
              <span className="min-w-0 truncate text-foreground/90">{supply.name}</span>
              <Badge variant={st === "critical" ? "destructive" : "secondary"} className="shrink-0 text-[11px] tabular-nums">
                {storage.getDaysRemaining(supply)}d left
              </Badge>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <div className="space-y-0 px-4 py-3.5" data-testid="dashboard-today-inline">
      <Link
        href="/tools/activity"
        className="group -mx-1 mb-2 flex items-center justify-between gap-2 rounded-lg border-b border-border/50 px-1 pb-2 outline-none ring-offset-background transition-colors hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:hover:bg-muted/20"
        data-testid="link-today-activity-calendar"
        aria-label={
          activityWeek.countLast7Days === 0
            ? "Open activity calendar"
            : `Open activity calendar, ${activityWeek.countLast7Days} entries this week`
        }
        onPointerEnter={() => prefetchToolsDestinationHref("/tools/activity")}
        onFocus={() => prefetchToolsDestinationHref("/tools/activity")}
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary transition-colors group-hover:bg-primary/25">
            <Calendar className="h-3.5 w-3.5" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-0.5">
              <span className="text-sm font-semibold tracking-tight text-foreground">Today</span>
              <ChevronRight
                className="h-3.5 w-3.5 shrink-0 text-primary opacity-90 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </div>
            <p className="text-[11px] leading-tight text-muted-foreground transition-colors group-hover:text-foreground/75">
              {habitStreaks.bedtime.current > 0 || habitStreaks.exercise.current > 0 ? (
                <>
                  Bedtime {habitStreaks.bedtime.current}d · Exercise {habitStreaks.exercise.current}d
                </>
              ) : habitStreaks.showingUp.current >= 2 ? (
                <>Showing up · {habitStreaks.showingUp.current} days</>
              ) : activityWeek.countLast7Days === 0 ? (
                "Activity calendar"
              ) : (
                `${activityWeek.countLast7Days} ${activityWeek.countLast7Days === 1 ? "entry" : "entries"} this week`
              )}
            </p>
          </div>
        </div>
        <span className="max-w-[46%] shrink-0 truncate text-xs font-medium tabular-nums text-muted-foreground">
          {new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
        </span>
      </Link>

      <div className="flex flex-col gap-2">
        {hideVisibleGlanceBanner ? (
          <span className="sr-only" data-testid="text-today-status">
            {status.message}
          </span>
        ) : (
          <div
            className={`flex items-start gap-2 rounded-md px-2 py-1.5 ${
              status.type === "warning"
                ? "bg-red-500/10 dark:bg-red-950/20"
                : status.type === "info"
                  ? "bg-amber-500/12 dark:bg-amber-950/25"
                  : "bg-green-500/10 dark:bg-green-950/25"
            }`}
          >
            {status.type === "warning" ? (
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" aria-hidden />
            ) : status.type === "info" ? (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-500" aria-hidden />
            ) : (
              <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-500" aria-hidden />
            )}
            <span className="min-w-0 text-sm leading-snug text-foreground" data-testid="text-today-status">
              {status.message}
            </span>
          </div>
        )}

        {showTravelCard ? (
          <div data-testid="dashboard-today-extras">
            <Link href="/scenarios/travel" className="block">
              <div
                className="cursor-pointer rounded-lg bg-muted/25 px-2.5 py-2 transition-colors hover:bg-muted/40 dark:bg-muted/15 dark:hover:bg-muted/25"
                data-testid="dashboard-today-trip-countdown"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Travel</p>
                <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                  {travelDestination}
                  {travelType ? ` (${travelType})` : ""}
                </p>
                {travelSubtitle ? (
                  <p className="mt-0.5 text-xs text-muted-foreground" data-testid="text-travel-card-subtitle">
                    {travelSubtitle}
                  </p>
                ) : null}
              </div>
            </Link>
          </div>
        ) : null}

        {scenarioState.sickDayActive ? (
          <div className="rounded-lg bg-orange-50/90 px-2.5 py-2 text-sm leading-snug text-orange-900 dark:bg-orange-950/40 dark:text-orange-100">
            Sick day — {scenarioState.sickDaySeverity || "moderate"} severity
          </div>
        ) : null}

        {showSupplyAttentionRows ? (
          supplyShortcutHidden ? (
            <Link href="/supplies" className="block rounded-lg no-underline outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              {supplyBlock}
            </Link>
          ) : (
            supplyBlock
          )
        ) : null}

        {isEvening ? (
          <Link href="/scenarios/bedtime" className="block pt-0.5">
            <div
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-transparent bg-indigo-50/90 px-2.5 py-2 text-sm leading-snug text-indigo-900 transition-colors hover:border-indigo-200/80 hover:bg-indigo-100/90 dark:border-indigo-900/30 dark:bg-indigo-950/35 dark:text-indigo-100 dark:hover:bg-indigo-950/50"
              data-testid="card-evening-bedtime"
            >
              <Moon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 font-medium">Bedtime check</span>
              <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            </div>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/** Standalone version of the Today card, kept for any other place that wants it on its own. */
export function TodayAtAGlanceCard(props: { supplyShortcutHidden?: boolean; healthStatus: HealthStatus }) {
  return (
    <Card
      variant="glass"
      className="dashboard-card-hover overflow-hidden rounded-2xl"
      data-testid="dashboard-today-card"
    >
      <TodayAtAGlanceContent {...props} />
    </Card>
  );
}
