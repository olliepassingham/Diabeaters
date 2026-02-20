import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dumbbell, ArrowRight, Plus, Clock, Flame, Zap, Wind, Footprints, Users, Waves, AlertTriangle, Play } from "lucide-react";
import { Link } from "wouter";
import { storage, ExerciseRoutine, ExerciseType, ActiveExerciseSession } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";

const EXERCISE_ICONS: Record<ExerciseType, typeof Dumbbell> = {
  cardio: Flame,
  strength: Dumbbell,
  hiit: Zap,
  yoga: Wind,
  walking: Footprints,
  sports: Users,
  swimming: Waves,
};

export function QuickExerciseWidget({ compact = false }: { compact?: boolean }) {
  const [exercises, setExercises] = useState<ExerciseRoutine[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveExerciseSession | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setExercises(storage.getRecentExercises(compact ? 3 : 5));
    setActiveSession(storage.getActiveExercise());
  }, [compact]);

  const handleQuickStart = (exercise: ExerciseRoutine) => {
    const existing = storage.getActiveExercise();
    if (existing) {
      toast({
        title: "Exercise already active",
        description: `You have "${existing.exerciseName}" in progress. Finish it first.`,
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
    setExercises(storage.getRecentExercises(compact ? 3 : 5));

    toast({
      title: "Exercise mode started",
      description: `${exercise.name} — check the banner above for your pre-exercise checklist`,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Card className={compact ? "flex flex-col overflow-visible" : "overflow-visible"} data-testid="widget-quick-exercise">
      <CardHeader className="pb-2">
        <Link href="/adviser?tab=exercise">
          <div className="flex items-center gap-2 hover:opacity-70 transition-opacity cursor-pointer">
            <Dumbbell className="h-5 w-5 text-green-600 dark:text-green-400" />
            <CardTitle className="text-base">Quick Exercise</CardTitle>
          </div>
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {activeSession && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-xs mb-1" data-testid="text-active-session-notice">
            <Play className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
            <span className="font-medium text-green-700 dark:text-green-300">
              {activeSession.exerciseName} is {activeSession.phase === "pre" ? "preparing" : activeSession.phase === "active" ? "in progress" : "in recovery"}
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
                    onClick={() => handleQuickStart(exercise)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg hover-elevate text-left border ${
                      isActive ? "border-green-400 dark:border-green-600 opacity-50 pointer-events-none" : ""
                    }`}
                    disabled={isActive}
                    data-testid={`button-quick-exercise-${exercise.id}`}
                  >
                    <Icon className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{exercise.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {exercise.durationMinutes}min · {exercise.intensity}
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-1" />
                  </button>
                );
              })}
            </div>

            {exercises.some(e => e.timesUsed > 0) && !compact && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                <Clock className="h-3 w-3 shrink-0" />
                <span>
                  Tap to activate exercise decision support mode
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span>Not medical advice</span>
            </div>
          </>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm text-muted-foreground">No saved exercises yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Save exercises in the Routines tab for quick access here
            </p>
          </div>
        )}

        <Link href={exercises.length > 0 ? "/adviser?tab=exercise" : "/adviser?tab=routines&section=exercise"}>
          <Button variant="outline" size="sm" className="w-full gap-1" data-testid="button-exercise-action">
            {exercises.length > 0 ? (
              <>
                Plan Workout
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                Add Exercises
              </>
            )}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
