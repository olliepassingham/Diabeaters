import { useEffect, useRef, useState } from "react";
import { Link, Redirect } from "wouter";
import type { LucideIcon } from "lucide-react";
import {
  Wine,
  AlertTriangle,
  Droplet,
  Phone,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  Utensils,
  Moon,
  Power,
  Calculator,
  ChevronDown,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Minus,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ScenarioCoachLink } from "@/components/ai-coach/ScenarioCoachLink";
import { Disclaimer } from "@/components/disclaimer";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { storage, type UserProfile, type UserSettings, DIABEATER_PROFILE_CHANGED_EVENT } from "@/lib/storage";
import { endAlcoholNightMode, scheduleAlcoholReminders } from "@/lib/alcohol-reminders";
import { formatAlcoholDoseRange, formatAlcoholLeanLine, buildAlcoholNightModeSchedule, formatNightModeTime, type AlcoholDoseGuidance } from "@/lib/alcohol-dose-guidance";
import { useToast } from "@/hooks/use-toast";
import { listCarerLinksForPatient } from "@/lib/carers";
import { invokeNotifyAlcoholNightMode } from "@/lib/invoke-notify-alcohol-night-mode";
import { NOTIFY_EDGE_FAILURE_TITLE, notifyEdgeFailureDescription } from "@/lib/notify-toast-messages";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { canShowAlcoholScenarios } from "@/lib/user-age";
import { recordLastInteraction } from "@/lib/last-interaction";
import {
  normalizeBgUnits,
  type AlcoholIntensity,
  type AlcoholRedFlags,
  type AlcoholTrend,
} from "@/lib/alcohol-night-tool";
import {
  adviserLinkFromAlcohol,
  buildAlcoholSituationOutcome,
  type AlcoholSituationKind,
  type AlcoholSituationLinks,
  type AlcoholSituationOutcome,
} from "@/lib/alcohol-situation-tool";
import { getMealDoseRoundingGuide, type MealDoseResult } from "@/lib/meal-dose";
import { cn } from "@/lib/utils";
import { BgTrendThreeButtons } from "@/components/bg-trend-three-buttons";
import { CgmPrefillButton } from "@/components/cgm-prefill-button";
import { useAutoCgmBgField } from "@/hooks/use-auto-cgm-bg-field";
import { AlcoholLastRecommendationCard } from "@/components/scenarios/alcohol-last-recommendation-card";
import {
  alcoholRecommendationSummary,
  saveAlcoholLastRecommendation,
} from "@/lib/alcohol-last-recommendation";
import { cgmTrendForAlcohol } from "@/lib/cgm/apply-cgm-trend";
import {
  ALCOHOL_DRINKS,
  summarizeAlcoholDrinks,
  type AlcoholDrinkPatternId,
  type AlcoholDrinkSummary,
} from "@/lib/alcohol-drinks";

const FROM_SCENARIOS = "from=/scenarios";

function linkWithFrom(path: string): string {
  return path.includes("?") ? `${path}&${FROM_SCENARIOS}` : `${path}?${FROM_SCENARIOS}`;
}

type Phase = "situation" | "inputs" | "result";

const SITUATION_CARDS: {
  id: AlcoholSituationKind;
  title: string;
  icon: LucideIcon;
  iconClass: string;
}[] = [
  {
    id: "meal_with_drinks",
    title: "Meal or snacks with drinks",
    icon: Utensils,
    iconClass: "text-primary",
  },
  {
    id: "late_snack",
    title: "Late snack after drinking",
    icon: Moon,
    iconClass: "text-amber-600 dark:text-amber-400",
  },
  {
    id: "before_out",
    title: "Before I go out",
    icon: Wine,
    iconClass: "text-violet-600 dark:text-violet-400",
  },
  {
    id: "feels_wrong",
    title: "Something feels wrong",
    icon: AlertTriangle,
    iconClass: "text-destructive",
  },
];

type ChoiceProps<T extends string> = {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; title: string; description?: string }[];
  name: string;
};

