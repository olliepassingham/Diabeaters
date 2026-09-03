import { useMemo } from "react";
import { BookOpen, Check, ChevronDown, ChevronUp, Plane, Split, Thermometer, Utensils, X } from "lucide-react";

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
import type { MealTimelineEventStatus } from "@/lib/meal-timeline-events";
import type { RatioFormat, ScenarioState, UserSettings } from "@/lib/storage";
import { cn } from "@/lib/utils";

export type MealDoseResultCardProps = {
  mealResult: MealDoseResult;
  mealImpact: MealImpactProfile | null;
  isPumpUser: boolean;
  mealTimelineStatus?: MealTimelineEventStatus;
  onConfirmMeal?: () => void;
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
  const steps = ["Check IOB", "Enter bolus", "Follow pump"];

  return (
    <div className="space-y-2">
      <ol
        className="grid grid-cols-3 rounded-2xl bg-indigo-500/[0.08] p-1 dark:bg-indigo-400/[0.08]"
        data-testid="list-pump-meal-actions"
      >
        {steps.map((step, index) => (
          <li key={step} className="flex min-w-0 flex-col items-center gap-1 rounded-xl px-1.5 py-2 text-center">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/15 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
              {index + 1}
            </span>
            <span className="text-[11px] font-medium leading-tight text-foreground/80">{step}</span>
          </li>
        ))}
      </ol>
      {loopNote ? <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">{loopNote}</p> : null}
    </div>
  );
}

export function MealDoseResultCard({
  mealResult,
  mealImpact,
  isPumpUser,
  mealTimelineStatus,
  onConfirmMeal,
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
      className={cn(
        "relative border-border/60 shadow-none",
        isPage && "!border-0 !bg-transparent !bg-none !shadow-none",
      )}
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
      <CardContent className={cn("space-y-3", isPage ? "p-0 pt-10" : "p-4")}>

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
            {mealTimelineStatus ? (
              <div
                className="flex items-center gap-3 rounded-2xl bg-primary/[0.07] px-3 py-2.5"
                data-testid="meal-timeline-confirmation"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {mealTimelineStatus === "confirmed" ? (
                    <Check className="h-4 w-4" aria-hidden />
                  ) : (
                    <Utensils className="h-4 w-4" aria-hidden />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {mealTimelineStatus === "confirmed" ? "Meal added to your glucose timeline" : "Meal plan saved"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {mealTimelineStatus === "confirmed"
                      ? "It will appear on your CGM graph."
                      : "Confirm when you eat so your graph stays accurate."}
                  </p>
                </div>
                {mealTimelineStatus === "planned" && onConfirmMeal ? (
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 shrink-0 rounded-full px-3 text-xs"
                    onClick={onConfirmMeal}
                    data-testid="button-confirm-meal-eaten"
                  >
                    I ate this
                  </Button>
                ) : null}
              </div>
            ) : null}
            {mealImpact ? <MealImpactCard impact={mealImpact} /> : null}
            {splitPreview ? (
              <div
                className="overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-cyan-500/[0.09] via-background/70 to-primary/[0.08] p-4 ring-1 ring-primary/10"
                data-testid="meal-result-split-preview"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                    <Split className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">
                      {isPumpUser ? "A split bolus may fit better" : "A split dose may fit better"}
                    </p>
                    <p className="text-xs text-muted-foreground">Optional pattern-based suggestion</p>
                  </div>
                </div>
                <div className="relative mt-4 grid grid-cols-2 gap-5 before:absolute before:left-1/2 before:top-2 before:h-px before:w-[40%] before:-translate-x-1/2 before:bg-primary/25">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Now</span>
                    <p className="mt-0.5 font-display text-2xl font-bold tabular-nums">
                      {formatInsulinUnits(splitPreview.firstDose, roundIncrement)}
                      <span className="ml-0.5 text-sm font-semibold text-muted-foreground">u</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {isPumpUser ? `Over ${splitPreview.secondDoseDelay}h` : `In ${splitPreview.secondDoseDelay}h`}
                    </span>
                    <p className="mt-0.5 font-display text-2xl font-bold tabular-nums">
                      {formatInsulinUnits(splitPreview.secondDose, roundIncrement)}
                      <span className="ml-0.5 text-sm font-semibold text-muted-foreground">u</span>
                    </p>
                  </div>
                </div>
                {onOpenSplitCalculator ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-3 w-full rounded-full bg-background/70"
                    onClick={onOpenSplitCalculator}
                    data-testid="button-open-split-from-result"
                  >
                    Review in split calculator
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
                  className="flex w-full items-center justify-between gap-3 rounded-2xl bg-muted/25 px-3.5 py-3 text-left transition-colors hover:bg-muted/40"
                  data-testid="button-toggle-meal-result-details"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <BookOpen className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm font-medium">Safety & calculation details</span>
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
