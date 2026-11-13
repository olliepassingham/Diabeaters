import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EXERCISE_MEAL_TYPE_OPTIONS, EXERCISE_PRE_FUEL_INTENT_OPTIONS } from "@/lib/exercise-catalog";
import {
  buildExerciseFuelActionLines,
  type ExerciseFuelCalculatorResult,
} from "@/lib/exercise-fuel-calculator";
import type { ExercisePreFuelIntent, UserSettings } from "@/lib/storage";
import { cn } from "@/lib/utils";

/** Three short chips: Meal / Snack / Not eating. */
export function PreFuelIntentPicker({
  value,
  onChange,
  testIdPrefix = "button-prefuel-intent",
}: {
  value: ExercisePreFuelIntent | null;
  onChange: (intent: ExercisePreFuelIntent) => void;
  testIdPrefix?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground">Before you start</Label>
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-muted/30 p-1" role="radiogroup" aria-label="Before you start">
        {EXERCISE_PRE_FUEL_INTENT_OPTIONS.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={cn(
                "h-10 rounded-xl px-1 text-xs font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              data-testid={`${testIdPrefix}-${o.value}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PreFuelMealFields({
  carbs,
  onCarbsChange,
  mealType,
  onMealTypeChange,
  testIdPrefix = "prefuel",
}: {
  carbs: string;
  onCarbsChange: (value: string) => void;
  mealType: string;
  onMealTypeChange: (value: string) => void;
  testIdPrefix?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-stretch gap-2">
        <Input
          id={`${testIdPrefix}-meal-carbs`}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          placeholder="Carbs"
          aria-label="Carbs in your meal"
          value={carbs}
          onChange={(e) => onCarbsChange(e.target.value.replace(/\D/g, "").slice(0, 3))}
          className="h-11 flex-1 rounded-xl border-border/60 bg-background text-lg font-semibold tabular-nums shadow-none"
          data-testid={`input-${testIdPrefix}-meal-carbs`}
        />
        <span className="flex min-w-[2.75rem] items-center justify-center rounded-xl border border-border/60 bg-muted/40 px-2 text-sm font-semibold text-muted-foreground">
          g
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1" role="group" aria-label="Meal type">
        {EXERCISE_MEAL_TYPE_OPTIONS.map((o) => (
          <Button
            key={o.value}
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              "h-8 rounded-lg px-1 text-[11px] font-medium",
              mealType === o.value ? "bg-background text-foreground shadow-sm ring-1 ring-border/50" : "text-muted-foreground",
            )}
            onClick={() => onMealTypeChange(o.value)}
            aria-pressed={mealType === o.value}
            data-testid={`button-${testIdPrefix}-meal-type-${o.value}`}
          >
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

/**
 * Up to two short action lines — the useful numbers only.
 * `includeCarry` defaults true on Plan a workout; false on the Before step (coach already shows carry).
 */
export function PreFuelPlanSummary({
  result,
  bgUnits,
  settings,
  compact = false,
  deferTreatFirst = false,
  headerAction,
  testId = "prefuel-plan-summary",
}: {
  result: ExerciseFuelCalculatorResult;
  bgUnits: string;
  settings?: UserSettings;
  compact?: boolean;
  deferTreatFirst?: boolean;
  headerAction?: ReactNode;
  testId?: string;
  /** Kept for call-site compatibility; unused (carb favourites live on the coach carry line). */
  profile?: unknown;
}) {
  const lines = buildExerciseFuelActionLines(result, bgUnits, settings, {
    deferTreatFirst,
    includeCarry: !compact,
  });
  if (lines.length === 0) return null;

  return (
    <div className="space-y-2" data-testid={testId}>
      {headerAction ? <div className="flex justify-end">{headerAction}</div> : null}
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-background/80">
        {lines.map((line, i) => (
          <div
            key={`${line.label}-${line.value}`}
            className={cn(
              "flex items-baseline justify-between gap-3 px-3.5 py-3",
              i > 0 && "border-t border-border/40",
              line.tone === "caution" && "bg-amber-500/[0.08]",
              line.tone === "insulin" && "bg-violet-500/[0.06]",
            )}
            data-testid={
              line.label === "Take" || line.label === "Correction"
                ? "prefuel-row-insulin"
                : line.label === "Carry"
                  ? "prefuel-row-carry"
                  : "prefuel-row-eat"
            }
          >
            <p className="text-sm font-medium text-muted-foreground">{line.label}</p>
            <p className="text-xl font-bold tabular-nums leading-none text-foreground">{line.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
