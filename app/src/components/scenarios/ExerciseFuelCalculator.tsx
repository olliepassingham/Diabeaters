import { useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { Calculator, ChevronDown, Dumbbell, Minus, TrendingDown, TrendingUp, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { InlineInfoHint } from "@/components/ui/field-label-with-info";
import { MedicalNumericOutputDisclaimer } from "@/components/medical-numeric-output-disclaimer";
import { MedicalSourcesLink } from "@/components/medical-sources-link";
import { preExerciseInsulinSuppressedMessage } from "@/lib/exercise-reading-guidance";
import {
  EXERCISE_INTENSITY_OPTIONS,
  EXERCISE_MEAL_TYPE_OPTIONS,
  EXERCISE_START_IN_OPTIONS,
  EXERCISE_TYPE_OPTIONS,
} from "@/lib/exercise-catalog";
import {
  computeExerciseFuelPlan,
  type ExerciseFuelCalculatorResult,
} from "@/lib/exercise-fuel-calculator";
import {
  formatCarbsForScenario,
  type CarbSourceScenario,
} from "@/lib/carb-source-preferences";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import {
  storage,
  DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT,
  DIABEATER_PROFILE_CHANGED_EVENT,
  type ExerciseBgTrend,
  type ExerciseIntensity,
  type ExerciseType,
  type UserProfile,
} from "@/lib/storage";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

type FoodMode = "known" | "suggest";

const BG_TREND_BUTTONS: {
  value: ExerciseBgTrend | "";
  shortLabel: string;
  ariaLabel: string;
  testId: string;
  icon?: "none" | "up" | "down";
}[] = [
  { value: "", shortLabel: "—", ariaLabel: "Trend not set", testId: "efc-trend-none" },
  { value: "flat", shortLabel: "Flat", ariaLabel: "Flat trend", testId: "efc-trend-flat" },
  { value: "rising", shortLabel: "Up", ariaLabel: "Rising trend", testId: "efc-trend-rising", icon: "up" },
  { value: "falling", shortLabel: "Down", ariaLabel: "Falling trend", testId: "efc-trend-falling", icon: "down" },
];

/** Shared pill grid so timing/trend controls fit one row on narrow phones. */
const EFC_PILL_GRID =
  "grid w-full gap-1 [&_button]:h-9 [&_button]:min-w-0 [&_button]:px-1 [&_button]:text-[11px] sm:[&_button]:px-2 sm:[&_button]:text-xs";

function PlanDetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="text-sm leading-relaxed text-popover-foreground/90">{children}</div>
    </div>
  );
}

/** One-line hint from profile carb source for this scenario (e.g. "about 3 Running gel"). */
function TreatmentHint({
  carbsGrams,
  profile,
  scenario,
  suffix,
  className,
}: {
  carbsGrams: number;
  profile: Partial<UserProfile> | undefined;
  scenario: CarbSourceScenario;
  suffix?: string;
  className?: string;
}) {
  const line = formatCarbsForScenario(carbsGrams, profile, scenario);
  if (!line) return null;
  return (
    <p className={cn("text-[11px] leading-snug text-muted-foreground", className)}>
      {line}
      {suffix ? ` ${suffix}` : null}
    </p>
  );
}

