import { useState, useEffect, useCallback } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dumbbell, ArrowRight, Plus, Clock, Flame, Zap, Wind, Footprints, Users, Waves, AlertTriangle, Play, CircleDot } from "lucide-react";
import { Link, useLocation } from "wouter";
import { storage, ExerciseRoutine, ExerciseType, ActiveExerciseSession } from "@/lib/storage";
import { buildExerciseScenarioPlannerHref, buildExerciseScenarioPlannerHrefFromSession } from "@/lib/exercise-planner-href";
import { useToast } from "@/hooks/use-toast";
import { WidgetCard } from "./WidgetCard";
import type { DashboardWidgetLayoutProps } from "./types";
import { isCompactLayout } from "./types";
import { cn } from "@/lib/utils";

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
  const [, setLocation] = useLocation();
  const [exercises, setExercises] = useState<ExerciseRoutine[] | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveExerciseSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

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

  const handleQuickStart = (exercise: ExerciseRoutine) => {
    try {
      const existing = storage.getActiveExercise?.();
      if (existing) {
        const href = buildExerciseScenarioPlannerHrefFromSession(existing, { syncActive: true, from: "widget" });
        setLocation(href);
        return;
      }

      const sc = storage.getScenarioState();
      if (sc.sickDayActive) {
        toast({
          title: "Sick Day Mode is active",
          description: "Exercise may not be recommended when unwell. End Sick Day Mode or follow your care team's guidance.",
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
        description: `${exercise.name} — opening readiness check.`,
      });

      const href = buildExerciseScenarioPlannerHrefFromSession(session, { syncActive: true, from: "widget" });
      setLocation(href);
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
      <CardContent className="space-y-2 p-4 pt-0 md:px-6 md:pb-6">
        {activeSession && (
          <div
            className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-2 text-sm mb-1"
            data-testid="text-active-session-notice"
          >
            <Play className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-medium text-emerald-800 dark:text-emerald-200">
              {activeSession.exerciseName} is{" "}
              {activeSession.phase === "pre"
                ? "preparing"
                : activeSession.phase === "active"
                  ? "in progress"
                  : "in recovery"}
            </span>
          </div>
        )}

        {exercises.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-2">
              {exercises.map((exercise) => {
                const Icon = EXERCISE_ICONS[exercise.exerciseType] || Dumbbell;
                const isActive = activeSession?.routineId === exercise.id;
                return (
                  <button
                    key={exercise.id}
                    type="button"
                    onClick={() => handleQuickStart(exercise)}
                    className={cn(
                      "pressable card-interactive flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-left shadow-sm",
                      isActive && "border-emerald-500/60 dark:border-emerald-500/50 opacity-50 pointer-events-none"
                    )}
                    disabled={isActive}
                    data-testid={`button-quick-exercise-${exercise.id}`}
                  >
                    <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{exercise.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {exercise.durationMinutes}min · {exercise.intensity}
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-1" />
                  </button>
                );
              })}
            </div>

            {exercises.some((e) => e.timesUsed > 0) && !compact && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>Tap to activate exercise decision support mode</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>Not medical advice</span>
            </div>
          </>
        ) : (
          <div className="text-center py-2 space-y-1">
            <p className="text-body text-muted-foreground">No saved exercises yet</p>
            <p className="text-small text-muted-foreground">Save workouts under Tools → Routines (Exercise) for quick access here.</p>
          </div>
        )}

        <Link href={plannerCtaHref}>
          <Button variant="outline" size="sm" className="w-full gap-1" data-testid="button-exercise-action">
            {exercises.length > 0 || activeSession ? (
              <>
                {plannerCtaLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                Add exercises
              </>
            )}
          </Button>
        </Link>
      </CardContent>
    </WidgetCard>
  );
}
