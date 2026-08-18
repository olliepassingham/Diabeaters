import { useEffect } from "react";
import {
  DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT,
  DIABEATER_SCENARIO_STATE_CHANGED_EVENT,
  storage,
  type ActiveExerciseSession,
} from "@/lib/storage";
import { isCapacitorNativeShell } from "@/lib/native-platform";
import { OsSurfaces, type OsSurfaceStatusPayload } from "@/lib/native-os-surfaces";
import { getCgmLocalHistory } from "@/lib/cgm/cgm-history-store";
import { fetchLatestCgmReading } from "@/lib/cgm/registry";
import { osSurfaceGlucoseFromHistory } from "@/lib/os-surface-glucose";
import { fetchPendingHypoCheckIns, respondHypoCheckIn } from "@/lib/hypo-check-ins";
import { toast } from "@/hooks/use-toast";
import type { BgUnits } from "@/lib/cgm/types";

function exerciseLabel(session: ActiveExerciseSession | null): string {
  if (!session) return "Exercise";
  const raw = (session.exerciseName || session.exerciseType || "Exercise").toString();
  return raw.replace(/_/g, " ");
}

function profileBgUnits(): BgUnits {
  const units = storage.getProfile()?.bgUnits;
  return units === "mg/dL" ? "mg/dL" : "mmol/L";
}

function glucoseFieldsFromHistory(): Partial<OsSurfaceStatusPayload> {
  const snapshot = osSurfaceGlucoseFromHistory(getCgmLocalHistory(1), profileBgUnits());
  if (!snapshot) return {};
  return {
    glucoseValue: snapshot.glucoseValue,
    glucoseUnits: snapshot.glucoseUnits,
    ...(snapshot.glucoseTrend ? { glucoseTrend: snapshot.glucoseTrend } : {}),
    glucoseRecordedAt: snapshot.glucoseRecordedAt,
  };
}

function buildStatusPayload(): OsSurfaceStatusPayload {
  const scenario = storage.getScenarioState();
  const exercise = storage.getActiveExercise();
  const updatedAt = new Date().toISOString();
  const glucose = glucoseFieldsFromHistory();

  if (exercise && (exercise.phase === "pre" || exercise.phase === "active" || exercise.phase === "recovery")) {
    const phaseLabel =
      exercise.phase === "pre" ? "Getting ready" : exercise.phase === "active" ? "In progress" : "Recovery";
    return {
      kind: "exercise",
      title: exerciseLabel(exercise),
      subtitle: phaseLabel,
      deepLinkPath: "/scenarios/exercise",
      updatedAt,
      ...glucose,
    };
  }

  if (scenario.sickDayActive) {
    return {
      kind: "sick_day",
      title: "Sick day active",
      subtitle: scenario.sickDaySeverity ? `Severity: ${scenario.sickDaySeverity}` : "Follow your sick-day plan",
      deepLinkPath: "/sick-day",
      updatedAt,
      ...glucose,
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
      ...glucose,
    };
  }

  return {
    kind: "idle",
    title: "Diabeaters",
    subtitle: glucose.glucoseRecordedAt
      ? "Last reading from the phone — not a CGM alarm"
      : "Guides, tools, and check-ins",
    deepLinkPath: "/",
    updatedAt,
    ...glucose,
  };
}

async function mergeLiveCgmIfFresher(payload: OsSurfaceStatusPayload): Promise<OsSurfaceStatusPayload> {
  try {
    const reading = await fetchLatestCgmReading(profileBgUnits());
    if (!reading || !Number.isFinite(reading.value)) return payload;
    const liveMs = Date.parse(reading.recordedAt);
    const existingMs = payload.glucoseRecordedAt ? Date.parse(payload.glucoseRecordedAt) : 0;
    if (!Number.isFinite(liveMs) || liveMs < existingMs) return payload;
    const trend = reading.trend && reading.trend !== "not_sure" ? reading.trend : undefined;
    const rest: OsSurfaceStatusPayload = { ...payload };
    delete rest.glucoseTrend;
    return {
      ...rest,
      glucoseValue: reading.value,
      glucoseUnits: reading.units,
      ...(trend ? { glucoseTrend: trend } : {}),
      glucoseRecordedAt: reading.recordedAt,
      subtitle:
        payload.kind === "idle" ? "Last reading from the phone — not a CGM alarm" : payload.subtitle,
    };
  } catch {
    return payload;
  }
}

async function syncWidgetStatus(): Promise<void> {
  if (!isCapacitorNativeShell()) return;
  try {
    const payload = await mergeLiveCgmIfFresher(buildStatusPayload());
    await OsSurfaces.syncStatus(payload);
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

async function handleWatchSortedIt(): Promise<void> {
  try {
    const { data, error } = await fetchPendingHypoCheckIns();
    if (error) {
      toast({ title: "Could not send reply", description: error.message, variant: "destructive" });
      return;
    }
    const latest = data[0];
    if (!latest) {
      toast({
        title: "No check-in waiting",
        description: "Treat first if you need to. Supporters see a reply when there is a check-in.",
      });
      return;
    }
    const res = await respondHypoCheckIn({ checkInId: latest.id, response: "treating" });
    if (res.error) {
      toast({ title: "Could not send reply", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Reply sent",
      description: `${latest.carer_name} will see you’ve sorted it.`,
    });
  } catch {
    /* offline / missing plugin */
  }
}

/** Keeps Lock Screen widget, Watch glance, and exercise Live Activity in sync. */
export function NativeOsSurfacesSync() {
  useEffect(() => {
    if (!isCapacitorNativeShell()) return;

    const run = () => {
      void syncWidgetStatus();
      void syncExerciseLiveActivity();
    };

    run();
    const interval = window.setInterval(run, 5 * 60 * 1000);
    window.addEventListener(DIABEATER_SCENARIO_STATE_CHANGED_EVENT, run);
    window.addEventListener(DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT, run);
    document.addEventListener("visibilitychange", run);
    let removeWatch: (() => void) | undefined;
    void OsSurfaces.addListener("watchSortedIt", () => {
      void handleWatchSortedIt();
    }).then((handle) => {
      removeWatch = () => {
        void handle.remove();
      };
    });
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(DIABEATER_SCENARIO_STATE_CHANGED_EVENT, run);
      window.removeEventListener(DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT, run);
      document.removeEventListener("visibilitychange", run);
      removeWatch?.();
    };
  }, []);

  return null;
}