function ExerciseFuelPlanDetails({
  result,
  bgUnits,
  sessionLine,
  profile,
}: {
  result: ExerciseFuelCalculatorResult;
  bgUnits: string;
  sessionLine: string;
  profile: Partial<UserProfile> | undefined;
}) {
  const settings = storage.getSettings();
  const mealTreatment = formatCarbsForScenario(result.mealCarbs, profile, "hypo");
  const onHandTreatment = formatCarbsForScenario(result.onHandCarbs, profile, "exercise_on_hand");
  const duringTreatment =
    result.duringCarbs > 0 ? formatCarbsForScenario(result.duringCarbs, profile, "exercise_during") : null;
  const showMealTreatmentInDetails = mealTreatment && !result.insulinSuppressedReason;

  return (
    <div className="space-y-3">
      <PlanDetailSection title="Summary">
        <p>{result.headline}</p>
        <p className="mt-1 text-muted-foreground">{sessionLine}</p>
        <p className="mt-1 text-muted-foreground">Target BG {result.targetBg} · educational only</p>
      </PlanDetailSection>

      {showMealTreatmentInDetails || onHandTreatment || duringTreatment ? (
        <PlanDetailSection title="In your usual treatment">
          {showMealTreatmentInDetails ? <p>Before exercise: {mealTreatment}</p> : null}
          {onHandTreatment ? (
            <p className={showMealTreatmentInDetails ? "mt-1" : undefined}>On hand: {onHandTreatment}</p>
          ) : null}
          {duringTreatment ? (
            <p className={showMealTreatmentInDetails || onHandTreatment ? "mt-1" : undefined}>
              During: {duringTreatment}
            </p>
          ) : null}
        </PlanDetailSection>
      ) : null}

      {result.insulin ? (
        <PlanDetailSection title="Meal insulin estimate">
          <p>
            Usually ~{result.insulin.standardUnits}u for {result.insulin.carbsGrams}g {result.insulin.mealType},
            reduced by {result.insulin.reductionPercent}% for this session → {result.insulin.adjustedUnits} units shown.
          </p>
        </PlanDetailSection>
      ) : null}

      {result.insulinSuppressedReason ? (
        <PlanDetailSection title="Why no meal insulin">
          <p>{preExerciseInsulinSuppressedMessage(result.insulinSuppressedReason, bgUnits, settings)}</p>
        </PlanDetailSection>
      ) : null}

      {result.insulinNoRatios && result.mealCarbs > 0 ? (
        <PlanDetailSection title="Insulin estimate">
          <p>
            Add meal ratios in Settings for a dose in units. Many teams use about {result.bolusReductionBand} less meal
            insulin before exercise.
          </p>
        </PlanDetailSection>
      ) : null}

      {result.pumpTip ? (
        <PlanDetailSection title="Pump">
          <p>{result.pumpTip}</p>
        </PlanDetailSection>
      ) : null}
    </div>
  );
}

/**
 * Pre-exercise fuel & insulin calculator (meal-tool style).
 */
