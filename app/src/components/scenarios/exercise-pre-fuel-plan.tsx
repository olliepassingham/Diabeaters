import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { BookOpen, ChevronDown, Package, Syringe, Utensils } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MedicalNumericOutputDisclaimer } from "@/components/medical-numeric-output-disclaimer";
import { MedicalSourcesLink } from "@/components/medical-sources-link";
import { EXERCISE_MEAL_TYPE_OPTIONS, EXERCISE_PRE_FUEL_INTENT_OPTIONS } from "@/lib/exercise-catalog";
import {
  buildExerciseFuelSummary,
  type ExerciseFuelCalculatorResult,
  type ExerciseFuelSummary,
} from "@/lib/exercise-fuel-calculator";
import { formatCarbsForScenario } from "@/lib/carb-source-preferences";
import type { ExercisePreFuelIntent, UserProfile, UserSettings } from "@/lib/storage";
import { cn } from "@/lib/utils";

export function PreFuelIntentPicker({
  value,
  onChange,
  testIdPrefix = "button-prefuel-intent",
}: {
  value: ExercisePreFuelIntent | null;
  onChange: (intent: ExercisePreFuelIntent) => void;
  testIdPrefix?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground">Before you start</Label>
      <div className="grid gap-1.5" role="radiogroup" aria-label="Before you start">
        {EXERCISE_PRE_FUEL_INTENT_OPTIONS.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={cn(
                "flex w-full flex-col items-start rounded-xl px-3.5 py-2.5 text-left transition-colors",
                active
                  ? "bg-background shadow-sm ring-1 ring-primary/50"
                  : "bg-muted/30 hover:bg-muted/50",
              )}
              data-testid={`${testIdPrefix}-${o.value}`}
            >
              <span className={cn("text-sm font-semibold", active ? "text-foreground" : "text-foreground/90")}>
                {o.label}
              </span>
              <span className="text-xs leading-snug text-muted-foreground">{o.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PreFuelMealFields({
  carbs,
  onCarbsChange,
  mealType,
  onMealTypeChange,
  testIdPrefix = "prefuel",
}: {
  carbs: string;
  onCarbsChange: (value: string) => void;
  mealType: string;
  onMealTypeChange: (value: string) => void;
  testIdPrefix?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${testIdPrefix}-meal-carbs`} className="text-xs font-medium text-muted-foreground">
          Carbs in your meal
        </Label>
        <div className="flex items-stretch gap-2">
          <Input
            id={`${testIdPrefix}-meal-carbs`}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            placeholder="e.g. 40"
            value={carbs}
            onChange={(e) => onCarbsChange(e.target.value.replace(/\D/g, "").slice(0, 3))}
            className="h-12 flex-1 rounded-xl border-border/60 bg-background text-xl font-semibold tabular-nums shadow-none"
            data-testid={`input-${testIdPrefix}-meal-carbs`}
          />
          <span className="flex min-w-[3.5rem] items-center justify-center rounded-xl border border-border/60 bg-muted/40 px-3 text-sm font-semibold text-muted-foreground">
            g
          </span>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Meal type</Label>
        <div className="grid grid-cols-4 gap-1 rounded-2xl bg-muted/30 p-1" role="group" aria-label="Meal type">
          {EXERCISE_MEAL_TYPE_OPTIONS.map((o) => (
            <Button
              key={o.value}
              type="button"
              size="sm"
              variant="ghost"
              className={cn(
                "h-9 rounded-xl px-1 text-xs font-medium",
                mealType === o.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => onMealTypeChange(o.value)}
              aria-pressed={mealType === o.value}
              data-testid={`button-${testIdPrefix}-meal-type-${o.value}`}
            >
              {o.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

export type PreFuelContextValues = {
  rapidInsulin2h: boolean;
  pumpIob: string;
  fasted: boolean;
  lastMealMins: string;
  lastMealCarbs: string;
};

export function PreFuelMoreContext({
  values,
  onChange,
  isPump,
}: {
  values: PreFuelContextValues;
  onChange: (next: Partial<PreFuelContextValues>) => void;
  isPump: boolean;
}) {
  const [open, setOpen] = useState(false);
  const filled =
    Number(values.rapidInsulin2h) +
    Number(values.fasted) +
    Number(!!values.pumpIob.trim()) +
    Number(!!values.lastMealMins.trim());
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="group/ctx overflow-hidden rounded-2xl border border-border/40 bg-muted/15"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left text-sm font-medium transition-colors hover:bg-muted/30"
          data-testid="button-prefuel-more-context"
        >
          <span>
            More context <span className="font-normal text-muted-foreground">(optional)</span>
            {filled > 0 ? <span className="ml-1.5 text-xs text-primary">· {filled}</span> : null}
          </span>
          <ChevronDown
            className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]/ctx:rotate-180"
            aria-hidden
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="divide-y divide-border/40 border-t border-border/40">
          <div className="flex items-center justify-between px-3.5 py-3">
            <Label htmlFor="prefuel-rapid-insulin" className="cursor-pointer text-sm">
              Rapid-acting insulin in last 2h
            </Label>
            <Switch
              id="prefuel-rapid-insulin"
              checked={values.rapidInsulin2h}
              onCheckedChange={(v) => onChange({ rapidInsulin2h: v })}
              data-testid="switch-prefuel-rapid-insulin"
            />
          </div>
          {isPump ? (
            <div className="space-y-1.5 px-3.5 py-3">
              <Label htmlFor="prefuel-pump-iob" className="text-sm">
                Pump insulin on board
              </Label>
              <Input
                id="prefuel-pump-iob"
                type="text"
                inputMode="decimal"
                placeholder="Units still working"
                value={values.pumpIob}
                onChange={(e) => onChange({ pumpIob: e.target.value })}
                data-testid="input-prefuel-pump-iob"
              />
            </div>
          ) : null}
          <div className="flex items-center justify-between px-3.5 py-3">
            <Label htmlFor="prefuel-fasted" className="cursor-pointer text-sm">
              Training fasted
            </Label>
            <Switch
              id="prefuel-fasted"
              checked={values.fasted}
              onCheckedChange={(v) => onChange(v ? { fasted: true, lastMealMins: "", lastMealCarbs: "" } : { fasted: false })}
              data-testid="switch-prefuel-fasted"
            />
          </div>
          {!values.fasted ? (
            <div className="grid grid-cols-2 gap-3 px-3.5 py-3">
              <div className="space-y-1.5">
                <Label htmlFor="prefuel-last-meal">Last ate (min ago)</Label>
                <Input
                  id="prefuel-last-meal"
                  inputMode="numeric"
                  placeholder="optional"
                  value={values.lastMealMins}
                  onChange={(e) => onChange({ lastMealMins: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                  className="h-10 rounded-xl"
                  data-testid="input-prefuel-last-meal-mins"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prefuel-last-carbs">Carbs then (g)</Label>
                <Input
                  id="prefuel-last-carbs"
                  inputMode="numeric"
                  placeholder="optional"
                  value={values.lastMealCarbs}
                  onChange={(e) => onChange({ lastMealCarbs: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                  className="h-10 rounded-xl"
                  data-testid="input-prefuel-last-meal-carbs"
                />
              </div>
            </div>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function PlanRow({
  icon: Icon,
  label,
  value,
  detail,
  tone = "default",
  testId,
}: {
  icon: typeof Utensils;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "default" | "caution" | "insulin" | "muted";
  testId?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-3.5 py-3",
        tone === "caution" && "border-amber-500/35 bg-amber-500/[0.08]",
        tone === "insulin" && "border-violet-500/25 bg-violet-500/[0.07]",
        tone === "muted" && "border-border/40 bg-muted/15",
        tone === "default" && "border-border/50 bg-background/80",
      )}
      data-testid={testId}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-right text-lg font-bold tabular-nums leading-tight text-foreground">{value}</p>
        </div>
        {detail ? <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{detail}</p> : null}
      </div>
    </div>
  );
}

function eatLabel(summary: ExerciseFuelSummary): string {
  if (!summary.eat) return "Eat";
  if (summary.eat.kind === "treat_first") return "Treat first";
  return summary.eat.kind === "meal" ? "Eat (meal)" : "Eat (top-up)";
}

function PlanDetails({ result, profile }: { result: ExerciseFuelCalculatorResult; profile?: Partial<UserProfile> }) {
  const during =
    result.sessionFuel.duringTotalGrams > 0
      ? formatCarbsForScenario(result.sessionFuel.duringTotalGrams, profile, "exercise_during")
      : null;
  const band = result.projection?.targetBand ?? result.targetBg;
  return (
    <div className="space-y-3 text-sm leading-relaxed text-popover-foreground/90">
      {result.notes.length > 0 ? (
        <ul className="space-y-1.5">
          {result.notes.map((n, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-primary">·</span>
              <span>{n}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="list-disc space-y-1 pl-4">
        {result.insulin ? (
          <li>
            Meal insulin: usually ~{result.insulin.standardUnits}u → {result.insulin.reductionPercent}% less for
            exercise → {result.insulin.adjustedUnits}u
            {result.insulin.correctionUnits > 0
              ? ` + ${result.insulin.correctionUnits}u correction → ${result.insulin.totalUnits}u total`
              : ""}
          </li>
        ) : null}
        {result.breakdown.ratioDescription && result.insulin ? <li>Ratio: {result.breakdown.ratioDescription}</li> : null}
        {result.preCorrection ? (
          <li>
            Reduced correction toward {band}: ~{result.preCorrection.fullUnitsBeforeReduction}u full →{" "}
            {result.preCorrection.reductionPercent}% less → ~{result.preCorrection.units}u
          </li>
        ) : null}
        {result.breakdown.lowBgCarbTopUpGrams ? (
          <li>
            Top-up: {result.breakdown.preBufferGrams}g session buffer + {result.breakdown.lowBgCarbTopUpGrams}g because
            BG is below the start range
          </li>
        ) : null}
        {during ? <li>During: {during}</li> : null}
        {result.exerciseEffectNote ? <li>{result.exerciseEffectNote}</li> : null}
        {result.pumpTip ? <li>{result.pumpTip}</li> : null}
        <li className="text-muted-foreground">Target {result.targetBg} · educational only</li>
      </ul>
    </div>
  );
}

/**
 * The plan in three rows — Eat, Insulin, Carry — plus one reason and optional details.
 * `compact` drops Carry (the coach shows its own carry line) and the details section.
 */
export function PreFuelPlanSummary({
  result,
  bgUnits,
  settings,
  profile,
  compact = false,
  deferTreatFirst = false,
  headerAction,
  testId = "prefuel-plan-summary",
}: {
  result: ExerciseFuelCalculatorResult;
  bgUnits: string;
  settings?: UserSettings;
  profile?: Partial<UserProfile>;
  compact?: boolean;
  /** Another card already shows the hypo treatment amount — don't show a second number. */
  deferTreatFirst?: boolean;
  headerAction?: ReactNode;
  testId?: string;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const summary = buildExerciseFuelSummary(result, bgUnits, settings);
  const eatHint = summary.eat
    ? formatCarbsForScenario(summary.eat.grams, profile, summary.eat.kind === "meal" ? "exercise_on_hand" : "hypo")
    : null;
  const carryHint =
    summary.carry.grams > 0 ? formatCarbsForScenario(summary.carry.grams, profile, "exercise_on_hand") : null;

  return (
    <div className="space-y-2.5" data-testid={testId}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold tracking-tight text-foreground">Your pre-workout plan</p>
        {headerAction}
      </div>

      <PlanRow
        icon={Utensils}
        label={eatLabel(summary)}
        value={
          !summary.eat
            ? "—"
            : summary.eat.kind === "treat_first" && deferTreatFirst
              ? "Now"
              : `${summary.eat.kind === "meal" ? "" : "~"}${summary.eat.grams}g`
        }
        detail={
          !summary.eat
            ? summary.eatNote
            : summary.eat.kind === "treat_first" && deferTreatFirst
              ? "Use the hypo treatment shown above, then recheck."
              : summary.eat.kind === "meal"
                ? null
                : eatHint
        }
        tone={summary.eat?.kind === "treat_first" ? "caution" : summary.eat ? "default" : "muted"}
        testId="prefuel-row-eat"
      />
      <PlanRow
        icon={Syringe}
        label={summary.insulin.kind === "correction" ? "Correction" : "Insulin"}
        value={summary.insulin.units > 0 ? `${summary.insulin.kind === "correction" ? "~" : ""}${summary.insulin.units}u` : "None"}
        detail={summary.insulin.reason}
        tone={summary.insulin.units > 0 ? "insulin" : "muted"}
        testId="prefuel-row-insulin"
      />
      {!compact && summary.carry.grams > 0 ? (
        <PlanRow
          icon={Package}
          label="Carry"
          value={`~${summary.carry.grams}g`}
          detail={
            summary.carry.doseGrams != null && summary.carry.everyMinutes != null
              ? `Fast carbs — about ${summary.carry.doseGrams}g every ${summary.carry.everyMinutes} min during the session.`
              : (carryHint ?? "Fast carbs within reach in case BG drops.")
          }
          testId="prefuel-row-carry"
        />
      ) : null}

      {summary.why ? (
        <p className="px-0.5 text-sm leading-relaxed text-foreground/80" data-testid="prefuel-why">
          {summary.why}
        </p>
      ) : null}

      {!compact ? (
        <>
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="group/details flex w-full items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/20 px-3.5 py-2.5 text-left"
                data-testid="button-prefuel-details"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <BookOpen className="h-4 w-4 text-primary" aria-hidden />
                  Details
                </span>
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/details:rotate-180"
                  aria-hidden
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-3 pt-2">
                <PlanDetails result={result} profile={profile} />
                <MedicalNumericOutputDisclaimer collapsible />
                <MedicalSourcesLink anchor="exercise" />
              </div>
            </CollapsibleContent>
          </Collapsible>
          {summary.intent === "meal" ? (
            <Button variant="outline" size="sm" className="h-10 w-full rounded-xl" asChild>
              <Link href="/adviser?tab=meal&exercise=1&exerciseTiming=before" data-testid="link-prefuel-meal-calculator">
                Open full meal calculator
              </Link>
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
