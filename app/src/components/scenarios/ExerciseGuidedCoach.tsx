/**
 * Guided pre/during/recovery exercise coach.
 *
 * Replaces the form-style ExercisePlanner on /scenarios/exercise.
 * Same data model and phases as the Quick Exercise top-bar quick check, with deeper
 * questions per phase that feed extra context into the recommendation engine.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  CircleCheck,
  Coffee,
  Dumbbell,
  Info,
  MapPin,
  Moon,
  Pill,
  Play,
  Power,
  History,
  RotateCcw,
  Snowflake,
  Sparkles,
  Sun,
  Thermometer,
  TrendingDown,
  TrendingUp,
  Wind,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { usesClosedLoop } from "@/lib/closed-loop";
import {
  closedLoopExercisePrePrompt,
  pumpTipsForPhase,
} from "@/lib/exercise-closed-loop";
import { listRecentRepeatableExerciseSessions, type RecentRepeatableExerciseSession } from "@/lib/exercise-session-repeat";
import { normalizePlannerExerciseTypeQueryParam } from "@/lib/exercise-planner-href";
import { applyCoachDefaultsFromLastExercise, startGuidedExerciseSession, type GuidedExerciseStartParams } from "@/lib/exercise-guided-start";
import { ExercisePumpTipsCard } from "@/components/scenarios/ExercisePumpTipsCard";
import {
  storage,
  DIABEATER_EXERCISE_OUTCOMES_CHANGED_EVENT,
  DIABEATER_PROFILE_CHANGED_EVENT,
  DIABEATER_SETTINGS_CHANGED_EVENT,
  type ActiveExerciseSession,
  type ExerciseBgTrend,
  type ExerciseEnvironmentChoice,
  type ExerciseIntensity,
  type ExerciseRoutine,
  type ExerciseSymptomFlag,
  type ExerciseType,
  type PreRapidInsulin2h,
  type UserProfile,
  type UserSettings,
} from "@/lib/storage";
import { buildExercisePlanContextFromCoachSession } from "@/lib/exercise-coach-plan-context";
import {
  calculateExercisePlan,
  type ExercisePlanResult,
  type ExerciseHistoryBias,
} from "@/lib/exercise-plan";
import {
  getExerciseFuelPlanLines,
  getExerciseReadinessVerdict,
  getReadinessToneClasses,
  type ExerciseReadinessResult,
} from "@/lib/exercise-readiness";
import {
  cancelExerciseReminders,
  scheduleExerciseActiveReminders,
  scheduleExercisePreReminders,
} from "@/lib/exercise-reminders";
import { computeExerciseHypoSuggestion, resolveExerciseBgForHypo } from "@/lib/exercise-hypo-auto";
import { format } from "date-fns";
import {
  ExerciseFuelPlanSummary,
  ExerciseHypoTreatmentHint,
  ExerciseWorkoutProgressBar,
  formatExerciseElapsedShort,
} from "@/components/exercise-active-session-extras";

// ----- Type / intensity catalogues kept local so the form can be self-contained -----

const EXERCISE_TYPE_OPTIONS: Array<{ value: ExerciseType; label: string }> = [
  { value: "cardio", label: "Cardio" },
  { value: "strength", label: "Strength" },
  { value: "hiit", label: "HIIT" },
  { value: "yoga", label: "Yoga / Pilates" },
  { value: "walking", label: "Walking" },
  { value: "court", label: "Court & racket sports" },
  { value: "field", label: "Field & team sports" },
  { value: "swimming", label: "Swimming" },
];

const INTENSITY_OPTIONS: ExerciseIntensity[] = ["light", "moderate", "intense"];

const ENVIRONMENT_OPTIONS: Array<{ value: ExerciseEnvironmentChoice; label: string; icon: typeof Sun }> = [
  { value: "indoor", label: "Indoor", icon: Activity },
  { value: "outdoor_normal", label: "Outdoor", icon: Sun },
  { value: "outdoor_hot", label: "Outdoor — hot", icon: Thermometer },
  { value: "outdoor_cold", label: "Outdoor — cold", icon: Snowflake },
  { value: "altitude", label: "Altitude", icon: Wind },
];

const VENUE_ENVIRONMENT_CHOICES = new Set<ExerciseEnvironmentChoice>([
  "indoor",
  "outdoor_normal",
  "outdoor_hot",
  "outdoor_cold",
]);

/** Venue pills are mutually exclusive; altitude toggles on top of any venue. */
function toggleExerciseEnvironmentSelection(
  current: ExerciseEnvironmentChoice[] | undefined,
  value: ExerciseEnvironmentChoice,
): ExerciseEnvironmentChoice[] | undefined {
  const cur = current?.filter(Boolean) ?? [];
  if (value === "altitude") {
    if (cur.includes("altitude")) {
      const next = cur.filter((v) => v !== "altitude");
      return next.length > 0 ? next : undefined;
    }
    return [...cur, "altitude"];
  }
  const withoutVenue = cur.filter((v) => !VENUE_ENVIRONMENT_CHOICES.has(v));
  if (cur.includes(value)) {
    return withoutVenue.length > 0 ? withoutVenue : undefined;
  }
  return [...withoutVenue, value];
}

const SYMPTOM_OPTIONS: Array<{ value: ExerciseSymptomFlag; label: string }> = [
  { value: "fine", label: "Feeling fine" },
  { value: "lightheaded", label: "Lightheaded" },
  { value: "shaky", label: "Shaky" },
  { value: "tingly", label: "Tingly" },
  { value: "sweaty", label: "Sweaty" },
  { value: "tired", label: "Tired" },
];

// ----- Helpers -----

