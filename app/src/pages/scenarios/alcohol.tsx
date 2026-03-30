import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Wine, AlertTriangle, Droplet, Phone, RotateCcw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { storage, type UserProfile } from "@/lib/storage";
import {
  buildAlcoholNightPlan,
  normalizeBgUnits,
  type AlcoholActivity,
  type AlcoholCgm,
  type AlcoholCompanions,
  type AlcoholFood,
  type AlcoholInsulin,
  type AlcoholIntensity,
  type AlcoholNightInputs,
  type AlcoholRedFlags,
  type AlcoholTiming,
  type AlcoholTrend,
} from "@/lib/alcohol-night-tool";
import { cn } from "@/lib/utils";

const FROM_SCENARIOS = "from=/scenarios";

function linkWithFrom(path: string): string {
  return path.includes("?") ? `${path}&${FROM_SCENARIOS}` : `${path}?${FROM_SCENARIOS}`;
}

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
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as T)}
        className="space-y-2"
      >
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

export default function AlcoholScenarioPage() {
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [showPlan, setShowPlan] = useState(false);
  const [checklistDone, setChecklistDone] = useState<Record<string, boolean>>({});
  const formTopRef = useRef<HTMLDivElement>(null);

  const [timing, setTiming] = useState<AlcoholTiming>("tonight");
  const [food, setFood] = useState<AlcoholFood>("unsure");
  const [activityToday, setActivityToday] = useState<AlcoholActivity>("light");
  const [companions, setCompanions] = useState<AlcoholCompanions>("with_others");
  const [cgm, setCgm] = useState<AlcoholCgm>("unsure");
  const [insulin, setInsulin] = useState<AlcoholInsulin>("unsure");
  const [bgSkipped, setBgSkipped] = useState(false);
  const [bgInput, setBgInput] = useState("");
  const [bgTrend, setBgTrend] = useState<AlcoholTrend>("unknown");
  const [intensity, setIntensity] = useState<AlcoholIntensity>("light");
  const [redFlags, setRedFlags] = useState<AlcoholRedFlags>({
    vomiting: false,
    severeAbdominalPain: false,
    confusion: false,
    veryHighBgOrKetones: false,
    cantKeepFluids: false,
  });

  useEffect(() => {
    const p = storage.getProfile();
    if (p) setProfile(p);
  }, []);

  const bgUnits = normalizeBgUnits(profile.bgUnits);

  const resolvedInput = useMemo((): AlcoholNightInputs | null => {
    let bgValue: number | null = null;
    if (!bgSkipped) {
      const t = bgInput.trim().replace(",", ".");
      if (!t) return null;
      const n = Number(t);
      if (Number.isNaN(n) || n <= 0) return null;
      bgValue = n;
    }
    return {
      timing,
      food,
      activityToday,
      companions,
      cgm,
      insulin,
      bgSkipped,
      bgValue,
      bgTrend: bgSkipped ? null : bgTrend,
      intensity,
      redFlags,
    };
  }, [
    timing,
    food,
    activityToday,
    companions,
    cgm,
    insulin,
    bgSkipped,
    bgInput,
    bgTrend,
    intensity,
    redFlags,
  ]);

  const plan = useMemo(() => {
    if (!showPlan || !resolvedInput) return null;
    return buildAlcoholNightPlan(resolvedInput, bgUnits);
  }, [showPlan, resolvedInput, bgUnits]);

  const bgRequiredError =
    showPlan && !resolvedInput && !bgSkipped ? "Enter a valid blood glucose number, or choose to skip for now." : null;

  const toggleRedFlag = (key: keyof AlcoholRedFlags) => {
    setRedFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const resetFlow = () => {
    setShowPlan(false);
    setChecklistDone({});
    formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <PageShell variant="standard" className="space-y-6">
      <div ref={formTopRef}>
        <PageHeader
          leading={<PageBackButton />}
          title="Alcohol"
          description="Answer a few questions for a personalised checklist and reminders. This does not tell you how much to drink or how to change insulin — only your care team should."
        />
      </div>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle className="text-h3 flex items-center gap-2 text-foreground">
            <Wine className="h-6 w-6 text-amber-600" />
            Evening and overnight planning
          </CardTitle>
          <CardDescription>
            Be honest about how you feel — red flags below can change the advice to urgent care.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/25 p-3 text-sm text-amber-950 dark:text-amber-100">
            Alcohol increases delayed hypo risk for many hours after you stop drinking. Never treat a low with more
            alcohol.
          </div>

          <ChoiceGroup
            name="timing"
            label="When are you thinking about this?"
            value={timing}
            onChange={setTiming}
            options={[
              { value: "tonight", title: "Tonight or very soon" },
              { value: "planning", title: "Planning ahead for another day" },
            ]}
          />

          <ChoiceGroup
            name="food"
            label="Food with alcohol"
            value={food}
            onChange={setFood}
            options={[
              { value: "with_meal", title: "With a proper meal" },
              { value: "snacks_only", title: "Snacks only" },
              { value: "unsure", title: "Not sure yet" },
            ]}
          />

          <ChoiceGroup
            name="activity"
            label="Activity today"
            value={activityToday}
            onChange={setActivityToday}
            options={[
              { value: "light", title: "Light / usual day" },
              { value: "moderate", title: "Moderately active" },
              { value: "heavy", title: "Heavy training or very demanding day" },
            ]}
          />

          <ChoiceGroup
            name="companions"
            label="Who are you with?"
            value={companions}
            onChange={setCompanions}
            options={[
              { value: "alone", title: "On my own this evening / overnight" },
              { value: "with_others", title: "With others (not specifically trained)" },
              { value: "someone_trained", title: "Someone who knows hypos and glucagon" },
            ]}
          />

          <ChoiceGroup
            name="cgm"
            label="CGM or flash glucose?"
            value={cgm}
            onChange={setCgm}
            options={[
              { value: "yes", title: "Yes" },
              { value: "no", title: "No" },
              { value: "unsure", title: "Not sure" },
            ]}
          />

          <ChoiceGroup
            name="insulin"
            label="Insulin delivery"
            value={insulin}
            onChange={setInsulin}
            options={[
              { value: "pump", title: "Pump" },
              { value: "mdi", title: "Injections (MDI)" },
              { value: "unsure", title: "Not sure" },
            ]}
          />

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-sm font-medium">Current glucose (optional but helpful)</Label>
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
                  Skip — I do not have a reading
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
                  />
                </div>
                <ChoiceGroup
                  name="trend"
                  label="Trend (if you know it)"
                  value={bgTrend}
                  onChange={setBgTrend}
                  options={[
                    { value: "rising", title: "Rising" },
                    { value: "flat", title: "Flat / stable" },
                    { value: "falling", title: "Falling" },
                    { value: "unknown", title: "Unknown / not using CGM" },
                  ]}
                />
              </div>
            ) : null}
          </div>

          <ChoiceGroup
            name="intensity"
            label="What kind of evening do you expect?"
            value={intensity}
            onChange={setIntensity}
            options={[
              { value: "light", title: "Light / one drink with food" },
              { value: "moderate", title: "Moderate social drinking" },
              {
                value: "long_or_heavy",
                title: "Longer night or heavier drinking",
                description: "Still not a recommendation to drink — only helps tailor overnight reminders.",
              },
            ]}
          />

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
              {(
                [
                  ["vomiting", "Repeated vomiting"],
                  ["severeAbdominalPain", "Severe abdominal pain"],
                  ["confusion", "Confusion or very drowsy"],
                  ["veryHighBgOrKetones", "Very high glucose or ketones concern"],
                  ["cantKeepFluids", "Cannot keep fluids down"],
                ] as const
              ).map(([key, text]) => (
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

          {bgRequiredError ? (
            <p className="text-sm text-destructive" role="alert">
              {bgRequiredError}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                if (!resolvedInput) {
                  setShowPlan(true);
                  return;
                }
                setChecklistDone({});
                setShowPlan(true);
              }}
            >
              Show my plan
            </Button>
            {showPlan ? (
              <Button type="button" variant="outline" className="gap-2" onClick={resetFlow}>
                <RotateCcw className="h-4 w-4" />
                Edit answers
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {plan ? (
        <Card
          className={cn(
            "surface-card border-2",
            plan.urgency === "urgent" && "border-destructive/60",
            plan.urgency === "caution" && "border-amber-500/50",
            plan.urgency === "plan" && "border-primary/30",
          )}
        >
          <CardHeader>
            <CardTitle className="text-h3">{plan.headline}</CardTitle>
            <CardDescription className="text-base text-foreground/90">{plan.lead}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {plan.bullets.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Guidance</p>
                <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground">
                  {plan.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {plan.checklist.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm font-medium">Checklist</p>
                <ul className="space-y-2">
                  {plan.checklist.map((item) => (
                    <li key={item.id} className="flex items-start gap-3">
                      <Checkbox
                        id={item.id}
                        checked={!!checklistDone[item.id]}
                        onCheckedChange={(c) =>
                          setChecklistDone((prev) => ({ ...prev, [item.id]: c === true }))
                        }
                      />
                      <Label htmlFor={item.id} className="text-sm font-normal cursor-pointer leading-snug">
                        {item.label}
                      </Label>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {plan.overnightBullets.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Overnight</p>
                <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground">
                  {plan.overnightBullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {(plan.links.hypoHelp || plan.links.sickDay || plan.links.helpNow) && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Quick links</p>
                <div className="flex flex-wrap gap-2">
                  {plan.links.hypoHelp ? (
                    <Button variant="secondary" size="sm" asChild>
                      <Link href={linkWithFrom("/tools/hypo-help")}>
                        <Droplet className="h-4 w-4 mr-1.5" />
                        Hypo help
                      </Link>
                    </Button>
                  ) : null}
                  {plan.links.sickDay ? (
                    <Button variant="secondary" size="sm" asChild>
                      <Link href={linkWithFrom("/sick-day")}>Sick day</Link>
                    </Button>
                  ) : null}
                  {plan.links.helpNow ? (
                    <Button variant="secondary" size="sm" asChild>
                      <Link href={linkWithFrom("/help-now")}>
                        <Phone className="h-4 w-4 mr-1.5" />
                        Help now
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </PageShell>
  );
}

