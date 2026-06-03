import { BookOpen, Calculator, ChevronDown, ChevronUp, Plane, Thermometer, Utensils, X } from "lucide-react";

import { MealCarbAbsorptionPreview } from "@/components/meal-carb-absorption-preview";
import { MedicalNumericOutputDisclaimer } from "@/components/medical-numeric-output-disclaimer";
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
  return "Your Dose Suggestion";
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
  const mainDoseClass = isPage ? "text-5xl sm:text-6xl" : "text-4xl";
  const exerciseDoseClass = isPage ? "text-4xl sm:text-5xl" : "text-3xl";

  return (
    <Card data-testid="card-meal-result" className={cn(isPage && "border-primary/25 shadow-md")}>
      <CardContent className={cn("space-y-3", isPage ? "p-5 sm:p-6" : "p-4")}>
        <div className="flex items-center justify-between gap-2">
          <h4 className={cn("font-medium flex items-center gap-2", isPage && "text-lg")}>
            <Utensils className="h-4 w-4 text-primary shrink-0" />
            {resultTitle(mealResult)}
          </h4>
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-clear-meal-result" aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {mealResult.error === "no_ratios" ? (
          <div className="p-4 bg-muted rounded-lg text-center space-y-2">
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
            {mealResult.exerciseContext === "during" ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-blue-200/80 bg-blue-50/60 p-4 dark:border-blue-800/50 dark:bg-blue-950/25">
                  <div className="space-y-1 min-w-0 text-center sm:text-left">
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium uppercase tracking-wide">
                      During exercise
                    </p>
                    <p className={cn("font-bold text-blue-900 dark:text-blue-100", exerciseDoseClass)}>
                      {isPumpUser ? "Usually no meal bolus" : "Usually no insulin"}
                    </p>
                    <p className="text-sm text-blue-700/80 dark:text-blue-200/80">
                      {mealResult.carbs}g carbs
                      {mealResult.standardDose != null
                        ? ` • Standard would be ${mealResult.standardDose}u${isPumpUser ? " (meal bolus)" : ""}`
                        : ""}
                    </p>
                  </div>
                </div>
                <MealCarbAbsorptionPreview
                  carbsGrams={mealResult.carbs}
                  visual={mealAbsorptionVisual}
                  foodChoiceLabel={mealFoodShortLabel}
                />
                {mealResult.tips && (
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {mealResult.tips.map((tip, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-primary">-</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {mealResult.exerciseContext && mealResult.standardDose !== undefined && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-center">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Standard</p>
                      <p className="text-xl font-bold line-through text-muted-foreground">{mealResult.standardDose}u</p>
                      <p className="text-xs text-muted-foreground">
                        {mealResult.carbs}g • {mealResult.mealType}
                      </p>
                    </div>
                    <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-4 text-center dark:border-emerald-800/50 dark:bg-emerald-950/25">
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium uppercase tracking-wide">
                        {mealResult.exerciseContext === "before" ? "Pre‑exercise" : "Post‑exercise"}
                        {typeof mealResult.exerciseReduction === "number" ? ` • −${mealResult.exerciseReduction}%` : ""}
                      </p>
                      <p
                        className={cn("font-bold text-emerald-900 dark:text-emerald-100", exerciseDoseClass)}
                        data-testid="text-meal-dose"
                      >
                        {mealResult.dose}u
                      </p>
                      <p className="text-xs text-emerald-700/80 dark:text-emerald-200/80">
                        {isPumpUser ? "Adjusted bolus (program on pump)" : "Adjusted dose"}
                      </p>
                    </div>
                  </div>
                )}
                {mealResult.exerciseContext && mealResult.standardDose !== undefined && isPumpUser ? (
                  <p className="text-xs text-muted-foreground text-center">
                    Check IOB before delivering; your pump may show a different recommended bolus if automation is active.
                  </p>
                ) : null}
                {!mealResult.exerciseContext && (
                  <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-5 text-center dark:border-emerald-800/50 dark:bg-emerald-950/25">
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium uppercase tracking-wide">
                      Suggested
                    </p>
                    <p
                      className={cn("font-bold text-emerald-900 dark:text-emerald-100", mainDoseClass)}
                      data-testid="text-meal-dose"
                    >
                      {mealResult.dose}u
                    </p>
                    <p className="text-sm text-emerald-700/80 dark:text-emerald-200/80">
                      {mealResult.carbs}g • {mealResult.mealType}
                    </p>
                    {isPumpUser ? (
                      <p className="text-xs text-emerald-800/90 dark:text-emerald-200/90 pt-1">
                        Check IOB on your pump before delivering; use extended or combo bolus if your team recommends it
                        for this meal.
                      </p>
                    ) : null}
                  </div>
                )}
                <MealCarbAbsorptionPreview
                  carbsGrams={mealResult.carbs}
                  visual={mealAbsorptionVisual}
                  foodChoiceLabel={mealFoodShortLabel}
                />
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
                      {mealResult.exerciseContext && mealResult.standardDose !== undefined && isPumpUser ? (
                        <p className="text-xs text-muted-foreground text-center">
                          Check IOB before delivering; your pump may show a different recommended bolus if automation is active.
                        </p>
                      ) : null}
                      {mealResult.roundingAdvice && (
                        <div className="p-2 bg-muted rounded text-xs text-muted-foreground">
                          <strong>Rounding guide:</strong> {mealResult.roundingAdvice}
                        </div>
                      )}
                      {mealResult.tips && (
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {mealResult.tips.map((tip, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="text-primary">-</span>
                              {tip}
                            </li>
                          ))}
                        </ul>
                      )}
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
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
