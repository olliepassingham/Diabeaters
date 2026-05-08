import { useState, useEffect, useCallback, useMemo } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dumbbell, ArrowRight, Plus, Clock, Flame, Zap, Wind, Footprints, Users, Waves, Play, CircleDot } from "lucide-react";
import { Link } from "wouter";
import { storage, ExerciseRoutine, ExerciseType, ActiveExerciseSession } from "@/lib/storage";
import { buildExerciseScenarioPlannerHref, buildExerciseScenarioPlannerHrefFromSession } from "@/lib/exercise-planner-href";
import { useToast } from "@/hooks/use-toast";
import { WidgetCard } from "./WidgetCard";
import type { DashboardWidgetLayoutProps } from "./types";
import { isCompactLayout } from "./types";
import { cn } from "@/lib/utils";
import { computeExerciseHypoSuggestion, resolveExerciseBgForHypo } from "@/lib/exercise-hypo-auto";
import { ExerciseHypoTreatmentHint, ExerciseWorkoutProgressBar } from "@/components/exercise-active-session-extras";

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
  const [exercises, setExercises] = useState<ExerciseRoutine[] | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveExerciseSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [nowTick, setNowTick] = useState(() => Date.now());

  const load = useCallback(() => {
    try {
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
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
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
    const bg = resolveExerciseBgForHypo(activeSession);
    if (bg == null) return null;
    const settings = storage.getSettings();
    const profile = storage.getProfile();
    const u = (profile?.bgUnits === "mg/dL" ? "mg/dL" : "mmol/L") as "mmol/L" | "mg/dL";
    return computeExerciseHypoSuggestion(bg, settings, u, profile ?? {});
  }, [activeSession]);

  const handleQuickStart = (exercise: ExerciseRoutine) => {
    try {
      const existing = storage.getActiveExercise?.();
      if (existing) {
        toast({
          title: "Exercise already active",
          description: `You're in ${existing.phase} for "${existing.exerciseName}". Use the bar at the top to View or End.`,
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
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
        exerciseType: exercise.exerciseType,
        intensity: exercise.intensity,
        durationMinutes: exercise.durationMinutes,
      });
      setActiveSession(session);
      setExercises(storage.getRecentExercises?.(compact ? 3 : 5) ?? []);

      toast({
        title: "Exercise mode started",
        description: `${exercise.name} — check the bar at the top to see if you're ready.`,
      });

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      toast({
        title: "Something went wrong",
        description: "Could not start exercise mode.",
        variant: "destructive",
      });
    }
  };

  if (error) {
    return (
      <WidgetCard className="overflow-visible" data-testid="widget-quick-exercise">
        <CardHeader className="p-4 pb-2 md:p-6 md:pb-3">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <CardTitle className="text-h3 text-foreground">Quick exercise</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 md:px-6 md:pb-6">
          <p className="text-body text-muted-foreground">{error}</p>
        </CardContent>
      </WidgetCard>
    );
  }

  if (exercises === null) {
    return (
      <WidgetCard className="overflow-visible" data-testid="widget-quick-exercise">
        <CardContent className="p-4 md:p-6">
          <p className="text-body text-muted-foreground">Loading…</p>
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
      <CardHeader className="p-4 pb-2 md:p-6 md:pb-3">
        <Link href="/scenarios/exercise">
          <div className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer">
            <Dumbbell className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <CardTitle className="text-h3 text-foreground">Quick exercise</CardTitle>
          </div>
        </Link>
        <p className="text-small text-muted-foreground uppercase tracking-wide mt-1">Start a saved workout</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-4 pt-0 md:px-6 md:pb-6">
        {activeSession && (
          <div className="space-y-2.5 rounded-xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.07] via-transparent to-teal-500/[0.04] px-3 py-3 dark:from-emerald-950/40 dark:to-transparent">
            <div className="flex items-start gap-2.5" data-testid="text-active-session-notice">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                <Play className="h-4 w-4 shrink-0" aria-hidden />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-semibold text-foreground leading-tight">{activeSession.exerciseName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activeSession.phase === "pre"
                    ? "Preparing — start when ready"
                    : activeSession.phase === "active"
                      ? "Workout in progress"
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
                compact
              />
            ) : null}
            {hypoWidgetSuggestion ? <ExerciseHypoTreatmentHint suggestion={hypoWidgetSuggestion} /> : null}
          </div>
        )}

        {exercises.length > 0 ? (
          <>
            <div className="flex flex-col gap-2">
              {exercises.map((exercise) => {
                const Icon = EXERCISE_ICONS[exercise.exerciseType] || Dumbbell;
                const isActive = activeSession?.routineId === exercise.id;
                return (
                  <button
                    key={exercise.id}
                    type="button"
                    onClick={() => handleQuickStart(exercise)}
                    className={cn(
                      "pressable card-interactive flex w-full min-h-11 items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left shadow-sm transition-colors",
                      "hover:border-emerald-500/35 hover:bg-emerald-500/[0.06] dark:hover:border-emerald-500/25 dark:hover:bg-emerald-950/25",
                      isActive && "border-emerald-500/60 dark:border-emerald-500/50 opacity-50 pointer-events-none"
                    )}
                    disabled={isActive}
                    data-testid={`button-quick-exercise-${exercise.id}`}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15">
                        <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </span>
                      <span className="min-w-0 text-left">
                        <span className="block text-sm font-semibold text-foreground truncate">{exercise.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {exercise.durationMinutes} min · {exercise.intensity}
                        </span>
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                );
              })}
            </div>

            {exercises.some((e) => e.timesUsed > 0) && !compact && (
              <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                <span>Tap a routine to start quick checks in the top bar</span>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-2 space-y-1">
            <p className="text-body text-muted-foreground">No saved exercises yet</p>
            <p className="text-small text-muted-foreground">Save workouts under Tools → Routines (Exercise) for quick access here.</p>
          </div>
        )}

        <Link href={plannerCtaHref} className="mt-auto">
          <Button
            variant="secondary"
            size="sm"
            className="w-full min-h-10 gap-1.5 font-medium shadow-sm border border-border/80"
            data-testid="button-exercise-action"
          >
            {exercises.length > 0 || activeSession ? (
              <>
                {plannerCtaLabel}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add exercises
              </>
            )}
          </Button>
        </Link>
      </CardContent>
    </WidgetCard>
  );
}
