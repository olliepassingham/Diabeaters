import { useEffect, useMemo, useState } from "react";
import {
  DIABEATER_SCENARIO_STATE_CHANGED_EVENT,
  storage,
  type ScenarioState,
} from "@/lib/storage";
import type { HealthStatus } from "@/lib/dashboard-health-status";
import { getHomeMealMoment, homeMealDismissalKey } from "@/lib/home-meal-moment";
import { useHomeBedtimePresence } from "@/components/home/HomeBedtimeMoment";
import {
  resolveHomeNextBestAction,
  type HomeNextBestAction,
} from "@/lib/home-next-best-action";
import {
  isTravelPackingIncomplete,
  resolveTravelPromote,
} from "@/lib/status-bar-model";
import { timezoneChangeFromHours } from "@/lib/travel-insulin-clock";

const DISMISSED_MEAL_MOMENT_KEY = "diabeater_home_meal_moment_dismissed";

/** Shared next-action resolution for hero + home sections (dedupe). */
export function useHomeNextBestAction(options: {
  status: HealthStatus;
  scenarioState: ScenarioState;
  showCoach: boolean;
}): HomeNextBestAction {
  const { status, scenarioState, showCoach } = options;
  const [now, setNow] = useState(() => new Date());
  const [dismissedMealKey, setDismissedMealKey] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_MEAL_MOMENT_KEY);
    } catch {
      return null;
    }
  });
  const bedtime = useHomeBedtimePresence();

  useEffect(() => {
    const refresh = () => {
      setNow(new Date());
      try {
        setDismissedMealKey(localStorage.getItem(DISMISSED_MEAL_MOMENT_KEY));
      } catch {
        // ignore
      }
    };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    window.addEventListener(DIABEATER_SCENARIO_STATE_CHANGED_EVENT, refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(DIABEATER_SCENARIO_STATE_CHANGED_EVENT, refresh);
    };
  }, []);

  const mealMoment = useMemo(() => getHomeMealMoment(now), [now]);
  const mealDismissed =
    mealMoment != null && homeMealDismissalKey(now, mealMoment.slot) === dismissedMealKey;

  const tzHours = Math.abs(scenarioState.travelTimezoneShift ?? 0);
  const travelPromote = useMemo(
    () =>
      resolveTravelPromote({
        travelModeActive: scenarioState.travelModeActive,
        travelStartDate: scenarioState.travelStartDate,
        travelEndDate: scenarioState.travelEndDate,
        timezoneHours: tzHours,
        timezoneChange:
          scenarioState.travelTimezoneDirection && scenarioState.travelTimezoneDirection !== "none"
            ? timezoneChangeFromHours(tzHours)
            : "none",
        packingIncomplete: isTravelPackingIncomplete(storage.getTravelPackingList()),
        today: now,
      }),
    [
      scenarioState.travelModeActive,
      scenarioState.travelStartDate,
      scenarioState.travelEndDate,
      scenarioState.travelTimezoneDirection,
      tzHours,
      now,
    ],
  );

  const hasCriticalSupply = useMemo(() => {
    try {
      return storage.getSupplies().some((s) => storage.getSupplyStatus(s) === "critical");
    } catch {
      return false;
    }
  }, [status, scenarioState]);

  const bedtimeDue =
    bedtime.visible && bedtime.mode === "evening" && bedtime.checkedTonight === false;

  const activeExercise = storage.getActiveExercise();

  return useMemo(
    () =>
      resolveHomeNextBestAction({
        healthStatus: status,
        sickDayActive: scenarioState.sickDayActive,
        pumpFailureActive: scenarioState.pumpFailureActive === true,
        exerciseActive: Boolean(activeExercise),
        travelPromote,
        travelModeActive: scenarioState.travelModeActive,
        travelDestination: scenarioState.travelDestination,
        bedtimeDue,
        mealMoment,
        mealDismissed,
        hasCriticalSupply,
        showCoach,
      }),
    [
      status,
      scenarioState.sickDayActive,
      scenarioState.pumpFailureActive,
      scenarioState.travelModeActive,
      scenarioState.travelDestination,
      activeExercise,
      travelPromote,
      bedtimeDue,
      mealMoment,
      mealDismissed,
      hasCriticalSupply,
      showCoach,
    ],
  );
}
