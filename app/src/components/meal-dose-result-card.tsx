import { useMemo } from "react";
import { BookOpen, ChevronDown, ChevronUp, Plane, Split, Thermometer, X } from "lucide-react";

import { MealImpactCard } from "@/components/meal-impact-card";
import { MedicalNumericOutputDisclaimer } from "@/components/medical-numeric-output-disclaimer";
import { RatiosEditPanel } from "@/components/ratios-edit-panel";
import { ScenarioResultHero, ScenarioResultHeroSuffix } from "@/components/scenarios/scenario-result-hero";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { calculateSplitDose, formatInsulinUnits, insulinRoundIncrement, type MealDoseResult, type SplitFatTier } from "@/lib/meal-dose";
import { closedLoopSafetyNote, usesClosedLoop } from "@/lib/closed-loop";
import type { MealImpactProfile } from "@/lib/meal-impact";
import type { RatioFormat, ScenarioState, UserSettings } from "@/lib/storage";
import { cn } from "@/lib/utils";

export type MealDoseResultCardProps = {
  mealResult: MealDoseResult;
  mealImpact: MealImpactProfile | null;
  isPumpUser: boolean;
  showDetails: boolean;
  onShowDetailsChange: (open: boolean) => void;
  scenarioState: ScenarioState;
  onClose: () => void;
  onGoToRatios: () => void;
  /** Opens the standalone split-dose calculator, prefilled from this result. */
  onOpenSplitCalculator?: () => void;
  /** Needed to offer an inline ratio setup right where the "no ratios" dead-end happens. */
  settings: UserSettings;
  bgUnit: string;
  ratioFormat: RatioFormat;
  carbPortionSize?: number;
  onRatiosSaved: (settings: UserSettings) => void;
  /** Full-screen result view uses larger dose typography. */
  variant?: "inline" | "page";
};

