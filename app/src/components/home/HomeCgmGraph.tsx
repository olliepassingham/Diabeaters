import { useEffect, useMemo, useState } from "react";
import { Activity, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { CgmGlucoseChart } from "@/components/cgm-glucose-chart";
import { Button } from "@/components/ui/button";
import type { CgmChartPoint } from "@/lib/cgm/cgm-chart";
import { getCgmLocalHistory } from "@/lib/cgm/cgm-history-store";
import { convertGlucoseValue } from "@/lib/cgm/units";
import type { BgUnits } from "@/lib/cgm/types";
import { resolveUserTargetBgRange } from "@/lib/target-bg-range";
import { storage, DIABEATER_PROFILE_CHANGED_EVENT, DIABEATER_SETTINGS_CHANGED_EVENT } from "@/lib/storage";
import { isPenDeliveryMethod } from "@/lib/insulin-delivery-method";
import {
  buildHomeInsulinChart,
  INSULIN_ACTIVITY_CHANGED_EVENT,
  usualLongActingUnits,
} from "@/lib/insulin-activity";
import { InsulinChartControls } from "@/components/home/InsulinChartControls";
import { useCgmHistory } from "@/hooks/use-cgm-history";
import {
  getMealTimelineEvents,
  MEAL_TIMELINE_CHANGED_EVENT,
  type MealTimelineEvent,
} from "@/lib/meal-timeline-events";

function localPoints(units: BgUnits): CgmChartPoint[] {
  return getCgmLocalHistory(0.5).map((point) => ({
    recordedAt: new Date(point.recordedAtMs).toISOString(),
    timeMs: point.recordedAtMs,
    timeLabel: new Date(point.recordedAtMs).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }),
    value:
      units === "mmol/L"
        ? convertGlucoseValue(point.valueMgDl, "mg/dL", "mmol/L")
        : Math.round(point.valueMgDl),
    valueMgDl: point.valueMgDl,
    trend: null,
  }));
}

