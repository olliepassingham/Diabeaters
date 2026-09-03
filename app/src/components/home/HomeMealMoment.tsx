import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ArrowRight, Calculator, Clock3, Sparkles, Utensils, X } from "lucide-react";
import { Link, useLocation } from "wouter";

import { Button } from "@/components/ui/button";
import {
  getHomeMealMoment,
  homeMealDismissalKey,
  type HomeMealSlot,
} from "@/lib/home-meal-moment";
import type { CarbCompositionHint } from "@/lib/carb-estimator-data";
import type { HealthStatus } from "@/lib/dashboard-health-status";
import { storage, type Routine } from "@/lib/storage";

const DISMISSED_MEAL_MOMENT_KEY = "diabeater_home_meal_moment_dismissed";
const CarbEstimatorSheet = lazy(() =>
  import("@/components/carb-estimator-sheet").then((module) => ({
    default: module.CarbEstimatorSheet,
  })),
);

function adviserHref(
  slot: HomeMealSlot,
  grams?: number,
  composition?: CarbCompositionHint | null,
): string {
  const params = new URLSearchParams({ tab: "meal", mealTime: slot, from: "home" });
  if (grams != null) params.set("carbs", String(Math.round(grams)));
  if (composition) {
    params.set("carbType", composition.carbType);
    if (composition.hasFat) params.set("fat", "1");
    if (composition.hasProtein) params.set("protein", "1");
    if (composition.hasFibre) params.set("fibre", "1");
  }
  return `/adviser?${params.toString()}`;
}

function getMealRoutines(slot: HomeMealSlot): Routine[] {
  try {
    return storage
      .getRoutinesByMealType(slot)
      .filter((routine) => Number.isFinite(routine.carbEstimate) && Number(routine.carbEstimate) > 0)
      .sort((a, b) => {
        const recentDifference =
          new Date(b.lastUsed ?? 0).getTime() - new Date(a.lastUsed ?? 0).getTime();
        return recentDifference || b.timesUsed - a.timesUsed;
      })
      .slice(0, 2);
  } catch {
    return [];
  }
}

export function HomeMealMoment({ healthStatus }: { healthStatus: HealthStatus }) {
  const [, setLocation] = useLocation();
  const [now, setNow] = useState(() => new Date());
  const [estimatorOpen, setEstimatorOpen] = useState(false);
  const [dismissedKey, setDismissedKey] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_MEAL_MOMENT_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const moment = useMemo(() => getHomeMealMoment(now), [now]);
  const currentDismissalKey = moment ? homeMealDismissalKey(now, moment.slot) : null;
  const isDismissed = currentDismissalKey != null && currentDismissalKey === dismissedKey;
  const routines = useMemo(() => (moment ? getMealRoutines(moment.slot) : []), [moment]);

  if (healthStatus === "action") return null;

  if (!moment || isDismissed) {
    return (
      <section className="animate-fade-in px-1 py-2" data-testid="home-meal-moment-compact">
        <Link
          href="/adviser?tab=meal"
          className="group flex items-center gap-2 rounded-full px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-primary/[0.05] hover:text-foreground"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/[0.08] text-primary">
            <Utensils className="h-3.5 w-3.5" aria-hidden />
          </span>
          <span className="font-medium">Plan a meal</span>
          <span className="ml-auto text-xs">Carbs and dose adviser</span>
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </section>
    );
  }

  const dismiss = () => {
    if (!currentDismissalKey) return;
    try {
      localStorage.setItem(DISMISSED_MEAL_MOMENT_KEY, currentDismissalKey);
    } catch {
      // The current view can still dismiss even when storage is unavailable.
    }
    setDismissedKey(currentDismissalKey);
  };

  const useRoutine = (routine: Routine) => {
    try {
      storage.useRoutine(routine.id);
    } catch {
      // A storage failure should not block opening the adviser.
    }
    setLocation(adviserHref(moment.slot, routine.carbEstimate));
  };

  return (
    <>
      <section className="animate-fade-in-up px-1 py-3" data-testid="home-meal-moment">
        <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-primary/[0.13] via-background/75 to-cyan-500/[0.10] px-4 pb-4 pt-3.5 ring-1 ring-primary/10">
          <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Utensils className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-primary">
                <Clock3 className="h-3 w-3" aria-hidden />
                {moment.timeLabel} · Right now
              </p>
              <h2 className="mt-0.5 font-display text-xl font-semibold tracking-tight">{moment.title}</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Estimate the carbs, then review your suggestion before you act.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-mr-2 -mt-2 h-9 w-9 shrink-0 rounded-full text-muted-foreground"
              onClick={dismiss}
              aria-label={`Dismiss ${moment.slot} suggestion`}
              data-testid="button-dismiss-home-meal-moment"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {routines.length > 0 ? (
            <div className="relative mt-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Your usual meals
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {routines.map((routine) => (
                  <button
                    key={routine.id}
                    type="button"
                    onClick={() => useRoutine(routine)}
                    className="flex min-w-0 shrink-0 items-center gap-2 rounded-full bg-background/75 px-3 py-2 text-left text-xs shadow-sm ring-1 ring-border/40 backdrop-blur-sm"
                    data-testid={`button-home-meal-routine-${routine.id}`}
                  >
                    <span className="max-w-[9rem] truncate font-medium">{routine.name}</span>
                    <span className="font-semibold tabular-nums text-primary">{routine.carbEstimate}g</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="relative mt-3 grid grid-cols-[1fr_auto] gap-2">
            <Button
              type="button"
              className="h-11 rounded-full shadow-sm"
              onClick={() => setEstimatorOpen(true)}
              data-testid="button-home-estimate-meal"
            >
              <Sparkles className="mr-2 h-4 w-4" aria-hidden />
              Estimate from foods
            </Button>
            <Button asChild variant="secondary" size="icon" className="h-11 w-11 rounded-full" title="Enter carbs manually">
              <Link href={adviserHref(moment.slot)} data-testid="link-home-enter-meal-carbs">
                <Calculator className="h-4 w-4" aria-hidden />
                <span className="sr-only">Enter carbs manually</span>
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {estimatorOpen ? (
        <Suspense fallback={null}>
          <CarbEstimatorSheet
            open
            onOpenChange={setEstimatorOpen}
            onConfirm={({ grams, compositionHint }) => {
              setLocation(adviserHref(moment.slot, grams, compositionHint));
            }}
          />
        </Suspense>
      ) : null}
    </>
  );
}
