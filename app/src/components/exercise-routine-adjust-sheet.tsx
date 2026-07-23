import { useEffect, useMemo, useState } from "react";
import { Pencil, Play, Save } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EXERCISE_INTENSITY_OPTIONS, EXERCISE_TYPE_OPTIONS } from "@/lib/exercise-catalog";
import { clampExerciseDurationMinutes } from "@/lib/exercise-guided-start";
import type { ExerciseIntensity, ExerciseRoutine, ExerciseType } from "@/lib/storage";
import { cn } from "@/lib/utils";

export type ExerciseRoutineAdjustValues = {
  exerciseType: ExerciseType;
  intensity: ExerciseIntensity;
  durationMinutes: number;
};

/** Minimal shape the adjust sheet needs — a saved routine or a past session both qualify. */
export type AdjustableExercise = Pick<ExerciseRoutine, "id" | "name" | "exerciseType" | "intensity" | "durationMinutes">;

const DURATION_PRESETS = [20, 30, 45, 60, 75, 90] as const;

function durationPresetsFor(savedMinutes: number): number[] {
  const set = new Set<number>(DURATION_PRESETS);
  if (savedMinutes >= 5 && savedMinutes <= 300) set.add(savedMinutes);
  return [...set].sort((a, b) => a - b);
}

type ExerciseRoutineAdjustSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routine: AdjustableExercise | null;
  /** One-off start with adjusted values (does not rewrite the saved routine). */
  onStart: (values: ExerciseRoutineAdjustValues) => void;
  /** Persist adjusted values onto the saved routine. Omit for one-off history (e.g. a past session), which has no "default" to save. */
  onSaveDefault?: (values: ExerciseRoutineAdjustValues) => void;
};

export function ExerciseRoutineAdjustSheet({
  open,
  onOpenChange,
  routine,
  onStart,
  onSaveDefault,
}: ExerciseRoutineAdjustSheetProps) {
  const [exerciseType, setExerciseType] = useState<ExerciseType>("cardio");
  const [intensity, setIntensity] = useState<ExerciseIntensity>("moderate");
  const [duration, setDuration] = useState("45");
  const [durationError, setDurationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !routine) return;
    setExerciseType(routine.exerciseType);
    setIntensity(routine.intensity);
    setDuration(String(routine.durationMinutes));
    setDurationError(null);
  }, [open, routine]);

  const presets = useMemo(
    () => durationPresetsFor(routine?.durationMinutes ?? 45),
    [routine?.durationMinutes],
  );

  const parsedDuration = clampExerciseDurationMinutes(Number(duration));
  const isDirty =
    !!routine &&
    (exerciseType !== routine.exerciseType ||
      intensity !== routine.intensity ||
      (parsedDuration != null && parsedDuration !== routine.durationMinutes) ||
      (parsedDuration == null && duration !== String(routine.durationMinutes)));

  const resolveValues = (): ExerciseRoutineAdjustValues | null => {
    const durationMinutes = clampExerciseDurationMinutes(Number(duration));
    if (durationMinutes == null) {
      setDurationError("Enter 5–300 minutes.");
      return null;
    }
    setDurationError(null);
    return { exerciseType, intensity, durationMinutes };
  };

  if (!routine) return null;

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Adjust workout"
      description={
        onSaveDefault
          ? `${routine.name} — tweak this session, or save as the new default.`
          : `${routine.name} — tweak this session before you start.`
      }
      bodyClassName="overflow-y-auto overscroll-contain px-4 pb-6"
    >
      <div className="space-y-5" data-testid="exercise-routine-adjust-sheet">
        <div className="space-y-2">
          <Label htmlFor="adjust-duration" className="text-xs font-medium text-muted-foreground">
            Duration
          </Label>
          <div className="flex flex-wrap gap-2">
            {presets.map((mins) => {
              const selected = duration === String(mins);
              return (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    setDuration(String(mins));
                    setDurationError(null);
                  }}
                  className={cn(
                    "min-h-9 rounded-full border px-3.5 text-sm font-medium transition-colors",
                    selected
                      ? "border-emerald-500/50 bg-emerald-500/12 text-emerald-800 dark:text-emerald-200"
                      : "border-border/60 bg-muted/20 text-foreground hover:border-emerald-500/35",
                  )}
                  data-testid={`button-adjust-duration-${mins}`}
                >
                  {mins} min
                </button>
              );
            })}
          </div>
          <Input
            id="adjust-duration"
            inputMode="numeric"
            value={duration}
            onChange={(e) => {
              setDuration(e.target.value.replace(/\D/g, ""));
              setDurationError(null);
            }}
            className="h-10"
            placeholder="Minutes"
            data-testid="input-adjust-duration"
            aria-invalid={durationError ? true : undefined}
          />
          {durationError ? (
            <p className="text-xs text-destructive" data-testid="text-adjust-duration-error">
              {durationError}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Intensity</p>
          <div className="grid grid-cols-3 gap-2">
            {EXERCISE_INTENSITY_OPTIONS.map((opt) => {
              const selected = intensity === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setIntensity(opt.value)}
                  className={cn(
                    "min-h-10 rounded-xl border px-2 text-sm font-medium transition-colors",
                    selected
                      ? "border-emerald-500/50 bg-emerald-500/12 text-emerald-800 dark:text-emerald-200"
                      : "border-border/60 bg-muted/20 text-foreground hover:border-emerald-500/35",
                  )}
                  data-testid={`button-adjust-intensity-${opt.value}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="adjust-type" className="text-xs font-medium text-muted-foreground">
            Type
          </Label>
          <Select value={exerciseType} onValueChange={(v) => setExerciseType(v as ExerciseType)}>
            <SelectTrigger id="adjust-type" className="h-10 rounded-xl" data-testid="select-adjust-type">
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

        <div className="space-y-2 pt-1">
          <Button
            type="button"
            className="h-11 w-full gap-2 rounded-xl"
            onClick={() => {
              const values = resolveValues();
              if (!values) return;
              onStart(values);
              onOpenChange(false);
            }}
            data-testid="button-adjust-start"
          >
            <Play className="h-4 w-4" aria-hidden />
            Start with these
          </Button>
          {onSaveDefault ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full gap-2 rounded-xl"
              disabled={!isDirty || parsedDuration == null}
              onClick={() => {
                const values = resolveValues();
                if (!values) return;
                onSaveDefault(values);
                onOpenChange(false);
              }}
              data-testid="button-adjust-save-default"
            >
              <Save className="h-4 w-4" aria-hidden />
              Save as default
            </Button>
          ) : null}
        </div>
      </div>
    </BottomSheet>
  );
}

/** Subtle icon button used on routine rows to open the adjust sheet. */
export function ExerciseRoutineAdjustTrigger({
  onClick,
  disabled,
  testId,
  className,
}: {
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/80 text-muted-foreground shadow-sm transition-colors",
        "hover:border-emerald-500/40 hover:bg-emerald-500/[0.08] hover:text-emerald-700 dark:hover:text-emerald-300",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      aria-label="Adjust before starting"
      data-testid={testId}
    >
      <Pencil className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}