function MealDoseHero({
  mealResult,
  isPumpUser,
  isPage,
  usesLoop,
}: {
  mealResult: MealDoseResult;
  isPumpUser: boolean;
  isPage: boolean;
  usesLoop: boolean;
}) {
  const compactValue = isPage ? undefined : "text-4xl";
  const increment = insulinRoundIncrement(isPumpUser);
  const doseLabel = formatInsulinUnits(mealResult.dose, increment);
  const standardLabel =
    mealResult.standardDose != null ? formatInsulinUnits(mealResult.standardDose, increment) : null;
  const loopNote = usesLoop ? closedLoopSafetyNote("meal", { usesClosedLoop: true }) : null;

  if (mealResult.exerciseContext === "during") {
    return (
      <ScenarioResultHero label="During exercise" value={isPumpUser ? "Usually no meal bolus" : "Usually no insulin"} valueClassName="text-3xl sm:text-4xl">
        <p className="mt-2 text-sm text-muted-foreground">
          {mealResult.carbs}g carbs
          {standardLabel != null
            ? ` · standard would be ${standardLabel}u${isPumpUser ? " (meal bolus)" : ""}`
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
              {doseLabel}
              <ScenarioResultHeroSuffix>u</ScenarioResultHeroSuffix>
            </>
          }
          valueTestId="text-meal-dose"
          valueClassName={compactValue}
        >
          <p className="mt-2 text-sm text-muted-foreground">
            {mealResult.carbs}g · {mealResult.mealType}
            {isPumpUser ? " · enter on pump" : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            vs <span className="line-through tabular-nums">{standardLabel}u</span> standard
          </p>
        </ScenarioResultHero>
        {isPumpUser ? (
          <PumpMealActions loopNote={loopNote} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ScenarioResultHero
        label={isPumpUser ? "Enter on pump" : "Suggested dose"}
        value={
          <>
            {doseLabel}
            <ScenarioResultHeroSuffix>u</ScenarioResultHeroSuffix>
          </>
        }
        valueTestId="text-meal-dose"
        valueClassName={compactValue}
      >
        <p className="mt-2 text-sm text-muted-foreground">
          {mealResult.carbs}g · {mealResult.mealType}
        </p>
      </ScenarioResultHero>
      {isPumpUser ? <PumpMealActions loopNote={loopNote} /> : null}
    </div>
  );
}

function PumpMealActions({ loopNote }: { loopNote: string | null }) {
  return (
    <ol className="space-y-1.5 rounded-xl border border-indigo-200/70 bg-indigo-50/40 px-3 py-2.5 text-sm dark:border-indigo-900/50 dark:bg-indigo-950/20" data-testid="list-pump-meal-actions">
      <li className="text-foreground/90">1. Check IOB on your pump</li>
      <li className="text-foreground/90">2. Program this bolus on the device</li>
      <li className="text-foreground/90">3. Use extended or combo bolus if your team recommends it for this meal</li>
      {loopNote ? <li className="text-xs text-muted-foreground">{loopNote}</li> : null}
    </ol>
  );
}

export function MealDoseResultCard({
  mealResult,
  mealImpact,
  isPumpUser,
  showDetails,
  onShowDetailsChange,
  scenarioState,
  onClose,
  onGoToRatios,
  onOpenSplitCalculator,
  settings,
  bgUnit,
  ratioFormat,
  carbPortionSize,
  onRatiosSaved,
  variant = "inline",
}: MealDoseResultCardProps) {
  const isPage = variant === "page";
  const usesLoop = usesClosedLoop(settings);
  const roundIncrement = insulinRoundIncrement(isPumpUser);

  const splitPreview = useMemo(() => {
    if (!mealImpact?.tailRisk || mealResult.error || !mealResult.exactDose || mealResult.exactDose <= 0) return null;
    const tier: SplitFatTier = mealImpact.composition.hasFat && mealImpact.composition.hasProtein ? "high" : "medium";
    return calculateSplitDose(mealResult.exactDose, tier, roundIncrement);
  }, [mealImpact, mealResult.error, mealResult.exactDose, roundIncrement]);

  return (
    <Card
      data-testid="card-meal-result"
      className={cn("relative border-border/60 shadow-none", isPage && "rounded-2xl")}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 z-10 h-9 w-9 rounded-full"
        onClick={onClose}
        data-testid="button-clear-meal-result"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </Button>
      <CardContent className={cn("space-y-3", isPage ? "p-4 sm:p-5" : "p-4")}>

        {mealResult.error === "no_ratios" ? (
          <div className="space-y-3" data-testid="meal-result-no-ratios">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
              You need insulin-to-carb ratios before the meal planner can suggest doses — add them below and
              we&apos;ll work out your dose right away.
            </div>
            <RatiosEditPanel
              settings={settings}
              bgUnit={bgUnit}
              ratioFormat={ratioFormat}
              carbPortionSize={carbPortionSize}
              onSaved={onRatiosSaved}
              onCancel={onGoToRatios}
              idPrefix="meal-result-ratios-setup"
            />
          </div>
        ) : mealResult.error === "invalid_carbs" ? (
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-center text-sm text-muted-foreground">
            Enter a carb amount greater than 0 to get a dose suggestion.
          </div>
        ) : (
          <>
            <MealDoseHero mealResult={mealResult} isPumpUser={isPumpUser} isPage={isPage} usesLoop={usesLoop} />
            {mealImpact ? <MealImpactCard impact={mealImpact} /> : null}
            {splitPreview ? (
              <div
                className="space-y-2 rounded-xl border border-border/60 bg-background/60 p-3"
                data-testid="meal-result-split-preview"
              >
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Split className="h-4 w-4 text-primary" aria-hidden />
                  {isPumpUser ? "Consider an extended / combo bolus" : "Consider splitting this dose"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isPumpUser
                    ? "Fat or protein can cause a delayed rise — an extended bolus may match better than a single hit."
                    : "Fat/protein in this meal can cause a delayed rise — spreading the dose may help it match."}
                </p>
                <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2 text-sm">
                  <span>
                    {isPumpUser ? "Now" : "Now"}: <strong className="tabular-nums">{formatInsulinUnits(splitPreview.firstDose, roundIncrement)}u</strong>
                  </span>
                  <span>
                    {isPumpUser ? `Extended over ${splitPreview.secondDoseDelay}h` : `In ${splitPreview.secondDoseDelay}h`}:{" "}
                    <strong className="tabular-nums">{formatInsulinUnits(splitPreview.secondDose, roundIncrement)}u</strong>
                  </span>
                </div>
                {onOpenSplitCalculator ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={onOpenSplitCalculator}
                    data-testid="button-open-split-from-result"
                  >
                    Open full split calculator
                  </Button>
                ) : null}
              </div>
            ) : null}
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
