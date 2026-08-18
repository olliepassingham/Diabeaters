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
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleCheck,
  CircleHelp,
  Coffee,
  Dumbbell,
  Flower2,
  Footprints,
  Maximize2,
  Moon,
  Pause,
  Pill,
  Play,
  History,
  RotateCcw,
  Snowflake,
  Sparkles,
  Sun,
  Swords,
  Thermometer,
  Waves,
  Wind,
  Wine,
  X,
  Zap,
} from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  ExerciseRoutineAdjustSheet,
  ExerciseRoutineAdjustTrigger,
  type ExerciseRoutineAdjustValues,
} from "@/components/exercise-routine-adjust-sheet";
import {
  storage,
  DIABEATER_EXERCISE_OUTCOMES_CHANGED_EVENT,
  DIABEATER_PROFILE_CHANGED_EVENT,
  DIABEATER_SETTINGS_CHANGED_EVENT,
  type ActiveExerciseSession,
  type ExerciseBgTrend,
  type ExerciseEnvironmentChoice,
  type ExerciseIntensity,
  type ExercisePhase,
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
  type ExerciseReadinessResult,
} from "@/lib/exercise-readiness";
import { reconcileExerciseFuelLines } from "@/lib/exercise-recommendation";
import { useExerciseSessionActions } from "@/hooks/use-exercise-session-actions";
import { requestOpenExerciseMode } from "@/lib/exercise-mode-deep-link";
import { computeExerciseHypoSuggestion, resolveExerciseBgForHypo } from "@/lib/exercise-hypo-auto";
import { format } from "date-fns";
import {
  ExerciseFuelPlanSummary,
  ExerciseHypoTreatmentHint,
  ExerciseWorkoutProgressBar,
  formatExerciseElapsedShort,
} from "@/components/exercise-active-session-extras";
import { getWorkoutElapsedMs, isExercisePaused } from "@/lib/exercise-session-timing";
import { ExerciseCgmBgField } from "@/components/exercise-cgm-bg-field";
import { useExerciseCgmBg } from "@/hooks/use-exercise-cgm-bg";
import type { BgPrefillResult } from "@/lib/cgm/prefill";
// Shared with the exercise routines page and elsewhere so every exercise type has exactly one
// label app-wide (e.g. always "Yoga / Pilates", never just "Yoga" on one screen and not another).
import { EXERCISE_TYPE_OPTIONS } from "@/lib/exercise-catalog";

/** Per-activity icon so the session header reads at a glance instead of always showing the same dumbbell. */
const EXERCISE_TYPE_ICONS: Record<ExerciseType, typeof Dumbbell> = {
  cardio: Activity,
  strength: Dumbbell,
  hiit: Zap,
  yoga: Flower2,
  walking: Footprints,
  court: Swords,
  field: Swords,
  swimming: Waves,
};

function ExerciseTypeIcon({ type, className }: { type: ExerciseType; className?: string }) {
  const Icon = EXERCISE_TYPE_ICONS[type] ?? Dumbbell;
  return <Icon className={className} aria-hidden />;
}

/**
 * Duration/intensity/type summary line — drops the type label when it just repeats the
 * exercise name (the common case for sessions started from the quick-start form, e.g. name
 * "Cardio" + type "cardio"), so the header doesn't say "Cardio" twice back to back.
 */
function sessionMetaLine(session: ActiveExerciseSession): string {
  const typeLabel = EXERCISE_TYPE_OPTIONS.find((o) => o.value === session.exerciseType)?.label ?? session.exerciseType;
  const nameMatchesType = session.exerciseName.trim().toLowerCase() === typeLabel.toLowerCase();
  const intensity =
    session.intensity.length > 0
      ? session.intensity.charAt(0).toUpperCase() + session.intensity.slice(1)
      : session.intensity;
  return nameMatchesType
    ? `${session.durationMinutes} min · ${intensity}`
    : `${session.durationMinutes} min · ${intensity} · ${typeLabel}`;
}

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

// Labels intentionally short (compact stepper pill) but share their leading word with the
// status strip's phase names ("Before you start" / "During" / "Recovery") so the same phase
// doesn't read as two different names depending on which surface the user is looking at.
const PHASE_STEPS: Array<{ id: ExercisePhase; label: string }> = [
  { id: "pre", label: "Before" },
  { id: "active", label: "During" },
  { id: "recovery", label: "Recovery" },
];

