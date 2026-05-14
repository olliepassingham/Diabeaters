import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MealAbsorptionVisual } from "@/lib/meal-planner-food-categories";
import { GradientMarkerBar } from "@/components/visualizations/gradient-marker-bar";

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
        <GradientMarkerBar
          markerPosition={visual.slowScore}
          endLeftLabel="Fast"
          endRightLabel="Slow"
          header={
            <>
              <span className="text-sm text-muted-foreground">Absorption time</span>
              <span className="text-sm font-semibold tabular-nums text-foreground">{visual.timeLabel}</span>
            </>
          }
          footer={
            footerNote ??
            (foodChoiceLabel ? (
              <>
                For &quot;{foodChoiceLabel}&quot; — typical pattern only, not your exact absorption.
              </>
            ) : (
              <>Typical pattern only — not your exact absorption.</>
            ))
          }
        />
      </div>
    </div>
  );
}
