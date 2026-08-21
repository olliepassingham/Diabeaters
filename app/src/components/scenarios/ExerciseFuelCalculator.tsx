import { useMemo, useRef, useState, useCallback, useEffect, type ReactNode } from "react";
import { Link } from "wouter";
import {
  Activity,
  BookOpen,
  Calculator,
  ChevronDown,
  Dumbbell,
  Flower2,
  Footprints,
  RotateCcw,
  Sparkles,
  Swords,
  Waves,
  X,
  Zap,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { InlineInfoHint } from "@/components/ui/field-label-with-info";
import { MedicalNumericOutputDisclaimer } from "@/components/medical-numeric-output-disclaimer";
import { MedicalSourcesLink } from "@/components/medical-sources-link";
import { ScenarioResultHero, ScenarioResultHeroSuffix } from "@/components/scenarios/scenario-result-hero";
import {
  preExerciseInsulinSuppressedMessage,
  preExerciseMealCarbsSkipMessage,
} from "@/lib/exercise-reading-guidance";
import {
  EXERCISE_INTENSITY_OPTIONS,
  EXERCISE_MEAL_TYPE_OPTIONS,
  EXERCISE_START_IN_OPTIONS,
  EXERCISE_TYPE_OPTIONS,
  exerciseStartInLabel,
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
import {
  storage,
  DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT,
  DIABEATER_PROFILE_CHANGED_EVENT,
  type ExerciseBgTrend,
  type ExerciseIntensity,
  type ExerciseType,
  type UserProfile,
} from "@/lib/storage";
import { cn } from "@/lib/utils";
import { ExerciseCgmBgField } from "@/components/exercise-cgm-bg-field";
import { CgmReadingSourceNote } from "@/components/cgm-reading-source-note";
import { useExerciseCgmBg } from "@/hooks/use-exercise-cgm-bg";

const EXERCISE_TYPE_ICONS: Record<ExerciseType, typeof Dumbbell> = {
  cardio: Activity,
  strength: Dumbbell,
  hiit: Zap,
  yoga: Flower2,
  walking: Footprints,
  court: Swords,
  field: Swords,
  swimming: Waves,
};

function ExerciseTypeIcon({ type, className }: { type: ExerciseType; className?: string }) {
  const Icon = EXERCISE_TYPE_ICONS[type] ?? Dumbbell;
  return <Icon className={className} aria-hidden />;
}

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

/** A compact result badge for meal insulin state — used for the three (mutually exclusive) non-hero insulin outcomes. */
function InsulinResultBadge({
  tone,
  title,
  value,
  info,
  testId,
}: {
  tone: "insulin" | "caution" | "neutral";
  title: ReactNode;
  value?: string;
  info: ReactNode;
  testId?: string;
}) {
  const toneClass =
    tone === "insulin"
      ? "border-violet-500/25 bg-violet-500/[0.08]"
      : tone === "caution"
        ? "border-amber-500/30 bg-amber-500/[0.08]"
        : "border-border/40 bg-muted/20";
  return (
    <div className={cn("flex items-center gap-1 rounded-2xl border px-3.5 py-3", toneClass)} data-testid={testId}>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm", value ? "text-[11px] text-muted-foreground" : "font-medium text-foreground")}>
          {title}
        </p>
        {value ? <p className="text-2xl font-bold tabular-nums leading-none">{value}</p> : null}
      </div>
      <InlineInfoHint ariaLabel="Meal insulin details" className="h-9 w-9 shrink-0" content={info} />
    </div>
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
      <ScenarioResultHero
        label="Pre-exercise meal"
        value={
          <>
            {result.mealCarbs}
            <ScenarioResultHeroSuffix>g</ScenarioResultHeroSuffix>
          </>
        }
      >
        <p className="mt-2 text-sm text-muted-foreground">Add meal ratios in Settings for an insulin estimate</p>
      </ScenarioResultHero>
    );
  }

  if (result.insulinSuppressedReason === "hypo" || (!insulin && result.insulinSuppressedReason)) {
    return (
      <ScenarioResultHero tone="caution" label="No meal insulin at this reading" value="0 units">
        {result.insulinSuppressedReason ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {preExerciseInsulinSuppressedMessage(result.insulinSuppressedReason, bgUnits, storage.getSettings())}
          </p>
        ) : null}
      </ScenarioResultHero>
    );
  }

  if (!insulin) return null;

  return (
    <div className="space-y-3">
      <ScenarioResultHero
        label="Pre-exercise dose"
        value={insulin.totalUnits}
        valueTestId="text-efc-dose"
      >
        <p className="mt-1 text-sm font-medium text-muted-foreground">units before exercise</p>
        {insulin.correctionUnits > 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {insulin.adjustedUnits}u meal + {insulin.correctionUnits}u correction
          </p>
        ) : null}
      </ScenarioResultHero>

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
  profile,
}: {
  result: ExerciseFuelCalculatorResult;
  profile: Partial<UserProfile> | undefined;
}) {
  const onHandTreatment = formatCarbsForScenario(result.sessionFuel.carryGrams, profile, "exercise_on_hand");
  const duringTreatment =
    result.sessionFuel.duringTotalGrams > 0
      ? formatCarbsForScenario(result.sessionFuel.duringTotalGrams, profile, "exercise_during")
      : null;
  const showMealInDetails = result.mealCarbs > 0 && !result.userEnteredMealCarbs;
  const whyNotes = result.notes.slice(0, 2);
  const band = result.projection?.targetBand ?? result.targetBg;

  return (
    <div className="space-y-3">
      {whyNotes.length > 0 ? (
        <PlanDetailSection title="Why this plan">
          <ul className="space-y-1.5">
            {whyNotes.map((n, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary">·</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </PlanDetailSection>
      ) : null}

      <PlanDetailSection title="Numbers">
        <ul className="list-disc space-y-1 pl-4">
          {showMealInDetails ? (
            <li>
              Pre-exercise carbs: ~{result.mealCarbs}g
              {result.mealCarbsIsSuggested ? " (suggested)" : ""}
            </li>
          ) : null}
          {onHandTreatment ? <li>Carry: {onHandTreatment}</li> : null}
          {duringTreatment ? <li>During: {duringTreatment}</li> : null}
          {result.insulin ? (
            <li>
              Meal bolus: usually ~{result.insulin.standardUnits}u → {result.insulin.reductionPercent}% less for
              exercise → {result.insulin.adjustedUnits}u
              {result.insulin.correctionUnits > 0
                ? ` + ${result.insulin.correctionUnits}u correction → ${result.insulin.totalUnits}u total`
                : ""}
            </li>
          ) : null}
          {result.preCorrection ? (
            <li>
              Reduced correction toward {band}: ~{result.preCorrection.fullUnitsBeforeReduction}u full →{" "}
              {result.preCorrection.reductionPercent}% less → ~{result.preCorrection.units}u
            </li>
          ) : null}
          {result.insulinNoRatios && result.mealCarbs > 0 ? (
            <li>Add meal ratios in Settings for a dose in units (about {result.bolusReductionBand} less is common).</li>
          ) : null}
          {result.pumpTip ? <li>{result.pumpTip}</li> : null}
          <li className="text-muted-foreground">Target {result.targetBg} · educational only</li>
        </ul>
      </PlanDetailSection>
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
  const [startInCustom, setStartInCustom] = useState("");
  const [fasted, setFasted] = useState(false);
  const [mealCarbs, setMealCarbs] = useState("");
  const [mealCarbsTouched, setMealCarbsTouched] = useState(false);
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
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
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

  // `mealCarbsOverride`: omit to use the field's current touched/untouched state; pass `null`
  // to force the "let us suggest" path regardless of what's in the field (used for the live preview).
  const buildFuelPlanResult = useCallback((mealCarbsOverride?: number | null): ExerciseFuelCalculatorResult | null => {
    const durationMinutes = parseInt(duration, 10);
    if (!Number.isFinite(durationMinutes) || durationMinutes < 1) return null;

    const settings = storage.getSettings();
    const bgParsed = parseFloat(currentBg.replace(",", "."));
    const lastMins = lastMealMins.trim() ? parseInt(lastMealMins, 10) : undefined;
    const lastCarbs = lastMealCarbs.trim() ? parseInt(lastMealCarbs, 10) : undefined;
    const userMealCarbs = mealCarbsTouched ? parseInt(mealCarbs, 10) : undefined;
    const mealCarbsGrams = mealCarbsOverride !== undefined ? mealCarbsOverride ?? undefined : userMealCarbs;

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
      profile,
    });
  }, [
    bgTrend,
    bgUnits,
    currentBg,
    duration,
    exerciseType,
    fasted,
    intensity,
    isPump,
    lastMealCarbs,
    lastMealMins,
    mealCarbs,
    mealCarbsTouched,
    mealType,
    minutesUntilStart,
    profile,
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

  // Live "what would we suggest" preview — keeps the carbs field pre-filled with our
  // estimate until the user types their own number, so there's a single always-visible field.
  const suggestedMealCarbs = useMemo(() => {
    const plan = buildFuelPlanResult(null /* force the suggested-carbs path */);
    return plan ? plan.mealCarbs : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    bgTrend,
    bgUnits,
    currentBg,
    duration,
    exerciseType,
    fasted,
    intensity,
    isPump,
    lastMealCarbs,
    lastMealMins,
    mealType,
    minutesUntilStart,
    profile,
    rapidInsulin2h,
  ]);

  useEffect(() => {
    if (mealCarbsTouched) return;
    setMealCarbs(suggestedMealCarbs != null && suggestedMealCarbs > 0 ? String(suggestedMealCarbs) : "");
  }, [suggestedMealCarbs, mealCarbsTouched]);

  const canCalculate = useMemo(() => {
    const d = parseInt(duration, 10);
    if (!Number.isFinite(d) || d < 1) return false;
    if (mealCarbsTouched) {
      const c = parseInt(mealCarbs, 10);
      const bg = parseFloat(currentBg.replace(",", "."));
      return Number.isFinite(c) && c > 0 && Number.isFinite(bg) && bg > 0;
    }
    return true;
  }, [duration, mealCarbsTouched, mealCarbs, currentBg]);

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
      minutesUntilStart <= 0
        ? "now"
        : minutesUntilStart === 90
          ? "~1.5h"
          : minutesUntilStart % 60 === 0
            ? `~${minutesUntilStart / 60}h`
            : `${minutesUntilStart}m`;
    return `${intensityLabel} ${typeLabel} · ${duration} min · ${start}`;
  }, [exerciseType, intensity, duration, minutesUntilStart]);

  const collapsedSummary = useMemo(() => {
    if (formOpen) return null;
    if (result) return sessionLine;
    return null;
  }, [result, formOpen, sessionLine]);

  return (
    <div className="space-y-4">
      <div
        className="relative overflow-hidden rounded-[1.75rem] border border-border/50 bg-card/95 shadow-sm"
        data-testid="exercise-fuel-calculator"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.05] via-transparent to-muted/20"
          aria-hidden
        />
        <Collapsible open={formOpen} onOpenChange={setFormOpen} className="group relative z-10">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left outline-none transition-colors hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
              data-testid="efc-collapsible-trigger"
              aria-expanded={formOpen}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                  <Calculator className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-semibold tracking-tight text-foreground">Fuel &amp; insulin</p>
                  {collapsedSummary ? (
                    <p className="truncate text-xs text-muted-foreground">{collapsedSummary}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Carbs and meal insulin before you start</p>
                  )}
                </div>
              </div>
              <ChevronDown
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
                aria-hidden
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-5 border-t border-border/40 px-4 pb-5 pt-4 sm:px-5">
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Your session
                </p>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Activity</Label>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {EXERCISE_TYPE_OPTIONS.map((o) => {
                      const active = exerciseType === o.value;
                      return (
                        <Button
                          key={o.value}
                          type="button"
                          size="sm"
                          variant="ghost"
                          className={cn(
                            "h-10 justify-start rounded-xl px-2.5 text-xs font-medium",
                            active
                              ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                              : "bg-muted/30 text-muted-foreground hover:text-foreground",
                          )}
                          onClick={() => setExerciseType(o.value)}
                        >
                          <ExerciseTypeIcon type={o.value} className="mr-1.5 h-3.5 w-3.5 shrink-0 opacity-80" />
                          <span className="truncate">{o.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                  <div className="sr-only" aria-hidden>
                    <Select value={exerciseType} onValueChange={(v) => setExerciseType(v as ExerciseType)}>
                      <SelectTrigger id="efc-activity" data-testid="efc-activity">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EXERCISE_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value} data-testid={`efc-type-${o.value}`}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Intensity</Label>
                    <div
                      className="grid grid-cols-3 gap-1 rounded-2xl bg-muted/30 p-1"
                      role="group"
                      aria-label="Intensity"
                    >
                      {EXERCISE_INTENSITY_OPTIONS.map((o) => (
                        <Button
                          key={o.value}
                          type="button"
                          size="sm"
                          variant="ghost"
                          className={cn(
                            "h-10 rounded-xl px-1 text-xs font-medium",
                            intensity === o.value
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                          onClick={() => setIntensity(o.value)}
                          data-testid={`efc-intensity-${o.value}`}
                        >
                          {o.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="efc-duration" className="text-xs font-medium text-muted-foreground">
                      Duration
                    </Label>
                    <div className="flex h-11 items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-3">
                      <Input
                        id="efc-duration"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                        value={duration}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => setDuration(e.target.value.replace(/\D/g, "").slice(0, 3))}
                        className="h-9 border-0 bg-transparent p-0 text-center text-base font-semibold tabular-nums shadow-none focus-visible:ring-0"
                        data-testid="efc-duration"
                        aria-label="Duration in minutes"
                      />
                      <span className="text-sm text-muted-foreground">min</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Starting in</Label>
                  <div
                    className="flex flex-wrap gap-1.5"
                    role="group"
                    aria-label="Minutes until exercise starts"
                  >
                    {EXERCISE_START_IN_OPTIONS.map((m) => (
                      <Button
                        key={m}
                        type="button"
                        size="sm"
                        variant="ghost"
                        className={cn(
                          "h-9 min-w-[3.25rem] rounded-xl px-2.5 text-xs font-medium tabular-nums",
                          minutesUntilStart === m
                            ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                            : "bg-muted/30 text-muted-foreground hover:text-foreground",
                        )}
                        onClick={() => {
                          setMinutesUntilStart(m);
                          setStartInCustom("");
                        }}
                        data-testid={`efc-start-${m}`}
                      >
                        {exerciseStartInLabel(m)}
                      </Button>
                    ))}
                    <div className="relative">
                      <Input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                        value={startInCustom}
                        placeholder="Custom"
                        onFocus={(e) => {
                          const el = e.currentTarget;
                          if (!startInCustom) {
                            setStartInCustom(String(minutesUntilStart));
                          }
                          window.requestAnimationFrame(() => el.select());
                        }}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
                          setStartInCustom(digits);
                          const n = parseInt(digits, 10);
                          if (Number.isFinite(n)) setMinutesUntilStart(n);
                        }}
                        className="h-9 w-[4.75rem] rounded-xl border-border/60 bg-muted/20 px-2 text-center text-xs font-medium tabular-nums shadow-none"
                        data-testid="efc-start-custom"
                        aria-label="Custom minutes until start"
                      />
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
                  className="space-y-3"
                />
              </div>

              <div className="space-y-3 border-t border-border/40 pt-4">
                <div className="flex items-center gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Food before exercise
                  </p>
                  <InlineInfoHint
                    ariaLabel="How the carbs estimate works"
                    className="h-7 w-7 shrink-0"
                    content={
                      <>
                        We suggest carbs from your session, BG, and trend above — type your own amount if you know it.
                        Meal insulin is never shown without a BG reading.
                      </>
                    }
                  />
                </div>
                {!mealCarbsTouched && suggestedMealCarbs != null && suggestedMealCarbs > 0 ? (
                  <div
                    className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] via-primary/[0.03] to-transparent px-4 py-4"
                    data-testid="efc-suggested-carbs-card"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/90">
                      Suggested for you
                    </p>
                    <p className="mt-1 flex items-baseline gap-1.5">
                      <span
                        className="text-4xl font-bold tabular-nums tracking-tight text-foreground"
                        data-testid="efc-suggested-carbs-value"
                      >
                        {suggestedMealCarbs}
                      </span>
                      <span className="text-base font-semibold text-muted-foreground">g before exercise</span>
                    </p>
                    <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
                      Based on your session, BG, and trend
                    </p>
                  </div>
                ) : !mealCarbsTouched ? (
                  <div
                    className="flex items-center gap-3 rounded-2xl border border-border/40 bg-muted/20 px-4 py-3.5"
                    data-testid="efc-suggested-carbs-none"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <Sparkles className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">No carbs suggested right now</p>
                      <p className="text-xs text-muted-foreground">Enter an amount below if you&apos;re planning to eat</p>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="efc-meal-carbs" className="text-xs font-medium text-muted-foreground">
                      {!mealCarbsTouched && suggestedMealCarbs != null && suggestedMealCarbs > 0
                        ? "Know your own amount instead?"
                        : "Carbs before exercise"}
                    </Label>
                    <div className="flex items-stretch gap-2">
                      <Input
                        id="efc-meal-carbs"
                        type="number"
                        placeholder="40"
                        value={mealCarbs}
                        onChange={(e) => {
                          setMealCarbs(e.target.value);
                          setMealCarbsTouched(true);
                        }}
                        className="h-14 flex-1 rounded-xl border-border/60 bg-background text-2xl font-semibold tabular-nums tracking-tight shadow-none"
                        data-testid="efc-meal-carbs"
                      />
                      <span className="flex min-w-[4.5rem] items-center justify-center rounded-xl border border-border/60 bg-muted/40 px-3 text-sm font-semibold text-muted-foreground">
                        g
                      </span>
                    </div>
                    {mealCarbsTouched ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted/60 active:scale-[0.98]"
                        onClick={() => setMealCarbsTouched(false)}
                        data-testid="efc-meal-carbs-reset"
                      >
                        <RotateCcw className="h-3 w-3 shrink-0 text-primary" aria-hidden />
                        Use our estimate{suggestedMealCarbs != null ? ` (${suggestedMealCarbs}g)` : ""}
                      </button>
                    ) : null}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="efc-meal-type" className="text-xs font-medium text-muted-foreground">
                      Meal type
                    </Label>
                    <Select value={mealType} onValueChange={setMealType}>
                      <SelectTrigger id="efc-meal-type" className="h-12 rounded-xl" data-testid="efc-meal-type">
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
              </div>

              <Collapsible
                open={extrasOpen}
                onOpenChange={setExtrasOpen}
                className="group overflow-hidden rounded-2xl border border-border/40 bg-muted/15"
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left text-sm font-medium transition-colors hover:bg-muted/30"
                    data-testid="efc-extras-toggle"
                  >
                    <span>Extras</span>
                    <ChevronDown
                      className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
                      aria-hidden
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="divide-y divide-border/40 border-t border-border/40">
                    <div className="flex items-center justify-between px-3.5 py-3">
                      <Label htmlFor="efc-rapid-insulin" className="cursor-pointer text-sm">
                        Rapid-acting insulin in last 2h
                      </Label>
                      <Switch
                        id="efc-rapid-insulin"
                        checked={rapidInsulin2h}
                        onCheckedChange={setRapidInsulin2h}
                        data-testid="efc-rapid-insulin"
                      />
                    </div>
                    <div className="flex items-center justify-between px-3.5 py-3">
                      <Label htmlFor="efc-fasted" className="cursor-pointer text-sm">
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
                      <div className="grid gap-3 px-3.5 py-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="efc-last-meal">Last meal (min ago)</Label>
                          <Input
                            id="efc-last-meal"
                            type="number"
                            placeholder="optional"
                            value={lastMealMins}
                            onChange={(e) => setLastMealMins(e.target.value)}
                            className="h-10 rounded-xl"
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
                            className="h-10 rounded-xl"
                            data-testid="efc-last-meal-carbs"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Button
                type="button"
                size="lg"
                className="h-12 w-full gap-2 rounded-2xl text-base font-semibold"
                disabled={!canCalculate}
                onClick={handleCalculate}
                data-testid="efc-calculate"
              >
                <Dumbbell className="h-4 w-4" aria-hidden />
                Calculate
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {result && !hasActiveExercise ? (
        <div
          ref={resultRef}
          className="scroll-mt-4 overflow-hidden rounded-[1.75rem] border border-border/50 bg-card/95 shadow-sm"
          data-testid="efc-result"
        >
          <div className="space-y-2 border-b border-border/40 px-4 pb-3 pt-4 sm:px-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-semibold tracking-tight text-foreground">Your plan</p>
                <p className="text-sm text-muted-foreground">{sessionLine}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full"
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
            <CgmReadingSourceNote prefill={cgmPrefill} bgValue={currentBg} />
          </div>
          <div className="space-y-4 px-4 py-4 sm:px-5">
            {result.userEnteredMealCarbs && result.mealCarbs > 0 ? (
              <KnownCarbsPlanHero
                result={result}
                bgUnits={bgUnits}
                profile={profile}
                exerciseType={exerciseType}
                durationMinutes={parseInt(duration, 10) || result.breakdown.durationMinutes}
              />
            ) : result.mealCarbs > 0 ? (
              <ScenarioResultHero
                label="Pre-exercise carbs"
                value={
                  <>
                    {result.mealCarbsIsSuggested ? "~" : ""}
                    {result.mealCarbs}
                    <ScenarioResultHeroSuffix>g</ScenarioResultHeroSuffix>
                  </>
                }
              >
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
              </ScenarioResultHero>
            ) : (
              <ScenarioResultHero tone="neutral" label="No pre-exercise carbs suggested" value={`~${result.onHandCarbs}g`}>
                <p className="mt-1 text-sm text-muted-foreground">fast carbs on hand</p>
                <TreatmentHint
                  carbsGrams={result.onHandCarbs}
                  profile={profile}
                  scenario="exercise_on_hand"
                  className="mt-1"
                />
              </ScenarioResultHero>
            )}

            {result.mealCarbsSkipReason && result.mealCarbs <= 0 ? (
              <p className="rounded-2xl border border-border/40 bg-muted/20 px-3.5 py-3 text-sm leading-relaxed text-muted-foreground">
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
              <InsulinResultBadge
                tone="insulin"
                title="Meal insulin"
                value={`${result.insulin.totalUnits} units`}
                testId="efc-insulin-badge"
                info={
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
            ) : result.insulinSuppressedReason &&
              !result.userEnteredMealCarbs &&
              (result.mealCarbs > 0 || mealCarbsTouched) ? (
              <InsulinResultBadge
                tone="caution"
                title="No meal insulin at this reading"
                testId="efc-insulin-badge"
                info={
                  <p className="text-sm leading-relaxed">
                    {preExerciseInsulinSuppressedMessage(
                      result.insulinSuppressedReason,
                      bgUnits,
                      storage.getSettings(),
                    )}
                  </p>
                }
              />
            ) : result.insulinNoRatios && result.mealCarbs > 0 ? (
              <InsulinResultBadge
                tone="neutral"
                title={
                  <>
                    Add ratios in{" "}
                    <Link href="/settings" className="font-medium text-primary underline-offset-4 hover:underline">
                      Settings
                    </Link>{" "}
                    for a dose
                  </>
                }
                testId="efc-insulin-badge"
                info={
                  <p className="text-sm leading-relaxed">
                    Many teams use about {result.bolusReductionBand} less meal insulin before exercise. Add meal
                    ratios in Settings for a dose in units.
                  </p>
                }
              />
            ) : null}

            {result.preCorrection ? (
              <InsulinResultBadge
                tone={result.preCorrection.severity === "very_high" ? "caution" : "insulin"}
                title={
                  result.preCorrection.severity === "very_high"
                    ? "Reduced correction (ketones first)"
                    : "Reduced correction"
                }
                value={`~${result.preCorrection.units} units`}
                testId="efc-correction-badge"
                info={
                  <p className="text-sm leading-relaxed">
                    {result.preCorrection.severity === "very_high"
                      ? "BG is very high — follow your team on ketones and fluids before hard effort. "
                      : "BG is above the usual pre-exercise band. "}
                    Toward {result.preCorrection.targetBg} {bgUnits}, a full correction would be about{" "}
                    {result.preCorrection.fullUnitsBeforeReduction}u; this estimate is{" "}
                    {result.preCorrection.reductionPercent}% lower because exercise can still drop glucose. Confirm
                    with your care team — educational only.
                  </p>
                }
              />
            ) : null}

            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-border/40 bg-muted/20 px-3.5 py-3 text-left"
                  data-testid="efc-details-toggle"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <BookOpen className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span className="text-sm font-medium">More detail</span>
                    <span className="truncate text-xs text-muted-foreground">Why this plan + numbers</span>
                  </div>
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
                    aria-hidden
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-3 pt-2">
                  <ExerciseFuelPlanDetails result={result} profile={profile} />
                  <MedicalNumericOutputDisclaimer collapsible />
                  <MedicalSourcesLink anchor="exercise" />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Button variant="outline" size="sm" className="h-11 w-full rounded-xl" asChild>
              <Link href="/adviser?tab=meal&exercise=1&exerciseTiming=before" data-testid="efc-adviser-link">
                Open full meal calculator
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
