import { useMemo, useRef, useState, useCallback, type ReactNode } from "react";
import { Link } from "wouter";
import { Calculator, ChevronDown, Dumbbell, X } from "lucide-react";
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
import {
  preExerciseInsulinSuppressedMessage,
  preExerciseMealCarbsSkipMessage,
} from "@/lib/exercise-reading-guidance";
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
import { isCardioLikeExerciseType } from "@/lib/exercise-readiness";
import {
  formatCarbsForScenario,
  type CarbSourceScenario,
} from "@/lib/carb-source-preferences";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { pumpTipsCardTitle } from "@/lib/exercise-closed-loop";
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
import { ExerciseCgmBgField } from "@/components/exercise-cgm-bg-field";
import { CgmReadingSourceNote } from "@/components/cgm-reading-source-note";
import { useExerciseCgmBg } from "@/hooks/use-exercise-cgm-bg";

type FoodMode = "known" | "suggest";

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

function SessionFuelSection({
  result,
  profile,
  exerciseType,
  durationMinutes,
  compact,
}: {
  result: ExerciseFuelCalculatorResult;
  profile: Partial<UserProfile> | undefined;
  exerciseType: string;
  durationMinutes: number;
  compact?: boolean;
}) {
  const { sessionFuel } = result;
  const showInterval =
    sessionFuel.doseGrams != null &&
    sessionFuel.intervalMinutes != null &&
    isCardioLikeExerciseType(exerciseType) &&
    durationMinutes > 30;

  if (sessionFuel.carryGrams <= 0 && sessionFuel.duringTotalGrams <= 0) return null;

  const carryHint = formatCarbsForScenario(sessionFuel.carryGrams, profile, "exercise_on_hand");

  return (
    <div className="space-y-2">
      {!compact ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Session fuel</p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border/50 bg-muted/15 px-3 py-3">
          <p className="text-xs font-medium text-muted-foreground">Carry with you</p>
          <p className={cn("font-bold tabular-nums text-foreground", compact ? "text-xl" : "text-2xl")}>
            ~{sessionFuel.carryGrams}g
          </p>
          {carryHint ? <p className="mt-0.5 text-xs text-muted-foreground">{carryHint}</p> : null}
        </div>
        <div className="rounded-xl border border-border/50 bg-muted/15 px-3 py-3">
          <p className="text-xs font-medium text-muted-foreground">During session</p>
          {showInterval ? (
            <>
              <p className={cn("font-bold tabular-nums text-foreground", compact ? "text-xl" : "text-2xl")}>
                ~{sessionFuel.doseGrams}g
              </p>
              <p className="text-xs text-muted-foreground">every {sessionFuel.intervalMinutes} min</p>
            </>
          ) : sessionFuel.duringTotalGrams > 0 ? (
            <>
              <p className={cn("font-bold tabular-nums text-foreground", compact ? "text-xl" : "text-2xl")}>
                ~{sessionFuel.duringTotalGrams}g
              </p>
              <p className="text-xs text-muted-foreground">if BG drops</p>
            </>
          ) : (
            <p className="text-sm font-medium text-muted-foreground">Unlikely needed</p>
          )}
        </div>
      </div>
    </div>
  );
}

function KnownCarbsPlanHero({
  result,
  bgUnits,
  profile,
  exerciseType,
  durationMinutes,
}: {
  result: ExerciseFuelCalculatorResult;
  bgUnits: string;
  profile: Partial<UserProfile> | undefined;
  exerciseType: string;
  durationMinutes: number;
}) {
  const insulin = result.insulin;
  const projection = result.projection;

  if (result.insulinNoRatios) {
    return (
      <div className="rounded-2xl border border-border/50 bg-background/90 px-4 py-5 text-center">
        <p className="text-base text-muted-foreground">Add meal ratios in Settings for an insulin estimate</p>
        <p className="mt-2 text-4xl font-bold tabular-nums text-foreground">{result.mealCarbs}g</p>
        <p className="text-sm font-medium text-muted-foreground">pre-exercise meal</p>
      </div>
    );
  }

  if (result.insulinSuppressedReason === "hypo" || (!insulin && result.insulinSuppressedReason)) {
    return (
      <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-5 text-center">
        <p className="text-4xl font-bold tabular-nums text-foreground">0 units</p>
        <p className="mt-2 text-base font-medium text-foreground">No meal insulin at this reading</p>
        {result.insulinSuppressedReason ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {preExerciseInsulinSuppressedMessage(result.insulinSuppressedReason, bgUnits, storage.getSettings())}
          </p>
        ) : null}
      </div>
    );
  }

  if (!insulin) return null;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-b from-primary/10 via-card to-card px-4 py-5 text-center shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary/90">Pre-exercise dose</p>
        <p className="mt-1 font-display text-5xl font-bold tabular-nums tracking-tight text-foreground">{insulin.totalUnits}</p>
        <p className="mt-1 text-sm font-medium text-muted-foreground">units before exercise</p>
        {insulin.correctionUnits > 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {insulin.adjustedUnits}u meal + {insulin.correctionUnits}u correction
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-border/50 bg-background/80 px-2 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Now</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
            {projection?.currentBg ?? "—"}
          </p>
          <p className="text-[10px] text-muted-foreground">{bgUnits}</p>
        </div>
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-2 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Meal</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{result.mealCarbs}g</p>
          <p className="text-[10px] text-muted-foreground truncate">{insulin.mealType}</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-background/80 px-2 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">At start</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
            {projection?.projectedBgAtStart != null ? `~${projection.projectedBgAtStart}` : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground">{bgUnits}</p>
        </div>
      </div>

      {projection ? (
        <p className="rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5 text-sm leading-relaxed text-foreground">
          Target at exercise start: <span className="font-semibold">{projection.targetBand}</span>
          {projection.inTargetAtStart ? " — your meal + dose should land you in range." : "."}
        </p>
      ) : null}

      {result.exerciseEffectNote ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{result.exerciseEffectNote}</p>
      ) : null}

      {result.insulinSuppressedReason === "falling" ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
          BG is falling — dose reduced. Recheck before hard effort.
        </p>
      ) : null}

      <SessionFuelSection
        result={result}
        profile={profile}
        exerciseType={exerciseType}
        durationMinutes={durationMinutes}
        compact
      />
    </div>
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
  const onHandTreatment = formatCarbsForScenario(result.sessionFuel.carryGrams, profile, "exercise_on_hand");
  const duringTreatment =
    result.sessionFuel.duringTotalGrams > 0
      ? formatCarbsForScenario(result.sessionFuel.duringTotalGrams, profile, "exercise_during")
      : null;
  const showMealInDetails = result.mealCarbs > 0 && !result.userEnteredMealCarbs;

  return (
    <div className="space-y-3">
      <PlanDetailSection title="Summary">
        <p>{result.headline}</p>
        <p className="mt-1 text-muted-foreground">{sessionLine}</p>
        <p className="mt-1 text-muted-foreground">Target BG {result.targetBg} · educational only</p>
      </PlanDetailSection>

      {showMealInDetails || onHandTreatment || duringTreatment ? (
        <PlanDetailSection title="In your usual treatment">
          {showMealInDetails ? (
            <p>
              Before exercise: {result.mealCarbs}g
              {result.mealCarbsIsSuggested ? " (suggested)" : ""}
            </p>
          ) : null}
          {onHandTreatment ? (
            <p className={showMealInDetails ? "mt-1" : undefined}>Carry with you: {onHandTreatment}</p>
          ) : null}
          {duringTreatment ? (
            <p className={showMealInDetails || onHandTreatment ? "mt-1" : undefined}>During: {duringTreatment}</p>
          ) : null}
        </PlanDetailSection>
      ) : null}

      {result.insulin ? (
        <PlanDetailSection title="Meal insulin estimate">
          <p>
            Usually ~{result.insulin.standardUnits}u for {result.insulin.carbsGrams}g {result.insulin.mealType},
            reduced by {result.insulin.reductionPercent}% for this session → {result.insulin.adjustedUnits}u meal bolus
            {result.insulin.correctionUnits > 0
              ? ` + ${result.insulin.correctionUnits}u correction → ${result.insulin.totalUnits}u total`
              : ` → ${result.insulin.totalUnits}u total`}
            .
          </p>
          {result.projection?.projectedBgAtStart != null ? (
            <p className="mt-1">
              Projected BG at exercise start: ~{result.projection.projectedBgAtStart} {bgUnits} (target{" "}
              {result.projection.targetBand}).
            </p>
          ) : null}
        </PlanDetailSection>
      ) : null}

      {result.exerciseEffectNote ? (
        <PlanDetailSection title="Exercise effect">
          <p>{result.exerciseEffectNote}</p>
        </PlanDetailSection>
      ) : null}

      {result.insulinSuppressedReason && !result.insulin ? (
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

      <PlanDetailSection title="How we calculated this">
        <ul className="list-disc space-y-1 pl-4">
          <li>
            Session: {result.breakdown.intensityLabel} {result.breakdown.activityLabel} ·{" "}
            {result.breakdown.durationMinutes} min
          </li>
          <li>Pre buffer (if you need fuel): ~{result.breakdown.preBufferGrams}g</li>
          <li>During session (fast carbs ready): ~{result.breakdown.duringGrams}g</li>
          <li>Carry with you: ~{result.sessionFuel.carryGrams}g</li>
          {result.sessionFuel.doseGrams != null && result.sessionFuel.intervalMinutes != null ? (
            <li>
              During interval: ~{result.sessionFuel.doseGrams}g every {result.sessionFuel.intervalMinutes} min
            </li>
          ) : null}
          {result.breakdown.mealCarbsSource === "user" ? (
            <li>Pre-meal carbs: your entry ({result.mealCarbs}g)</li>
          ) : result.breakdown.mealCarbsSource === "suggested" ? (
            <li>Pre-meal carbs suggested from buffer: ~{result.mealCarbs}g (BG/trend/fasted)</li>
          ) : result.breakdown.mealCarbsSkipReason ? (
            <li>{preExerciseMealCarbsSkipMessage(result.breakdown.mealCarbsSkipReason, bgUnits)}</li>
          ) : (
            <li>No pre-meal carbs suggested — keep fast carbs on hand for the full session.</li>
          )}
          {result.insulin ? (
            <>
              <li>{result.breakdown.ratioDescription ?? "Ratio from Settings"}</li>
              <li>
                Standard dose ~{result.breakdown.standardUnits}u → {result.breakdown.reductionPercent}% exercise
                reduction → {result.insulin.adjustedUnits}u meal bolus
                {result.insulin.correctionUnits > 0
                  ? ` + ${result.insulin.correctionUnits}u correction → ${result.insulin.totalUnits}u total`
                  : ""}
                {result.breakdown.adjustedUnitsExact != null &&
                result.breakdown.adjustedUnitsExact !== result.insulin.adjustedUnits
                  ? ` (exact meal ${result.breakdown.adjustedUnitsExact}u before rounding)`
                  : ""}
              </li>
            </>
          ) : result.projectedInsulinAtTarget ? (
            <li>
              Projected at target band: ~{result.projectedInsulinAtTarget.totalUnits}u for {result.mealCarbs}g once BG
              is in range ({result.projectedInsulinAtTarget.adjustedUnits}u meal
              {result.projectedInsulinAtTarget.correctionUnits > 0
                ? ` + ${result.projectedInsulinAtTarget.correctionUnits}u correction`
                : ""}
              )
            </li>
          ) : result.insulinSuppressedReason ? (
            <li>{preExerciseInsulinSuppressedMessage(result.insulinSuppressedReason, bgUnits, settings)}</li>
          ) : null}
        </ul>
      </PlanDetailSection>

      {result.pumpTip ? (
        <PlanDetailSection title={pumpTipsCardTitle(settings)}>
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
  const hasCalculatedRef = useRef(false);
  const [hasActiveExercise, setHasActiveExercise] = useState(() => Boolean(storage.getActiveExercise()));
  const [profile, setProfile] = useState<Partial<UserProfile> | undefined>(() => storage.getProfile() ?? undefined);

  const onFuelTrendChange = (t: ExerciseBgTrend) => {
    setBgTrend(t === "not_sure" ? "" : t);
  };

  const {
    prefill: cgmPrefill,
    loading: cgmLoading,
    refresh: refreshCgm,
    emptyHint: cgmEmptyHint,
    onBgChange: onBgFieldChange,
  } = useExerciseCgmBg({
    bgValue: currentBg,
    onApplyBg: setCurrentBg,
    onApplyTrend: onFuelTrendChange,
    autoApplyKey: "fuel-calculator",
  });

  const buildFuelPlanResult = useCallback((): ExerciseFuelCalculatorResult | null => {
    const durationMinutes = parseInt(duration, 10);
    if (!Number.isFinite(durationMinutes) || durationMinutes < 1) return null;

    const settings = storage.getSettings();
    const bgParsed = parseFloat(currentBg.replace(",", "."));
    const mealCarbsGrams = foodMode === "known" ? parseInt(mealCarbs, 10) : undefined;
    const lastMins = lastMealMins.trim() ? parseInt(lastMealMins, 10) : undefined;
    const lastCarbs = lastMealCarbs.trim() ? parseInt(lastMealCarbs, 10) : undefined;

    return computeExerciseFuelPlan({
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
  }, [
    bgTrend,
    bgUnits,
    currentBg,
    duration,
    exerciseType,
    fasted,
    foodMode,
    intensity,
    isPump,
    lastMealCarbs,
    lastMealMins,
    mealCarbs,
    mealType,
    minutesUntilStart,
    rapidInsulin2h,
  ]);

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
      const bg = parseFloat(currentBg.replace(",", "."));
      return Number.isFinite(c) && c > 0 && Number.isFinite(bg) && bg > 0;
    }
    return true;
  }, [duration, foodMode, mealCarbs, currentBg]);

  const handleCalculate = () => {
    const next = buildFuelPlanResult();
    if (!next) return;
    hasCalculatedRef.current = true;
    setResult(next);
    setFormOpen(false);
    storage.recordExerciseToolUse("calculate");
    window.requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  useEffect(() => {
    if (!hasCalculatedRef.current || !canCalculate || formOpen) return;
    const next = buildFuelPlanResult();
    if (!next) return;
    setResult(next);
  }, [buildFuelPlanResult, canCalculate, formOpen]);

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

            <ExerciseCgmBgField
              bgUnits={bgUnits}
              bgValue={currentBg}
              trend={bgTrend || null}
              onBgChange={onBgFieldChange}
              onTrendChange={onFuelTrendChange}
              prefill={cgmPrefill}
              loading={cgmLoading}
              onRefresh={refreshCgm}
              emptyHint={cgmEmptyHint}
              inputTestId="efc-bg"
              trendTestIdPrefix="efc-trend"
              className="sm:col-span-2 space-y-3"
            />

            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/15 px-3 py-2 sm:col-span-2">
              <Label htmlFor="efc-rapid-insulin" className="text-sm cursor-pointer">
                Rapid-acting insulin in last 2h
              </Label>
              <Switch id="efc-rapid-insulin" checked={rapidInsulin2h} onCheckedChange={setRapidInsulin2h} data-testid="efc-rapid-insulin" />
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
            <div className="flex flex-wrap items-center gap-2">
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
              {foodMode === "suggest" ? (
                <InlineInfoHint
                  ariaLabel="How suggest mode uses BG and trend"
                  className="h-9 w-9 shrink-0"
                  content={
                    <>
                      Enter current BG and trend above — we use them to decide whether to suggest eating before you
                      start or only keeping fast carbs on hand. Meal insulin is never shown without a BG reading.
                    </>
                  }
                />
              ) : null}
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
                <p className="sm:col-span-2 text-xs text-muted-foreground leading-relaxed">
                  Enter current BG above — we estimate insulin for your carbs, exercise type, and target range (with
                  exercise reduction applied).
                </p>
              </div>
            ) : null}
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
          className="rounded-2xl border-border/60 bg-card shadow-none scroll-mt-4"
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
                  hasCalculatedRef.current = false;
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
            <CgmReadingSourceNote prefill={cgmPrefill} bgValue={currentBg} />
          </CardHeader>
          <CardContent className="space-y-4">
            {result.userEnteredMealCarbs && result.mealCarbs > 0 ? (
              <KnownCarbsPlanHero
                result={result}
                bgUnits={bgUnits}
                profile={profile}
                exerciseType={exerciseType}
                durationMinutes={parseInt(duration, 10) || result.breakdown.durationMinutes}
              />
            ) : result.mealCarbs > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-b from-primary/10 via-card to-card px-4 py-4 text-center shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-primary/90">Pre-exercise carbs</p>
                <p className="mt-1 font-display text-4xl font-bold tabular-nums tracking-tight text-foreground">
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

            {result.mealCarbsSkipReason && result.mealCarbs <= 0 ? (
              <p className="rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5 text-sm text-muted-foreground leading-relaxed">
                {preExerciseMealCarbsSkipMessage(result.mealCarbsSkipReason, bgUnits)}
              </p>
            ) : null}

            {!result.userEnteredMealCarbs && (result.mealCarbs > 0 || result.sessionFuel.carryGrams > 0) ? (
              <SessionFuelSection
                result={result}
                profile={profile}
                exerciseType={exerciseType}
                durationMinutes={parseInt(duration, 10) || result.breakdown.durationMinutes}
              />
            ) : null}

            {result.insulin && !result.userEnteredMealCarbs ? (
              <div className="flex items-center gap-1 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground">Meal insulin</p>
                  <p className="text-2xl font-bold tabular-nums leading-none">{result.insulin.totalUnits} units</p>
                </div>
                <InlineInfoHint
                  ariaLabel="Meal insulin estimate details"
                  className="h-9 w-9 shrink-0"
                  content={
                    <p className="text-sm leading-relaxed">
                      Usually ~{result.insulin.standardUnits}u for {result.insulin.carbsGrams}g{" "}
                      {result.insulin.mealType}, reduced by {result.insulin.reductionPercent}% for this session
                      {result.insulin.correctionUnits > 0
                        ? `, plus ${result.insulin.correctionUnits}u correction toward target`
                        : ""}
                      .
                    </p>
                  }
                />
              </div>
            ) : result.projectedInsulinAtTarget && !result.userEnteredMealCarbs ? (
              <div className="flex items-center gap-1 rounded-xl border border-violet-500/20 bg-violet-500/5 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground">Once in target range</p>
                  <p className="text-2xl font-bold tabular-nums leading-none">
                    ~{result.projectedInsulinAtTarget.totalUnits} units
                  </p>
                </div>
                <InlineInfoHint
                  ariaLabel="Projected insulin at target BG"
                  className="h-9 w-9 shrink-0"
                  content={
                    <p className="text-sm leading-relaxed">
                      Estimate for {result.projectedInsulinAtTarget.carbsGrams}g {result.projectedInsulinAtTarget.mealType}{" "}
                      once BG is in your pre-exercise band ({result.targetBg}). Usually ~
                      {result.projectedInsulinAtTarget.standardUnits}u before {result.projectedInsulinAtTarget.reductionPercent}%
                      exercise reduction.
                    </p>
                  }
                />
              </div>
            ) : result.insulinSuppressedReason && (result.mealCarbs > 0 || foodMode === "known") && !result.userEnteredMealCarbs ? (
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
