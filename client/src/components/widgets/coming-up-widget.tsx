import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dumbbell, ArrowRight, Plus, Clock, Flame, Zap, Wind, Footprints, Users, Waves, AlertTriangle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { storage, ExerciseRoutine, ExerciseType } from "@/lib/storage";

const EXERCISE_ICONS: Record<ExerciseType, typeof Dumbbell> = {
  cardio: Flame,
  strength: Dumbbell,
  hiit: Zap,
  yoga: Wind,
  walking: Footprints,
  sports: Users,
  swimming: Waves,
};

const EXERCISE_LABELS: Record<ExerciseType, string> = {
  cardio: "Cardio",
  strength: "Strength",
  hiit: "HIIT",
  yoga: "Yoga",
  walking: "Walking",
  sports: "Sports",
  swimming: "Swimming",
};

export function QuickExerciseWidget({ compact = false }: { compact?: boolean }) {
  const [exercises, setExercises] = useState<ExerciseRoutine[]>([]);
  const [, setLocation] = useLocation();

  useEffect(() => {
    setExercises(storage.getRecentExercises(compact ? 3 : 5));
  }, [compact]);

  const handleQuickStart = (exercise: ExerciseRoutine) => {
    storage.useExerciseRoutine(exercise.id);
    const params = new URLSearchParams({
      tab: "exercise",
      type: exercise.exerciseType,
      duration: String(exercise.durationMinutes),
      intensity: exercise.intensity,
      auto: "1",
    });
    setLocation(`/adviser?${params.toString()}`);
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
        {exercises.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-2">
              {exercises.map((exercise) => {
                const Icon = EXERCISE_ICONS[exercise.exerciseType] || Dumbbell;
                return (
                  <button
                    key={exercise.id}
                    onClick={() => handleQuickStart(exercise)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover-elevate text-left border"
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
                  Tap to get instant insulin and carb advice for your workout
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