function clampInt(value: string, min: number, max: number): number | null {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function parseFloatOrNull(value: string): number | null {
  const v = value.trim().replace(",", ".");
  if (v === "") return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Build a history bias from past outcomes for the same routine.
 * Light defensive thresholds — only meaningful with at least 2 prior matching sessions.
 */
function deriveHistoryBias(session: ActiveExerciseSession | null): ExerciseHistoryBias | undefined {
  if (!session) return undefined;
  const patterns = storage.getExercisePatterns(session.exerciseType, session.intensity);
  if (patterns.totalSessions < 2) return undefined;

  let typicalResponse: ExerciseHistoryBias["typicalResponse"] = "stable";
  if (patterns.droppedCount > patterns.stableCount && patterns.droppedCount > patterns.roseCount) {
    typicalResponse = "dropped";
  } else if (patterns.roseCount > patterns.stableCount && patterns.roseCount > patterns.droppedCount) {
    typicalResponse = "rose";
  }
  return {
    totalSessions: patterns.totalSessions,
    typicalResponse,
    hypoProne: patterns.hypoCount >= Math.max(1, Math.floor(patterns.totalSessions / 3)),
  };
}

// ----- Component -----

function scrollToActiveGuidedCoach(): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document
        .querySelector('[data-testid="exercise-guided-coach"]')
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

export function ExerciseGuidedCoach() {
  const { toast } = useToast();
  const search = useSearch();
  const [, navigate] = useLocation();
  const autostartHandled = useRef(false);
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [settings, setSettings] = useState<UserSettings>(() => storage.getSettings());
  const [activeSession, setActiveSession] = useState<ActiveExerciseSession | null>(() => storage.getActiveExercise());
  const [now, setNow] = useState<number>(() => Date.now());
  const [routines, setRoutines] = useState<ExerciseRoutine[]>(() => storage.getRecentExercises?.(8) ?? []);
  const appliedDefaultsForSessionId = useRef<string | null>(null);

  // Quick start form (only relevant when no active session exists)
  const [planWorkoutOpen, setPlanWorkoutOpen] = useState(false);
  const [startType, setStartType] = useState<ExerciseType>("cardio");
  const [startIntensity, setStartIntensity] = useState<ExerciseIntensity>("moderate");
  const [startDuration, setStartDuration] = useState<string>("45");

  // Pre / active / recovery local input state (mirrors active session for snappy controls)
  const [bgInput, setBgInput] = useState<string>("");
  const lastSyncedSessionId = useRef<string>("");

  const bgUnits = (profile.bgUnits === "mg/dL" ? "mg/dL" : "mmol/L") as "mmol/L" | "mg/dL";
  const isPump = isPumpDeliveryMethod(profile.insulinDeliveryMethod);
  const closedLoop = usesClosedLoop(settings);
  const [recentWorkoutsVersion, setRecentWorkoutsVersion] = useState(0);

  const recentWorkouts = useMemo(() => {
    let outcomes: ReturnType<typeof storage.getExerciseOutcomes> = [];
    try {
      outcomes = storage.getExerciseOutcomes();
    } catch {
      outcomes = [];
    }
    return listRecentRepeatableExerciseSessions({ outcomes, limit: 5 });
  }, [recentWorkoutsVersion, activeSession]);

  useEffect(() => {
    const onOutcomes = () => setRecentWorkoutsVersion((v) => v + 1);
    window.addEventListener(DIABEATER_EXERCISE_OUTCOMES_CHANGED_EVENT, onOutcomes);
    return () => window.removeEventListener(DIABEATER_EXERCISE_OUTCOMES_CHANGED_EVENT, onOutcomes);
  }, []);

  // ----- Mount: load profile, settings, and listen for session changes -----
  useEffect(() => {
    const onProfile = () => {
      setProfile(storage.getProfile() ?? {});
      setSettings(storage.getSettings());
    };
    window.addEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
    window.addEventListener(DIABEATER_SETTINGS_CHANGED_EVENT, onProfile);
    return () => {
      window.removeEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
      window.removeEventListener(DIABEATER_SETTINGS_CHANGED_EVENT, onProfile);
    };
  }, []);

  useEffect(() => {
    setProfile(storage.getProfile() ?? {});
    setSettings(storage.getSettings());
  }, []);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setActiveSession(storage.getActiveExercise());
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!activeSession) {
      appliedDefaultsForSessionId.current = null;
      return;
    }
    if (activeSession.phase !== "pre") return;
    if (appliedDefaultsForSessionId.current === activeSession.id) return;
    appliedDefaultsForSessionId.current = activeSession.id;
    const updated = applyCoachDefaultsFromLastExercise(activeSession);
    if (updated !== activeSession) setActiveSession(updated);
  }, [activeSession]);

  // Sync the BG input when the phase changes so the visible field reflects the right reading.
  useEffect(() => {
    if (!activeSession) {
      setBgInput("");
      lastSyncedSessionId.current = "";
      return;
    }
    const key = `${activeSession.id}-${activeSession.phase}`;
    if (lastSyncedSessionId.current === key) return;
    lastSyncedSessionId.current = key;
    const v =
      activeSession.phase === "pre"
        ? activeSession.preBg
        : activeSession.phase === "active"
          ? activeSession.midBg ?? activeSession.preBg
          : activeSession.recoveryBg ?? activeSession.midBg ?? activeSession.preBg;
    setBgInput(typeof v === "number" && Number.isFinite(v) ? String(v) : "");
  }, [activeSession]);

  // ----- Deep-link: /scenarios/exercise?phase=pre|active|recovery&type=...&duration=...&intensity=... -----
  useEffect(() => {
    const q = search.startsWith("?") ? search.slice(1) : search;
    const params = new URLSearchParams(q);
    const type = params.get("type");
    const intensity = params.get("intensity");
    const duration = params.get("duration");

    if (!storage.getActiveExercise()) {
      if (type && EXERCISE_TYPE_OPTIONS.some((o) => o.value === (normalizePlannerExerciseTypeQueryParam(type) ?? type))) {
        setStartType((normalizePlannerExerciseTypeQueryParam(type) ?? type) as ExerciseType);
      }
      if (intensity && (INTENSITY_OPTIONS as readonly string[]).includes(intensity)) {
        setStartIntensity(intensity as ExerciseIntensity);
      }
      if (duration && /^\d{1,3}$/.test(duration)) setStartDuration(duration);
    }
  }, [search]);

  useEffect(() => {
    if (activeSession) return;

    const q = search.startsWith("?") ? search.slice(1) : search;
    const params = new URLSearchParams(q);
    if (params.get("start") !== "1") {
      autostartHandled.current = false;
      return;
    }
    if (autostartHandled.current) return;

    const type = normalizePlannerExerciseTypeQueryParam(params.get("type")) ?? params.get("type");
    const intensity = params.get("intensity");
    const duration = Number.parseInt(params.get("duration") ?? "", 10);
    const exerciseName = params.get("name") ?? undefined;
    const routineId = params.get("routineId") ?? undefined;

    if (!type || !intensity || !Number.isFinite(duration)) return;
    if (!EXERCISE_TYPE_OPTIONS.some((o) => o.value === type)) return;
    if (!(INTENSITY_OPTIONS as readonly string[]).includes(intensity)) return;

    autostartHandled.current = true;

    const result = startGuidedExerciseSession({
      exerciseType: type as ExerciseType,
      intensity: intensity as ExerciseIntensity,
      durationMinutes: duration,
      exerciseName,
      routineId,
    });

    if (!result.ok) {
      if (result.reason === "severe_sick_day") {
        toast({
          title: "Sick day mode is active",
          description: "Severe illness — focus on rest. End sick day mode to start a session.",
          variant: "destructive",
        });
      } else if (result.reason === "active_session") {
        toast({
          title: "Exercise already active",
          description: "Finish your current session first.",
          variant: "destructive",
        });
      }
      return;
    }

    setActiveSession(result.session);
    setRoutines(storage.getRecentExercises?.(8) ?? []);
    storage.recordExerciseToolUse("guided_start");
    void scheduleExercisePreReminders(result.session, 0);
    scrollToActiveGuidedCoach();

    params.delete("start");
    const next = params.toString();
    navigate(next ? `/scenarios/exercise?${next}` : "/scenarios/exercise", { replace: true });
  }, [activeSession, navigate, search, toast]);

  // ----- Derived recommendation context -----
  const trendForReadiness: ExerciseBgTrend | null = useMemo(() => {
    if (!activeSession) return null;
    if (activeSession.phase === "pre") return activeSession.preTrend ?? null;
    if (activeSession.phase === "active") return activeSession.midTrend ?? activeSession.preTrend ?? null;
    return activeSession.recoveryTrend ?? activeSession.midTrend ?? activeSession.preTrend ?? null;
  }, [activeSession]);

  const historyBias = useMemo(() => deriveHistoryBias(activeSession), [activeSession]);

  const exercisePlan: ExercisePlanResult | null = useMemo(() => {
    if (!activeSession) return null;
    const bgParsed = parseFloatOrNull(bgInput);
    try {
      const ctx = buildExercisePlanContextFromCoachSession({
        session: activeSession,
        bgUnits,
        currentBg: bgParsed ?? undefined,
        bgTrend: trendForReadiness,
        historyBias,
      });
      if (activeSession.phase !== "pre") {
        ctx.minutesUntilStart = 0;
      }
      return calculateExercisePlan(ctx, settings);
    } catch {
      return null;
    }
  }, [activeSession, bgInput, bgUnits, historyBias, trendForReadiness, settings]);

  const phasePumpTips = useMemo(() => {
    if (!exercisePlan || !isPump || !activeSession) return [];
    if (activeSession.phase === "pre") return pumpTipsForPhase(exercisePlan.pumpTips, "pre");
    if (activeSession.phase === "active") return pumpTipsForPhase(exercisePlan.pumpTips, "during");
    return pumpTipsForPhase(exercisePlan.pumpTips, "recovery");
  }, [exercisePlan, isPump, activeSession]);

  const readiness: ExerciseReadinessResult | null = useMemo(() => {
    if (!activeSession || !exercisePlan) return null;
    const sc = storage.getScenarioState();
    return getExerciseReadinessVerdict({
      exercisePlanResult: exercisePlan,
      currentBg: parseFloatOrNull(bgInput),
      bgUnits,
      sickDayActive: sc.sickDayActive,
      sickDaySeverity: sc.sickDaySeverity,
      exerciseType: activeSession.exerciseType,
      intensity: activeSession.intensity,
      bgTrend: trendForReadiness,
      phase: activeSession.phase,
      preRapidInsulin2h: activeSession.preRapidInsulin2h ?? null,
      sleepHoursLastNight: activeSession.preSleepHours ?? null,
      feelingOff: activeSession.preFeelingOff,
      alcoholLastNight: activeSession.preAlcoholLastNight,
      hypoProneHistory: historyBias?.hypoProne === true,
    });
  }, [activeSession, bgInput, bgUnits, exercisePlan, historyBias, trendForReadiness]);

  const fuelPlanLines = useMemo(() => {
    if (!activeSession || !exercisePlan || !readiness) return [];
    const bg = parseFloatOrNull(bgInput);
    if (bg == null) return [];
    return getExerciseFuelPlanLines(exercisePlan, readiness.verdict, profile, {
      phase: activeSession.phase,
      exerciseType: activeSession.exerciseType,
      currentBg: bg,
      bgUnits,
      intensity: activeSession.intensity,
    });
  }, [activeSession, bgInput, bgUnits, exercisePlan, profile, readiness]);

  const fuelPlanVariant =
    activeSession?.phase === "pre"
      ? "pre"
      : activeSession?.phase === "active"
        ? "active"
        : "recovery";

  const hypoCoachSuggestion = useMemo(() => {
    if (!activeSession) return null;
    const bg = resolveExerciseBgForHypo(activeSession, bgInput);
    if (bg == null) return null;
    const settings = storage.getSettings();
    const lowThreshold = exercisePlan ? parseFloat(exercisePlan.pre.lowThreshold) : undefined;
    return computeExerciseHypoSuggestion(bg, settings, bgUnits, profile, {
      trend: trendForReadiness,
      phase: activeSession.phase,
      exerciseLowThreshold: Number.isFinite(lowThreshold) ? lowThreshold : undefined,
      carbsIfLow: exercisePlan?.pre.carbsIfLow,
    });
  }, [activeSession, bgInput, bgUnits, profile.dateOfBirth, profile.bgUnits, exercisePlan, trendForReadiness]);

  // ----- Mutators -----
  const update = (updates: Parameters<typeof storage.updateActiveExercise>[0]) => {
    const next = storage.updateActiveExercise(updates);
    if (next) setActiveSession(next);
  };

  const onBgChange = (value: string) => {
    setBgInput(value);
    if (!activeSession) return;
    const raw = value.trim().replace(",", ".");
    if (raw === "") {
      if (activeSession.phase === "pre") update({ preBg: undefined, preBgAt: undefined });
      else if (activeSession.phase === "active") update({ midBg: undefined, midBgAt: undefined });
      else update({ recoveryBg: undefined, recoveryBgAt: undefined });
      return;
    }
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) return;
    const at = new Date().toISOString();
    if (activeSession.phase === "pre") update({ preBg: n, preBgAt: at });
    else if (activeSession.phase === "active") update({ midBg: n, midBgAt: at, midCheckDone: true });
    else update({ recoveryBg: n, recoveryBgAt: at });
  };

  const onTrendChange = (t: ExerciseBgTrend) => {
    if (!activeSession) return;
    if (activeSession.phase === "pre") update({ preTrend: t });
    else if (activeSession.phase === "active") update({ midTrend: t });
    else update({ recoveryTrend: t });
  };

  const beginGuidedSession = (
    params: GuidedExerciseStartParams,
    options?: { toastLabel?: string },
  ) => {
    const result = startGuidedExerciseSession(params);
    if (!result.ok) {
      if (result.reason === "active_session") {
        toast({
          title: "Exercise already active",
          description: "Finish your current session first.",
          variant: "destructive",
        });
      } else if (result.reason === "severe_sick_day") {
        toast({
          title: "Sick day mode is active",
          description: "Severe illness — focus on rest. End sick day mode to start a session.",
          variant: "destructive",
        });
      } else if (result.reason === "invalid_duration") {
        toast({
          title: "Set a duration",
          description: "Enter how long you'll exercise (5–300 min).",
          variant: "destructive",
        });
      }
      return;
    }

    setActiveSession(result.session);
    setPlanWorkoutOpen(false);
    setRoutines(storage.getRecentExercises?.(8) ?? []);
    storage.recordExerciseToolUse("guided_start");
    void scheduleExercisePreReminders(result.session, 0);
    scrollToActiveGuidedCoach();

    if (options?.toastLabel) {
      toast({
        title: "Session ready",
        description: options.toastLabel,
      });
    }
  };

  const onStartFromRepeatable = (session: RecentRepeatableExerciseSession) => {
    beginGuidedSession(
      {
        exerciseType: session.exerciseType,
        intensity: session.intensity,
        durationMinutes: session.durationMinutes,
        exerciseName: session.exerciseName,
      },
      { toastLabel: session.label },
    );
  };

  const onStartFromForm = () => {
    const dur = clampInt(startDuration, 5, 300);
    if (dur == null) {
      toast({
        title: "Set a duration",
        description: "Enter how long you'll exercise (5–300 min).",
        variant: "destructive",
      });
      return;
    }
    beginGuidedSession({
      exerciseName: EXERCISE_TYPE_OPTIONS.find((o) => o.value === startType)?.label ?? "Exercise",
      exerciseType: startType,
      intensity: startIntensity,
      durationMinutes: dur,
    });
  };

  const onStartFromRoutine = (routine: ExerciseRoutine) => {
    beginGuidedSession({
      routineId: routine.id,
      exerciseName: routine.name,
      exerciseType: routine.exerciseType,
      intensity: routine.intensity,
      durationMinutes: routine.durationMinutes,
    });
  };

  const onStartWorkout = () => {
    if (!activeSession || activeSession.phase !== "pre") return;
    storage.startExercisePhase();
    const updated = storage.getActiveExercise();
    if (updated) {
      setActiveSession(updated);
      void scheduleExerciseActiveReminders(updated);
    }
  };

  const onFinishWorkout = () => {
    if (!activeSession || activeSession.phase !== "active") return;
    void cancelExerciseReminders(activeSession.id);
    storage.finishExercisePhase();
    const updated = storage.getActiveExercise();
    if (updated) setActiveSession(updated);
  };

  const onEndSession = () => {
    if (!activeSession) return;
    void cancelExerciseReminders(activeSession.id);
    storage.endExerciseSession();
    setActiveSession(null);
  };

  // ----- Phase timer -----
  const phaseTimerLabel: string | null = useMemo(() => {
    if (!activeSession) return null;
    if (activeSession.phase === "active" && activeSession.exerciseStartedAt) {
      const t = new Date(activeSession.exerciseStartedAt).getTime();
      if (!Number.isFinite(t)) return null;
      return formatExerciseElapsedShort(now - t);
    }
    if (activeSession.phase === "recovery" && activeSession.exerciseEndedAt) {
      const t = new Date(activeSession.exerciseEndedAt).getTime();
      if (!Number.isFinite(t)) return null;
      return formatExerciseElapsedShort(now - t);
    }
    return null;
  }, [activeSession, now]);

  // ----- Render -----
  if (!activeSession) {
    return (
      <div className="space-y-4 max-sm:space-y-3" data-testid="exercise-guided-coach-start">
        {recentWorkouts.length > 0 ? (
          <Card
            className="overflow-hidden rounded-2xl border-border/50 shadow-sm ring-1 ring-border/40 dark:ring-border/30"
            data-testid="exercise-recent-workouts"
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-h3 flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" aria-hidden />
                Recent workouts
              </CardTitle>
              <CardDescription>
                Restart a completed session — update today&apos;s BG and meal details before you start.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 pt-0">
              {recentWorkouts.map((session) => (
                <div
                  key={session.id}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/60 bg-muted/10 px-3 py-3"
                  data-testid={`exercise-recent-workout-${session.id}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {session.exerciseName?.trim() || session.label}
                    </p>
                    <p className="text-xs text-muted-foreground leading-snug">
                      {format(new Date(session.completedAt), "d MMM")} · {session.label}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-9 shrink-0"
                    onClick={() => onStartFromRepeatable(session)}
                    data-testid={`button-restart-recent-${session.id}`}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" aria-hidden />
                    Restart
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card className="overflow-hidden rounded-2xl border-border/50 shadow-sm ring-1 ring-border/40 dark:ring-border/30">
          <Collapsible open={planWorkoutOpen} onOpenChange={setPlanWorkoutOpen} className="group">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 px-6 py-4 text-left hover:bg-muted/30 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                data-testid="coach-plan-workout-trigger"
                aria-expanded={planWorkoutOpen}
              >
                <div className="min-w-0 space-y-1">
                  <CardTitle className="text-h3 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary shrink-0" />
                    Plan a workout
                  </CardTitle>
                  <CardDescription>
                    {planWorkoutOpen
                      ? closedLoop
                        ? "Guided pre / during / recovery — check IOB and loop settings before you go."
                        : "Start a guided pre / during / recovery session."
                      : `${startDuration || "—"} min · ${startIntensity} · ${startType.replace(/_/g, " ")}`}
                  </CardDescription>
                </div>
                <ChevronDown
                  className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5 transition-transform group-data-[state=open]:rotate-180"
                  aria-hidden
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="start-type">Type</Label>
                <Select value={startType} onValueChange={(v) => setStartType(v as ExerciseType)}>
                  <SelectTrigger id="start-type" data-testid="select-start-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXERCISE_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="start-intensity">Intensity</Label>
                <Select value={startIntensity} onValueChange={(v) => setStartIntensity(v as ExerciseIntensity)}>
                  <SelectTrigger id="start-intensity" data-testid="select-start-intensity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTENSITY_OPTIONS.map((i) => (
                      <SelectItem key={i} value={i}>
                        {i.charAt(0).toUpperCase() + i.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="start-duration">Duration (min)</Label>
                <Input
                  id="start-duration"
                  inputMode="numeric"
                  value={startDuration}
                  onChange={(e) => setStartDuration(e.target.value.replace(/\D/g, ""))}
                  data-testid="input-start-duration"
                />
              </div>
            </div>
            <Button onClick={onStartFromForm} className="w-full" data-testid="button-start-coach">
              <Play className="h-4 w-4 mr-2" />
              Start guided session
            </Button>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {routines.length > 0 ? (
          <Card className="overflow-hidden rounded-2xl border-border/50 shadow-sm ring-1 ring-border/40 dark:ring-border/30">
            <CardHeader>
              <CardTitle className="text-h3 flex items-center gap-2">
                <Dumbbell className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Saved routines
              </CardTitle>
              <CardDescription>Tap to start with the same questions filled in.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {routines.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onStartFromRoutine(r)}
                  className="text-left rounded-xl border border-border bg-card px-3 py-2.5 hover:border-emerald-500/35 hover:bg-emerald-500/[0.06]"
                  data-testid={`button-coach-routine-${r.id}`}
                >
                  <p className="text-sm font-semibold">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.durationMinutes} min · {r.intensity} · {r.exerciseType}
                  </p>
                </button>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    );
  }

  const phase = activeSession.phase;

  return (
    <div className="space-y-4 max-sm:space-y-3" data-testid="exercise-guided-coach">
      <Card className="overflow-hidden rounded-2xl border-border/50 shadow-sm ring-1 ring-border/40 dark:ring-border/30">
        <CardHeader className="pb-2">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-h3 flex items-center gap-2">
                <Dumbbell className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                {activeSession.exerciseName}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/20 px-2 py-0.5">
                    {activeSession.durationMinutes} min
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/20 px-2 py-0.5">
                    {activeSession.intensity}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/20 px-2 py-0.5">
                    {activeSession.exerciseType}
                  </span>
                </div>
              </div>
              <div className="shrink-0">
                {phase === "pre" ? (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={onStartWorkout}
                    className="whitespace-nowrap"
                    data-testid="button-coach-start-workout"
                  >
                    <Play className="h-3.5 w-3.5 mr-1" />
                    Start
                  </Button>
                ) : phase === "active" ? (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={onFinishWorkout}
                    className="whitespace-nowrap"
                    data-testid="button-coach-finish-workout"
                  >
                    <ArrowRight className="h-3.5 w-3.5 mr-1" />
                    Recovery
                  </Button>
                ) : phase === "recovery" ? (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={onEndSession}
                    className="whitespace-nowrap"
                    data-testid="button-coach-finish-session"
                  >
                    <CircleCheck className="h-3.5 w-3.5 mr-1" />
                    Finish
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={phase} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pre" disabled={phase !== "pre"}>
                Pre
              </TabsTrigger>
              <TabsTrigger value="active" disabled={phase !== "active"}>
                During
              </TabsTrigger>
              <TabsTrigger value="recovery" disabled={phase !== "recovery"}>
                Recovery
              </TabsTrigger>
            </TabsList>

            {/* ----- HERO RECOMMENDATION ----- */}
            <div className="pt-3 space-y-3">
              {readiness ? (
                <div
                  className={cn(
                    "rounded-2xl border px-3 py-3 space-y-1.5 bg-background/75",
                    getReadinessToneClasses(readiness.verdict),
                  )}
                  data-testid="coach-readiness-card"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-base font-semibold leading-tight text-foreground">{readiness.title}</p>
                    {phaseTimerLabel ? (
                      <span
                        className="text-xs tabular-nums text-muted-foreground"
                        data-testid="coach-phase-timer"
                        title={phase === "active" ? "Workout elapsed" : "Time since workout ended"}
                      >
                        {phaseTimerLabel}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm leading-snug text-foreground/90">{readiness.detail}</p>
                  {fuelPlanLines.length > 0 ? (
                    <ExerciseFuelPlanSummary
                      lines={fuelPlanLines}
                      variant={fuelPlanVariant}
                      className="mt-2"
                    />
                  ) : null}
                  {historyBias && historyBias.totalSessions >= 2 ? (
                    <p className="text-xs text-muted-foreground pt-1 border-t border-border/40 mt-1">
                      Based on {historyBias.totalSessions} past {activeSession.exerciseType} sessions: BG typically{" "}
                      {historyBias.typicalResponse}{historyBias.hypoProne ? ", and hypos have been common" : ""}.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {phase === "active" && activeSession.exerciseStartedAt ? (
                <ExerciseWorkoutProgressBar
                  phase={phase}
                  exerciseStartedAt={activeSession.exerciseStartedAt}
                  durationMinutes={activeSession.durationMinutes}
                  nowMs={now}
                />
              ) : null}

              {hypoCoachSuggestion ? <ExerciseHypoTreatmentHint suggestion={hypoCoachSuggestion} /> : null}

              {isPump && phasePumpTips.length > 0 ? (
                <ExercisePumpTipsCard
                  tips={phasePumpTips}
                  data-testid={`coach-pump-tips-${phase}`}
                />
              ) : null}

              {closedLoop && phase === "pre" && closedLoopExercisePrePrompt(true) ? (
                <p className="text-xs text-muted-foreground leading-relaxed" data-testid="coach-closed-loop-pre-prompt">
                  {closedLoopExercisePrePrompt(true)}
                </p>
              ) : null}
            </div>

            <TabsContent value="pre" className="space-y-4 pt-2">
              <div
                className={cn(
                  "rounded-2xl border border-border/60 bg-background/55 px-3 py-3 backdrop-blur space-y-4",
                  readiness ? getReadinessToneClasses(readiness.verdict) : null,
                )}
                data-testid="coach-input-panel-pre"
              >
                <PreQuestions
                  session={activeSession}
                  bgUnits={bgUnits}
                  bgInput={bgInput}
                  onBgChange={onBgChange}
                  onTrendChange={onTrendChange}
                  update={update}
                />
              </div>
            </TabsContent>

            <TabsContent value="active" className="space-y-4 pt-2">
              <div
                className={cn(
                  "rounded-2xl border border-border/60 bg-background/55 px-3 py-3 backdrop-blur space-y-4",
                  readiness ? getReadinessToneClasses(readiness.verdict) : null,
                )}
                data-testid="coach-input-panel-active"
              >
                <DuringQuestions
                  session={activeSession}
                  bgUnits={bgUnits}
                  bgInput={bgInput}
                  onBgChange={onBgChange}
                  onTrendChange={onTrendChange}
                  update={update}
                />
              </div>
            </TabsContent>

            <TabsContent value="recovery" className="space-y-4 pt-2">
              <div
                className={cn(
                  "rounded-2xl border border-border/60 bg-background/55 px-3 py-3 backdrop-blur space-y-4",
                  readiness ? getReadinessToneClasses(readiness.verdict) : null,
                )}
                data-testid="coach-input-panel-recovery"
              >
                <RecoveryQuestions
                  session={activeSession}
                  bgUnits={bgUnits}
                  bgInput={bgInput}
                  onBgChange={onBgChange}
                  onTrendChange={onTrendChange}
                  update={update}
                />
                {exercisePlan ? (
                  <p className="text-xs text-muted-foreground leading-snug">
                    Recovery window (~{exercisePlan.recovery.monitorHours}): delayed lows still happen — keep snacks and your hypo plan close.
                  </p>
                ) : null}
                {(activeSession.intensity === "intense" || activeSession.intensity === "moderate") ? (
                  <Link href="/scenarios/bedtime">
                    <Button variant="outline" size="sm" className="w-full" data-testid="button-coach-recovery-bedtime">
                      <Moon className="h-3.5 w-3.5 mr-2" />
                      Open Bedtime tool
                      <ArrowRight className="h-3.5 w-3.5 ml-auto" />
                    </Button>
                  </Link>
                ) : null}
              </div>
            </TabsContent>
          </Tabs>


          {phase === "recovery" && exercisePlan ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  Recovery notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {exercisePlan.recovery.tips.slice(0, 5).map((tip, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
                {isPump && exercisePlan.pumpTips.recovery.length > 0 ? (
                  <div className="pt-3 mt-3 border-t border-border/40">
                    <ExercisePumpTipsCard
                      tips={exercisePlan.pumpTips.recovery}
                      data-testid="coach-pump-tips-recovery-notes"
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

// ----- Sub-components -----

type PhaseProps = {
  session: ActiveExerciseSession;
  bgUnits: "mmol/L" | "mg/dL";
  bgInput: string;
  onBgChange: (v: string) => void;
  onTrendChange: (t: ExerciseBgTrend) => void;
  update: (updates: Parameters<typeof storage.updateActiveExercise>[0]) => void;
};

function BgAndTrendRow({
  bgUnits,
  bgInput,
  session,
  onBgChange,
  onTrendChange,
  inputRef,
}: Omit<PhaseProps, "update"> & { inputRef?: React.RefObject<HTMLInputElement | null> }) {
  const trend =
    session.phase === "pre"
      ? session.preTrend
      : session.phase === "active"
        ? session.midTrend
        : session.recoveryTrend;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">BG now</Label>
        <Label className="text-xs text-muted-foreground">Trend</Label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          ref={inputRef as any}
          inputMode="decimal"
          value={bgInput}
          onChange={(e) => onBgChange(e.target.value)}
          placeholder={bgUnits === "mmol/L" ? "e.g. 7.2" : "e.g. 130"}
          className="h-9 min-w-[10rem] flex-1"
          data-testid="input-coach-bg"
        />
        <div className="flex flex-wrap gap-2">
          {(["flat", "rising", "falling"] as const).map((t) => (
            <Button
              key={t}
              type="button"
              size="sm"
              variant={trend === t ? "default" : "outline"}
              className="h-7 px-2 text-xs"
              onClick={() => onTrendChange(trend === t ? ("not_sure" as ExerciseBgTrend) : t)}
              data-testid={`button-coach-trend-${t}`}
            >
              {t === "rising" ? <TrendingUp className="h-3.5 w-3.5 mr-1" /> : t === "falling" ? <TrendingDown className="h-3.5 w-3.5 mr-1" /> : null}
              {t}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PreQuestions({ session, bgUnits, bgInput, onBgChange, onTrendChange, update }: PhaseProps) {
  const sleepPresets = [4, 6, 8, 10] as const;
  const sleepIsPreset = session.preSleepHours != null && sleepPresets.includes(session.preSleepHours as (typeof sleepPresets)[number]);
  const mealPresets = [0, 30, 60, 120] as const;
  const mealIsPreset =
    session.prefuelMinutesAgo != null && mealPresets.includes(session.prefuelMinutesAgo as (typeof mealPresets)[number]);

  return (
    <div className="space-y-4">
      <BgAndTrendRow
        session={session}
        bgUnits={bgUnits}
        bgInput={bgInput}
        onBgChange={onBgChange}
        onTrendChange={onTrendChange}
      />

      <FieldRow icon={Pill} label="Rapid-acting insulin in last 2h?">
        <YesNoToggle
          value={session.preRapidInsulin2h ?? null}
          onChange={(v) => {
            const patch: Parameters<typeof update>[0] = {
              preRapidInsulin2h: v === null ? undefined : v,
            };
            if (v === "no") {
              patch.preChecklist = { ...session.preChecklist, basalAdjusted: true };
            }
            update(patch);
          }}
        />
      </FieldRow>

      <DeeperContextSection title="Personal context" icon={Sparkles}>
        <Field label="Sleep last night">
          <div className="flex flex-wrap items-center gap-2">
            {sleepPresets.map((h) => (
              <Button
                key={h}
                type="button"
                size="sm"
                variant={session.preSleepHours === h ? "default" : "outline"}
                className="h-8 px-2.5 text-xs"
                onClick={() => update({ preSleepHours: session.preSleepHours === h ? undefined : h })}
                data-testid={`button-coach-sleep-${h}`}
              >
                {h}h
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              variant={session.preSleepHours != null && !sleepIsPreset ? "default" : "outline"}
              className="h-8 px-2.5 text-xs"
              onClick={() => {
                if (session.preSleepHours != null && !sleepIsPreset) {
                  update({ preSleepHours: undefined });
                } else {
                  update({ preSleepHours: 7 });
                }
              }}
              data-testid="button-coach-sleep-custom"
            >
              Custom
            </Button>
          </div>
          {session.preSleepHours != null && !sleepIsPreset ? (
            <div className="pt-2">
              <Input
                inputMode="numeric"
                value={String(session.preSleepHours)}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  update({ preSleepHours: Number.isFinite(n) ? Math.min(16, Math.max(0, n)) : undefined });
                }}
                className="h-9"
                data-testid="input-coach-sleep"
              />
            </div>
          ) : null}
        </Field>
        <ToggleField
          label="Training fasted"
          checked={!!session.preFasted}
          onChange={(v) => update({ preFasted: v })}
          testId="toggle-coach-fasted"
        />
        <Field label="Last meal">
          <div className="flex flex-wrap items-center gap-2">
            {mealPresets.map((m) => (
              <Button
                key={m}
                type="button"
                size="sm"
                variant={session.prefuelMinutesAgo === m ? "default" : "outline"}
                className="h-8 px-2.5 text-xs"
                onClick={() => update({ prefuelMinutesAgo: session.prefuelMinutesAgo === m ? undefined : m })}
                disabled={!!session.preFasted}
                data-testid={`button-coach-lastmeal-${m}`}
              >
                {m === 0 ? "0m" : m === 120 ? "120m+" : `${m}m`}
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              variant={session.prefuelMinutesAgo != null && !mealIsPreset ? "default" : "outline"}
              className="h-8 px-2.5 text-xs"
              onClick={() => {
                if (session.prefuelMinutesAgo != null && !mealIsPreset) {
                  update({ prefuelMinutesAgo: undefined });
                } else {
                  update({ prefuelMinutesAgo: 90 });
                }
              }}
              disabled={!!session.preFasted}
              data-testid="button-coach-lastmeal-custom"
            >
              Custom
            </Button>
          </div>
          {session.prefuelMinutesAgo != null && !mealIsPreset ? (
            <div className="pt-2">
              <Input
                inputMode="numeric"
                value={String(session.prefuelMinutesAgo)}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  update({ prefuelMinutesAgo: Number.isFinite(n) ? Math.min(720, Math.max(0, n)) : undefined });
                }}
                className="h-9"
                disabled={!!session.preFasted}
                data-testid="input-coach-prefuel-min"
              />
            </div>
          ) : null}
          {session.preFasted ? <p className="text-xs text-muted-foreground pt-2">Fasted selected — last meal not needed.</p> : null}
        </Field>
        <Field label="Approx carbs in last meal (g)">
          <Input
            inputMode="numeric"
            value={session.prefuelGrams != null ? String(session.prefuelGrams) : ""}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              update({ prefuelGrams: Number.isFinite(n) ? Math.min(300, Math.max(0, n)) : undefined });
            }}
            className="h-9"
            disabled={!!session.preFasted}
            data-testid="input-coach-prefuel-carbs"
          />
        </Field>
        <Field label="Hydration">
          <div className="flex gap-2">
            {(["ok", "low"] as const).map((v) => (
              <Button
                key={v}
                type="button"
                size="sm"
                variant={session.preHydration === v ? "default" : "outline"}
                onClick={() => update({ preHydration: session.preHydration === v ? undefined : v })}
                className="h-8 px-3 text-xs"
                data-testid={`button-coach-hydration-${v}`}
              >
                {v === "ok" ? "Hydrated" : "Low"}
              </Button>
            ))}
          </div>
        </Field>
        <ToggleField
          label="Feeling off / stressed"
          checked={!!session.preFeelingOff}
          onChange={(v) => update({ preFeelingOff: v })}
          testId="toggle-coach-feeling-off"
        />
      </DeeperContextSection>

      <DeeperContextSection title="Environment & timing" icon={MapPin}>
        <Field label="Where">
          <div className="flex flex-wrap gap-2">
            {ENVIRONMENT_OPTIONS.map((o) => {
              const Icon = o.icon;
              const selected = session.preEnvironments?.includes(o.value) ?? false;
              return (
                <Button
                  key={o.value}
                  type="button"
                  size="sm"
                  variant={selected ? "default" : "outline"}
                  className="h-8 px-2.5 text-xs"
                  onClick={() =>
                    update({ preEnvironments: toggleExerciseEnvironmentSelection(session.preEnvironments, o.value) })
                  }
                  data-testid={`button-coach-env-${o.value}`}
                >
                  <Icon className="h-3.5 w-3.5 mr-1" />
                  {o.label}
                </Button>
              );
            })}
          </div>
        </Field>
        <ToggleField
          label="Group / competitive session"
          checked={!!session.preCompetitive}
          onChange={(v) => update({ preCompetitive: v })}
          testId="toggle-coach-competitive"
        />
      </DeeperContextSection>

      <DeeperContextSection title="Medication context" icon={Pill}>
        <ToggleField
          label="Caffeine in the last 2h"
          checked={!!session.preCaffeine2h}
          onChange={(v) => update({ preCaffeine2h: v })}
          testId="toggle-coach-caffeine"
          icon={Coffee}
        />
        <ToggleField
          label="Alcohol last night"
          checked={!!session.preAlcoholLastNight}
          onChange={(v) => update({ preAlcoholLastNight: v })}
          testId="toggle-coach-alcohol-last-night"
        />
        <Field label="Insulin on board (units, optional)">
          <Input
            inputMode="decimal"
            value={session.preIobUnits != null ? String(session.preIobUnits) : ""}
            onChange={(e) => {
              const n = parseFloat(e.target.value.replace(",", "."));
              update({ preIobUnits: Number.isFinite(n) && n >= 0 ? Math.min(50, n) : undefined });
            }}
            className="h-9"
            data-testid="input-coach-iob"
          />
        </Field>
      </DeeperContextSection>
    </div>
  );
}

function DuringQuestions({ session, bgUnits, bgInput, onBgChange, onTrendChange, update }: PhaseProps) {
  const bgRef = useRef<HTMLInputElement | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [hypoRecheckEndsAt, setHypoRecheckEndsAt] = useState<number | null>(null);
  const [customCarbsOpen, setCustomCarbsOpen] = useState(false);
  const [customCarbs, setCustomCarbs] = useState("");

  useEffect(() => {
    if (hypoRecheckEndsAt == null) return;
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [hypoRecheckEndsAt]);

  useEffect(() => {
    // Reset in-panel timers when session id changes
    setHypoRecheckEndsAt(null);
    setCustomCarbsOpen(false);
    setCustomCarbs("");
  }, [session.id]);

  const carbsSoFar = session.midCarbsGramsSoFar ?? 0;
  const last = storage.getLastExerciseSummary?.();
  const lastCarbs = last?.context?.midCarbsGramsTotal;
  const lastIsSimilar =
    !!last &&
    last.exerciseType === session.exerciseType &&
    last.intensity === session.intensity &&
    Math.abs(last.durationMinutes - session.durationMinutes) <= 15;
  const trend =
    session.phase === "active"
      ? (session.midTrend ?? session.preTrend ?? "not_sure")
      : ("not_sure" as const);
  const symptomSelected = (session.midSymptoms ?? []).filter((s) => s !== "fine");
  const hasSymptoms = symptomSelected.length > 0;
  const severity = session.midSymptomSeverity ?? "moderate";
  const addCarbs = (g: number) => {
    const next = Math.min(400, Math.max(0, carbsSoFar + g));
    update({ midCarbsGramsSoFar: next });
  };

  const startHypoRecheckTimer = () => {
    setHypoRecheckEndsAt(Date.now() + 15 * 60_000);
  };

  const bgNow = parseFloatOrNull(bgInput);
  const isLowish = bgNow != null ? (bgUnits === "mmol/L" ? bgNow < 5.6 : bgNow < 100) : null;
  const isVeryLow = bgNow != null ? (bgUnits === "mmol/L" ? bgNow < 4.0 : bgNow < 72) : null;
  const trendDown = trend === "falling";
  const recommendTreatNow = isVeryLow === true || (isLowish === true && trendDown) || (severity === "severe" && trendDown);
  const recommendPauseAndCheckNow = severity !== "mild" || trendDown;

  const hypoRemainingSec = hypoRecheckEndsAt != null ? Math.max(0, Math.floor((hypoRecheckEndsAt - nowMs) / 1000)) : null;
  const hypoRemainingLabel =
    hypoRemainingSec == null ? null : `${Math.floor(hypoRemainingSec / 60)}:${String(hypoRemainingSec % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      {hypoRecheckEndsAt != null ? (
        <div
          className="rounded-xl border border-amber-300/70 bg-amber-50/50 dark:border-amber-800/50 dark:bg-amber-950/20 px-3 py-2.5 text-sm"
          data-testid="panel-coach-hypo-recheck"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-amber-900 dark:text-amber-100">Treat & re-check</p>
            <span className="text-xs tabular-nums text-amber-900/80 dark:text-amber-100/80">
              {hypoRemainingLabel}
            </span>
          </div>
          <p className="text-xs text-amber-900/80 dark:text-amber-100/80 leading-snug pt-1">
            If your plan uses it: take fast carbs now, then re-check when the timer ends.
          </p>
          <div className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs"
              onClick={() => setHypoRecheckEndsAt(null)}
              data-testid="button-coach-hypo-clear"
            >
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      <BgAndTrendRow
        session={session}
        bgUnits={bgUnits}
        bgInput={bgInput}
        onBgChange={onBgChange}
        onTrendChange={onTrendChange}
        inputRef={bgRef}
      />

      <div className="rounded-xl border border-border/50 bg-muted/15 px-3 py-3 space-y-2.5" data-testid="panel-coach-carbs">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">Log carbs taken</p>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold tabular-nums text-muted-foreground" data-testid="text-coach-carbs-total">
              {carbsSoFar > 0 ? `${carbsSoFar}g logged` : "None yet"}
            </p>
            {carbsSoFar > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => update({ midCarbsGramsSoFar: 0 })}
                data-testid="button-coach-carbs-reset"
              >
                Reset
              </Button>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[15, 25].map((g) => (
            <Button
              key={g}
              type="button"
              size="sm"
              variant={g === 15 ? "default" : "secondary"}
              className="h-9 px-3 text-xs"
              onClick={() => addCarbs(g)}
              data-testid={g === 15 ? "button-coach-quick-addcarbs-15" : `button-coach-addcarbs-${g}`}
            >
              +{g}g
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant={customCarbsOpen ? "default" : "outline"}
            className="h-9 px-3 text-xs"
            onClick={() => setCustomCarbsOpen((v) => !v)}
            data-testid="button-coach-addcarbs-custom"
          >
            Custom
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 px-3 text-xs"
            onClick={startHypoRecheckTimer}
            data-testid="button-coach-feel-low"
          >
            I feel low
          </Button>
        </div>
        {customCarbsOpen ? (
          <div className="flex items-center gap-2">
            <Input
              inputMode="numeric"
              value={customCarbs}
              onChange={(e) => setCustomCarbs(e.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 12"
              className="h-9"
              data-testid="input-coach-addcarbs-custom"
            />
            <Button
              type="button"
              size="sm"
              className="h-9"
              onClick={() => {
                const n = parseInt(customCarbs, 10);
                if (Number.isFinite(n) && n > 0) addCarbs(n);
                setCustomCarbs("");
                setCustomCarbsOpen(false);
              }}
              data-testid="button-coach-addcarbs-apply"
            >
              Add
            </Button>
          </div>
        ) : null}
        {lastIsSimilar && typeof lastCarbs === "number" && Number.isFinite(lastCarbs) && lastCarbs > 0 && carbsSoFar === 0 ? (
          <p className="text-xs text-muted-foreground">
            Last similar session: {Math.round(lastCarbs)}g —{" "}
            <button
              type="button"
              className="font-medium text-foreground underline-offset-2 hover:underline"
              onClick={() => update({ midCarbsGramsSoFar: Math.max(0, Math.min(400, Math.round(lastCarbs))) })}
              data-testid="button-coach-carbs-use-last"
            >
              use that
            </button>
          </p>
        ) : null}
      </div>

      <Field label="How hard does it feel?">
        <div className="grid grid-cols-4 rounded-xl border border-border/60 overflow-hidden">
          {(
            [
              { id: "easy", label: "Easy", value: 3 },
              { id: "moderate", label: "Moderate", value: 5 },
              { id: "hard", label: "Hard", value: 7 },
              { id: "max", label: "Max", value: 9 },
            ] as const
          ).map((o) => (
            <Button
              key={o.id}
              type="button"
              size="sm"
              variant={session.midRpe === o.value ? "default" : "ghost"}
              className={cn(
                "h-9 rounded-none px-2 text-xs",
                o.id !== "max" ? "border-r border-border/60" : null,
              )}
              onClick={() => update({ midRpe: session.midRpe === o.value ? undefined : o.value })}
              data-testid={`button-coach-rpe-${o.id}`}
            >
              {o.label}
            </Button>
          ))}
        </div>
      </Field>

      <Field label="Symptoms">
        <div className="flex flex-wrap gap-2">
          {SYMPTOM_OPTIONS.map((o) => {
            const selected = session.midSymptoms?.includes(o.value) ?? false;
            return (
              <Button
                key={o.value}
                type="button"
                size="sm"
                variant={selected ? "default" : "outline"}
                className="h-8 px-2.5 text-xs"
                onClick={() => {
                  const current = new Set(session.midSymptoms ?? []);
                  if (o.value === "fine") {
                    if (selected) current.delete("fine");
                    else {
                      current.clear();
                      current.add("fine");
                    }
                  } else {
                    current.delete("fine");
                    if (selected) current.delete(o.value);
                    else current.add(o.value);
                  }
                  const next = current.size === 0 ? undefined : (Array.from(current) as ExerciseSymptomFlag[]);
                  update({
                    midSymptoms: next,
                    midSymptomSeverity: next && next.some((s) => s !== "fine") ? (session.midSymptomSeverity ?? "moderate") : undefined,
                  });
                }}
                data-testid={`button-coach-symptom-${o.value}`}
              >
                {o.label}
              </Button>
            );
          })}
        </div>
      </Field>

      {hasSymptoms ? (
        <div
          className="rounded-xl border border-amber-300/70 bg-amber-50/45 dark:border-amber-800/50 dark:bg-amber-950/20 px-2.5 py-2.5 space-y-2"
          data-testid="panel-coach-symptoms-action"
        >
          <div className="space-y-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Hypo symptoms</p>
              <p className="text-[11px] text-amber-900/80 dark:text-amber-100/80 leading-snug">
                {symptomSelected.slice(0, 3).join(", ")}
                {symptomSelected.length > 3 ? ` +${symptomSelected.length - 3} more` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(["mild", "moderate", "severe"] as const).map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant={severity === s ? "default" : "outline"}
                  className="h-7 px-2 text-[11px] rounded-full"
                  onClick={() => update({ midSymptomSeverity: s })}
                  data-testid={`button-coach-symptom-severity-${s}`}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-amber-900/85 dark:text-amber-100/85 leading-snug">
            {recommendTreatNow ? (
              <p>
                <span className="font-medium">Do now:</span> treat with fast carbs, then re-check in 15 min.
              </p>
            ) : recommendPauseAndCheckNow ? (
              <p>
                <span className="font-medium">Do now:</span> pause + check BG. Treat if low or falling.
              </p>
            ) : (
              <p>
                <span className="font-medium">Do now:</span> slow down, keep carbs within reach, re-check if it persists.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 px-3 text-xs flex-1"
              onClick={() => {
                addCarbs(15);
                startHypoRecheckTimer();
              }}
              data-testid="button-coach-symptom-treat-15"
            >
              +15g & start timer
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs"
              onClick={startHypoRecheckTimer}
              data-testid="button-coach-symptom-start-timer"
            >
              15‑min timer
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs"
              onClick={() => update({ midSymptoms: undefined, midSymptomSeverity: undefined })}
              data-testid="button-coach-symptom-clear"
            >
              Clear
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RecoveryQuestions({ session, bgUnits, bgInput, onBgChange, onTrendChange, update }: PhaseProps) {
  return (
    <div className="space-y-4">
      <BgAndTrendRow
        session={session}
        bgUnits={bgUnits}
        bgInput={bgInput}
        onBgChange={onBgChange}
        onTrendChange={onTrendChange}
      />

      <Field label="Carbs eaten since stopping (g)">
        <Input
          inputMode="numeric"
          value={session.recoveryCarbsGrams != null ? String(session.recoveryCarbsGrams) : ""}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            update({ recoveryCarbsGrams: Number.isFinite(n) ? Math.min(300, Math.max(0, n)) : undefined });
          }}
          className="h-9"
          data-testid="input-coach-recovery-carbs"
        />
      </Field>

      <Field label="Bolus given for recovery food (units)">
        <Input
          inputMode="decimal"
          value={session.recoveryBolusUnits != null ? String(session.recoveryBolusUnits) : ""}
          onChange={(e) => {
            const n = parseFloat(e.target.value.replace(",", "."));
            update({ recoveryBolusUnits: Number.isFinite(n) && n >= 0 ? Math.min(50, n) : undefined });
          }}
          className="h-9"
          data-testid="input-coach-recovery-bolus"
        />
      </Field>

      <Field label="Bedtime in (hours)">
        <Input
          inputMode="decimal"
          value={session.bedtimeInHours != null ? String(session.bedtimeInHours) : ""}
          onChange={(e) => {
            const n = parseFloat(e.target.value.replace(",", "."));
            update({ bedtimeInHours: Number.isFinite(n) && n >= 0 ? Math.min(24, n) : undefined });
          }}
          className="h-9"
          data-testid="input-coach-bedtime-hours"
        />
      </Field>

      <ToggleField
        label="Alcohol planned tonight"
        checked={!!session.alcoholTonight}
        onChange={(v) => update({ alcoholTonight: v })}
        testId="toggle-coach-alcohol-tonight"
      />
    </div>
  );
}

// ----- Tiny presentational helpers -----

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function FieldRow({ icon: Icon, label, children }: { icon: typeof Sparkles; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </Label>
      {children}
    </div>
  );
}

function YesNoToggle({
  value,
  onChange,
}: {
  value: PreRapidInsulin2h | null;
  onChange: (v: PreRapidInsulin2h | null) => void;
}) {
  return (
    <div className="flex gap-2">
      {(["yes", "no"] as const).map((v) => (
        <Button
          key={v}
          type="button"
          size="sm"
          variant={value === v ? "default" : "outline"}
          className="h-8 px-3 text-xs"
          onClick={() => onChange(value === v ? null : v)}
          data-testid={`button-coach-rapid-${v}`}
        >
          {v === "yes" ? "Yes" : "No"}
        </Button>
      ))}
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
  testId,
  icon: Icon,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  testId: string;
  icon?: typeof Sparkles;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
      <span className="text-sm flex items-center gap-2">
        {Icon ? <Icon className="h-3.5 w-3.5 text-muted-foreground" /> : null}
        {label}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} data-testid={testId} />
    </div>
  );
}

function DeeperContextSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Sparkles;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLButtonElement | null>(null);
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        ref={headerRef}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
        data-testid={`button-coach-section-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`}
      >
        <span className="text-sm font-medium flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </span>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "Add"}</span>
      </button>
      {open ? (
        <div className="px-3 pb-3 space-y-2 border-t border-border/40 pt-3">
          {children}
          <div className="pt-1 flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs"
              onClick={() => {
                setOpen(false);
                headerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
              }}
              data-testid={`button-coach-section-close-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`}
            >
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
