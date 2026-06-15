import { BookOpen, Calculator, ChevronDown, ChevronUp, Plane, Thermometer, Utensils, X } from "lucide-react";

import { MealCarbAbsorptionPreview } from "@/components/meal-carb-absorption-preview";
import { MedicalNumericOutputDisclaimer } from "@/components/medical-numeric-output-disclaimer";
import { ScenarioResultHero, ScenarioResultHeroSuffix } from "@/components/scenarios/scenario-result-hero";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { MealAbsorptionVisual } from "@/lib/meal-planner-food-categories";
import type { MealDoseResult } from "@/lib/meal-dose";
import type { ScenarioState } from "@/lib/storage";
import { cn } from "@/lib/utils";

export type MealDoseResultCardProps = {
  mealResult: MealDoseResult;
  mealAbsorptionVisual: MealAbsorptionVisual;
  mealFoodShortLabel: string;
  isPumpUser: boolean;
  showDetails: boolean;
  onShowDetailsChange: (open: boolean) => void;
  scenarioState: ScenarioState;
  onClose: () => void;
  onGoToRatios: () => void;
  /** Full-screen result view uses larger dose typography. */
  variant?: "inline" | "page";
};

function resultTitle(mealResult: MealDoseResult): string {
  if (mealResult.exerciseContext === "during") return "During-Exercise Fuel";
  if (mealResult.exerciseContext === "before") return "Pre-Exercise Dose";
  if (mealResult.exerciseContext === "after") return "Post-Exercise Dose";
  return "Your dose suggestion";
}

