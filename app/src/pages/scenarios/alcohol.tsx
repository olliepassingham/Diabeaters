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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
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
import { AlcoholMorningCgmCard } from "@/components/scenarios/alcohol-morning-cgm-card";
import { cgmTrendForAlcohol } from "@/lib/cgm/apply-cgm-trend";

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
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <RadioGroup value={value} onValueChange={(v) => onChange(v as T)} className="grid gap-2">
        {options.map((opt) => {
          const id = `${name}-${opt.value}`;
          return (
            <div
              key={opt.value}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors cursor-pointer",
                value === opt.value
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border/70 hover:bg-muted/40",
              )}
              onClick={() => onChange(opt.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onChange(opt.value);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <RadioGroupItem value={opt.value} id={id} />
              <Label htmlFor={id} className="flex-1 font-normal cursor-pointer text-sm leading-snug">
                {opt.title}
              </Label>
            </div>
          );
        })}
      </RadioGroup>
    </div>
  );
}


function AlcoholActionLinks({ links }: { links: AlcoholSituationLinks }) {
  return (
    <div className="flex flex-wrap gap-2">
      {links.hypoHelp ? (
        <Button variant="secondary" size="sm" className="gap-1.5" asChild>
          <Link href={linkWithFrom("/tools/hypo-help")}>
            <Droplet className="h-4 w-4" />
            Hypo help
          </Link>
        </Button>
      ) : null}
      {links.sickDay ? (
        <Button variant="secondary" size="sm" asChild>
          <Link href={linkWithFrom("/sick-day")}>Sick day</Link>
        </Button>
      ) : null}
      {links.helpNow ? (
        <Button variant="secondary" size="sm" className="gap-1.5" asChild>
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
}: {
  intensity: AlcoholIntensity;
  situationLabel?: string | null;
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
            <p className="text-sm font-semibold text-foreground">Night mode is on</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Reminders on until your morning review.
            </p>
          </div>
        </div>
        <ul className="space-y-1.5 border-t border-border/40 pt-3">
          {schedule.map((item) => (
            <li key={item.kind} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-foreground/90">{item.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{formatNightModeTime(item.atIso)}</span>
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          className="w-full min-h-11"
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
          <p className="text-sm font-semibold text-foreground">Tonight&apos;s checks</p>
          <p className="text-xs text-muted-foreground">Bedtime and overnight reminders on this device.</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="alcohol-bedtime" className="text-xs text-muted-foreground">
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
          <li key={item.kind} className="flex items-center justify-between gap-2 text-xs">
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
          <span className="min-w-0 text-xs text-foreground/90">
            Let supporters know
          </span>
        </label>
      ) : null}
      <Button
        type="button"
        className="w-full min-h-10 rounded-xl"
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
  onEdit,
  onReset,
}: {
  meal: MealDoseResult;
  guidance: AlcoholDoseGuidance;
  bgUnits: string;
  mealType: string;
  situationLabel: string | null;
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
            className="absolute right-2 top-2 h-8 gap-1 px-2 text-xs text-muted-foreground"
            onClick={onReset}
            data-testid="button-alcohol-edit-answers"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary/90">Your range tonight</p>
          <p
            className="mt-1 font-display text-5xl font-bold tabular-nums tracking-tight text-foreground"
            data-testid="alcohol-dose-range"
          >
            {showRange ? rangeLabel : "Discuss with team"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{guidance.contextLabel}</p>
          {guidance.standardDose > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              vs <span className="font-medium tabular-nums text-foreground/85">{guidance.standardDose}u</span> food alone
              {rounding ? (
                <>
                  {" "}
                  · exact <span className="tabular-nums">{rounding.exactLabel}</span>
                </>
              ) : null}
            </p>
          ) : null}
          {leanLine ? (
            <p className="mt-2 text-xs font-medium text-foreground/90" data-testid="alcohol-bg-note">
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
              <p className="text-sm font-semibold text-foreground">{guidance.riskHeadline}</p>
              <p className="text-xs text-foreground/80">{overnightNote}</p>
            </div>
          </div>
        </div>
      ) : null}

      <AlcoholNightModeCard intensity={guidance.drinkingIntensity} situationLabel={situationLabel} />

      <div className="flex gap-2">
        <Button asChild className="min-h-11 flex-1 gap-2 rounded-xl">
          <Link href={linkWithFrom(adviserLinkFromAlcohol(meal.carbs, mealType))}>
            <Calculator className="h-4 w-4" />
            Open Meal Adviser
          </Link>
        </Button>
        <Button type="button" variant="outline" className="min-h-11 shrink-0 rounded-xl" onClick={onEdit}>
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
            className="absolute right-2 top-2 h-8 gap-1 px-2 text-xs text-muted-foreground"
            onClick={onReset}
            data-testid="button-alcohol-edit-answers"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <h2 className="text-lg font-semibold leading-snug text-foreground">{outcome.headline}</h2>
          <p className="text-sm leading-relaxed text-foreground/85">{outcome.lead}</p>
        </div>
      </div>
      <ol className="space-y-2 px-4 pb-4" aria-label="Safety steps">
        {outcome.bullets.map((b, i) => (
          <li key={b} className="flex gap-3 text-sm leading-relaxed text-foreground/90">
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
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
              className="float-right -mt-1 h-8 gap-1 px-2 text-xs text-muted-foreground"
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
              <li key={item} className="flex items-start gap-2.5 text-sm leading-snug text-foreground/90">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {outcome.tips.length > 0 ? (
        <Collapsible open={tipsOpen} onOpenChange={onTipsOpenChange}>
          <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 rounded-xl border border-border/60 bg-card/50 px-3.5 py-2.5 text-left text-sm font-medium outline-none hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden />
              Tips
              <span className="text-xs font-normal text-muted-foreground">({outcome.tips.length})</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" aria-hidden />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {outcome.tips.map((tip) => (
              <p key={tip} className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 text-sm leading-relaxed text-foreground/90">
                {tip}
              </p>
            ))}
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      <AlcoholNightModeCard intensity={intensity} situationLabel={situationLabel} />

      <Button type="button" variant="outline" className="w-full gap-1.5 rounded-xl" onClick={onEdit}>
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
          {body ? <p className="text-sm leading-relaxed text-foreground/85">{body}</p> : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 gap-1 px-2 text-xs text-muted-foreground"
          onClick={onReset}
          data-testid="button-alcohol-edit-answers"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>
      {(outcome.kind === "needs_ratios" || outcome.kind === "needs_carbs") && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" asChild>
            <Link href={linkWithFrom("/adviser?tab=ratios")}>Ratio Adviser</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/settings">Settings</Link>
          </Button>
        </div>
      )}
      {outcome.kind === "feels_ok" ? <AlcoholActionLinks links={outcome.links} /> : null}
      <Button type="button" variant="outline" className="w-full gap-1.5" onClick={onEdit}>
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
  const [carbsInput, setCarbsInput] = useState("");
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

  const parseCarbsGrams = (): number | null => {
    const t = carbsInput.trim().replace(",", ".");
    if (!t) return null;
    const n = carbUnit === "cp" ? parseInt(t, 10) * 10 : parseInt(t, 10);
    if (Number.isNaN(n) || n <= 0) return null;
    return n;
  };

  const buildInput = (): { ok: false; message: string } | { ok: true; payload: Parameters<typeof buildAlcoholSituationOutcome>[0] } => {
    if (situation == null) return { ok: false, message: "Choose a situation." };
    const bg = parseBgValue();
    if (!bg.ok) {
      return { ok: false, message: "Enter a valid blood glucose number, or choose to skip for now." };
    }
    const carbsG =
      situation === "meal_with_drinks" || situation === "late_snack" ? parseCarbsGrams() : null;
    if ((situation === "meal_with_drinks" || situation === "late_snack") && (carbsG == null || carbsG <= 0)) {
      return { ok: false, message: `Enter carbs (${carbUnit === "cp" ? "CP" : "grams"}) for this food or snack.` };
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
    setCarbsInput("");
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
            <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span>Step {stepIndex + 1} of 3</span>
            </div>
            <Progress value={progressPct} className="h-1" data-testid="alcohol-question-progress" />
          </div>
        ) : null}

        {isPumpDeliveryMethod(profile?.insulinDeliveryMethod) && phase !== "result" ? (
          <p
            className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs leading-snug text-muted-foreground"
            data-testid="alert-alcohol-pump"
          >
            <span className="font-medium text-foreground">Pump:</span> Check IOB before bolusing — hypos can linger for hours after drinking.
          </p>
        ) : null}

        {phase === "situation" ? <AlcoholMorningCgmCard units={bgUnits} /> : null}

        {phase === "situation" ? (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">What&apos;s going on?</h2>
            <div className="grid gap-2">
              {SITUATION_CARDS.map((c) => {
                const Icon = c.icon;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pickSituation(c.id)}
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-xl border border-border/70 bg-card/40 px-3.5 py-3 text-left transition-all",
                      "active:scale-[0.99] hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      situation === c.id && "border-primary bg-primary/5",
                    )}
                    data-testid={`alcohol-situation-${c.id}`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                      <Icon className={cn("h-4 w-4", c.iconClass)} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-foreground">{c.title}</span>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {phase === "inputs" && situation && activeSituation ? (
          <Card className="surface-card border-border/60 shadow-none">
            <CardHeader className="space-y-2 pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                    <activeSituation.icon className={cn("h-4 w-4", activeSituation.iconClass)} aria-hidden />
                  </span>
                  <CardTitle className="text-base font-semibold leading-snug">{activeSituation.title}</CardTitle>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 px-2 text-xs text-muted-foreground"
                  onClick={backToSituation}
                  data-testid="button-alcohol-change-situation"
                >
                  Change
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-0">
              {situation === "feels_wrong" ? (
                <div className="space-y-3 rounded-xl border border-destructive/25 bg-destructive/5 p-3.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0" aria-hidden />
                    <p className="text-sm font-medium">Red flags — tick any that apply</p>
                  </div>
                  <div className="grid gap-2.5">
                    {RED_FLAG_ROWS.map(([key, text]) => (
                      <div key={key} className="flex items-start gap-2.5">
                        <Checkbox
                          id={`rf-${key}`}
                          checked={redFlags[key]}
                          onCheckedChange={() => toggleRedFlag(key)}
                        />
                        <Label htmlFor={`rf-${key}`} className="text-sm font-normal cursor-pointer leading-snug">
                          {text}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {(situation === "meal_with_drinks" || situation === "late_snack") && (
                <div className="space-y-4">
                  <div className="space-y-2 max-w-xs">
                    <Label htmlFor="alcohol-carbs">Carbs ({carbUnit === "cp" ? "CP" : "grams"})</Label>
                    <Input
                      id="alcohol-carbs"
                      type="text"
                      inputMode="numeric"
                      placeholder={carbUnit === "cp" ? "e.g. 6" : "e.g. 60"}
                      value={carbsInput}
                      onChange={(e) => setCarbsInput(e.target.value)}
                      autoComplete="off"
                      data-testid="input-alcohol-carbs"
                    />
                  </div>
                  <div className="space-y-2 max-w-xs">
                    <Label>Meal period</Label>
                    <Select value={mealType} onValueChange={setMealType}>
                      <SelectTrigger data-testid="select-alcohol-meal-type">
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
                </div>
              )}

              {situation === "before_out" ? (
                <ChoiceGroup
                  name="intensity-before"
                  label="Expected drinking"
                  value={intensity}
                  onChange={setIntensity}
                  options={[
                    { value: "light", title: "Light — one drink with food" },
                    { value: "moderate", title: "Moderate social drinking" },
                    { value: "long_or_heavy", title: "Longer or heavier night" },
                  ]}
                />
              ) : situation !== "feels_wrong" ? (
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
              ) : (
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
                  <Label className="text-sm font-medium">Glucose (optional)</Label>
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
                    <Label htmlFor="bg-skip" className="text-xs font-normal cursor-pointer text-muted-foreground">
                      Skip
                    </Label>
                  </div>
                </div>
                {!bgSkipped ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5 max-w-xs">
                      <Label htmlFor="alcohol-bg" className="text-xs text-muted-foreground">
                        Reading ({bgUnits})
                      </Label>
                      <Input
                        id="alcohol-bg"
                        type="text"
                        inputMode="decimal"
                        placeholder={bgUnits === "mmol/L" ? "e.g. 5.6" : "e.g. 100"}
                        value={bgInput}
                        onChange={(e) => alcoholCgm.onBgChange(e.target.value)}
                        autoComplete="off"
                        data-testid="input-alcohol-bg"
                      />
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
                    </div>
                    <BgTrendThreeButtons
                      label="Trend (if you know it)"
                      value={bgTrend}
                      onChange={(v) => setBgTrend(v as AlcoholTrend)}
                      unsetValue="unknown"
                      flatLabel="Flat / stable"
                    />
                  </div>
                ) : null}
              </div>

              {carbsError ? (
                <p className="text-sm text-destructive" role="alert">
                  {carbsError}
                </p>
              ) : null}
            </CardContent>
          </Card>
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

        <Disclaimer className="text-center text-[11px] leading-relaxed opacity-80" />
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
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={backToSituation}
              data-testid="button-alcohol-back-step"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              size="sm"
              className="ml-auto min-w-[9rem] flex-1 gap-1.5 sm:flex-none"
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
