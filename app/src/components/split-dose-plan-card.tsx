import { ArrowLeft, BookOpen, ChevronDown, ChevronUp, Clock3, Split } from "lucide-react";
import { useState } from "react";

import { MedicalNumericOutputDisclaimer } from "@/components/medical-numeric-output-disclaimer";
import { SplitDoseTimeline } from "@/components/split-dose-timeline";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatInsulinUnits, insulinRoundIncrement } from "@/lib/insulin-rounding";
import {
  SPLIT_FAT_OPTIONS,
  splitSecondDoseClockLabel,
  type MealSplitPlan,
} from "@/lib/meal-split-plan";
import type { SplitFatTier } from "@/lib/meal-dose";
import { getSplitFatAbsorptionVisual } from "@/lib/meal-planner-food-categories";
import { cn } from "@/lib/utils";

type SplitDosePlanCardProps = {
  plan: MealSplitPlan;
  isPumpUser: boolean;
  onFatTierChange: (tier: SplitFatTier) => void;
  onBack: () => void;
  backLabel: string;
};

export function SplitDosePlanCard({
  plan,
  isPumpUser,
  onFatTierChange,
  onBack,
  backLabel,
}: SplitDosePlanCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const roundIncrement = insulinRoundIncrement(isPumpUser);
  const laterLabel = splitSecondDoseClockLabel(plan.secondDoseDelay);
  const absorption = getSplitFatAbsorptionVisual(plan.fatTier);
  const firstLabel = formatInsulinUnits(plan.firstDose, roundIncrement);
  const secondLabel = formatInsulinUnits(plan.secondDose, roundIncrement);
  const totalLabel = formatInsulinUnits(plan.firstDose + plan.secondDose, roundIncrement);
  const mealLabel = plan.mealTime.charAt(0).toUpperCase() + plan.mealTime.slice(1);

  return (
    <div className="space-y-4 animate-fade-in-up" data-testid="split-dose-plan">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-2 gap-1.5 text-muted-foreground"
        onClick={onBack}
        data-testid="button-back-split-plan"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Button>

      <section className="relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-primary/[0.12] via-background/55 to-cyan-500/[0.08] p-4 ring-1 ring-primary/10">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <Split className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
              Split plan · {plan.splitRatio}
            </p>
            <p className="font-display text-3xl font-semibold tracking-tight tabular-nums">
              {totalLabel}
              <span className="ml-1 text-lg font-semibold text-muted-foreground">u</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {plan.carbsGrams}g · {mealLabel} · {absorption.timeLabel} absorption
            </p>
          </div>
        </div>

        <SplitDoseTimeline
          className="mt-4"
          firstDose={plan.firstDose}
          secondDose={plan.secondDose}
          delayHours={plan.secondDoseDelay}
          roundIncrement={roundIncrement}
          isPumpUser={isPumpUser}
        />
      </section>

      <section className="space-y-2.5" aria-label="What to do">
        <ol className="space-y-2">
          <li className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              1
            </span>
            <p className="pt-0.5 text-sm leading-snug">
              <span className="font-semibold">{firstLabel}u now</span>
              {isPumpUser ? " — program this part as you start the meal." : " — take this as you start the meal."}
            </p>
          </li>
          <li className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-bold text-primary">
              2
            </span>
            <p className="pt-0.5 text-sm leading-snug">
              <span className="font-semibold">Set a reminder for {laterLabel}</span>
              {" "}({plan.secondDoseDelay}h). Check glucose before the next part.
            </p>
          </li>
          <li className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-bold text-primary">
              3
            </span>
            <p className="pt-0.5 text-sm leading-snug">
              <span className="font-semibold">{secondLabel}u around {laterLabel}</span>
              {isPumpUser
                ? " if IOB and glucose still look right — or use an extended bolus instead."
                : " only if glucose is not heading low."}
            </p>
          </li>
        </ol>
      </section>

      {plan.fatTier !== "low" ? (
        <div className="flex items-start gap-2 rounded-2xl bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-950 dark:text-amber-100">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <p className="leading-snug">
            {plan.fatTier === "high"
              ? "High-fat meals can keep rising after the second dose. Check again 3–5 hours after eating."
              : "This meal may still be absorbing later. Check glucose before the second dose, and again if it keeps rising."}
          </p>
        </div>
      ) : null}

      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          How fatty is the meal?
        </p>
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Fat content">
          {SPLIT_FAT_OPTIONS.map((option) => {
            const selected = plan.fatTier === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onFatTierChange(option.value)}
                className={cn(
                  "rounded-2xl px-2 py-2.5 text-center transition-colors",
                  selected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/40 text-foreground hover:bg-muted/70",
                )}
                data-testid={`button-split-fat-${option.value}`}
              >
                <span className="block text-xs font-semibold">{option.label}</span>
                <span className={cn("mt-0.5 block text-[10px]", selected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  {option.ratio}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {SPLIT_FAT_OPTIONS.find((option) => option.value === plan.fatTier)?.examples}. Typical pattern only.
        </p>
      </section>

      <Collapsible open={showDetails} onOpenChange={setShowDetails}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-2xl bg-muted/25 px-3.5 py-3 text-left"
            data-testid="button-toggle-split-result-details"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <BookOpen className="h-4 w-4 text-primary" aria-hidden />
              Safety & calculation details
            </span>
            {showDetails ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-2 px-1 pt-3 text-sm text-muted-foreground">
            <MedicalNumericOutputDisclaimer compact />
            <p>{plan.ratioUsed}</p>
            <p>
              Fat can slow carb absorption by about {Math.max(0.5, plan.secondDoseDelay - 1)}–
              {plan.secondDoseDelay + 1} hours, so a single dose can act too early.
            </p>
            {isPumpUser ? (
              <p data-testid="pump-tip-split-bolus">
                Many pumps can do this as an extended or dual-wave bolus. Use your pump&apos;s feature if that is how
                you usually manage slower meals.
              </p>
            ) : (
              <p>Set a timer for the second dose and check glucose before taking it.</p>
            )}
            <p className="text-xs">
              Not medical advice. Everyone&apos;s response to fat varies — start conservatively and follow your diabetes
              team.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
