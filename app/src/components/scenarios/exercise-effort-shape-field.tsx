import { Button } from "@/components/ui/button";
import { EXERCISE_EFFORT_SHAPE_OPTIONS } from "@/lib/exercise-catalog";
import type { ExerciseEffortShape } from "@/lib/storage";
import { cn } from "@/lib/utils";

export function ExerciseEffortShapeField({
  value,
  onChange,
  testIdPrefix,
  appearance = "muted",
}: {
  value: ExerciseEffortShape;
  onChange: (value: ExerciseEffortShape) => void;
  testIdPrefix: string;
  appearance?: "muted" | "emerald";
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">This intense session</p>
      <div
        className={cn(
          "grid grid-cols-2",
          appearance === "muted" ? "gap-1 rounded-2xl bg-muted/30 p-1" : "gap-2",
        )}
        role="group"
        aria-label="This intense session"
      >
        {EXERCISE_EFFORT_SHAPE_OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant="ghost"
              className={cn(
                "h-auto min-h-10 whitespace-normal rounded-xl px-2 text-xs font-medium leading-snug",
                appearance === "emerald"
                  ? selected
                    ? "border border-emerald-500/50 bg-emerald-500/12 text-emerald-800 hover:bg-emerald-500/12 dark:text-emerald-200"
                    : "border border-border/60 bg-muted/20 text-foreground hover:border-emerald-500/35"
                  : selected
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => onChange(option.value)}
              data-testid={`${testIdPrefix}-${option.value}`}
            >
              {option.label}
            </Button>
          );
        })}
      </div>
      {value === "max" ? (
        <p className="text-xs leading-snug text-muted-foreground">
          Glucose can climb during the effort, then drop afterwards.
        </p>
      ) : null}
    </div>
  );
}
