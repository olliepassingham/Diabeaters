import { useState, useEffect, useCallback, useMemo } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dumbbell, ArrowRight, Plus, Flame, Zap, Wind, Footprints, Users, Waves, Play, CircleDot } from "lucide-react";
import { Link, useLocation } from "wouter";
import { storage, ExerciseRoutine, ExerciseType, ActiveExerciseSession, DIABEATER_SCENARIO_STATE_CHANGED_EVENT } from "@/lib/storage";
import { buildExerciseScenarioPlannerHref, buildExerciseScenarioPlannerHrefFromSession } from "@/lib/exercise-planner-href";
import { useToast } from "@/hooks/use-toast";
import { WidgetCard } from "./WidgetCard";
import type { DashboardWidgetLayoutProps } from "./types";
import { isCompactLayout } from "./types";
import { cn } from "@/lib/utils";
import { HomeCardEmpty } from "@/components/home/home-ui";
import { computeExerciseHypoSuggestion, resolveExerciseBgForHypo } from "@/lib/exercise-hypo-auto";
import { calculateExercisePlan } from "@/lib/exercise-plan";
import { getExerciseReadinessVerdict, getReadinessToneClasses } from "@/lib/exercise-readiness";
import { ExerciseHypoTreatmentHint, ExerciseWorkoutProgressBar } from "@/components/exercise-active-session-extras";
import {
  ExerciseRoutineAdjustSheet,
  ExerciseRoutineAdjustTrigger,
  type ExerciseRoutineAdjustValues,
} from "@/components/exercise-routine-adjust-sheet";
import { useBgPrefill } from "@/hooks/use-bg-prefill";
import { EXERCISE_CGM_POLL_MS } from "@/hooks/use-exercise-cgm-bg";
import { cgmTrendForExercise } from "@/lib/cgm/apply-cgm-trend";
import { isStarterExerciseRoutine, seedStarterExerciseRoutineIfNeeded } from "@/lib/starter-exercise-routine";
import { EXERCISE_GUIDE_HREF } from "@/lib/exercise-mode-deep-link";
import { Badge } from "@/components/ui/badge";

const EXERCISE_ICONS: Record<ExerciseType, typeof Dumbbell> = {
  cardio: Flame,
  strength: Dumbbell,
  hiit: Zap,
  yoga: Wind,
  walking: Footprints,
  court: CircleDot,
  field: Users,
  swimming: Waves,
};