function ChoiceGroup<T extends string>({ label, value, onChange, options, name }: ChoiceProps<T>) {
  const compact = options.every((opt) => opt.title.length <= 18);
  return (
    <div className="space-y-2">
      <Label className="text-base font-semibold text-foreground">{label}</Label>
      <div
        className={cn("grid gap-2", compact ? "grid-cols-3" : "grid-cols-1")}
        role="radiogroup"
        aria-label={label}
      >
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              name={name}
              className={cn(
                "min-h-12 rounded-xl border px-3 py-3 text-base font-medium leading-snug transition-colors",
                compact ? "text-center" : "text-left",
                selected
                  ? "border-primary bg-primary/10 text-foreground shadow-sm"
                  : "border-border/70 bg-background/70 text-foreground hover:bg-muted/40",
              )}
              onClick={() => onChange(opt.value)}
            >
              {opt.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}


const DRINK_PATTERN_ORDER: AlcoholDrinkPatternId[] = [
  "carb_then_low",
  "low_carb_later_low",
  "later_low",
  "low_alcohol",
];

const DRINK_PATTERN_TITLE: Record<AlcoholDrinkPatternId, string> = {
  carb_then_low: "Raises you first, then a later low",
  low_carb_later_low: "Small rise. A later low still matters",
  later_low: "Little rise. Watch for a later low",
  low_alcohol: "Carbs still count. The later low is smaller",
};

const DRINK_SHORT_NAME: Record<string, string> = {
  "pint-lager": "Lager",
  "half-lager": "Half lager",
  "pint-cider": "Cider",
  "wine-small": "Small wine",
  "wine-large": "Large wine",
  prosecco: "Prosecco",
  "spirit-diet": "Spirit, diet",
  "spirit-sugar": "Spirit, sugary",
  alcopop: "Alcopop",
  cocktail: "Cocktail",
  "low-alcohol-beer": "Low-alcohol",
};

function AlcoholDrinkRows({
  interactive,
  counts,
  onCount,
}: {
  interactive: boolean;
  counts: Record<string, number>;
  onCount?: (id: string, delta: number) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const chosen = ALCOHOL_DRINKS.filter((drink) => (counts[drink.id] ?? 0) > 0);

  if (!interactive) {
    return (
      <div className="space-y-4" data-testid="alcohol-drink-lookup">
        {DRINK_PATTERN_ORDER.map((patternId) => {
          const drinks = ALCOHOL_DRINKS.filter((drink) => drink.patternId === patternId);
          if (drinks.length === 0) return null;
          return (
            <section key={patternId} className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">{DRINK_PATTERN_TITLE[patternId]}</h3>
              <ul className="space-y-1">
                {drinks.map((drink) => (
                  <li key={drink.id} className="text-base text-foreground">
                    {drink.name}
                    <span className="text-muted-foreground"> · {drink.carbsGrams}g</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="alcohol-drink-picker">
      {chosen.length > 0 ? (
        <ul className="space-y-2">
          {chosen.map((drink) => {
            const count = counts[drink.id] ?? 0;
            return (
              <li
                key={drink.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-base font-medium leading-snug text-foreground">{drink.name}</p>
                  <p className="text-base text-muted-foreground">{count * drink.carbsGrams}g</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 rounded-xl bg-background"
                    aria-label={`Remove one ${drink.name}`}
                    data-testid={`alcohol-drink-remove-${drink.id}`}
                    onClick={() => onCount?.(drink.id, -1)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-6 text-center text-base font-semibold tabular-nums">{count}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 rounded-xl bg-background"
                    aria-label={`Add one ${drink.name}`}
                    data-testid={`alcohol-drink-add-${drink.id}`}
                    onClick={() => onCount?.(drink.id, 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full rounded-xl bg-background text-base"
        data-testid="button-alcohol-add-drink"
        onClick={() => setPickerOpen(true)}
      >
        <Plus className="h-4 w-4" />
        {chosen.length > 0 ? "Add another drink" : "Add a drink"}
      </Button>
      <BottomSheet open={pickerOpen} onOpenChange={setPickerOpen} title="Add a drink" bodyClassName="flex flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
          <ul className="grid grid-cols-2 gap-2">
            {ALCOHOL_DRINKS.map((drink) => {
              const count = counts[drink.id] ?? 0;
              const selected = count > 0;
              return (
                <li key={drink.id}>
                  <div
                    className={cn(
                      "flex min-h-[4.5rem] items-stretch gap-1 rounded-2xl border px-3 py-2",
                      selected ? "border-primary bg-primary/10" : "border-border/70 bg-background",
                    )}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      aria-label={`Add one ${drink.name}`}
                      data-testid={`alcohol-drink-pick-${drink.id}`}
                      onClick={() => onCount?.(drink.id, 1)}
                    >
                      <span className="block text-base font-medium leading-snug text-foreground">
                        {DRINK_SHORT_NAME[drink.id] ?? drink.name}
                      </span>
                      <span className="block text-base text-muted-foreground">
                        {drink.carbsGrams}g{selected ? ` · ${count}` : ""}
                      </span>
                    </button>
                    {selected ? (
                      <button
                        type="button"
                        className="flex w-10 shrink-0 items-center justify-center rounded-xl text-foreground"
                        aria-label={`Remove one ${drink.name}`}
                        onClick={() => onCount?.(drink.id, -1)}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="shrink-0 border-t border-border/60 px-4 py-3">
          <Button type="button" className="h-12 w-full rounded-xl text-base" onClick={() => setPickerOpen(false)}>
            Done
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}

function AlcoholActionLinks({ links }: { links: AlcoholSituationLinks }) {
  return (
    <div className="flex flex-wrap gap-2">
      {links.hypoHelp ? (
        <Button variant="secondary" className="h-11 gap-1.5 text-base" asChild>
          <Link href={linkWithFrom("/tools/hypo-help")}>
            <Droplet className="h-4 w-4" />
            Hypo help
          </Link>
        </Button>
      ) : null}
      {links.sickDay ? (
        <Button variant="secondary" className="h-11 text-base" asChild>
          <Link href={linkWithFrom("/sick-day")}>Sick day</Link>
        </Button>
      ) : null}
      {links.helpNow ? (
        <Button variant="secondary" className="h-11 gap-1.5 text-base" asChild>
          <Link href={linkWithFrom("/help-now")}>
            <Phone className="h-4 w-4" />
            Help now
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

function defaultBedtimeLocal(): string {
  const d = new Date();
  d.setHours(23, 0, 0, 0);
  if (d.getTime() <= Date.now() + 30 * 60_000) {
    d.setDate(d.getDate() + 1);
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function riskAccent(level: AlcoholDoseGuidance["riskLevel"]) {
  if (level === "high") {
    return {
      border: "border-amber-500/35",
      bg: "bg-gradient-to-b from-amber-500/12 to-card",
      icon: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    };
  }
  if (level === "elevated") {
    return {
      border: "border-amber-500/25",
      bg: "bg-gradient-to-b from-amber-500/8 to-card",
      icon: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
    };
  }
  return {
    border: "border-primary/25",
    bg: "bg-gradient-to-b from-primary/8 to-card",
    icon: "bg-primary/10 text-primary",
  };
}

function AlcoholNightModeCard({
  intensity,
  situationLabel,
  activeOnly = false,
}: {
  intensity: AlcoholIntensity;
  situationLabel?: string | null;
  /** Situation step: show the on-state only, so the home chip lands on the checks and the off switch. */
  activeOnly?: boolean;
}) {
  const { toast } = useToast();
  const [bedtimeLocal, setBedtimeLocal] = useState(defaultBedtimeLocal);
  const [active, setActive] = useState(() => storage.getScenarioState().alcoholModeActive === true);
  const [busy, setBusy] = useState(false);
  const [notifySupporters, setNotifySupporters] = useState(false);
  const [scenarioSupporterCount, setScenarioSupporterCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await listCarerLinksForPatient();
      if (cancelled) return;
      const count = (data ?? []).filter((link) => link.scopes.scenarios).length;
      setScenarioSupporterCount(count);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const previewSchedule = buildAlcoholNightModeSchedule(
    intensity,
    new Date(bedtimeLocal).toISOString(),
  );

  const deactivate = async () => {
    setBusy(true);
    try {
      await endAlcoholNightMode();
      setActive(false);
      toast({
        title: "Night mode off",
        description: "Scheduled reminders were cancelled.",
      });
    } finally {
      setBusy(false);
    }
  };

  if (activeOnly && !active) return null;

  if (active) {
    const session = storage.getAlcoholSession();
    const schedule = session
      ? buildAlcoholNightModeSchedule(session.intensity, session.plannedBedtimeIso)
      : previewSchedule;
    return (
      <div
        className="rounded-2xl border border-primary/25 bg-primary/[0.05] px-4 py-3.5 space-y-3"
        data-testid="alcohol-night-mode-active"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Moon className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="text-base font-semibold text-foreground">Night mode is on</p>
            <p className="text-base leading-relaxed text-muted-foreground">
              Reminders on until your morning review.
            </p>
          </div>
        </div>
        <ul className="space-y-1.5 border-t border-border/40 pt-3">
          {schedule.map((item) => (
            <li key={item.kind} className="flex items-center justify-between gap-2 text-base">
              <span className="text-foreground/90">{item.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{formatNightModeTime(item.atIso)}</span>
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          className="w-full min-h-11 text-base"
          onClick={() => void deactivate()}
          disabled={busy}
          data-testid="button-alcohol-night-mode-off"
        >
          <Power className="h-4 w-4 mr-2" aria-hidden />
          Turn off night mode
        </Button>
      </div>
    );
  }

  const activate = async () => {
    setBusy(true);
    try {
      const at = new Date(bedtimeLocal);
      if (Number.isNaN(at.getTime())) {
        toast({ title: "Choose a valid bedtime", variant: "destructive" });
        return;
      }
      const session = storage.activateAlcoholMode({
        intensity,
        plannedBedtimeIso: at.toISOString(),
        situation: situationLabel ?? null,
      });
      await scheduleAlcoholReminders(session);
      setActive(true);
      toast({
        title: "Night mode on",
        description: "Check reminders are scheduled for your bedtime.",
      });
      if (notifySupporters) {
        const res = await invokeNotifyAlcoholNightMode({
          sessionId: session.id,
          intensity: session.intensity,
          plannedBedtimeIso: session.plannedBedtimeIso,
        });
        if (res.success) {
          toast({ title: "Supporters notified" });
        } else {
          toast({
            title: NOTIFY_EDGE_FAILURE_TITLE,
            description: notifyEdgeFailureDescription(res),
            variant: "destructive",
          });
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 px-4 py-4 space-y-3" data-testid="alcohol-night-mode-offer">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/12 text-violet-700 dark:text-violet-300">
          <Moon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-base font-semibold text-foreground">Tonight&apos;s checks</p>
          <p className="text-base text-muted-foreground">Bedtime and overnight reminders on this device.</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="alcohol-bedtime" className="text-base font-semibold text-foreground">
          Planned bedtime
        </Label>
        <Input
          id="alcohol-bedtime"
          type="datetime-local"
          step={60}
          value={bedtimeLocal}
          onChange={(e) => setBedtimeLocal(e.target.value)}
          data-testid="input-alcohol-bedtime"
        />
      </div>
      <ul className="space-y-1.5 rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5">
        {previewSchedule.map((item) => (
          <li key={item.kind} className="flex items-center justify-between gap-2 text-base">
            <span className="text-foreground/90">{item.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{formatNightModeTime(item.atIso)}</span>
          </li>
        ))}
      </ul>
      {scenarioSupporterCount > 0 ? (
        <label
          htmlFor="alcohol-notify-supporters"
          className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border/40 bg-muted/15 px-3 py-2.5"
        >
          <Checkbox
            id="alcohol-notify-supporters"
            checked={notifySupporters}
            onCheckedChange={(v) => setNotifySupporters(v === true)}
            className="mt-0.5"
            data-testid="checkbox-alcohol-notify-supporters"
          />
          <span className="min-w-0 text-base text-foreground">
            Let supporters know
          </span>
        </label>
      ) : null}
      <Button
        type="button"
        className="w-full min-h-11 rounded-xl text-base"
        disabled={busy}
        onClick={() => void activate()}
        data-testid="button-alcohol-night-mode"
      >
        {busy ? "Scheduling…" : "Turn on night mode"}
      </Button>
    </div>
  );
}

function AlcoholEstimateResult({
  meal,
  guidance,
  bgUnits,
  mealType,
  situationLabel,
  drinkSummary,
  foodCarbsGrams,
  onEdit,
  onReset,
}: {
  meal: MealDoseResult;
  guidance: AlcoholDoseGuidance;
  bgUnits: string;
  mealType: string;
  situationLabel: string | null;
  drinkSummary: AlcoholDrinkSummary | null;
  foodCarbsGrams: number;
  onEdit: () => void;
  onReset: () => void;
}) {
  const rounding = getMealDoseRoundingGuide(meal.exactDose, meal.dose, bgUnits);
  const accent = riskAccent(guidance.riskLevel);
  const rangeLabel = formatAlcoholDoseRange(guidance);
  const showRange = guidance.standardDose > 0 && guidance.reductionPctMax > 0;
  const leanLine = formatAlcoholLeanLine(guidance);
  const overnightNote = guidance.overnightBullets[0] ?? null;

  return (
    <div className="space-y-3" data-testid="alcohol-plan-card">
      <div className="overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-b from-primary/12 via-card to-card shadow-sm ring-1 ring-primary/10">
        <div className="relative px-5 pb-4 pt-5 text-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-2 top-2 h-10 gap-1 px-2 text-base text-muted-foreground"
            onClick={onReset}
            data-testid="button-alcohol-edit-answers"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <p className="text-base font-semibold text-primary/90">Your range tonight</p>
          <p
            className="mt-1 font-display text-5xl font-bold tabular-nums tracking-tight text-foreground"
            data-testid="alcohol-dose-range"
          >
            {showRange ? rangeLabel : "Discuss with team"}
          </p>
          <p className="mt-2 text-base text-foreground" data-testid="alcohol-carb-split">
            {drinkSummary && drinkSummary.carbsGrams > 0 ? `${drinkSummary.carbsGrams}g drinks` : "No drink carbs"}
            {" · "}
            {foodCarbsGrams > 0 ? `${foodCarbsGrams}g food` : "No food carbs"}
          </p>
          {guidance.standardDose > 0 ? (
            <p className="mt-2 text-base text-muted-foreground">
              Usual dose for these carbs is{" "}
              <span className="font-medium tabular-nums text-foreground">{guidance.standardDose}u</span>
              {rounding ? (
                <>
                  {" "}
                  · exact <span className="tabular-nums">{rounding.exactLabel}</span>
                </>
              ) : null}
            </p>
          ) : null}
          {leanLine ? (
            <p className="mt-2 text-base font-medium text-foreground" data-testid="alcohol-bg-note">
              {leanLine}
            </p>
          ) : null}
        </div>
      </div>

      {overnightNote ? (
        <div className={cn("rounded-2xl border px-4 py-3", accent.border, accent.bg)}>
          <div className="flex items-start gap-3">
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", accent.icon)}>
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="min-w-0 space-y-0.5">
              <p className="text-base font-semibold text-foreground">{guidance.riskHeadline}</p>
              <p className="text-base text-foreground/80">{overnightNote}</p>
            </div>
          </div>
        </div>
      ) : null}

      {drinkSummary && drinkSummary.drinkCount > 0 ? (
        <div className="space-y-2 rounded-2xl border border-border/70 px-4 py-3" data-testid="alcohol-drink-patterns">
          <p className="text-base font-semibold text-foreground">{drinkSummary.labels.join(", ")}</p>
          {DRINK_PATTERN_ORDER.filter((patternId) =>
            ALCOHOL_DRINKS.some(
              (drink) =>
                drink.patternId === patternId &&
                drinkSummary.labels.some((label) => label.toLowerCase().includes(drink.name.toLowerCase())),
            ),
          ).map((patternId) => (
            <p key={patternId} className="text-base leading-snug text-foreground">
              {DRINK_PATTERN_TITLE[patternId]}
            </p>
          ))}
        </div>
      ) : null}

      <AlcoholNightModeCard intensity={guidance.drinkingIntensity} situationLabel={situationLabel} />

      <div className="flex gap-2">
        <Button asChild className="min-h-11 flex-1 gap-2 rounded-xl text-base">
          <Link href={linkWithFrom(adviserLinkFromAlcohol(meal.carbs, mealType))}>
            <Calculator className="h-4 w-4" />
            Open Meal Adviser
          </Link>
        </Button>
        <Button type="button" variant="outline" className="min-h-11 shrink-0 rounded-xl text-base" onClick={onEdit}>
          Edit
        </Button>
      </div>
    </div>
  );
}

function AlcoholSafetyResult({
  outcome,
  onReset,
}: {
  outcome: Extract<AlcoholSituationOutcome, { kind: "urgent" | "hypo_first" }>;
  onReset: () => void;
}) {
  const isUrgent = outcome.kind === "urgent";
  return (
    <div
      className={cn(
        "relative space-y-3 overflow-hidden rounded-2xl border shadow-sm",
        isUrgent ? "border-destructive/40 bg-gradient-to-b from-destructive/10 to-card" : "border-amber-500/35 bg-gradient-to-b from-amber-500/10 to-card",
      )}
      data-testid="alcohol-plan-card"
    >
      <div className="flex items-start gap-3 px-4 pt-4">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            isUrgent ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
          )}
        >
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-2 top-2 h-10 gap-1 px-2 text-base text-muted-foreground"
            onClick={onReset}
            data-testid="button-alcohol-edit-answers"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <h2 className="text-lg font-semibold leading-snug text-foreground">{outcome.headline}</h2>
          <p className="text-base leading-relaxed text-foreground/85">{outcome.lead}</p>
        </div>
      </div>
      <ol className="space-y-2 px-4 pb-4" aria-label="Safety steps">
        {outcome.bullets.map((b, i) => (
          <li key={b} className="flex gap-3 text-base leading-relaxed text-foreground/90">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base font-semibold",
                isUrgent ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-800 dark:text-amber-200",
              )}
              aria-hidden
            >
              {i + 1}
            </span>
            <span className="min-w-0 pt-0.5">{b}</span>
          </li>
        ))}
      </ol>
      <div className="border-t border-border/40 px-4 py-3">
        <AlcoholActionLinks links={outcome.links} />
      </div>
    </div>
  );
}

function AlcoholPrepResult({
  outcome,
  intensity,
  situationLabel,
  tipsOpen,
  onTipsOpenChange,
  onEdit,
  onReset,
}: {
  outcome: Extract<AlcoholSituationOutcome, { kind: "prep_only" }>;
  intensity: AlcoholIntensity;
  situationLabel: string | null;
  tipsOpen: boolean;
  onTipsOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-3" data-testid="alcohol-plan-card">
      <div className="overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-card shadow-sm">
        <div className="flex items-start gap-3 px-4 py-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
            <Moon className="h-5 w-5 text-amber-700 dark:text-amber-300" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="float-right -mt-1 h-10 gap-1 px-2 text-base text-muted-foreground"
              onClick={onReset}
              data-testid="button-alcohol-edit-answers"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <h2 className="text-lg font-semibold leading-snug text-foreground">{outcome.headline}</h2>
          </div>
        </div>
        {outcome.checklist.length > 0 ? (
          <ul className="space-y-2 border-t border-border/40 px-4 py-3">
            {outcome.checklist.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-base leading-snug text-foreground/90">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {outcome.tips.length > 0 ? (
        <Collapsible open={tipsOpen} onOpenChange={onTipsOpenChange}>
          <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 rounded-xl border border-border/60 bg-card/50 px-3.5 py-3 text-left text-base font-medium outline-none hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden />
              Tips
              <span className="font-normal text-muted-foreground">({outcome.tips.length})</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" aria-hidden />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {outcome.tips.map((tip) => (
              <p key={tip} className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 text-base leading-relaxed text-foreground/90">
                {tip}
              </p>
            ))}
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      <AlcoholNightModeCard intensity={intensity} situationLabel={situationLabel} />

      <Button type="button" variant="outline" className="h-11 w-full gap-1.5 rounded-xl text-base" onClick={onEdit}>
        <ArrowLeft className="h-4 w-4" />
        Edit details
      </Button>
    </div>
  );
}

function AlcoholSimpleResult({
  outcome,
  onEdit,
  onReset,
}: {
  outcome: AlcoholSituationOutcome;
  onEdit: () => void;
  onReset: () => void;
}) {
  const title =
    outcome.kind === "needs_ratios" || outcome.kind === "needs_carbs"
      ? outcome.message
      : outcome.kind === "feels_ok"
        ? outcome.headline
        : "Result";
  const body = outcome.kind === "feels_ok" ? outcome.body : null;

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-card/50 p-4 shadow-sm" data-testid="alcohol-plan-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-semibold leading-snug text-foreground">{title}</h2>
          {body ? <p className="text-base leading-relaxed text-foreground/85">{body}</p> : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10 shrink-0 gap-1 px-2 text-base text-muted-foreground"
          onClick={onReset}
          data-testid="button-alcohol-edit-answers"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>
      {(outcome.kind === "needs_ratios" || outcome.kind === "needs_carbs") && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="h-11 text-base" asChild>
            <Link href={linkWithFrom("/adviser?tab=ratios")}>Ratio Adviser</Link>
          </Button>
          <Button variant="outline" className="h-11 text-base" asChild>
            <Link href="/settings">Settings</Link>
          </Button>
        </div>
      )}
      {outcome.kind === "feels_ok" ? <AlcoholActionLinks links={outcome.links} /> : null}
      <Button type="button" variant="outline" className="h-11 w-full gap-1.5 text-base" onClick={onEdit}>
        <ArrowLeft className="h-4 w-4" />
        Edit details
      </Button>
    </div>
  );
}

const RED_FLAG_ROWS: [keyof AlcoholRedFlags, string][] = [
  ["vomiting", "Repeated vomiting"],
  ["severeAbdominalPain", "Severe abdominal pain"],
  ["confusion", "Confusion or very drowsy"],
  ["veryHighBgOrKetones", "Very high glucose or ketones concern"],
  ["cantKeepFluids", "Cannot keep fluids down"],
];

export default function AlcoholScenarioPage() {
  const [profile, setProfile] = useState<Partial<UserProfile>>(() => storage.getProfile() ?? {});
  const [settings, setSettings] = useState<UserSettings>({});
  const [phase, setPhase] = useState<Phase>("situation");
  const [situation, setSituation] = useState<AlcoholSituationKind | null>(null);
  const [outcome, setOutcome] = useState<AlcoholSituationOutcome | null>(null);
  const [carbsError, setCarbsError] = useState<string | null>(null);

  const [bgSkipped, setBgSkipped] = useState(false);
  const [bgInput, setBgInput] = useState("");
  const [bgTrend, setBgTrend] = useState<AlcoholTrend>("unknown");
  const [intensity, setIntensity] = useState<AlcoholIntensity>("light");
  const [foodCarbsInput, setFoodCarbsInput] = useState("");
  const [drinkCounts, setDrinkCounts] = useState<Record<string, number>>({});
  const [drinkLookupOpen, setDrinkLookupOpen] = useState(false);
  const [mealType, setMealType] = useState<string>("snack");
  const [redFlags, setRedFlags] = useState<AlcoholRedFlags>({
    vomiting: false,
    severeAbdominalPain: false,
    confusion: false,
    veryHighBgOrKetones: false,
    cantKeepFluids: false,
  });
  const [resultTipsOpen, setResultTipsOpen] = useState(false);

  const formTopRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (storage.getScenarioState().alcoholModeActive) {
      recordLastInteraction("scenario:alcohol");
    }
  }, []);

  const refreshFromStorage = () => {
    const p = storage.getProfile();
    if (p) setProfile(p);
    setSettings(storage.getSettings());
  };

  useEffect(() => {
    refreshFromStorage();
  }, []);

  useEffect(() => {
    window.addEventListener(DIABEATER_PROFILE_CHANGED_EVENT, refreshFromStorage);
    return () => window.removeEventListener(DIABEATER_PROFILE_CHANGED_EVENT, refreshFromStorage);
  }, []);

  const bgUnits = normalizeBgUnits(profile.bgUnits);
  const alcoholCgm = useAutoCgmBgField({
    bgValue: bgInput,
    onApplyBg: setBgInput,
    onApplyTrend: (trend) => {
      const mapped = cgmTrendForAlcohol(trend);
      if (mapped) setBgTrend(mapped);
    },
    autoApplyKey: phase === "inputs" ? "alcohol" : undefined,
  });
  const carbUnit: "grams" | "cp" = profile.carbUnits === "cp" ? "cp" : "grams";

  const stepIndex = phase === "situation" ? 0 : phase === "inputs" ? 1 : 2;
  const progressPct = ((stepIndex + 1) / 3) * 100;

  const parseBgValue = (): { ok: true; value: number | null; skipped: boolean } | { ok: false } => {
    if (bgSkipped) return { ok: true, value: null, skipped: true };
    const t = bgInput.trim().replace(",", ".");
    if (!t) return { ok: false };
    const n = Number(t);
    if (Number.isNaN(n) || n <= 0) return { ok: false };
    return { ok: true, value: n, skipped: false };
  };

  const drinkSummary = summarizeAlcoholDrinks(
    Object.entries(drinkCounts).map(([id, count]) => ({ id, count })),
  );

  const applyDrinkCount = (id: string, delta: number) => {
    setDrinkCounts((prev) => {
      const nextCount = Math.max(0, (prev[id] ?? 0) + delta);
      const next = { ...prev };
      if (nextCount === 0) delete next[id];
      else next[id] = nextCount;
      return next;
    });
  };

  useEffect(() => {
    if (drinkSummary.suggestedIntensity) setIntensity(drinkSummary.suggestedIntensity);
  }, [drinkSummary.suggestedIntensity, drinkSummary.drinkCount]);

  const parseFoodCarbsGrams = (): number | null => {
    const t = foodCarbsInput.trim().replace(",", ".");
    if (!t) return 0;
    const n = carbUnit === "cp" ? parseFloat(t) * 10 : parseFloat(t);
    if (Number.isNaN(n) || n < 0) return null;
    return Math.round(n);
  };

  const foodCarbsGrams = parseFoodCarbsGrams() ?? 0;
  const sessionCarbsGrams = foodCarbsGrams + drinkSummary.carbsGrams;

  const buildInput = (): { ok: false; message: string } | { ok: true; payload: Parameters<typeof buildAlcoholSituationOutcome>[0] } => {
    if (situation == null) return { ok: false, message: "Choose a situation." };
    const bg = parseBgValue();
    if (!bg.ok) {
      return { ok: false, message: "Enter a valid blood glucose number, or choose to skip for now." };
    }
    const dosing =
      situation === "meal_with_drinks" || situation === "late_snack" || situation === "before_out";
    const foodG = dosing ? parseFoodCarbsGrams() : 0;
    if (dosing && foodG == null) {
      return { ok: false, message: "Enter the food carbs as a number, or leave the box empty." };
    }
    const carbsG = dosing ? (foodG ?? 0) + drinkSummary.carbsGrams : null;
    if ((situation === "meal_with_drinks" || situation === "late_snack") && (carbsG == null || carbsG <= 0)) {
      return { ok: false, message: "Add the drinks, the food, or both." };
    }
    return {
      ok: true,
      payload: {
        situation,
        redFlags,
        bgSkipped: bg.skipped,
        bgValue: bg.value,
        bgTrend: bg.skipped ? null : bgTrend,
        drinkingIntensity: intensity,
        carbsG,
        mealType,
        isPump: isPumpDeliveryMethod(profile?.insulinDeliveryMethod),
      },
    };
  };

  const runGuidance = () => {
    setCarbsError(null);
    const built = buildInput();
    if (!built.ok) {
      setCarbsError(built.message);
      return;
    }
    const o = buildAlcoholSituationOutcome(built.payload, settings, profile.bgUnits);
    const summary = alcoholRecommendationSummary(built.payload, o);
    if (summary) {
      saveAlcoholLastRecommendation({ askedAtIso: new Date().toISOString(), summary });
    }
    setOutcome(o);
    setPhase("result");
  };

  const resetFlow = () => {
    setPhase("situation");
    setSituation(null);
    setOutcome(null);
    setCarbsError(null);
    setResultTipsOpen(false);
    setBgSkipped(false);
    setBgInput("");
    setBgTrend("unknown");
    setIntensity("light");
    setFoodCarbsInput("");
    setDrinkCounts({});
    setDrinkLookupOpen(false);
    setMealType("snack");
    setRedFlags({
      vomiting: false,
      severeAbdominalPain: false,
      confusion: false,
      veryHighBgOrKetones: false,
      cantKeepFluids: false,
    });
    refreshFromStorage();
    formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const pickSituation = (id: AlcoholSituationKind) => {
    setSituation(id);
    if (id === "late_snack") setMealType("snack");
    setPhase("inputs");
    setCarbsError(null);
    setOutcome(null);
  };

  const backToSituation = () => {
    setPhase("situation");
    setSituation(null);
    setCarbsError(null);
  };

  const backToInputs = () => {
    setPhase("inputs");
    setOutcome(null);
    setResultTipsOpen(false);
  };

  useEffect(() => {
    if (phase === "result" && outcome) {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [phase, outcome]);

  const toggleRedFlag = (key: keyof AlcoholRedFlags) => {
    setRedFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const showSticky = phase === "inputs";
  const activeSituation = situation ? SITUATION_CARDS.find((s) => s.id === situation) : null;

  if (!canShowAlcoholScenarios(profile.dateOfBirth)) {
    return <Redirect to="/scenarios" replace />;
  }

  return (
    <div className="min-h-[50vh]">
      <PageShell
        variant="narrow"
        density="compact"
        className={cn(showSticky && "pb-24")}
      >
        <div ref={formTopRef}>
          <PageHeader
            leading={<PageBackButton />}
            title="Alcohol"
            actions={
              <>
                <ScenarioCoachLink topic="alcohol" />
                <PageInfoDialog title="About this tool" description="Alcohol and glucose safety">
                  <InfoSection title="Delayed lows">
                    <p>
                      Alcohol can affect glucose for many hours after you stop drinking. Never treat a low with more alcohol.
                    </p>
                  </InfoSection>
                  <InfoSection title="Estimates">
                    <p>
                      Food bolus numbers use your carb ratios. An alcohol-aware range may suggest less than a normal meal — always confirm with your clinic.
                    </p>
                  </InfoSection>
                  <InfoSection title="Night mode">
                    <p>
                      Pick your bedtime to schedule check reminders: bedtime glucose check, an overnight recheck on moderate or heavier nights (about 2 hours later), and a morning review at 10:00. On iPhone/Android you get local notifications; online you also get in-app alerts. Night mode ends after the morning review.
                    </p>
                  </InfoSection>
                </PageInfoDialog>
              </>
            }
          />
        </div>

        {phase !== "result" ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-base font-medium text-muted-foreground">
              <span>Step {stepIndex + 1} of 3</span>
            </div>
            <Progress value={progressPct} className="h-1" data-testid="alcohol-question-progress" />
          </div>
        ) : null}

        {isPumpDeliveryMethod(profile?.insulinDeliveryMethod) && phase !== "result" ? (
          <p
            className="rounded-lg border border-amber-500/25 bg-amber-500/5 dark:bg-amber-950/25 px-3 py-2 text-base leading-snug text-muted-foreground"
            data-testid="alert-alcohol-pump"
          >
            <span className="font-medium text-foreground">Pump:</span> Check IOB before bolusing — hypos can linger for hours after drinking.
          </p>
        ) : null}

        {phase === "situation" && storage.getScenarioState().alcoholModeActive ? (
          <AlcoholNightModeCard intensity={intensity} activeOnly />
        ) : null}

        {phase === "situation" ? <AlcoholLastRecommendationCard /> : null}

        {phase === "situation" ? (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              What&apos;s going on?
            </h2>
            <div className="grid gap-2">
              {SITUATION_CARDS.map((c) => {
                const Icon = c.icon;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pickSituation(c.id)}
                    className={cn(
                      "group flex min-h-14 w-full items-center gap-3 rounded-[1.35rem] border border-border/70 bg-card/50 px-4 py-3.5 text-left transition-all",
                      "active:scale-[0.99] hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      situation === c.id && "border-primary bg-primary/5",
                    )}
                    data-testid={`alcohol-situation-${c.id}`}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted/60">
                      <Icon className={cn("h-5 w-5", c.iconClass)} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 text-base font-semibold leading-snug text-foreground">{c.title}</span>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="flex min-h-12 w-full items-center justify-between rounded-xl px-1 text-left text-base font-medium text-primary"
              aria-expanded={drinkLookupOpen}
              data-testid="button-alcohol-drink-lookup"
              onClick={() => setDrinkLookupOpen((open) => !open)}
            >
              Look up a drink
              <ChevronDown className={cn("h-4 w-4 transition-transform", drinkLookupOpen && "rotate-180")} />
            </button>
            {drinkLookupOpen ? <AlcoholDrinkRows interactive={false} counts={{}} /> : null}
          </section>
        ) : null}

        {phase === "inputs" && situation && activeSituation ? (
          <section className="space-y-4 overflow-hidden rounded-[1.35rem] border border-violet-500/20 bg-gradient-to-b from-violet-500/[0.07] via-card to-card p-4 shadow-none dark:border-violet-400/15 dark:from-violet-950/35 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted/60">
                  <activeSituation.icon className={cn("h-4 w-4", activeSituation.iconClass)} aria-hidden />
                </span>
                <h2 className="text-base font-semibold leading-snug">{activeSituation.title}</h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10 shrink-0 rounded-xl px-2.5 text-base text-muted-foreground"
                onClick={backToSituation}
                data-testid="button-alcohol-change-situation"
              >
                Change
              </Button>
            </div>

            {situation === "feels_wrong" ? (
                <div className="space-y-3 rounded-2xl border border-destructive/25 bg-destructive/5 p-3.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0" aria-hidden />
                    <p className="text-base font-medium">Red flags — tick any that apply</p>
                  </div>
                  <div className="grid gap-2.5">
                    {RED_FLAG_ROWS.map(([key, text]) => (
                      <div key={key} className="flex items-start gap-2.5">
                        <Checkbox
                          id={`rf-${key}`}
                          checked={redFlags[key]}
                          onCheckedChange={() => toggleRedFlag(key)}
                        />
                        <Label htmlFor={`rf-${key}`} className="text-base font-normal cursor-pointer leading-snug">
                          {text}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {situation !== "feels_wrong" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold text-foreground">Drinks</h3>
                    <AlcoholDrinkRows interactive counts={drinkCounts} onCount={applyDrinkCount} />
                    {drinkSummary.drinkCount > 0 ? (
                      <div className="space-y-1">
                        {DRINK_PATTERN_ORDER.filter((patternId) =>
                          ALCOHOL_DRINKS.some(
                            (drink) =>
                              drink.patternId === patternId && (drinkCounts[drink.id] ?? 0) > 0,
                          ),
                        ).map((patternId) => (
                          <p key={patternId} className="text-base leading-snug text-foreground">
                            {DRINK_PATTERN_TITLE[patternId]}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="alcohol-carbs" className="text-base font-semibold text-foreground">
                      Food
                    </Label>
                    <div className="flex items-stretch gap-2">
                      <Input
                        id="alcohol-carbs"
                        type="text"
                        inputMode={carbUnit === "cp" ? "decimal" : "numeric"}
                        placeholder={carbUnit === "cp" ? "4" : "40"}
                        value={foodCarbsInput}
                        onChange={(e) => setFoodCarbsInput(e.target.value)}
                        autoComplete="off"
                        className="h-14 flex-1 rounded-xl border-border/60 bg-background text-2xl font-semibold tabular-nums tracking-tight shadow-none"
                        data-testid="input-alcohol-carbs"
                      />
                      <span className="flex min-w-[4.5rem] items-center justify-center rounded-xl border border-border/60 bg-muted/40 px-3 text-base font-semibold text-muted-foreground">
                        {carbUnit === "cp" ? "CP" : "g"}
                      </span>
                    </div>
                  </div>
                  {sessionCarbsGrams > 0 || foodCarbsInput.trim() ? (
                    <p className="text-base font-semibold text-foreground" data-testid="alcohol-session-total">
                      {sessionCarbsGrams}g to inject for
                      <span className="mt-1 block font-normal text-muted-foreground">
                        {drinkSummary.carbsGrams}g drinks · {foodCarbsGrams}g food
                      </span>
                    </p>
                  ) : null}
                  {situation !== "late_snack" ? (
                    <div className="space-y-2">
                      <Label className="text-base font-semibold text-foreground">Which meal</Label>
                      <Select value={mealType} onValueChange={setMealType}>
                        <SelectTrigger className="h-12 rounded-xl text-base" data-testid="select-alcohol-meal-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="breakfast">Breakfast</SelectItem>
                          <SelectItem value="lunch">Lunch</SelectItem>
                          <SelectItem value="dinner">Dinner</SelectItem>
                          <SelectItem value="snack">Snack</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {situation !== "feels_wrong" ? (
                <ChoiceGroup
                  name="intensity-meal"
                  label="Expected drinking"
                  value={intensity}
                  onChange={setIntensity}
                  options={[
                    { value: "light", title: "Light — one drink with food" },
                    { value: "moderate", title: "Moderate social drinking" },
                    { value: "long_or_heavy", title: "Longer or heavier night" },
                  ]}
                />
              ) : null}
              {situation !== "feels_wrong" && drinkSummary.drinkCount > 0 ? (
                <p className="text-base leading-snug text-muted-foreground">
                  Suggested from {drinkSummary.drinkCount} {drinkSummary.drinkCount === 1 ? "drink" : "drinks"}. You can change this.
                </p>
              ) : null}
              {situation === "before_out" ? null : situation !== "feels_wrong" ? null : (
                <ChoiceGroup
                  name="intensity-feels"
                  label="Drinking level"
                  value={intensity}
                  onChange={setIntensity}
                  options={[
                    { value: "light", title: "Light" },
                    { value: "moderate", title: "Moderate" },
                    { value: "long_or_heavy", title: "Longer or heavier" },
                  ]}
                />
              )}

              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-base font-semibold text-foreground">Glucose (optional)</span>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="bg-skip"
                      checked={bgSkipped}
                      onCheckedChange={(c) => {
                        const on = c === true;
                        setBgSkipped(on);
                        if (on) setBgTrend("unknown");
                      }}
                    />
                    <Label htmlFor="bg-skip" className="text-base font-normal cursor-pointer text-muted-foreground">
                      Skip
                    </Label>
                  </div>
                </div>
                {!bgSkipped ? (
                  <div className="space-y-3 rounded-2xl border border-border/50 bg-background/70 p-3 shadow-sm dark:bg-background/40">
                    <Label htmlFor="alcohol-bg" className="sr-only">
                      Reading ({bgUnits})
                    </Label>
                    <div className="flex items-stretch gap-2">
                      <Input
                        id="alcohol-bg"
                        type="text"
                        inputMode="decimal"
                        placeholder={bgUnits === "mmol/L" ? "5.6" : "100"}
                        value={bgInput}
                        onChange={(e) => alcoholCgm.onBgChange(e.target.value)}
                        autoComplete="off"
                        className="h-14 flex-1 rounded-xl border-border/60 bg-background text-2xl font-semibold tabular-nums tracking-tight shadow-none"
                        data-testid="input-alcohol-bg"
                      />
                      <span className="flex min-w-[4.5rem] items-center justify-center rounded-xl border border-border/60 bg-muted/40 px-3 text-base font-semibold text-muted-foreground">
                        {bgUnits}
                      </span>
                    </div>
                    <CgmPrefillButton
                      prefill={alcoholCgm.prefill}
                      loading={alcoholCgm.loading}
                      bgUnits={bgUnits}
                      currentValue={bgInput}
                      onApply={alcoholCgm.onBgChange}
                      onApplyTrend={(trend) => {
                        const mapped = cgmTrendForAlcohol(trend);
                        if (mapped) setBgTrend(mapped);
                      }}
                      onRefresh={alcoholCgm.refresh}
                      emptyHint={alcoholCgm.emptyHint}
                      allowSync
                      testId="button-alcohol-cgm-prefill"
                    />
                    <BgTrendThreeButtons
                      label="Trend"
                      labelClassName="text-base font-semibold text-foreground"
                      value={bgTrend}
                      onChange={(v) => setBgTrend(v as AlcoholTrend)}
                      unsetValue="unknown"
                      flatLabel="Stable"
                      buttonClassName="h-11 rounded-xl text-base"
                    />
                  </div>
                ) : null}
              </div>

              {carbsError ? (
                <p className="text-base text-destructive" role="alert">
                  {carbsError}
                </p>
              ) : null}
          </section>
        ) : null}

        {phase === "result" && outcome ? (
          <div ref={resultsRef}>
            {outcome.kind === "estimate" ? (
              <AlcoholEstimateResult
                meal={outcome.meal}
                guidance={outcome.alcoholGuidance}
                bgUnits={bgUnits}
                mealType={mealType}
                situationLabel={activeSituation?.title ?? null}
                drinkSummary={drinkSummary}
                foodCarbsGrams={foodCarbsGrams}
                onEdit={backToInputs}
                onReset={resetFlow}
              />
            ) : outcome.kind === "urgent" || outcome.kind === "hypo_first" ? (
              <AlcoholSafetyResult outcome={outcome} onReset={resetFlow} />
            ) : outcome.kind === "prep_only" ? (
              <AlcoholPrepResult
                outcome={outcome}
                intensity={intensity}
                situationLabel={activeSituation?.title ?? null}
                tipsOpen={resultTipsOpen}
                onTipsOpenChange={setResultTipsOpen}
                onEdit={backToInputs}
                onReset={resetFlow}
              />
            ) : (
              <AlcoholSimpleResult outcome={outcome} onEdit={backToInputs} onReset={resetFlow} />
            )}
          </div>
        ) : null}

        <Disclaimer className="text-center text-base leading-relaxed" />
      </PageShell>

      {showSticky ? (
        <div
          className="fixed bottom-[var(--bottom-nav-height,0px)] left-0 right-0 z-40 border-t border-border/80 bg-background/95 px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/85"
          data-testid="alcohol-sticky-actions"
        >
          <div className="mx-auto flex w-full min-w-0 max-w-lg items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-12 shrink-0 gap-1.5 rounded-xl px-4 text-base"
              onClick={backToSituation}
              data-testid="button-alcohol-back-step"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              className="h-12 min-w-0 flex-1 gap-1.5 rounded-xl text-base font-semibold"
              onClick={runGuidance}
              data-testid="button-alcohol-show-plan"
            >
              Show guidance
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
