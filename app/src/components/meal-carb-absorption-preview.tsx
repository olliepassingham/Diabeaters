import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MealAbsorptionVisual } from "@/lib/meal-planner-food-categories";

type Props = {
  carbsGrams: number;
  visual: MealAbsorptionVisual;
  /** Short label for the selected food type, e.g. "Balanced" */
  foodChoiceLabel?: string;
  /** Override footer copy (otherwise uses foodChoiceLabel or generic line) */
  footerNote?: ReactNode;
  /** Root `data-testid` for tests */
  previewTestId?: string;
  className?: string;
};

/** Stacked carb + absorption bar, inspired by meal-timing previews (Fast ← → Slow). */
export function MealCarbAbsorptionPreview({
  carbsGrams,
  visual,
  foodChoiceLabel,
  footerNote,
  previewTestId = "meal-carb-absorption-preview",
  className,
}: Props) {
  const p = Math.min(0.97, Math.max(0.03, visual.slowScore));

  return (
    <div className={cn("space-y-2.5", className)} data-testid={previewTestId}>
      <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/25 px-3.5 py-3 dark:bg-muted/15">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white shadow-inner ring-2 ring-sky-400/40 dark:bg-sky-500"
          aria-hidden
        >
          <Check className="h-5 w-5 stroke-[2.5]" />
        </div>
        <p className="text-lg font-semibold tracking-tight text-foreground">
          {carbsGrams} g carbs
        </p>
      </div>

      <div className="rounded-2xl border border-border/70 bg-muted/25 px-3.5 py-3 dark:bg-muted/15">
        <div className="mb-2.5 flex items-baseline justify-between gap-2">
          <span className="text-sm text-muted-foreground">Absorption time</span>
          <span className="text-sm font-semibold tabular-nums text-foreground">{visual.timeLabel}</span>
        </div>
        <div className="relative h-2.5">
          <div
            className="absolute inset-0 rounded-full bg-gradient-to-r from-sky-950 via-sky-600 to-sky-300 dark:from-sky-950 dark:via-sky-600 dark:to-sky-200"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute top-1/2 z-10 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md"
            style={{ left: `${p * 100}%` }}
            aria-hidden
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Fast</span>
          <span>Slow</span>
        </div>
        <p className="mt-2 text-[10px] leading-snug text-muted-foreground/90">
          {footerNote ??
            (foodChoiceLabel ? (
              <>
                For &quot;{foodChoiceLabel}&quot; — typical pattern only, not your exact absorption.
              </>
            ) : (
              <>Typical pattern only — not your exact absorption.</>
            ))}
        </p>
      </div>
    </div>
  );
}