function MealDoseHero({
  mealResult,
  isPumpUser,
  isPage,
}: {
  mealResult: MealDoseResult;
  isPumpUser: boolean;
  isPage: boolean;
}) {
  const compactValue = isPage ? undefined : "text-4xl";

  if (mealResult.exerciseContext === "during") {
    return (
      <ScenarioResultHero label="During exercise" value={isPumpUser ? "Usually no meal bolus" : "Usually no insulin"} valueClassName="text-3xl sm:text-4xl">
        <p className="mt-2 text-sm text-muted-foreground">
          {mealResult.carbs}g carbs
          {mealResult.standardDose != null
            ? ` · standard would be ${mealResult.standardDose}u${isPumpUser ? " (meal bolus)" : ""}`
            : ""}
        </p>
      </ScenarioResultHero>
    );
  }

  if (mealResult.exerciseContext && mealResult.standardDose !== undefined) {
    return (
      <div className="space-y-3">
        <ScenarioResultHero
          label={
            mealResult.exerciseContext === "before"
              ? `Pre-exercise${typeof mealResult.exerciseReduction === "number" ? ` · −${mealResult.exerciseReduction}%` : ""}`
              : `Post-exercise${typeof mealResult.exerciseReduction === "number" ? ` · −${mealResult.exerciseReduction}%` : ""}`
          }
          value={
            <>
              {mealResult.dose}
              <ScenarioResultHeroSuffix>u</ScenarioResultHeroSuffix>
            </>
          }
          valueTestId="text-meal-dose"
          valueClassName={compactValue}
        >
          <p className="mt-2 text-sm text-muted-foreground">
            {mealResult.carbs}g · {mealResult.mealType}
            {isPumpUser ? " · program on pump" : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            vs <span className="line-through tabular-nums">{mealResult.standardDose}u</span> standard
          </p>
        </ScenarioResultHero>
        {isPumpUser ? (
          <p className="text-center text-xs text-muted-foreground">
            Check IOB before delivering; your pump may show a different recommended bolus if automation is active.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <ScenarioResultHero
      label="Suggested dose"
      value={
        <>
          {mealResult.dose}
          <ScenarioResultHeroSuffix>u</ScenarioResultHeroSuffix>
        </>
      }
      valueTestId="text-meal-dose"
      valueClassName={compactValue}
    >
      <p className="mt-2 text-sm text-muted-foreground">
        {mealResult.carbs}g · {mealResult.mealType}
      </p>
      {isPumpUser ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Check IOB on your pump before delivering; use extended or combo bolus if your team recommends it for this meal.
        </p>
      ) : null}
    </ScenarioResultHero>
  );
}

export function MealDoseResultCard({
  mealResult,
  mealAbsorptionVisual,
  mealFoodShortLabel,
  isPumpUser,
  showDetails,
  onShowDetailsChange,
  scenarioState,
  onClose,
  onGoToRatios,
  variant = "inline",
}: MealDoseResultCardProps) {
  const isPage = variant === "page";

  return (
    <Card
      data-testid="card-meal-result"
      className={cn("border-border/60 shadow-none", isPage && "rounded-2xl")}
    >
      <CardContent className={cn("space-y-3", isPage ? "p-4 sm:p-5" : "p-4")}>
        <div className="flex items-center justify-between gap-2">
          <h4 className={cn("font-medium flex items-center gap-2", isPage && "text-base")}>
            {!isPage ? <Utensils className="h-4 w-4 text-primary shrink-0" /> : null}
            {resultTitle(mealResult)}
          </h4>
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-clear-meal-result" aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {mealResult.error === "no_ratios" ? (
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              You need insulin-to-carb ratios before the meal planner can suggest doses.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={onGoToRatios}
              data-testid="button-no-ratios-go-adviser"
            >
              <Calculator className="h-3.5 w-3.5" />
              Go to Ratio Adviser
            </Button>
          </div>
        ) : (
          <>
            <MealDoseHero mealResult={mealResult} isPumpUser={isPumpUser} isPage={isPage} />
            <MealCarbAbsorptionPreview
              carbsGrams={mealResult.carbs}
              visual={mealAbsorptionVisual}
              foodChoiceLabel={mealFoodShortLabel}
            />
            {mealResult.exerciseContext === "during" && mealResult.tips ? (
              <ul className="text-sm text-muted-foreground space-y-1">
                {mealResult.tips.map((tip, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-primary">-</span>
                    {tip}
                  </li>
                ))}
              </ul>
            ) : null}
            <Collapsible open={showDetails} onOpenChange={onShowDetailsChange}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-left"
                  data-testid="button-toggle-meal-result-details"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <BookOpen className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm font-medium">More detail</span>
                    <span className="text-xs text-muted-foreground truncate">Tips, rounding, safety notes</span>
                  </div>
                  {showDetails ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pt-2 space-y-2">
                  <MedicalNumericOutputDisclaimer compact />
                  {mealResult.roundingAdvice && (
                    <div className="p-2 bg-muted rounded text-xs text-muted-foreground">
                      <strong>Rounding guide:</strong> {mealResult.roundingAdvice}
                    </div>
                  )}
                  {mealResult.tips && mealResult.exerciseContext !== "during" ? (
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {mealResult.tips.map((tip, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-primary">-</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {scenarioState.sickDayActive && (
                    <div
                      className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800"
                      data-testid="meal-note-sick-day"
                    >
                      <div className="flex items-start gap-2">
                        <Thermometer className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          <strong>Sick day note:</strong> Your ratios may need 10-30% more insulin during illness. The
                          Sick day tool has adjusted ratios for you.
                        </p>
                      </div>
                    </div>
                  )}
                  {scenarioState.travelModeActive && Math.abs(scenarioState.travelTimezoneShift || 0) >= 2 && (
                    <div
                      className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800"
                      data-testid="meal-note-travel"
                    >
                      <div className="flex items-start gap-2">
                        <Plane className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          <strong>Travel Note:</strong> You&apos;re in a different timezone. Your usual meal times and
                          ratios may need adjusting as your body clock adapts.
                        </p>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">[Not medical advice. Always verify with your own calculations.]</p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </CardContent>
    </Card>
  );
}
