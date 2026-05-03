import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
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
  Calculator,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { ScenarioCoachLink } from "@/components/ai-coach/ScenarioCoachLink";
import { ScenarioToolDisclaimer } from "@/components/disclaimer";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { storage, type UserProfile, type UserSettings } from "@/lib/storage";
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
  type AlcoholSituationOutcome,
} from "@/lib/alcohol-situation-tool";
import { cn } from "@/lib/utils";
import { BgTrendThreeButtons } from "@/components/bg-trend-three-buttons";

const FROM_SCENARIOS = "from=/scenarios";

function linkWithFrom(path: string): string {
  return path.includes("?") ? `${path}&${FROM_SCENARIOS}` : `${path}?${FROM_SCENARIOS}`;
}

type Phase = "situation" | "inputs" | "result";

const SITUATION_CARDS: {
  id: AlcoholSituationKind;
  title: string;
  description: string;
}[] = [
  {
    id: "meal_with_drinks",
    title: "Meal or snacks with drinks",
    description: "Carb estimate from your saved ratios.",
  },
  {
    id: "late_snack",
    title: "Eating after drinking / late snack",
    description: "Late food and delayed-low reminders.",
  },
  {
    id: "before_out",
    title: "Before I go out",
    description: "Quick prep before you leave.",
  },
  {
    id: "feels_wrong",
    title: "Something feels wrong",
    description: "Red flags and where to get help fast.",
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
    <div className="space-y-3">
      <Label className="text-sm font-medium">{label}</Label>
      <RadioGroup value={value} onValueChange={(v) => onChange(v as T)} className="space-y-2">
        {options.map((opt) => {
          const id = `${name}-${opt.value}`;
          return (
            <div
              key={opt.value}
              className={cn(
                "flex items-start space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer",
                value === opt.value && "border-primary bg-primary/5",
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
              <RadioGroupItem value={opt.value} id={id} className="mt-0.5" />
              <div className="flex-1 min-w-0">
                <Label htmlFor={id} className="font-normal cursor-pointer leading-snug">
                  {opt.title}
                </Label>
                {opt.description ? (
                  <p className="text-xs text-muted-foreground mt-1">{opt.description}</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </RadioGroup>
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: AlcoholSituationOutcome }) {
  if (outcome.kind === "urgent") {
    return <Badge variant="destructive">Urgent — seek help</Badge>;
  }
  if (outcome.kind === "hypo_first") {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/70 bg-amber-500/10 text-amber-950 dark:text-amber-100"
      >
        Treat glucose first
      </Badge>
    );
  }
  if (outcome.kind === "estimate") {
    return (
      <Badge variant="secondary" className="font-medium">
        Carb coverage estimate
      </Badge>
    );
  }
  if (outcome.kind === "prep_only") {
    return (
      <Badge variant="outline" className="font-medium">
        Planning
      </Badge>
    );
  }
  if (outcome.kind === "needs_ratios" || outcome.kind === "needs_carbs") {
    return <Badge variant="outline">More info needed</Badge>;
  }
  return (
    <Badge variant="outline" className="font-medium">
      Safety
    </Badge>
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
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
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
  const [mealType, setMealType] = useState<string>("lunch");
  const [redFlags, setRedFlags] = useState<AlcoholRedFlags>({
    vomiting: false,
    severeAbdominalPain: false,
    confusion: false,
    veryHighBgOrKetones: false,
    cantKeepFluids: false,
  });

  const formTopRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const refreshFromStorage = () => {
    const p = storage.getProfile();
    if (p) setProfile(p);
    setSettings(storage.getSettings());
  };

  useEffect(() => {
    refreshFromStorage();
  }, []);

  const bgUnits = normalizeBgUnits(profile.bgUnits);
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
    setBgSkipped(false);
    setBgInput("");
    setBgTrend("unknown");
    setIntensity("light");
    setCarbsInput("");
    setMealType("lunch");
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
  };

  useEffect(() => {
    if (phase === "result" && outcome) {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [phase, outcome]);

  const toggleRedFlag = (key: keyof AlcoholRedFlags) => {
    setRedFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const estimateCarbsG = useMemo(() => {
    if (outcome?.kind !== "estimate") return null;
    return outcome.meal.carbs;
  }, [outcome]);

  const showSticky = phase !== "result";

  return (
    <div className="min-h-[50vh]">
      <PageShell
        variant="standard"
        className={cn("space-y-6", showSticky && "pb-28 sm:pb-6")}
      >
        <div ref={formTopRef}>
          <PageHeader
            leading={<PageBackButton />}
            title="Alcohol"
            description="Pick your situation — estimates use your saved ratios (like Meal Adviser). Not medical advice."
            actions={
              <>
                <ScenarioCoachLink topic="alcohol" />
                <PageInfoDialog title="About this tool" description="Alcohol and glucose — read before you rely on estimates">
                  <InfoSection title="Delayed lows">
                    <p>
                      Alcohol can affect glucose for many hours after you stop drinking. Never treat a low with more alcohol.
                    </p>
                  </InfoSection>
                  <InfoSection title="Estimates">
                    <p>
                      Carb coverage numbers use the same ratio logic as Meal Adviser in this app. They do not replace your
                      clinic&apos;s plan.
                    </p>
                  </InfoSection>
                </PageInfoDialog>
              </>
            }
          />
          <ScenarioToolDisclaimer className="mt-4" />
        </div>

        {profile?.insulinDeliveryMethod === "pump" && (
          <Alert data-testid="alert-alcohol-pump">
            <AlertTitle className="text-sm">Pump</AlertTitle>
            <AlertDescription className="text-sm">
              Alcohol can make hypos more likely for many hours. Check <strong>IOB</strong> before extra meal or correction
              boluses, and be cautious stacking insulin after drinking. Temp basals or extended boluses may need review —
              follow your team&apos;s alcohol plan.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="font-medium uppercase tracking-wide">
              Step {stepIndex + 1} of 3
            </span>
          </div>
          <Progress value={progressPct} className="h-1.5" data-testid="alcohol-question-progress" />
        </div>

        {phase === "situation" ? (
          <Card className="surface-card">
            <CardHeader className="space-y-1">
              <CardTitle className="text-h3 flex items-center gap-2 text-foreground">
                <Wine className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0" />
                What&apos;s going on?
              </CardTitle>
              <CardDescription>Pick the closest situation. You can change it anytime.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">
                Tap the info button above for delayed-low safety and how estimates work.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {SITUATION_CARDS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pickSituation(c.id)}
                    className={cn(
                      "text-left rounded-xl border p-4 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      situation === c.id && "border-primary bg-primary/5",
                    )}
                    data-testid={`alcohol-situation-${c.id}`}
                  >
                    <p className="font-semibold text-foreground">{c.title}</p>
                    <p className="text-sm text-muted-foreground mt-1.5 leading-snug">{c.description}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {phase === "inputs" && situation ? (
          <Card className="surface-card">
            <CardHeader className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-h3">A few details</CardTitle>
                  <CardDescription>
                    {SITUATION_CARDS.find((s) => s.id === situation)?.title}
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground shrink-0 -mt-1 sm:mt-0"
                  onClick={backToSituation}
                  data-testid="button-alcohol-change-situation"
                >
                  Change situation
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-8">
              {situation === "feels_wrong" ? (
                <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Red flags — tick anything that applies now</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        If any apply, we will point you to urgent help rather than drinking guidance.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {RED_FLAG_ROWS.map(([key, text]) => (
                      <div key={key} className="flex items-start gap-2">
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
                  label="How heavy do you expect drinking to be?"
                  value={intensity}
                  onChange={setIntensity}
                  options={[
                    { value: "light", title: "Light / one drink with food" },
                    { value: "moderate", title: "Moderate social drinking" },
                    {
                      value: "long_or_heavy",
                      title: "Longer night or heavier drinking",
                      description: "Still not a recommendation to drink — only helps tailor reminders.",
                    },
                  ]}
                />
              ) : situation !== "feels_wrong" ? (
                <ChoiceGroup
                  name="intensity-meal"
                  label="How heavy do you expect drinking to be?"
                  value={intensity}
                  onChange={setIntensity}
                  options={[
                    { value: "light", title: "Light / one drink with food" },
                    { value: "moderate", title: "Moderate social drinking" },
                    {
                      value: "long_or_heavy",
                      title: "Longer night or heavier drinking",
                      description: "Used with trend to flag possible delayed-low risk.",
                    },
                  ]}
                />
              ) : (
                <ChoiceGroup
                  name="intensity-feels"
                  label="If you add a glucose reading, how heavy was or will drinking be?"
                  value={intensity}
                  onChange={setIntensity}
                  options={[
                    { value: "light", title: "Light / one drink" },
                    { value: "moderate", title: "Moderate" },
                    { value: "long_or_heavy", title: "Longer or heavier" },
                  ]}
                />
              )}

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-sm font-medium">Current glucose (optional)</Label>
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
                    <Label htmlFor="bg-skip" className="text-sm font-normal cursor-pointer">
                      Skip — no reading
                    </Label>
                  </div>
                </div>
                {!bgSkipped ? (
                  <div className="space-y-4">
                    <div className="space-y-2 max-w-xs">
                      <Label htmlFor="alcohol-bg">Blood glucose ({bgUnits})</Label>
                      <Input
                        id="alcohol-bg"
                        type="text"
                        inputMode="decimal"
                        placeholder={bgUnits === "mmol/L" ? "e.g. 5.6" : "e.g. 100"}
                        value={bgInput}
                        onChange={(e) => setBgInput(e.target.value)}
                        autoComplete="off"
                        data-testid="input-alcohol-bg"
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
          <div ref={resultsRef} className="space-y-4">
            <Card
              className={cn(
                "surface-card border-2 overflow-hidden",
                outcome.kind === "urgent" && "border-destructive/60",
                outcome.kind === "hypo_first" && "border-amber-500/50",
                outcome.kind === "estimate" && "border-primary/30",
              )}
              data-testid="alcohol-plan-card"
            >
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2 min-w-0">
                    <OutcomeBadge outcome={outcome} />
                    {outcome.kind === "estimate" ? (
                      <>
                        <CardTitle className="text-h3 leading-tight flex items-center gap-2">
                          <Utensils className="h-6 w-6 text-primary shrink-0" />
                          About {outcome.meal.dose} units
                        </CardTitle>
                        <CardDescription className="text-base text-foreground/90">
                          For ~{outcome.meal.carbs}g carbs at {outcome.meal.mealType} using your saved ratios
                          {outcome.meal.exactDose ? ` (exact ${outcome.meal.exactDose}u)` : ""}.
                        </CardDescription>
                        {outcome.meal.roundingAdvice ? (
                          <p className="text-sm text-muted-foreground">{outcome.meal.roundingAdvice}</p>
                        ) : null}
                      </>
                    ) : outcome.kind === "prep_only" ? (
                      <>
                        <CardTitle className="text-h3 leading-tight flex items-center gap-2">
                          <Moon className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0" />
                          {outcome.headline}
                        </CardTitle>
                      </>
                    ) : outcome.kind === "needs_ratios" || outcome.kind === "needs_carbs" ? (
                      <>
                        <CardTitle className="text-h3 leading-tight">{outcome.message}</CardTitle>
                      </>
                    ) : outcome.kind === "feels_ok" ? (
                      <>
                        <CardTitle className="text-h3 leading-tight">{outcome.headline}</CardTitle>
                        <CardDescription className="text-base text-foreground/90">{outcome.body}</CardDescription>
                      </>
                    ) : (
                      <>
                        <CardTitle className="text-h3 leading-tight">{outcome.headline}</CardTitle>
                        <CardDescription className="text-base text-foreground/90">{outcome.lead}</CardDescription>
                      </>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 shrink-0 self-start"
                    onClick={resetFlow}
                    data-testid="button-alcohol-edit-answers"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Start over
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {(outcome.kind === "urgent" || outcome.kind === "hypo_first") && (
                  <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                    {outcome.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}

                {outcome.kind === "estimate" && (
                  <Collapsible className="group rounded-lg border border-border/60">
                    <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/50 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span>Tips, safety note, and Meal Adviser</span>
                      <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="border-t border-border/60 px-4 pb-4 pt-3 space-y-4">
                      <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                        {outcome.tips.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                      <Alert>
                        <AlertDescription className="text-sm">{outcome.disclaimer}</AlertDescription>
                      </Alert>
                      <div className="flex flex-wrap gap-2">
                        {estimateCarbsG != null ? (
                          <Button asChild className="gap-2">
                            <Link href={linkWithFrom(adviserLinkFromAlcohol(estimateCarbsG, mealType))}>
                              <Calculator className="h-4 w-4" />
                              Open in Meal Adviser
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {outcome.kind === "prep_only" && (
                  <>
                    <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                      {outcome.tips.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                    {outcome.checklist.length > 0 ? (
                      <Collapsible className="group rounded-lg border border-border/60">
                        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/50 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          <span>Quick checklist</span>
                          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="border-t border-border/60 px-4 pb-4 pt-2">
                          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                            {outcome.checklist.map((c) => (
                              <li key={c}>{c}</li>
                            ))}
                          </ul>
                        </CollapsibleContent>
                      </Collapsible>
                    ) : null}
                  </>
                )}

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

                {outcome.kind === "feels_ok" && (
                  <div className="flex flex-wrap gap-2">
                    {outcome.links.helpNow ? (
                      <Button variant="secondary" size="sm" asChild>
                        <Link href={linkWithFrom("/help-now")}>
                          <Phone className="h-4 w-4 mr-1.5" />
                          Help now
                        </Link>
                      </Button>
                    ) : null}
                    {outcome.links.hypoHelp ? (
                      <Button variant="secondary" size="sm" asChild>
                        <Link href={linkWithFrom("/tools/hypo-help")}>
                          <Droplet className="h-4 w-4 mr-1.5" />
                          Hypo help
                        </Link>
                      </Button>
                    ) : null}
                    {outcome.links.sickDay ? (
                      <Button variant="secondary" size="sm" asChild>
                        <Link href={linkWithFrom("/sick-day")}>Sick day</Link>
                      </Button>
                    ) : null}
                  </div>
                )}

                {(outcome.kind === "urgent" || outcome.kind === "hypo_first") && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {outcome.links.hypoHelp ? (
                      <Button variant="secondary" size="sm" asChild>
                        <Link href={linkWithFrom("/tools/hypo-help")}>
                          <Droplet className="h-4 w-4 mr-1.5" />
                          Hypo help
                        </Link>
                      </Button>
                    ) : null}
                    {outcome.links.sickDay ? (
                      <Button variant="secondary" size="sm" asChild>
                        <Link href={linkWithFrom("/sick-day")}>Sick day</Link>
                      </Button>
                    ) : null}
                    {outcome.links.helpNow ? (
                      <Button variant="secondary" size="sm" asChild>
                        <Link href={linkWithFrom("/help-now")}>
                          <Phone className="h-4 w-4 mr-1.5" />
                          Help now
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </PageShell>

      {showSticky ? (
        <div
          className="fixed bottom-[var(--bottom-nav-height,0px)] left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:static sm:z-auto sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none"
          data-testid="alcohol-sticky-actions"
        >
          {/* PageShell reserves nav padding-bottom; never use it inside this fixed bar or it balloons the footer height. */}
          <div className="mx-auto flex w-full min-w-0 max-w-3xl items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-1.5 shrink-0"
              onClick={phase === "inputs" ? backToSituation : undefined}
              disabled={phase === "situation"}
              data-testid="button-alcohol-back-step"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            {phase === "inputs" ? (
              <Button
                type="button"
                className="gap-1.5 min-w-[8.5rem]"
                onClick={runGuidance}
                data-testid="button-alcohol-show-plan"
              >
                Show guidance
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <span className="text-sm text-muted-foreground sm:ml-auto line-clamp-2 text-right">
                Choose a situation to continue
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="mx-auto flex w-full min-w-0 max-w-3xl justify-start">
          <Button type="button" variant="outline" className="gap-1.5" onClick={backToInputs}>
            <ArrowLeft className="h-4 w-4" />
            Edit details
          </Button>
        </div>
      )}
    </div>
  );
}