/** Live progress indicator — replaces a row of always-disabled tabs with a clearer at-a-glance stepper. */
function ExercisePhaseStepper({
  phase,
  variant = "default",
}: {
  phase: ExercisePhase;
  variant?: "default" | "immersive";
}) {
  const currentIndex = PHASE_STEPS.findIndex((s) => s.id === phase);
  const immersive = variant === "immersive";
  return (
    <div className="flex items-center gap-1.5" data-testid="coach-phase-stepper" aria-hidden>
      {PHASE_STEPS.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={step.id} className="flex flex-1 items-center gap-1.5">
            <div
              className={cn(
                "flex h-7 min-w-0 flex-1 items-center justify-center gap-1 rounded-full text-[11px] font-medium transition-colors",
                immersive
                  ? active
                    ? "bg-emerald-400/20 text-emerald-100 ring-1 ring-emerald-400/35"
                    : done
                      ? "bg-white/8 text-white/55"
                      : "bg-white/[0.04] text-white/30"
                  : active
                    ? "bg-emerald-500/15 text-emerald-800 ring-1 ring-emerald-500/40 dark:text-emerald-200"
                    : done
                      ? "bg-muted/50 text-muted-foreground"
                      : "bg-muted/25 text-muted-foreground/60",
              )}
            >
              {done ? <Check className="h-3 w-3 shrink-0" /> : null}
              <span className="truncate">{step.label}</span>
            </div>
            {i < PHASE_STEPS.length - 1 ? (
              <div
                className={cn(
                  "h-px w-2 shrink-0 rounded-full",
                  immersive ? (done ? "bg-emerald-400/40" : "bg-white/15") : done ? "bg-emerald-500/40" : "bg-border",
                )}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Verdict → icon + colour chip for the hero. Awaiting-input renders as a neutral "?" prompt
 * rather than the amber caution look, since no BG has been entered yet — a warning colour
 * before the user has typed anything reads as a false alarm rather than guidance.
 */
function getVerdictVisuals(readiness: ExerciseReadinessResult | null): {
  icon: typeof CheckCircle2;
  chipClass: string;
  cardClass: string;
  immersiveChipClass: string;
  immersiveTitleClass: string;
} {
  if (!readiness || readiness.awaitingInput) {
    return {
      icon: CircleHelp,
      chipClass: "bg-muted text-muted-foreground",
      cardClass: "border-border/50 bg-muted/25 dark:bg-muted/10",
      immersiveChipClass: "bg-white/10 text-white/60",
      immersiveTitleClass: "text-white/70",
    };
  }
  if (readiness.verdict === "ready") {
    return {
      icon: CheckCircle2,
      chipClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
      cardClass: "border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-800/50 dark:bg-emerald-950/25",
      immersiveChipClass: "bg-emerald-400/20 text-emerald-200",
      immersiveTitleClass: "text-emerald-100",
    };
  }
  if (readiness.verdict === "not_recommended") {
    return {
      icon: AlertOctagon,
      chipClass: "bg-red-500/15 text-red-700 dark:text-red-300",
      cardClass: "border-red-200/80 bg-red-50/60 dark:border-red-800/50 dark:bg-red-950/25",
      immersiveChipClass: "bg-red-400/20 text-red-200",
      immersiveTitleClass: "text-red-100",
    };
  }
  return {
    icon: AlertTriangle,
    chipClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    cardClass: "border-amber-200/80 bg-amber-50/60 dark:border-amber-800/50 dark:bg-amber-950/25",
    immersiveChipClass: "bg-amber-400/20 text-amber-200",
    immersiveTitleClass: "text-amber-100",
  };
}

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
  const [adjustRoutine, setAdjustRoutine] = useState<ExerciseRoutine | null>(null);
  const [adjustRecent, setAdjustRecent] = useState<RecentRepeatableExerciseSession | null>(null);
  const appliedDefaultsForSessionId = useRef<string | null>(null);

  // Quick start form (only relevant when no active session exists)
  const [planWorkoutOpen, setPlanWorkoutOpen] = useState(true);
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

  // The elapsed-time display only needs per-second granularity while a workout is actively
  // running (and the full-screen Exercise Mode overlay is the primary "during" surface anyway).
  // Pre/recovery — or no session at all — refresh far less often, so this page doesn't force a
  // full plan/readiness recompute every second for phases where nothing is time-sensitive.
  useEffect(() => {
    const intervalMs = activeSession?.phase === "active" ? 1000 : 15_000;
    const tick = window.setInterval(() => {
      setActiveSession(storage.getActiveExercise());
      setNow(Date.now());
    }, intervalMs);
    return () => window.clearInterval(tick);
  }, [activeSession?.phase]);

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

  const recoveryEveningContext = isExerciseRecoveryEveningContext(new Date(now));
  const recoveryBedtimeCtaInfo = useMemo(
    () =>
      activeSession && recoveryEveningContext ? recoveryBedtimeCta(activeSession) : null,
    [activeSession, recoveryEveningContext],
  );

  const phasePumpTips = useMemo(() => {
    if (!exercisePlan || !isPump || !activeSession) return [];
    if (activeSession.phase === "pre") return pumpTipsForPhase(exercisePlan.pumpTips, "pre");
    if (activeSession.phase === "active") return pumpTipsForPhase(exercisePlan.pumpTips, "during");
    return pumpTipsForPhase(exercisePlan.pumpTips, "recovery");
  }, [exercisePlan, isPump, activeSession]);

  const readiness: ExerciseReadinessResult | null = useMemo(() => {
    if (!activeSession || !exercisePlan) return null;
    const sc = storage.getScenarioState();
    const activeSymptomSeverity =
      activeSession.phase === "active" && (activeSession.midSymptoms ?? []).some((s) => s !== "fine")
        ? activeSession.midSymptomSeverity ?? "moderate"
        : null;
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
      environments: activeSession.preEnvironments ?? null,
      fasted: activeSession.preFasted,
      hydration: activeSession.preHydration ?? null,
      caffeineLast2h: activeSession.preCaffeine2h,
      glp1Last24h: activeSession.preGlp1Last24h,
      betaBlockerToday: activeSession.preBetaBlockerToday,
      competitive: activeSession.preCompetitive,
      symptomSeverity: activeSymptomSeverity,
    });
  }, [activeSession, bgInput, bgUnits, exercisePlan, historyBias, trendForReadiness]);

  const hypoCoachSuggestion = useMemo(() => {
    if (!activeSession) return null;
    const bg = resolveExerciseBgForHypo(activeSession, bgInput);
    if (bg == null) return null;
    const settings = storage.getSettings();
    const lowThreshold = exercisePlan ? parseFloat(exercisePlan.pre.lowThreshold) : undefined;
    const symptomSeverity =
      activeSession.phase === "active" &&
      (activeSession.midSymptoms ?? []).some((s) => s !== "fine")
        ? activeSession.midSymptomSeverity
        : undefined;
    return computeExerciseHypoSuggestion(bg, settings, bgUnits, profile, {
      trend: trendForReadiness,
      phase: activeSession.phase,
      exerciseLowThreshold: Number.isFinite(lowThreshold) ? lowThreshold : undefined,
      carbsIfLow: exercisePlan?.pre.carbsIfLow,
      symptomSeverity,
    });
  }, [activeSession, bgInput, bgUnits, profile.dateOfBirth, profile.bgUnits, exercisePlan, trendForReadiness]);

  const fuelPlanLines = useMemo(() => {
    if (!activeSession || !exercisePlan || !readiness) return [];
    const bg = parseFloatOrNull(bgInput);
    if (bg == null) return [];
    const rawLines = getExerciseFuelPlanLines(exercisePlan, readiness.verdict, profile, {
      phase: activeSession.phase,
      exerciseType: activeSession.exerciseType,
      currentBg: bg,
      bgUnits,
      intensity: activeSession.intensity,
      trend: trendForReadiness,
    });
    // The hypo suggestion (rendered separately, just above) is the single source of
    // truth for "take now" grams whenever it's present — drop the fuel plan's own
    // "Take now" line so the two never show two different numbers for the same moment.
    return reconcileExerciseFuelLines(rawLines, hypoCoachSuggestion);
  }, [activeSession, bgInput, bgUnits, exercisePlan, hypoCoachSuggestion, profile, readiness, trendForReadiness]);

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
      else if (activeSession.phase === "active")
        update({ midBg: undefined, midBgAt: undefined, midBgSource: undefined });
      else update({ recoveryBg: undefined, recoveryBgAt: undefined });
      return;
    }
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) return;
    const at = new Date().toISOString();
    if (activeSession.phase === "pre") update({ preBg: n, preBgAt: at });
    else if (activeSession.phase === "active")
      update({ midBg: n, midBgAt: at, midCheckDone: true, midBgSource: "manual" });
    else update({ recoveryBg: n, recoveryBgAt: at });
  };

  const applyCgmBg = (value: string) => {
    setBgInput(value);
    if (!activeSession) return;
    const raw = value.trim().replace(",", ".");
    if (raw === "") return;
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) return;
    const at = new Date().toISOString();
    if (activeSession.phase === "pre") update({ preBg: n, preBgAt: at });
    else if (activeSession.phase === "active")
      update({ midBg: n, midBgAt: at, midCheckDone: true, midBgSource: "cgm" });
    else update({ recoveryBg: n, recoveryBgAt: at });
  };

  const onTrendChange = (t: ExerciseBgTrend) => {
    if (!activeSession) return;
    if (activeSession.phase === "pre") update({ preTrend: t });
    else if (activeSession.phase === "active") update({ midTrend: t });
    else update({ recoveryTrend: t });
  };

  const cgmAutoApplyKey = activeSession ? `${activeSession.id}-${activeSession.phase}` : undefined;
  const {
    prefill: cgmPrefill,
    loading: cgmLoading,
    refresh: refreshCgm,
    emptyHint: cgmEmptyHint,
    onBgChange: onBgFieldChange,
  } = useExerciseCgmBg({
    bgValue: bgInput,
    onApplyBg: applyCgmBg,
    onChange: onBgChange,
    onApplyTrend: onTrendChange,
    autoApplyKey: cgmAutoApplyKey,
  });

  const cgmPhaseProps = {
    cgmPrefill,
    cgmLoading,
    cgmEmptyHint,
    onCgmRefresh: refreshCgm,
    onBgFieldChange,
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
    scrollToActiveGuidedCoach();

    if (options?.toastLabel) {
      toast({
        title: "Session ready",
        description: options.toastLabel,
      });
    }
  };

  const onStartFromRepeatable = (
    session: RecentRepeatableExerciseSession,
    overrides?: Partial<ExerciseRoutineAdjustValues>,
  ) => {
    beginGuidedSession(
      {
        exerciseType: overrides?.exerciseType ?? session.exerciseType,
        intensity: overrides?.intensity ?? session.intensity,
        durationMinutes: overrides?.durationMinutes ?? session.durationMinutes,
        exerciseName: session.exerciseName,
      },
      { toastLabel: session.exerciseName?.trim() || session.label },
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

  const onStartFromRoutine = (routine: ExerciseRoutine, overrides?: Partial<ExerciseRoutineAdjustValues>) => {
    beginGuidedSession({
      routineId: routine.id,
      exerciseName: routine.name,
      exerciseType: overrides?.exerciseType ?? routine.exerciseType,
      intensity: overrides?.intensity ?? routine.intensity,
      durationMinutes: overrides?.durationMinutes ?? routine.durationMinutes,
    });
  };

  const onSaveRoutineDefault = (values: ExerciseRoutineAdjustValues) => {
    if (!adjustRoutine) return;
    storage.updateExerciseRoutine(adjustRoutine.id, {
      exerciseType: values.exerciseType,
      intensity: values.intensity,
      durationMinutes: values.durationMinutes,
    });
    setRoutines(storage.getRecentExercises?.(8) ?? []);
    toast({
      title: "Routine updated",
      description: `${adjustRoutine.name} will use these details next time.`,
    });
  };

  const sessionActions = useExerciseSessionActions();

  const onStartWorkout = () => {
    if (!activeSession || activeSession.phase !== "pre") return;
    const updated = sessionActions.startWorkout();
    setActiveSession(updated);
  };

  const onFinishWorkout = () => {
    if (!activeSession || activeSession.phase !== "active") return;
    const updated = sessionActions.finishWorkout();
    setActiveSession(updated);
  };

  const onPauseWorkout = () => {
    if (!activeSession || activeSession.phase !== "active" || activeSession.pausedAt) return;
    const updated = sessionActions.pauseWorkout();
    setActiveSession(updated);
  };

  const onResumeWorkout = () => {
    if (!activeSession || activeSession.phase !== "active" || !activeSession.pausedAt) return;
    const updated = sessionActions.resumeWorkout();
    setActiveSession(updated);
  };

  const onEndSession = () => {
    if (!activeSession) return;
    sessionActions.endSession();
    setActiveSession(null);
    toast({ title: "Exercise ended", description: "Session cleared." });
  };

  // ----- Phase timer -----
  const phaseTimerLabel: string | null = useMemo(() => {
    if (!activeSession) return null;
    if (activeSession.phase === "active" && activeSession.exerciseStartedAt) {
      return formatExerciseElapsedShort(getWorkoutElapsedMs(activeSession, now));
    }
    if (activeSession.phase === "recovery" && activeSession.exerciseEndedAt) {
      const t = new Date(activeSession.exerciseEndedAt).getTime();
      if (!Number.isFinite(t)) return null;
      return formatExerciseElapsedShort(now - t);
    }
    return null;
  }, [activeSession, now]);

  const workoutPaused = isExercisePaused(activeSession);

  // ----- Render -----
  if (!activeSession) {
    const durationPresets = [30, 45, 60, 90] as const;
    const durationNum = parseInt(startDuration, 10);

    return (
      <div className="space-y-4 max-sm:space-y-3" data-testid="exercise-guided-coach-start">
        <div className="relative overflow-hidden rounded-[1.75rem] border border-border/50 bg-card/95 shadow-sm">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-emerald-500/[0.06] via-transparent to-muted/20"
            aria-hidden
          />
          <Collapsible open={planWorkoutOpen} onOpenChange={setPlanWorkoutOpen} className="group relative z-10">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left outline-none transition-colors hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
                data-testid="coach-plan-workout-trigger"
                aria-expanded={planWorkoutOpen}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/15 dark:text-emerald-400">
                    <Sparkles className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-lg font-semibold tracking-tight text-foreground">Plan a workout</p>
                    <p className="text-xs text-muted-foreground">Type, intensity, and duration — then start guided</p>
                  </div>
                </div>
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
                  aria-hidden
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-5 border-t border-border/40 px-4 pb-5 pt-4 sm:px-5">
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Type</Label>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {EXERCISE_TYPE_OPTIONS.map((o) => {
                      const active = startType === o.value;
                      return (
                        <Button
                          key={o.value}
                          type="button"
                          size="sm"
                          variant="ghost"
                          className={cn(
                            "h-10 justify-start rounded-xl px-2.5 text-xs font-medium",
                            active
                              ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                              : "bg-muted/30 text-muted-foreground hover:text-foreground",
                          )}
                          onClick={() => setStartType(o.value)}
                          data-testid={`button-start-type-${o.value}`}
                        >
                          <ExerciseTypeIcon type={o.value} className="mr-1.5 h-3.5 w-3.5 shrink-0 opacity-80" />
                          <span className="truncate">{o.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Intensity
                  </Label>
                  <div className="grid grid-cols-3 gap-1 rounded-2xl bg-muted/30 p-1" role="group" aria-label="Intensity">
                    {INTENSITY_OPTIONS.map((i) => {
                      const active = startIntensity === i;
                      return (
                        <Button
                          key={i}
                          type="button"
                          size="sm"
                          variant="ghost"
                          className={cn(
                            "h-10 rounded-xl text-sm font-medium capitalize",
                            active
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                          onClick={() => setStartIntensity(i)}
                          data-testid={`button-start-intensity-${i}`}
                        >
                          {i}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Duration
                  </Label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {durationPresets.map((m) => (
                      <Button
                        key={m}
                        type="button"
                        size="sm"
                        variant="ghost"
                        className={cn(
                          "h-10 min-w-[4.25rem] rounded-xl px-3 text-sm font-medium tabular-nums",
                          durationNum === m
                            ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                            : "bg-muted/30 text-muted-foreground hover:text-foreground",
                        )}
                        onClick={() => setStartDuration(String(m))}
                        data-testid={`button-start-duration-${m}`}
                      >
                        {m} min
                      </Button>
                    ))}
                    <div className="relative">
                      <Input
                        id="start-duration"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                        value={startDuration}
                        placeholder="Custom"
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => setStartDuration(e.target.value.replace(/\D/g, "").slice(0, 3))}
                        className="h-10 w-[5.75rem] rounded-xl border-border/60 bg-muted/20 pr-8 text-center tabular-nums shadow-none"
                        data-testid="input-start-duration"
                        aria-label="Custom duration in minutes"
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[11px] font-medium text-muted-foreground">
                        min
                      </span>
                    </div>
                  </div>
                </div>

                {/* Keep selects for tests that still query them; synced with pill UI above. */}
                <div className="sr-only" aria-hidden>
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

                <Button
                  size="lg"
                  onClick={onStartFromForm}
                  className="h-12 w-full rounded-2xl text-base font-semibold"
                  data-testid="button-start-coach"
                >
                  <Play className="mr-2 h-5 w-5" aria-hidden />
                  Start guided session
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {recentWorkouts.length > 0 ? (
          <div
            className="overflow-hidden rounded-[1.5rem] border border-border/50 bg-card/90 shadow-sm"
            data-testid="exercise-recent-workouts"
          >
            <div className="flex items-center gap-2 px-4 pb-1 pt-4 sm:px-5">
              <History className="h-4 w-4 text-muted-foreground" aria-hidden />
              <p className="text-sm font-semibold tracking-tight text-foreground">Recent</p>
            </div>
            <div className="grid gap-2 px-4 pb-4 pt-2 sm:px-5">
              {recentWorkouts.map((session) => (
                <div
                  key={session.id}
                  className="flex flex-col gap-2 rounded-2xl border border-border/40 bg-muted/15 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                  data-testid={`exercise-recent-workout-${session.id}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {session.exerciseName?.trim() || session.label}
                    </p>
                    <p className="text-xs leading-snug text-muted-foreground">
                      {format(new Date(session.completedAt), "d MMM")} · {session.label}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-9 shrink-0 rounded-xl"
                      onClick={() => onStartFromRepeatable(session)}
                      data-testid={`button-restart-recent-${session.id}`}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
                      Restart
                    </Button>
                    <ExerciseRoutineAdjustTrigger
                      onClick={() => setAdjustRecent(session)}
                      testId={`button-adjust-recent-${session.id}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {routines.length > 0 ? (
          <div className="overflow-hidden rounded-[1.5rem] border border-border/50 bg-card/90 shadow-sm">
            <div className="flex items-center gap-2 px-4 pb-1 pt-4 sm:px-5">
              <Dumbbell className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <p className="text-sm font-semibold tracking-tight text-foreground">Routines</p>
            </div>
            <div className="grid gap-2 px-4 pb-4 pt-2 sm:grid-cols-2 sm:px-5">
              {routines.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-1 rounded-2xl border border-border/40 bg-muted/10 p-1 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/[0.05]"
                >
                  <button
                    type="button"
                    onClick={() => onStartFromRoutine(r)}
                    className="min-w-0 flex-1 rounded-xl px-2.5 py-2.5 text-left"
                    data-testid={`button-coach-routine-${r.id}`}
                  >
                    <p className="truncate text-sm font-semibold">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.durationMinutes} min · {r.intensity} · {r.exerciseType}
                    </p>
                  </button>
                  <ExerciseRoutineAdjustTrigger
                    onClick={() => setAdjustRoutine(r)}
                    testId={`button-coach-adjust-routine-${r.id}`}
                    className="mr-0.5"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <ExerciseRoutineAdjustSheet
          open={!!adjustRoutine}
          onOpenChange={(open) => {
            if (!open) setAdjustRoutine(null);
          }}
          routine={adjustRoutine}
          onStart={(values) => {
            if (!adjustRoutine) return;
            onStartFromRoutine(adjustRoutine, values);
          }}
          onSaveDefault={onSaveRoutineDefault}
        />

        <ExerciseRoutineAdjustSheet
          open={!!adjustRecent}
          onOpenChange={(open) => {
            if (!open) setAdjustRecent(null);
          }}
          routine={
            adjustRecent
              ? {
                  id: adjustRecent.id,
                  name: adjustRecent.exerciseName?.trim() || adjustRecent.label,
                  exerciseType: adjustRecent.exerciseType,
                  intensity: adjustRecent.intensity,
                  durationMinutes: adjustRecent.durationMinutes,
                }
              : null
          }
          onStart={(values) => {
            if (!adjustRecent) return;
            onStartFromRepeatable(adjustRecent, values);
          }}
        />
      </div>
    );
  }

  const phase = activeSession.phase;
  const verdictVisuals = getVerdictVisuals(readiness);
  const VerdictIcon = verdictVisuals.icon;

  const fuelPlanVariant =
    phase === "pre" ? "pre" : phase === "active" ? "active" : "recovery";

  return (
    <div className="space-y-4 max-sm:space-y-3" data-testid="exercise-guided-coach">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-border/50 bg-card/95 text-foreground shadow-sm">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-muted/40 via-transparent to-muted/20"
          aria-hidden
        />
        <div
          className={cn(
            "pointer-events-none absolute -top-28 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full blur-3xl transition-colors duration-700",
            hypoCoachSuggestion ? "bg-amber-400/15 dark:bg-amber-400/10" : "bg-emerald-400/12 dark:bg-emerald-400/10",
          )}
          aria-hidden
        />

        <div className="relative z-10 space-y-5 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/15 dark:text-emerald-400"
              aria-hidden
            >
              <ExerciseTypeIcon type={activeSession.exerciseType} className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5 pt-0.5">
              <p className="truncate text-lg font-semibold tracking-tight text-foreground">{activeSession.exerciseName}</p>
              <p className="text-xs text-muted-foreground" data-testid="text-coach-session-meta">
                {sessionMetaLine(activeSession)}
              </p>
            </div>
            {phase === "pre" || phase === "active" ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    data-testid="button-coach-end-session"
                    aria-label="End session"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>End this session?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This clears the current {phase === "pre" ? "planned" : "in-progress"} workout and cancels
                      any scheduled check-in reminders for it.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep going</AlertDialogCancel>
                    <AlertDialogAction onClick={onEndSession} data-testid="button-coach-end-session-confirm">
                      End session
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>

          {phase === "pre" ? (
            <Button
              size="lg"
              onClick={onStartWorkout}
              className="h-12 w-full rounded-2xl text-base font-semibold"
              data-testid="button-coach-start-workout"
            >
              <Play className="mr-2 h-5 w-5" aria-hidden />
              Start workout
            </Button>
          ) : phase === "active" ? (
            <div className="grid grid-cols-2 gap-2.5">
              {workoutPaused ? (
                <Button
                  size="lg"
                  onClick={onResumeWorkout}
                  className="h-12 rounded-2xl text-base font-semibold"
                  data-testid="button-coach-resume-workout"
                >
                  <Play className="mr-2 h-5 w-5" aria-hidden />
                  Resume
                </Button>
              ) : (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={onPauseWorkout}
                  className="h-12 rounded-2xl border-border/70 bg-background/60 text-base font-semibold"
                  data-testid="button-coach-pause-workout"
                >
                  <Pause className="mr-2 h-5 w-5" aria-hidden />
                  Pause
                </Button>
              )}
              <Button
                size="lg"
                variant={workoutPaused ? "outline" : "default"}
                onClick={onFinishWorkout}
                className={cn(
                  "h-12 rounded-2xl text-base font-semibold",
                  workoutPaused && "border-border/70 bg-background/60",
                )}
                data-testid="button-coach-finish-workout"
              >
                <ArrowRight className="mr-2 h-5 w-5" aria-hidden />
                Recovery
              </Button>
            </div>
          ) : phase === "recovery" ? (
            <Button
              size="lg"
              onClick={onEndSession}
              className="h-12 w-full rounded-2xl text-base font-semibold"
              data-testid="button-coach-finish-session"
            >
              <CircleCheck className="mr-2 h-5 w-5" aria-hidden />
              Finish
            </Button>
          ) : null}

          <ExercisePhaseStepper phase={phase} />

          <div className="space-y-4" data-testid="coach-phase-card">
            {phase === "active" && phaseTimerLabel ? (
              <div className="space-y-3 text-center" data-testid="coach-active-timer-hero">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    {workoutPaused ? "Paused" : "Elapsed"}
                  </p>
                  <p
                    className={cn(
                      "mt-1.5 text-[3.25rem] font-bold leading-none tabular-nums tracking-tight sm:text-6xl",
                      workoutPaused ? "text-amber-600 dark:text-amber-400" : "text-foreground",
                    )}
                    data-testid="coach-phase-timer"
                    title={workoutPaused ? "Workout paused" : "Workout elapsed"}
                  >
                    {phaseTimerLabel}
                  </p>
                </div>
                {activeSession.exerciseStartedAt ? (
                  <ExerciseWorkoutProgressBar
                    phase={phase}
                    exerciseStartedAt={activeSession.exerciseStartedAt}
                    durationMinutes={activeSession.durationMinutes}
                    nowMs={now}
                    pausedAt={activeSession.pausedAt}
                    totalPausedMs={activeSession.totalPausedMs}
                  />
                ) : null}
              </div>
            ) : null}

            {readiness ? (
              <div className="space-y-3" data-testid="coach-readiness-card">
                <div
                  className={cn("rounded-2xl border px-3.5 py-3.5", verdictVisuals.cardClass)}
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        verdictVisuals.chipClass,
                      )}
                      aria-hidden
                    >
                      <VerdictIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold leading-snug tracking-tight text-foreground">
                        {readiness.title}
                      </p>
                      {readiness.detail ? (
                        <p
                          className="mt-1.5 text-sm leading-relaxed text-foreground/80"
                          data-testid="coach-readiness-detail"
                        >
                          {readiness.detail}
                        </p>
                      ) : null}
                      {phase !== "active" && phaseTimerLabel ? (
                        <p
                          className="mt-2.5 text-xs font-medium tabular-nums text-muted-foreground"
                          data-testid="coach-phase-timer"
                          title={phase === "recovery" ? "Time since workout ended" : "Time in this step"}
                        >
                          {phase === "recovery" ? "Time in recovery" : "Time in this step"} · {phaseTimerLabel}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
                {fuelPlanLines.length > 0 ? (
                  <ExerciseFuelPlanSummary lines={fuelPlanLines} variant={fuelPlanVariant} />
                ) : null}
              </div>
            ) : null}

            {phase === "active" ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-10 w-full rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground"
                onClick={() => requestOpenExerciseMode()}
                data-testid="button-coach-exercise-mode"
              >
                <Maximize2 className="mr-1.5 h-3.5 w-3.5 opacity-80" aria-hidden />
                Open Exercise mode
              </Button>
            ) : null}

            {hypoCoachSuggestion ? <ExerciseHypoTreatmentHint suggestion={hypoCoachSuggestion} /> : null}

            {isPump && phasePumpTips.length > 0 ? (
              <ExercisePumpTipsCard tips={phasePumpTips} data-testid={`coach-pump-tips-${phase}`} />
            ) : null}

            {closedLoop && phase === "pre" && closedLoopExercisePrePrompt(true) ? (
              <p className="text-xs leading-relaxed text-muted-foreground" data-testid="coach-closed-loop-pre-prompt">
                {closedLoopExercisePrePrompt(true)}
              </p>
            ) : null}

            <div className="space-y-4 border-t border-border/40 pt-4">
              <Tabs value={phase} className="w-full">
                <TabsContent value="pre" className="mt-0 space-y-4" data-testid="coach-input-panel-pre">
                  <PreQuestions
                    session={activeSession}
                    bgUnits={bgUnits}
                    bgInput={bgInput}
                    onTrendChange={onTrendChange}
                    update={update}
                    {...cgmPhaseProps}
                  />
                </TabsContent>

                <TabsContent value="active" className="mt-0 space-y-4" data-testid="coach-input-panel-active">
                  <DuringQuestions
                    session={activeSession}
                    bgUnits={bgUnits}
                    bgInput={bgInput}
                    onTrendChange={onTrendChange}
                    update={update}
                    {...cgmPhaseProps}
                  />
                </TabsContent>

                <TabsContent value="recovery" className="mt-0 space-y-4" data-testid="coach-input-panel-recovery">
                  <RecoveryQuestions
                    session={activeSession}
                    bgUnits={bgUnits}
                    bgInput={bgInput}
                    onTrendChange={onTrendChange}
                    update={update}
                    showTonightPlanning={recoveryEveningContext}
                    {...cgmPhaseProps}
                  />
                  {exercisePlan || recoveryBedtimeCtaInfo ? (
                    <div className="space-y-3 border-t border-border/50 pt-3.5">
                      {exercisePlan ? (
                        <p
                          className="text-xs leading-snug text-muted-foreground"
                          data-testid="coach-recovery-window-note"
                        >
                          ~{exercisePlan.recovery.monitorHours}h recovery · watch for delayed lows
                        </p>
                      ) : null}
                      {recoveryBedtimeCtaInfo ? (
                        <div
                          className={cn(
                            "space-y-2 rounded-xl border px-3.5 py-3",
                            recoveryBedtimeCtaInfo.urgent
                              ? "border-primary/40 bg-primary/5"
                              : "border-border/50 bg-muted/10",
                          )}
                          data-testid="coach-recovery-bedtime-cta"
                        >
                          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <Moon className="h-4 w-4 shrink-0" aria-hidden />
                            {recoveryBedtimeCtaInfo.title}
                          </p>
                          <Link href="/scenarios/bedtime">
                            <Button
                              variant={recoveryBedtimeCtaInfo.urgent ? "default" : "outline"}
                              size="sm"
                              className="w-full"
                              data-testid="button-coach-recovery-bedtime"
                            >
                              Open Bedtime tool
                              <ArrowRight className="ml-auto h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----- Sub-components -----

type PhaseProps = {
  session: ActiveExerciseSession;
  bgUnits: "mmol/L" | "mg/dL";
  bgInput: string;
  onTrendChange: (t: ExerciseBgTrend) => void;
  update: (updates: Parameters<typeof storage.updateActiveExercise>[0]) => void;
  cgmPrefill: BgPrefillResult | null;
  cgmLoading: boolean;
  cgmEmptyHint?: string;
  onCgmRefresh: () => void;
  onBgFieldChange: (v: string) => void;
};

/** How many "More context" fields the user has already filled in — shown as a quiet badge. */
function countMoreContextSelections(session: ActiveExerciseSession): number {
  let n = 0;
  if (session.preFasted) n++;
  if (session.preFeelingOff) n++;
  if (session.preCompetitive) n++;
  if (session.preCaffeine2h) n++;
  if (session.preAlcoholLastNight) n++;
  if (session.preGlp1Last24h) n++;
  if (session.preBetaBlockerToday) n++;
  if (session.preSleepHours != null) n++;
  if (session.preHydration === "low") n++;
  if (session.preEnvironments && session.preEnvironments.length > 0) n++;
  if (!session.preFasted && (session.prefuelMinutesAgo != null || session.prefuelGrams != null)) n++;
  return n;
}

function sessionTrend(session: ActiveExerciseSession): ExerciseBgTrend | null | undefined {
  return session.phase === "pre"
    ? session.preTrend
    : session.phase === "active"
      ? session.midTrend
      : session.recoveryTrend;
}

function PreQuestions({
  session,
  bgUnits,
  bgInput,
  onTrendChange,
  update,
  cgmPrefill,
  cgmLoading,
  cgmEmptyHint,
  onCgmRefresh,
  onBgFieldChange,
}: PhaseProps) {
  const sleepPresets = [4, 6, 8, 10] as const;
  const sleepIsPreset = session.preSleepHours != null && sleepPresets.includes(session.preSleepHours as (typeof sleepPresets)[number]);
  const mealPresets = [0, 30, 60, 120] as const;
  const mealIsPreset =
    session.prefuelMinutesAgo != null && mealPresets.includes(session.prefuelMinutesAgo as (typeof mealPresets)[number]);

  return (
    <div className="space-y-4">
      <ExerciseCgmBgField
        bgUnits={bgUnits}
        bgValue={bgInput}
        trend={sessionTrend(session)}
        onBgChange={onBgFieldChange}
        onTrendChange={onTrendChange}
        prefill={cgmPrefill}
        loading={cgmLoading}
        onRefresh={onCgmRefresh}
        emptyHint={cgmEmptyHint}
        inputTestId="input-coach-bg"
        trendTestIdPrefix="button-coach-trend"
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

      <DeeperContextSection title="More context" icon={Sparkles} badgeCount={countMoreContextSelections(session)}>
        <Field label="Anything else going on?">
          <div className="flex flex-wrap gap-2">
            <PillToggle
              label="Fasted"
              checked={!!session.preFasted}
              onChange={(v) => update({ preFasted: v })}
              testId="toggle-coach-fasted"
            />
            <PillToggle
              label="Feeling off"
              checked={!!session.preFeelingOff}
              onChange={(v) => update({ preFeelingOff: v })}
              testId="toggle-coach-feeling-off"
            />
            <PillToggle
              label="Competitive"
              checked={!!session.preCompetitive}
              onChange={(v) => update({ preCompetitive: v })}
              testId="toggle-coach-competitive"
            />
            <PillToggle
              label="Caffeine (2h)"
              icon={Coffee}
              checked={!!session.preCaffeine2h}
              onChange={(v) => update({ preCaffeine2h: v })}
              testId="toggle-coach-caffeine"
            />
            <PillToggle
              label="Alcohol last night"
              checked={!!session.preAlcoholLastNight}
              onChange={(v) => update({ preAlcoholLastNight: v })}
              testId="toggle-coach-alcohol-last-night"
            />
            <PillToggle
              label="GLP-1 (24h)"
              checked={!!session.preGlp1Last24h}
              onChange={(v) => update({ preGlp1Last24h: v })}
              testId="toggle-coach-glp1"
            />
            <PillToggle
              label="Beta-blocker today"
              checked={!!session.preBetaBlockerToday}
              onChange={(v) => update({ preBetaBlockerToday: v })}
              testId="toggle-coach-beta-blocker"
            />
            <PillToggle
              label="Low hydration"
              checked={session.preHydration === "low"}
              onChange={(v) => update({ preHydration: v ? "low" : undefined })}
              testId="toggle-coach-hydration-low"
            />
          </div>
        </Field>

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

        {!session.preFasted ? (
          <Field label="Approx carbs in last meal (g)">
            <Input
              inputMode="numeric"
              value={session.prefuelGrams != null ? String(session.prefuelGrams) : ""}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                update({ prefuelGrams: Number.isFinite(n) ? Math.min(300, Math.max(0, n)) : undefined });
              }}
              className="h-9"
              data-testid="input-coach-prefuel-carbs"
            />
          </Field>
        ) : null}

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
      </DeeperContextSection>
    </div>
  );
}

function DuringQuestions({
  session,
  bgUnits,
  bgInput,
  onTrendChange,
  update,
  cgmPrefill,
  cgmLoading,
  cgmEmptyHint,
  onCgmRefresh,
  onBgFieldChange,
}: PhaseProps) {
  const bgRef = useRef<HTMLInputElement | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [hypoRecheckEndsAt, setHypoRecheckEndsAt] = useState<number | null>(null);

  useEffect(() => {
    if (hypoRecheckEndsAt == null) return;
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [hypoRecheckEndsAt]);

  useEffect(() => {
    setHypoRecheckEndsAt(null);
  }, [session.id]);

  const trend =
    session.phase === "active"
      ? (session.midTrend ?? session.preTrend ?? "not_sure")
      : ("not_sure" as const);
  const symptomSelected = (session.midSymptoms ?? []).filter((s) => s !== "fine");
  const hasSymptoms = symptomSelected.length > 0;
  const severity = session.midSymptomSeverity ?? "moderate";

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
      {/* Mid-workout check-in: BG + trend + feel-low — sits in the light sheet below the dark stage. */}
      <div className="space-y-3" data-testid="coach-during-checkin">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">BG check-in</p>
        <ExerciseCgmBgField
          bgUnits={bgUnits}
          bgValue={bgInput}
          trend={sessionTrend(session)}
          onBgChange={onBgFieldChange}
          onTrendChange={onTrendChange}
          prefill={cgmPrefill}
          loading={cgmLoading}
          onRefresh={onCgmRefresh}
          emptyHint={cgmEmptyHint}
          inputTestId="input-coach-bg"
          trendTestIdPrefix="button-coach-trend"
          inputRef={bgRef}
        />

        {/* Always-visible safety action; effort/symptoms stay in the collapsible below. */}
        {hypoRecheckEndsAt != null ? (
          <div
            className="rounded-xl border border-amber-300/70 bg-amber-50/60 dark:border-amber-800/50 dark:bg-amber-950/25 px-2.5 py-2 text-sm"
            data-testid="panel-coach-hypo-recheck"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-amber-900 dark:text-amber-100">Treat & re-check</p>
              <span className="text-xs tabular-nums text-amber-900/80 dark:text-amber-100/80">{hypoRemainingLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <p className="text-xs text-amber-900/80 dark:text-amber-100/80 leading-snug">
                Take fast carbs now if your plan uses this, then re-check when the timer ends.
              </p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 shrink-0 px-2 text-xs"
                onClick={() => setHypoRecheckEndsAt(null)}
                data-testid="button-coach-hypo-clear"
              >
                Dismiss
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 w-full rounded-xl border-border/60 text-xs"
            onClick={startHypoRecheckTimer}
            data-testid="button-coach-feel-low"
          >
            I feel low — start 15‑min timer
          </Button>
        )}
      </div>

      <DeeperContextSection
        title="Log how it feels"
        icon={Activity}
        badgeCount={countDuringLogSelections(session)}
        defaultOpen={hasSymptoms}
      >
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
                className={cn("h-9 rounded-none px-2 text-xs", o.id !== "max" ? "border-r border-border/60" : null)}
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
                      midSymptomSeverity:
                        next && next.some((s) => s !== "fine") ? (session.midSymptomSeverity ?? "moderate") : undefined,
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
            className="rounded-lg border border-amber-300/60 bg-amber-50/45 dark:border-amber-800/50 dark:bg-amber-950/20 px-2.5 py-2.5 space-y-2"
            data-testid="panel-coach-symptoms-action"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-amber-900/80 dark:text-amber-100/80 leading-snug">
                {symptomSelected.slice(0, 3).join(", ")}
                {symptomSelected.length > 3 ? ` +${symptomSelected.length - 3} more` : ""} — how bad?
              </p>
              <div className="flex items-center gap-1.5">
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

            <p className="text-[11px] text-amber-900/85 dark:text-amber-100/85 leading-snug">
              <span className="font-medium">Do now:</span>{" "}
              {recommendTreatNow
                ? "treat with fast carbs, then re-check in 15 min."
                : recommendPauseAndCheckNow
                  ? "pause + check BG. Treat if low or falling."
                  : "slow down, keep carbs within reach, re-check if it persists."}
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 px-3 text-xs flex-1"
                onClick={startHypoRecheckTimer}
                data-testid="button-coach-symptom-start-timer"
              >
                Start 15‑min timer
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
      </DeeperContextSection>
    </div>
  );
}

/** How many mid-session log fields are already filled — shown as a quiet badge when collapsed. */
function countDuringLogSelections(session: ActiveExerciseSession): number {
  let n = 0;
  if (session.midRpe != null) n++;
  if ((session.midSymptoms ?? []).some((s) => s !== "fine")) n++;
  return n;
}

const BEDTIME_PRESET_HOURS = [1, 2, 4, 8] as const;

function RecoveryQuestions({
  session,
  bgUnits,
  bgInput,
  onTrendChange,
  update,
  cgmPrefill,
  cgmLoading,
  cgmEmptyHint,
  onCgmRefresh,
  onBgFieldChange,
  showTonightPlanning,
}: PhaseProps & { showTonightPlanning: boolean }) {
  const bedtimeIsPreset =
    session.bedtimeInHours != null && BEDTIME_PRESET_HOURS.includes(session.bedtimeInHours as (typeof BEDTIME_PRESET_HOURS)[number]);

  return (
    <div className="space-y-4">
      <ExerciseCgmBgField
        bgUnits={bgUnits}
        bgValue={bgInput}
        trend={sessionTrend(session)}
        onBgChange={onBgFieldChange}
        onTrendChange={onTrendChange}
        prefill={cgmPrefill}
        loading={cgmLoading}
        onRefresh={onCgmRefresh}
        emptyHint={cgmEmptyHint}
        inputTestId="input-coach-bg"
        trendTestIdPrefix="button-coach-trend"
      />

      {/* Bedtime / alcohol only matter closer to night — daytime recovery stays BG-focused. */}
      {showTonightPlanning ? (
        <>
          <FieldRow icon={Moon} label="Bedtime tonight">
            <div className="flex flex-wrap items-center gap-2">
              {BEDTIME_PRESET_HOURS.map((h) => (
                <Button
                  key={h}
                  type="button"
                  size="sm"
                  variant={session.bedtimeInHours === h ? "default" : "outline"}
                  className="h-8 px-2.5 text-xs"
                  onClick={() => update({ bedtimeInHours: session.bedtimeInHours === h ? undefined : h })}
                  data-testid={`button-coach-bedtime-${h}`}
                >
                  {h >= 8 ? `${h}h+` : `${h}h`}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant={session.bedtimeInHours != null && !bedtimeIsPreset ? "default" : "outline"}
                className="h-8 px-2.5 text-xs"
                onClick={() => {
                  if (session.bedtimeInHours != null && !bedtimeIsPreset) {
                    update({ bedtimeInHours: undefined });
                  } else {
                    update({ bedtimeInHours: 3 });
                  }
                }}
                data-testid="button-coach-bedtime-custom"
              >
                Custom
              </Button>
            </div>
            {session.bedtimeInHours != null && !bedtimeIsPreset ? (
              <div className="pt-2">
                <Input
                  inputMode="decimal"
                  value={String(session.bedtimeInHours)}
                  onChange={(e) => {
                    const n = parseFloat(e.target.value.replace(",", "."));
                    update({ bedtimeInHours: Number.isFinite(n) && n >= 0 ? Math.min(24, n) : undefined });
                  }}
                  className="h-9"
                  data-testid="input-coach-bedtime-hours"
                />
              </div>
            ) : null}
          </FieldRow>

          <div className="flex flex-wrap gap-2">
            <PillToggle
              label="Alcohol planned tonight"
              icon={Wine}
              checked={!!session.alcoholTonight}
              onChange={(v) => update({ alcoholTonight: v })}
              testId="toggle-coach-alcohol-tonight"
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * Evening / overnight local hours — when the Bedtime tool and "tonight" prompts are useful.
 * Matches the overnight window used by post-exercise educational copy (from 5pm).
 */
function isExerciseRecoveryEveningContext(now: Date = new Date()): boolean {
  const h = now.getHours();
  return h >= 17 || h < 5;
}

/**
 * Drives the "Open Bedtime tool" prompt in the recovery panel — urgency and copy respond to
 * how close bedtime actually is. Caller must already gate to evening context.
 */
function recoveryBedtimeCta(
  session: ActiveExerciseSession,
): { urgent: boolean; title: string } | null {
  const hours = session.bedtimeInHours;
  if (hours != null && Number.isFinite(hours)) {
    if (hours <= 4) {
      return {
        urgent: true,
        title: hours <= 1 ? "Bedtime is close" : `Bedtime in about ${Math.round(hours)}h`,
      };
    }
    return {
      urgent: false,
      title: `Bedtime in about ${Math.round(hours)}h`,
    };
  }
  if (session.intensity === "intense" || session.intensity === "moderate") {
    return {
      urgent: false,
      title: "Planning for tonight",
    };
  }
  return null;
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
    <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-muted/30 p-1">
      {(["yes", "no"] as const).map((v) => (
        <Button
          key={v}
          type="button"
          size="sm"
          variant="ghost"
          className={cn(
            "h-10 rounded-xl text-sm font-medium",
            value === v
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onChange(value === v ? null : v)}
          data-testid={`button-coach-rapid-${v}`}
        >
          {v === "yes" ? "Yes" : "No"}
        </Button>
      ))}
    </div>
  );
}

/** Compact tap-pill for a boolean flag — used where a full-width switch row would waste space. */
function PillToggle({
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
    <Button
      type="button"
      size="sm"
      variant={checked ? "default" : "outline"}
      className="h-8 px-2.5 text-xs"
      onClick={() => onChange(!checked)}
      data-testid={testId}
      aria-pressed={checked}
    >
      {Icon ? <Icon className="h-3.5 w-3.5 mr-1" /> : null}
      {label}
    </Button>
  );
}

function DeeperContextSection({
  title,
  icon: Icon,
  badgeCount,
  defaultOpen,
  children,
}: {
  title: string;
  icon: typeof Sparkles;
  /** Count of fields already filled in this section — shown as a quiet badge when collapsed. */
  badgeCount?: number;
  /** Start expanded — e.g. once something inside already needs the user's attention. */
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const headerRef = useRef<HTMLButtonElement | null>(null);
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        ref={headerRef}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/30"
        data-testid={`button-coach-section-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`}
        aria-expanded={open}
      >
        <span className="text-sm font-medium flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-background/80 ring-1 ring-border/50">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          {title}
          {!open && badgeCount ? (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium leading-none text-primary">
              {badgeCount} added
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open ? "rotate-180" : null)}
          aria-hidden
        />
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