export function QuickExerciseWidget(props: DashboardWidgetLayoutProps) {
  const compact = isCompactLayout(props);
  const { prefill: cgmPrefill } = useBgPrefill({ pollIntervalMs: EXERCISE_CGM_POLL_MS });
  const [exercises, setExercises] = useState<ExerciseRoutine[] | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveExerciseSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [travelActiveTripHint, setTravelActiveTripHint] = useState(false);
  const [adjustRoutine, setAdjustRoutine] = useState<ExerciseRoutine | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [nowTick, setNowTick] = useState(() => Date.now());

  const load = useCallback(() => {
    try {
      seedStarterExerciseRoutineIfNeeded();
      setExercises(storage.getRecentExercises?.(compact ? 3 : 5) ?? []);
      setActiveSession(storage.getActiveExercise?.() ?? null);
      setError(null);
    } catch {
      setError("Could not load exercises.");
      setExercises([]);
    }
  }, [compact]);

  useEffect(() => {
    load();
    const onFocus = () => load();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "diabeater_exercise_routines" || e.key === "diabeater_active_exercise") load();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    const onScenario = () => {
      const s = storage.getScenarioState();
      setTravelActiveTripHint(Boolean(s.travelModeActive && s.travelTripStyle === "active"));
    };
    onScenario();
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(DIABEATER_SCENARIO_STATE_CHANGED_EVENT, onScenario);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(DIABEATER_SCENARIO_STATE_CHANGED_EVENT, onScenario);
    };
  }, [load]);

  useEffect(() => {
    if (!activeSession) return;
    const tick = () => {
      setNowTick(Date.now());
      setActiveSession(storage.getActiveExercise?.() ?? null);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [activeSession?.id]);

  const hypoWidgetSuggestion = useMemo(() => {
    if (!activeSession) return null;
    const profile = storage.getProfile();
    const u = (profile?.bgUnits === "mg/dL" ? "mg/dL" : "mmol/L") as "mmol/L" | "mg/dL";
    let bg = resolveExerciseBgForHypo(activeSession);
    let trend =
      activeSession.phase === "pre"
        ? activeSession.preTrend
        : activeSession.phase === "active"
          ? activeSession.midTrend ?? activeSession.preTrend
          : activeSession.recoveryTrend ?? activeSession.midTrend ?? activeSession.preTrend;

    if (cgmPrefill?.fromCgm && cgmPrefill.reading) {
      const live = parseFloat(cgmPrefill.value.replace(",", "."));
      if (Number.isFinite(live)) {
        bg = live;
        const mapped = cgmTrendForExercise(cgmPrefill.reading.trend);
        if (mapped) trend = mapped;
      }
    }

    if (bg == null) return null;
    const settings = storage.getSettings();
    const plan = calculateExercisePlan({
      exerciseType: activeSession.exerciseType,
      durationMinutes: activeSession.durationMinutes,
      intensity: activeSession.intensity,
      minutesUntilStart: 0,
      bgUnits: u,
      currentBg: bg,
      bgTrend: trend ?? undefined,
    });
    const lowThreshold = parseFloat(plan.pre.lowThreshold);
    return computeExerciseHypoSuggestion(bg, settings, u, profile ?? {}, {
      trend,
      phase: activeSession.phase,
      exerciseLowThreshold: Number.isFinite(lowThreshold) ? lowThreshold : undefined,
      carbsIfLow: plan.pre.carbsIfLow,
    });
  }, [activeSession, cgmPrefill]);

  const widgetReadiness = useMemo(() => {
    if (!activeSession) return null;
    const profile = storage.getProfile();
    const u = (profile?.bgUnits === "mg/dL" ? "mg/dL" : "mmol/L") as "mmol/L" | "mg/dL";
    let bg = resolveExerciseBgForHypo(activeSession);
    let trend =
      activeSession.phase === "pre"
        ? activeSession.preTrend
        : activeSession.phase === "active"
          ? activeSession.midTrend ?? activeSession.preTrend
          : activeSession.recoveryTrend ?? activeSession.midTrend ?? activeSession.preTrend;

    if (cgmPrefill?.fromCgm && cgmPrefill.reading) {
      const live = parseFloat(cgmPrefill.value.replace(",", "."));
      if (Number.isFinite(live)) {
        bg = live;
        const mapped = cgmTrendForExercise(cgmPrefill.reading.trend);
        if (mapped) trend = mapped;
      }
    }

    if (bg == null) return null;
    const sc = storage.getScenarioState();
    const plan = calculateExercisePlan({
      exerciseType: activeSession.exerciseType,
      durationMinutes: activeSession.durationMinutes,
      intensity: activeSession.intensity,
      minutesUntilStart: 0,
      bgUnits: u,
      currentBg: bg,
      bgTrend: trend ?? undefined,
    });
    return getExerciseReadinessVerdict({
      exercisePlanResult: plan,
      currentBg: bg,
      bgUnits: u,
      sickDayActive: sc.sickDayActive,
      sickDaySeverity: sc.sickDaySeverity,
      exerciseType: activeSession.exerciseType,
      intensity: activeSession.intensity,
      bgTrend: trend ?? null,
      phase: activeSession.phase,
      preRapidInsulin2h: activeSession.preRapidInsulin2h ?? null,
    });
  }, [activeSession, cgmPrefill]);

  const handleQuickStart = (
    exercise: ExerciseRoutine,
    overrides?: Partial<ExerciseRoutineAdjustValues>,
  ) => {
    try {
      const existing = storage.getActiveExercise?.();
      if (existing) {
        setLocation(EXERCISE_GUIDE_HREF);
        toast({
          title: "Exercise already active",
          description: `Continue "${existing.exerciseName}" in the Exercise guide.`,
        });
        return;
      }

      const sc = storage.getScenarioState();
      if (sc.sickDayActive) {
        toast({
          title: "Sick day mode is active",
          description: "Exercise may not be recommended when unwell. End sick day mode or follow your care team's guidance.",
          variant: "destructive",
        });
        return;
      }

      storage.useExerciseRoutine(exercise.id);
      const session = storage.startExerciseSession({
        routineId: exercise.id,
        exerciseName: exercise.name,
        exerciseType: overrides?.exerciseType ?? exercise.exerciseType,
        intensity: overrides?.intensity ?? exercise.intensity,
        durationMinutes: overrides?.durationMinutes ?? exercise.durationMinutes,
      });
      setActiveSession(session);
      setExercises(storage.getRecentExercises?.(compact ? 3 : 5) ?? []);
      setAdjustRoutine(null);

      setLocation(EXERCISE_GUIDE_HREF);
      toast({
        title: `${exercise.name} ready`,
        description: "Continue in the Exercise guide — check BG and start when you're ready.",
      });
    } catch {
      toast({
        title: "Something went wrong",
        description: "Could not start exercise mode.",
        variant: "destructive",
      });
    }
  };

  const handleSaveAdjustDefault = (values: ExerciseRoutineAdjustValues) => {
    if (!adjustRoutine) return;
    storage.updateExerciseRoutine(adjustRoutine.id, {
      exerciseType: values.exerciseType,
      intensity: values.intensity,
      durationMinutes: values.durationMinutes,
    });
    setExercises(storage.getRecentExercises?.(compact ? 3 : 5) ?? []);
    toast({
      title: "Routine updated",
      description: `${adjustRoutine.name} will use these details next time.`,
    });
  };

  if (error) {
    return (
      <WidgetCard className="overflow-visible" data-testid="widget-quick-exercise">
        <CardHeader className="space-y-0 p-3 pb-1.5 sm:p-4 sm:pb-2">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <CardTitle className="text-base font-semibold leading-tight text-foreground">Quick exercise</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </WidgetCard>
    );
  }

  if (exercises === null) {
    return (
      <WidgetCard className="overflow-visible" data-testid="widget-quick-exercise">
        <CardContent className="p-3 sm:p-4">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </CardContent>
      </WidgetCard>
    );
  }

  const plannerCtaHref = activeSession
    ? buildExerciseScenarioPlannerHrefFromSession(activeSession, { syncActive: true, from: "widget" })
    : exercises[0]
      ? buildExerciseScenarioPlannerHref({
          exerciseType: exercises[0].exerciseType,
          durationMinutes: exercises[0].durationMinutes,
          intensity: exercises[0].intensity,
          routineId: exercises[0].id,
          from: "widget",
        })
      : "/routines?section=exercise";

  const plannerCtaLabel = activeSession
    ? "Open planner (current session)"
    : exercises.length > 0
      ? "Plan workout"
      : "Add exercises";

  return (
    <WidgetCard className="overflow-visible" data-testid="widget-quick-exercise">
      <CardHeader className="space-y-0 p-3 pb-1.5 sm:p-4 sm:pb-2">
        <Link href="/scenarios/exercise">
          <div className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer">
            <Dumbbell className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <CardTitle className="text-base font-semibold leading-tight text-foreground">Quick exercise</CardTitle>
          </div>
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 p-3 pt-0 sm:gap-2.5 sm:p-4 sm:pt-0">
        {travelActiveTripHint ? (
          <p className="text-[11px] text-muted-foreground" data-testid="text-exercise-travel-active-hint">
            On an active trip — logging sessions helps you spot patterns.
          </p>
        ) : null}
        {activeSession && (
          <div className="space-y-2 rounded-xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.07] via-transparent to-teal-500/[0.04] px-2.5 py-2.5 dark:from-emerald-950/40 dark:to-transparent">
            <div className="flex items-center gap-2.5" data-testid="text-active-session-notice">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                <Play className="h-3.5 w-3.5 shrink-0" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight truncate">{activeSession.exerciseName}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {activeSession.phase === "pre"
                    ? "Preparing — start when ready"
                    : activeSession.phase === "active"
                      ? activeSession.pausedAt
                        ? "Workout paused"
                        : "Workout in progress"
                      : "Recovery window"}
                </p>
              </div>
            </div>
            {activeSession.phase === "active" && activeSession.exerciseStartedAt ? (
              <ExerciseWorkoutProgressBar
                phase={activeSession.phase}
                exerciseStartedAt={activeSession.exerciseStartedAt}
                durationMinutes={activeSession.durationMinutes}
                nowMs={nowTick}
                pausedAt={activeSession.pausedAt}
                totalPausedMs={activeSession.totalPausedMs}
                compact
              />
            ) : null}
            {widgetReadiness ? (
              <div
                className={cn(
                  "rounded-lg border px-2.5 py-2 text-xs leading-snug",
                  getReadinessToneClasses(widgetReadiness.verdict),
                )}
                data-testid="widget-exercise-readiness"
              >
                <p className="font-semibold text-foreground">{widgetReadiness.title}</p>
                <p className="text-foreground/85 mt-0.5">{widgetReadiness.detail}</p>
              </div>
            ) : null}
            {hypoWidgetSuggestion ? <ExerciseHypoTreatmentHint suggestion={hypoWidgetSuggestion} /> : null}
          </div>
        )}

        {exercises.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {exercises.map((exercise) => {
              const Icon = EXERCISE_ICONS[exercise.exerciseType] || Dumbbell;
              const isActive = activeSession?.routineId === exercise.id;
              return (
                <div
                  key={exercise.id}
                  className={cn(
                    "flex w-full items-center gap-0.5 rounded-xl border border-border/70 bg-card/80 p-0.5 transition-colors",
                    "hover:border-emerald-500/35 hover:bg-emerald-500/[0.06] dark:hover:border-emerald-500/25 dark:hover:bg-emerald-950/25",
                    isActive && "border-emerald-500/60 dark:border-emerald-500/50 opacity-50",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleQuickStart(exercise)}
                    className={cn(
                      "pressable flex min-h-10 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left",
                      isActive && "pointer-events-none",
                    )}
                    disabled={isActive}
                    data-testid={`button-quick-exercise-${exercise.id}`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15">
                      <Icon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="block truncate text-sm font-semibold leading-tight text-foreground">
                          {exercise.name}
                        </span>
                        {isStarterExerciseRoutine(exercise) ? (
                          <Badge
                            variant="secondary"
                            className="h-4 shrink-0 px-1 py-0 text-[0.6rem] font-medium"
                            data-testid="badge-starter-exercise"
                          >
                            Example
                          </Badge>
                        ) : null}
                        {isActive ? (
                          <Badge
                            variant="secondary"
                            className="h-4 shrink-0 px-1 py-0 text-[0.6rem] font-medium text-emerald-700 dark:text-emerald-300"
                          >
                            Active
                          </Badge>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] leading-none text-muted-foreground">
                        {exercise.durationMinutes} min · {exercise.intensity}
                      </span>
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
                  </button>
                  <ExerciseRoutineAdjustTrigger
                    disabled={isActive || !!activeSession}
                    onClick={() => setAdjustRoutine(exercise)}
                    testId={`button-adjust-exercise-${exercise.id}`}
                    className="mr-0.5 h-8 w-8"
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <HomeCardEmpty
            compact
            icon={Dumbbell}
            title="No saved exercises yet"
            description="Save workouts under Tools → Routines (Exercise)."
          >
            <Link href="/routines?section=exercise" className="w-full">
              <Button
                variant="secondary"
                size="sm"
                className="w-full h-9 gap-1.5 text-xs font-medium shadow-sm border border-border/80"
                data-testid="button-exercise-action"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add exercises
              </Button>
            </Link>
          </HomeCardEmpty>
        )}

        {(exercises.length > 0 || activeSession) && (
          <Link href={plannerCtaHref}>
            <Button
              variant="secondary"
              size="sm"
              className="w-full h-9 gap-1.5 text-xs font-medium shadow-sm border border-border/80"
              data-testid="button-exercise-action"
            >
              {plannerCtaLabel}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </Link>
        )}
      </CardContent>

      <ExerciseRoutineAdjustSheet
        open={!!adjustRoutine}
        onOpenChange={(open) => {
          if (!open) setAdjustRoutine(null);
        }}
        routine={adjustRoutine}
        onStart={(values) => {
          if (!adjustRoutine) return;
          handleQuickStart(adjustRoutine, values);
        }}
        onSaveDefault={handleSaveAdjustDefault}
      />
    </WidgetCard>
  );
}
