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
  pickNextUpcomingAppointment,
  resolveHomeNextBestAction,
  type HomeNextBestAction,
} from "@/lib/home-next-best-action";
import {
  resolveHomeGlucoseAttention,
  resolveHomeStatusPill,
} from "@/lib/home-glucose-attention";
import { hypoRangeThreshold } from "@/lib/exercise-hypo-auto";
import { useBgPrefill } from "@/hooks/use-bg-prefill";
import { isCgmPrefillActive } from "@/lib/cgm/preferences";
import { normalizeBgUnits } from "@/lib/alcohol-night-tool";
import {
  isTravelPackingIncomplete,
  resolveTravelPromote,
} from "@/lib/status-bar-model";
import { timezoneChangeFromHours } from "@/lib/travel-insulin-clock";

const DISMISSED_MEAL_MOMENT_KEY = "diabeater_home_meal_moment_dismissed";

export type HomeLiveGlucose = {
  value: number;
  units: string;
  trend: "rising" | "falling" | "flat" | null;
};

/** Shared next-action resolution for hero + home sections (dedupe). */
export function useHomeNextBestAction(options: {
  status: HealthStatus;
  scenarioState: ScenarioState;
  showCoach: boolean;
}): {
  action: HomeNextBestAction;
  pill: { status: HealthStatus; label: string };
  glucose: HomeLiveGlucose | null;
} {
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
  const cgmActive = isCgmPrefillActive();
  const { prefill: bgPrefill } = useBgPrefill({
    pollIntervalMs: cgmActive ? 5 * 60_000 : undefined,
  });

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
  const nextAppointment = useMemo(() => {
    try {
      return pickNextUpcomingAppointment(storage.getAppointments(), now);
    } catch {
      return null;
    }
  }, [now]);
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

  const bgUnits = normalizeBgUnits(storage.getProfile()?.bgUnits);
  const reading = bgPrefill?.fromCgm ? bgPrefill.reading : null;
  const parsedPrefill = bgPrefill?.fromCgm && bgPrefill.value != null ? Number(bgPrefill.value) : null;
  const liveValue = reading?.value ?? (parsedPrefill != null && Number.isFinite(parsedPrefill) ? parsedPrefill : null);
  const trend =
    reading?.trend === "rising" || reading?.trend === "falling" || reading?.trend === "flat"
      ? reading.trend
      : null;
  const settings = storage.getSettings();
  const lowLine = hypoRangeThreshold(settings, bgUnits);
  const highLine =
    typeof settings.targetBgHigh === "number" && settings.targetBgHigh > lowLine
      ? settings.targetBgHigh
      : null;
  const attention =
    liveValue != null && Number.isFinite(liveValue)
      ? resolveHomeGlucoseAttention({
          bg: liveValue,
          trend,
          bgUnits,
          lowLine,
          highLine,
        })
      : null;
  const pill = resolveHomeStatusPill(status, attention);
  const glucose: HomeLiveGlucose | null =
    liveValue != null && Number.isFinite(liveValue)
      ? { value: liveValue, units: reading?.units ?? bgUnits, trend }
      : null;

  const action = useMemo(
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
        nextAppointment,
        mealMoment,
        mealDismissed,
        hasCriticalSupply,
        showCoach,
        glucoseNeedsHypoHelp: attention === "low" || attention === "dropping",
        glucoseIsLow: attention === "low",
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
      nextAppointment,
      mealMoment,
      mealDismissed,
      hasCriticalSupply,
      showCoach,
      attention,
    ],
  );

  return { action, pill, glucose };
}