export function HomeCgmGraph() {
  const history = useCgmHistory("12h");
  const [mealEvents, setMealEvents] = useState<MealTimelineEvent[]>(() =>
    getMealTimelineEvents(Date.now() - 12 * 60 * 60 * 1000),
  );
  const [insulinTick, setInsulinTick] = useState(0);
  const [penUser, setPenUser] = useState(() => isPenDeliveryMethod(storage.getProfile()?.insulinDeliveryMethod));
  const { units, connected, loading, refresh } = history;
  const savedPoints = useMemo(() => localPoints(units), [units]);
  const points = history.points.length ? history.points : savedPoints;
  const target = useMemo(() => resolveUserTargetBgRange(storage.getSettings(), units), [units]);
  const insulin = useMemo(() => {
    const settings = storage.getSettings();
    const times =
      (settings.longActingInjectionsPerDay ?? 0) >= 2
        ? [settings.basalInjectionTime, settings.basalInjectionTime2]
        : [settings.basalInjectionTime];
    return buildHomeInsulinChart(Date.now(), times);
    // insulinTick refreshes after a dose is saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insulinTick]);

  const timelineEvents = useMemo(
    () =>
      mealEvents.map((event) => ({
        id: event.id,
        timeMs: new Date(event.occurredAt).getTime(),
        label: event.status === "confirmed" ? "Meal" : "Meal planned",
        detail: `${event.mealType.charAt(0).toUpperCase()}${event.mealType.slice(1)} · ${event.carbsGrams}g`,
        status: event.status,
      })),
    [mealEvents],
  );

  useEffect(() => {
    const refreshMealEvents = () => {
      setMealEvents(getMealTimelineEvents(Date.now() - 12 * 60 * 60 * 1000));
    };
    window.addEventListener(MEAL_TIMELINE_CHANGED_EVENT, refreshMealEvents);
    window.addEventListener("focus", refreshMealEvents);
    const refreshInsulin = () => {
      setPenUser(isPenDeliveryMethod(storage.getProfile()?.insulinDeliveryMethod));
      setInsulinTick((tick) => tick + 1);
    };
    window.addEventListener(INSULIN_ACTIVITY_CHANGED_EVENT, refreshInsulin);
    window.addEventListener(DIABEATER_PROFILE_CHANGED_EVENT, refreshInsulin);
    window.addEventListener(DIABEATER_SETTINGS_CHANGED_EVENT, refreshInsulin);
    return () => {
      window.removeEventListener(MEAL_TIMELINE_CHANGED_EVENT, refreshMealEvents);
      window.removeEventListener("focus", refreshMealEvents);
      window.removeEventListener(INSULIN_ACTIVITY_CHANGED_EVENT, refreshInsulin);
      window.removeEventListener(DIABEATER_PROFILE_CHANGED_EVENT, refreshInsulin);
      window.removeEventListener(DIABEATER_SETTINGS_CHANGED_EVENT, refreshInsulin);
    };
  }, []);

  const showChart = points.length > 1 || Boolean(penUser && insulin.visible && insulin.xDomain);

  return (
    <section
      className="relative pb-1 pt-2"
      data-testid="home-cgm-graph"
      aria-label={showChart ? "Glucose, last 12 hours" : "Glucose"}
    >
      {showChart ? (
        <div className="relative -mx-6 w-[calc(100%+3rem)] md:-mx-8 md:w-[calc(100%+4rem)]">
          <div className="absolute right-1 top-0 z-10 flex">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full bg-background/70"
              onClick={refresh}
              disabled={loading}
              aria-label="Refresh glucose graph"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden />
              )}
            </Button>
            <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-background/70">
              <Link href={connected ? "/tools/cgm-live" : "/settings/cgm"} aria-label="Open glucose trends">
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
          <CgmGlucoseChart
            points={points}
            units={units}
            targetLow={target.low}
            targetHigh={target.high}
            timelineEvents={timelineEvents}
            insulinSeries={penUser && insulin.visible ? insulin.series : undefined}
            insulinMarks={penUser && insulin.visible ? insulin.marks : undefined}
            insulinDoseMarks={penUser && insulin.visible ? insulin.doseMarks : undefined}
            xDomain={penUser && insulin.visible ? insulin.xDomain ?? undefined : undefined}
            plotHeight={240}
            className="w-full [&>p]:hidden"
          />
        </div>
      ) : (
        <Link
          href={connected ? "/tools/cgm-live" : "/settings/cgm"}
          className="flex items-center gap-3 py-2"
          data-testid="home-cgm-empty-graph"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Activity className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">
              {connected && loading ? "Loading your glucose" : connected ? "Waiting for readings" : "Connect your CGM"}
            </span>
            <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
              {connected && loading
                ? "The latest readings are on the way."
                : connected
                  ? "They will draw this 12-hour chart."
                  : "Dexcom, Libre, or phone health."}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
      )}
      {showChart && points.length <= 1 ? (
        <p className="px-1 text-center text-xs text-muted-foreground">
          {connected ? (
            "Glucose readings will appear on this graph once they arrive."
          ) : (
            <>
              <Link href="/settings/cgm" className="font-medium text-primary">
                Connect your CGM
              </Link>{" "}
              to see glucose on this graph too.
            </>
          )}
        </p>
      ) : null}

      {penUser ? (
        <InsulinChartControls
          visible={insulin.visible}
          hasDoses={insulin.hasDoses}
          remaining={insulin.remaining}
          runsOutLabel={insulin.runsOutLabel}
          longActingUnits={usualLongActingUnits(
            storage.getSettings().longActingUnitsPerDay,
            storage.getSettings().longActingInjectionsPerDay,
          )}
        />
      ) : null}

      {history.error && savedPoints.length > 1 ? (
        <p className="mt-1 text-center text-xs text-muted-foreground">
          Live refresh unavailable — showing saved readings.
        </p>
      ) : null}
    </section>
  );
}