export function ExerciseFuelCalculator() {
  const [exerciseType, setExerciseType] = useState<ExerciseType>("cardio");
  const [intensity, setIntensity] = useState<ExerciseIntensity>("moderate");
  const [duration, setDuration] = useState("45");
  const [minutesUntilStart, setMinutesUntilStart] = useState<number>(30);
  const [fasted, setFasted] = useState(false);
  const [foodMode, setFoodMode] = useState<FoodMode>("known");
  const [mealCarbs, setMealCarbs] = useState("");
  const [mealType, setMealType] = useState("snack");
  const [currentBg, setCurrentBg] = useState("");
  const [bgTrend, setBgTrend] = useState<ExerciseBgTrend | "">("");
  const [rapidInsulin2h, setRapidInsulin2h] = useState(false);
  const [lastMealMins, setLastMealMins] = useState("");
  const [lastMealCarbs, setLastMealCarbs] = useState("");
  const [result, setResult] = useState<ExerciseFuelCalculatorResult | null>(null);
  const [bgUnits, setBgUnits] = useState("mmol/L");
  const [isPump, setIsPump] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const [hasActiveExercise, setHasActiveExercise] = useState(() => Boolean(storage.getActiveExercise()));
  const [profile, setProfile] = useState<Partial<UserProfile> | undefined>(() => storage.getProfile() ?? undefined);

  useEffect(() => {
    const sync = () => {
      const p = storage.getProfile();
      setProfile(p ?? undefined);
      if (p?.bgUnits) setBgUnits(p.bgUnits);
      setIsPump(isPumpDeliveryMethod(p?.insulinDeliveryMethod));
    };
    sync();
    window.addEventListener(DIABEATER_PROFILE_CHANGED_EVENT, sync);
    return () => window.removeEventListener(DIABEATER_PROFILE_CHANGED_EVENT, sync);
  }, []);

  useEffect(() => {
    const onActiveExercise = () => {
      const active = Boolean(storage.getActiveExercise());
      setHasActiveExercise(active);
      if (active) setFormOpen(false);
    };
    onActiveExercise();
    window.addEventListener(DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT, onActiveExercise);
    return () => window.removeEventListener(DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT, onActiveExercise);
  }, []);

  const canCalculate = useMemo(() => {
    const d = parseInt(duration, 10);
    if (!Number.isFinite(d) || d < 1) return false;
    if (foodMode === "known") {
      const c = parseInt(mealCarbs, 10);
      return Number.isFinite(c) && c > 0;
    }
    return true;
  }, [duration, foodMode, mealCarbs]);

  const handleCalculate = () => {
    const durationMinutes = parseInt(duration, 10);
    if (!Number.isFinite(durationMinutes) || durationMinutes < 1) return;

    const settings = storage.getSettings();
    const bgParsed = parseFloat(currentBg.replace(",", "."));
    const mealCarbsGrams =
      foodMode === "known" ? parseInt(mealCarbs, 10) : undefined;
    const lastMins = lastMealMins.trim() ? parseInt(lastMealMins, 10) : undefined;
    const lastCarbs = lastMealCarbs.trim() ? parseInt(lastMealCarbs, 10) : undefined;

    const next = computeExerciseFuelPlan({
      exerciseType,
      intensity,
      durationMinutes,
      minutesUntilStart,
      fasted,
      bgUnits,
      settings,
      isPump,
      mealCarbsGrams: mealCarbsGrams != null && Number.isFinite(mealCarbsGrams) ? mealCarbsGrams : undefined,
      mealType,
      currentBg: Number.isFinite(bgParsed) ? bgParsed : undefined,
      bgTrend: bgTrend || null,
      rapidInsulinLast2h: rapidInsulin2h,
      lastMealMinutesAgo: Number.isFinite(lastMins) ? lastMins : undefined,
      lastMealCarbsGrams: Number.isFinite(lastCarbs) ? lastCarbs : undefined,
    });
    setResult(next);
    setFormOpen(false);
    window.requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const sessionLine = useMemo(() => {
    const typeLabel = EXERCISE_TYPE_OPTIONS.find((o) => o.value === exerciseType)?.label ?? exerciseType;
    const intensityLabel = EXERCISE_INTENSITY_OPTIONS.find((o) => o.value === intensity)?.label ?? intensity;
    const start =
      minutesUntilStart <= 0 ? "now" : minutesUntilStart === 60 ? "~1h" : `${minutesUntilStart}m`;
    return `${intensityLabel} ${typeLabel} · ${duration} min · ${start}`;
  }, [exerciseType, intensity, duration, minutesUntilStart]);

  const collapsedSummary = useMemo(() => {
    if (!result || formOpen) return null;
    return `${sessionLine} — tap to edit`;
  }, [result, formOpen, sessionLine]);

  return (
    <div className="space-y-4">
      <Card className="surface-card border-border/70 shadow-sm overflow-hidden" data-testid="exercise-fuel-calculator">
        <Collapsible open={formOpen} onOpenChange={setFormOpen} className="group">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-start justify-between gap-3 px-6 py-4 text-left hover:bg-muted/30 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              data-testid="efc-collapsible-trigger"
              aria-expanded={formOpen}
            >
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary shrink-0" aria-hidden />
                  Pre-exercise fuel &amp; insulin
                </CardTitle>
                <CardDescription>
                  {collapsedSummary ?? "Carb and insulin numbers for your session and food plan."}
                </CardDescription>
              </div>
              <ChevronDown
                className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5 transition-transform group-data-[state=open]:rotate-180"
                aria-hidden
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-5 pt-0">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your session</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="efc-type">Activity</Label>
                <Select value={exerciseType} onValueChange={(v) => setExerciseType(v as ExerciseType)}>
                  <SelectTrigger id="efc-type" data-testid="efc-exercise-type">
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
              <div className="space-y-1.5">
                <Label htmlFor="efc-intensity">Intensity</Label>
                <Select value={intensity} onValueChange={(v) => setIntensity(v as ExerciseIntensity)}>
                  <SelectTrigger id="efc-intensity" data-testid="efc-intensity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXERCISE_INTENSITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="efc-duration">Duration (min)</Label>
                <Input
                  id="efc-duration"
                  type="number"
                  inputMode="numeric"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  data-testid="efc-duration"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Starting in</Label>
                <div className={cn(EFC_PILL_GRID, "grid-cols-5")} role="group" aria-label="Minutes until exercise starts">
                  {EXERCISE_START_IN_OPTIONS.map((m) => (
                    <Button
                      key={m}
                      type="button"
                      size="sm"
                      variant={minutesUntilStart === m ? "default" : "outline"}
                      className="w-full tabular-nums"
                      onClick={() => setMinutesUntilStart(m)}
                      data-testid={`efc-start-${m}`}
                    >
                      {m === 0 ? "Now" : `${m}m`}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="efc-bg">BG now ({bgUnits})</Label>
                <Input
                  id="efc-bg"
                  inputMode="decimal"
                  placeholder="optional"
                  value={currentBg}
                  onChange={(e) => setCurrentBg(e.target.value)}
                  data-testid="efc-bg"
                />
              </div>
              <div className="flex items-end pb-0.5">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={rapidInsulin2h} onCheckedChange={setRapidInsulin2h} data-testid="efc-rapid-insulin" />
                  Insulin in last 2h
                </label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Trend</Label>
              <div className={cn(EFC_PILL_GRID, "grid-cols-4")} role="group" aria-label="Blood glucose trend">
                {BG_TREND_BUTTONS.map((opt) => (
                  <Button
                    key={opt.testId}
                    type="button"
                    size="sm"
                    variant={bgTrend === opt.value ? "default" : "outline"}
                    className="w-full flex flex-col items-center justify-center gap-0.5 leading-none"
                    onClick={() => setBgTrend(opt.value)}
                    data-testid={opt.testId}
                    aria-label={opt.ariaLabel}
                    aria-pressed={bgTrend === opt.value}
                  >
                    {opt.value === "" ? (
                      <Minus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    ) : opt.icon === "up" ? (
                      <TrendingUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    ) : opt.icon === "down" ? (
                      <TrendingDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    ) : null}
                    <span>{opt.shortLabel}</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/15 px-3 py-2">
              <Label htmlFor="efc-fasted" className="text-sm cursor-pointer">
                Training fasted
              </Label>
              <Switch
                id="efc-fasted"
                checked={fasted}
                onCheckedChange={(v) => {
                  setFasted(v);
                  if (v) {
                    setLastMealMins("");
                    setLastMealCarbs("");
                  }
                }}
                data-testid="efc-fasted"
              />
            </div>

            {!fasted ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="efc-last-meal">Last meal (min ago)</Label>
                  <Input
                    id="efc-last-meal"
                    type="number"
                    placeholder="optional"
                    value={lastMealMins}
                    onChange={(e) => setLastMealMins(e.target.value)}
                    data-testid="efc-last-meal-mins"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="efc-last-carbs">Carbs in that meal (g)</Label>
                  <Input
                    id="efc-last-carbs"
                    type="number"
                    placeholder="optional"
                    value={lastMealCarbs}
                    onChange={(e) => setLastMealCarbs(e.target.value)}
                    data-testid="efc-last-meal-carbs"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-3 border-t border-border/50 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Food before exercise</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={foodMode === "known" ? "default" : "outline"}
                onClick={() => setFoodMode("known")}
                data-testid="efc-food-known"
              >
                I know my carbs
              </Button>
              <Button
                type="button"
                size="sm"
                variant={foodMode === "suggest" ? "default" : "outline"}
                onClick={() => setFoodMode("suggest")}
                data-testid="efc-food-suggest"
              >
                Suggest carbs for me
              </Button>
            </div>

            {foodMode === "known" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="efc-meal-carbs">Carbs you will eat (g)</Label>
                  <Input
                    id="efc-meal-carbs"
                    type="number"
                    placeholder="e.g. 40"
                    value={mealCarbs}
                    onChange={(e) => setMealCarbs(e.target.value)}
                    data-testid="efc-meal-carbs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="efc-meal-type">Meal type</Label>
                  <Select value={mealType} onValueChange={setMealType}>
                    <SelectTrigger id="efc-meal-type" data-testid="efc-meal-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXERCISE_MEAL_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                We will suggest carbs from your activity, intensity, duration, and whether you are fasted — then
                estimate insulin if ratios are set in Settings.
              </p>
            )}
          </div>

          <Button
            type="button"
            className="w-full gap-2"
            disabled={!canCalculate}
            onClick={handleCalculate}
            data-testid="efc-calculate"
          >
            <Dumbbell className="h-4 w-4" aria-hidden />
            Calculate
          </Button>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {result && !hasActiveExercise ? (
        <Card
          ref={resultRef}
          className="border-primary/25 bg-primary/5 shadow-sm scroll-mt-4"
          data-testid="efc-result"
        >
          <CardHeader className="space-y-2 pb-2">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-lg">Your plan</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => {
                  setResult(null);
                  setFormOpen(true);
                }}
                aria-label="Clear result"
                data-testid="efc-clear"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-0.5">
              <p className="min-w-0 flex-1 text-sm text-muted-foreground">{sessionLine}</p>
              <InlineInfoHint
                ariaLabel="About this plan"
                className="h-9 w-9 shrink-0"
                content={
                  <ExerciseFuelPlanDetails
                    result={result}
                    bgUnits={bgUnits}
                    sessionLine={sessionLine}
                    profile={profile}
                  />
                }
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.mealCarbs > 0 ? (
              <div className="rounded-2xl border border-primary/25 bg-background/90 px-4 py-4 text-center shadow-sm">
                <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
                  {result.mealCarbsIsSuggested ? "~" : ""}
                  {result.mealCarbs}g
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">carbs before exercise</p>
                {result.insulinSuppressedReason ? (
                  <TreatmentHint
                    carbsGrams={result.mealCarbs}
                    profile={profile}
                    scenario="hypo"
                    suffix="to bring BG up"
                    className="mt-1.5"
                  />
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-border/50 bg-background/80 px-4 py-3 text-center">
                <p className="text-sm text-muted-foreground">No pre-exercise carbs suggested</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">~{result.onHandCarbs}g</p>
                <p className="text-sm text-muted-foreground">fast carbs on hand</p>
                <TreatmentHint
                  carbsGrams={result.onHandCarbs}
                  profile={profile}
                  scenario="exercise_on_hand"
                  className="mt-1"
                />
              </div>
            )}

            {result.mealCarbs > 0 ? (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl border border-border/50 bg-muted/15 px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">On hand</p>
                  <p className="font-semibold tabular-nums">~{result.onHandCarbs}g</p>
                  <TreatmentHint carbsGrams={result.onHandCarbs} profile={profile} scenario="exercise_on_hand" className="mt-0.5" />
                </div>
                <div className="rounded-xl border border-border/50 bg-muted/15 px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">During</p>
                  <p className="font-semibold tabular-nums">
                    {result.duringCarbs > 0 ? `~${result.duringCarbs}g` : "—"}
                  </p>
                  {result.duringCarbs > 0 ? (
                    <TreatmentHint carbsGrams={result.duringCarbs} profile={profile} scenario="exercise_during" className="mt-0.5" />
                  ) : null}
                </div>
              </div>
            ) : null}

            {result.insulin ? (
              <div className="flex items-center gap-1 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground">Meal insulin</p>
                  <p className="text-2xl font-bold tabular-nums leading-none">{result.insulin.adjustedUnits} units</p>
                </div>
                <InlineInfoHint
                  ariaLabel="Meal insulin estimate details"
                  className="h-9 w-9 shrink-0"
                  content={
                    <p className="text-sm leading-relaxed">
                      Usually ~{result.insulin.standardUnits}u for {result.insulin.carbsGrams}g{" "}
                      {result.insulin.mealType}, reduced by {result.insulin.reductionPercent}% for this session.
                    </p>
                  }
                />
              </div>
            ) : result.insulinSuppressedReason && result.mealCarbs > 0 ? (
              <div className="flex items-center gap-1 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5">
                <p className="min-w-0 flex-1 text-sm font-medium text-foreground">No meal insulin at this reading</p>
                <InlineInfoHint
                  ariaLabel="Why no meal insulin is suggested"
                  className="h-9 w-9 shrink-0"
                  content={
                    <p className="text-sm leading-relaxed">
                      {preExerciseInsulinSuppressedMessage(
                        result.insulinSuppressedReason,
                        bgUnits,
                        storage.getSettings(),
                      )}
                    </p>
                  }
                />
              </div>
            ) : result.insulinNoRatios && result.mealCarbs > 0 ? (
              <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
                <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                  Add ratios in{" "}
                  <Link href="/settings" className="font-medium text-primary underline-offset-4 hover:underline">
                    Settings
                  </Link>{" "}
                  for a dose
                </p>
                <InlineInfoHint
                  ariaLabel="About insulin estimates"
                  className="h-9 w-9 shrink-0"
                  content={
                    <p className="text-sm leading-relaxed">
                      Many teams use about {result.bolusReductionBand} less meal insulin before exercise. Add meal
                      ratios in Settings for a dose in units.
                    </p>
                  }
                />
              </div>
            ) : null}

            {result.notes.length > 0 ? (
              <Collapsible>
                <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-left text-sm font-medium text-foreground">
                  <span>Session notes ({result.notes.length})</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" aria-hidden />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
                    {result.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            ) : null}

            <MedicalNumericOutputDisclaimer collapsible />
            <MedicalSourcesLink section="exercise" />

            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href="/adviser?tab=meal&exercise=1&exerciseTiming=before" data-testid="efc-adviser-link">
                Open full meal calculator
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
