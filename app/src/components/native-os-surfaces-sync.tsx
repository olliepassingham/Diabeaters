import { useEffect } from "react";
import {
  DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT,
  DIABEATER_SCENARIO_STATE_CHANGED_EVENT,
  storage,
  type ActiveExerciseSession,
} from "@/lib/storage";
import { isCapacitorNativeShell } from "@/lib/native-platform";
import { OsSurfaces, type OsSurfaceStatusPayload } from "@/lib/native-os-surfaces";

function exerciseLabel(session: ActiveExerciseSession | null): string {
  if (!session) return "Exercise";
  const raw = (session.exerciseName || session.exerciseType || "Exercise").toString();
  return raw.replace(/_/g, " ");
}

function buildStatusPayload(): OsSurfaceStatusPayload {
  const scenario = storage.getScenarioState();
  const exercise = storage.getActiveExercise();
  const updatedAt = new Date().toISOString();

  if (exercise && (exercise.phase === "pre" || exercise.phase === "active" || exercise.phase === "recovery")) {
    const phaseLabel =
      exercise.phase === "pre" ? "Getting ready" : exercise.phase === "active" ? "In progress" : "Recovery";
    return {
      kind: "exercise",
      title: exerciseLabel(exercise),
      subtitle: phaseLabel,
      deepLinkPath: "/scenarios/exercise",
      updatedAt,
    };
  }

  if (scenario.sickDayActive) {
    return {
      kind: "sick_day",
      title: "Sick day active",
      subtitle: scenario.sickDaySeverity ? `Severity: ${scenario.sickDaySeverity}` : "Follow your sick-day plan",
      deepLinkPath: "/sick-day",
      updatedAt,
    };
  }

  if (scenario.travelModeActive) {
    const dest = scenario.travelDestination?.trim();
    return {
      kind: "travel",
      title: dest ? `Travel — ${dest}` : "Travel mode active",
      subtitle: "Open travel guide",
      deepLinkPath: "/scenarios/travel",
      updatedAt,
    };
  }

  return {
    kind: "idle",
    title: "Diabeaters",
    subtitle: "Guides, tools, and check-ins",
    deepLinkPath: "/",
    updatedAt,
  };
}

async function syncWidgetStatus(): Promise<void> {
  if (!isCapacitorNativeShell()) return;
  try {
    await OsSurfaces.syncStatus(buildStatusPayload());
  } catch {
    /* simulator / missing plugin */
  }
}

async function syncExerciseLiveActivity(): Promise<void> {
  if (!isCapacitorNativeShell()) return;
  const session = storage.getActiveExercise();
  try {
    if (!session) {
      await OsSurfaces.endExerciseLiveActivity();
      return;
    }
    const payload = {
      exerciseLabel: exerciseLabel(session),
      phase: session.phase as "pre" | "active" | "recovery",
      startedAtIso: session.exerciseStartedAt || session.startedAt,
      deepLinkPath: "/scenarios/exercise",
    };
    if (session.phase === "pre" || session.phase === "active") {
      const started = await OsSurfaces.startExerciseLiveActivity(payload);
      if (!started.ok) {
        await OsSurfaces.updateExerciseLiveActivity(payload);
      }
    } else {
      await OsSurfaces.updateExerciseLiveActivity(payload);
    }
  } catch {
    /* ActivityKit unavailable */
  }
}

/** Keeps Lock Screen widget + exercise Live Activity in sync with local scenario state. */
export function NativeOsSurfacesSync() {
  useEffect(() => {
    if (!isCapacitorNativeShell()) return;

    const run = () => {
      void syncWidgetStatus();
      void syncExerciseLiveActivity();
    };

    run();
    window.addEventListener(DIABEATER_SCENARIO_STATE_CHANGED_EVENT, run);
    window.addEventListener(DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT, run);
    return () => {
      window.removeEventListener(DIABEATER_SCENARIO_STATE_CHANGED_EVENT, run);
      window.removeEventListener(DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT, run);
    };
  }, []);

  return null;
}
