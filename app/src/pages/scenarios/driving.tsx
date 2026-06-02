import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Redirect } from "wouter";
import { Car, ArrowLeft, ArrowRight, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { ScenarioCoachLink } from "@/components/ai-coach/ScenarioCoachLink";
import { DISCLAIMER_TEXT } from "@/components/disclaimer";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
import { DrivingResultCard } from "@/components/scenarios/driving-result-card";
import { trackFeatureEngagement } from "@/components/discovery-prompts";
import { storage, type UserProfile, DIABEATER_PROFILE_CHANGED_EVENT } from "@/lib/storage";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { canShowDrivingReadiness } from "@/lib/user-age";
import { normalizeBgUnits } from "@/lib/alcohol-night-tool";
import {
  getDrivingBgPrefill,
  formatDrivingTargetRange,
  getRecentHypoForDriving,
} from "@/lib/driving-prefill";
import { getPrimaryHypoTreatmentFromProfile } from "@/lib/hypo-treatment-display";
import {
  buildDrivingReadinessOutcome,
  type DrivingReadinessOutcome,
  type DrivingTrend,
} from "@/lib/driving-readiness-tool";
import { cn } from "@/lib/utils";
import { BgTrendThreeButtons } from "@/components/bg-trend-three-buttons";

const FROM_SCENARIOS = "from=/scenarios";

function linkWithFrom(path: string): string {
  return path.includes("?") ? `${path}&${FROM_SCENARIOS}` : `${path}?${FROM_SCENARIOS}`;
}

type Phase = "form" | "result";

const FORM_WIZARD_STEPS = 4;

type YesNo = "yes" | "no" | "";

type ChoiceProps<T extends string> = {
  label: string;
  value: T | "";
  onChange: (v: T) => void;
  options: { value: T; title: string; description?: string }[];
  name: string;
};

function ChoiceGroup<T extends string>({ label, value, onChange, options, name }: ChoiceProps<T>) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">{label}</Label>
      <RadioGroup
        value={value === "" ? undefined : value}
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
                (value === "" ? undefined : value) === opt.value && "border-primary bg-primary/5",
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

export default function DrivingScenarioPage() {
  const [profile, setProfile] = useState<Partial<UserProfile>>(() => storage.getProfile() ?? {});
  const [phase, setPhase] = useState<Phase>("form");
  const [outcome, setOutcome] = useState<DrivingReadinessOutcome | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [bgSkipped, setBgSkipped] = useState(false);
  const [bgInput, setBgInput] = useState("");
  const [bgTrend, setBgTrend] = useState<DrivingTrend>("unknown");
  const [recentHypo, setRecentHypo] = useState<YesNo>("");
  const [alertEnough, setAlertEnough] = useState<YesNo>("");
  const [treatmentInReach, setTreatmentInReach] = useState<YesNo>("");
  const [longJourney, setLongJourney] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);

  const formTopRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    trackFeatureEngagement("scenarios-driving");
    const p = storage.getProfile();
    if (p) setProfile(p);
  }, []);

  useEffect(() => {
    const onProfile = () => {
      const p = storage.getProfile();
      if (p) setProfile(p);
    };
    window.addEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
    return () => window.removeEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
  }, []);

  const bgUnits = normalizeBgUnits(profile.bgUnits);
  const settings = storage.getSettings();
  const primaryHypoTreatment = getPrimaryHypoTreatmentFromProfile(profile);
  const isPumpUser = isPumpDeliveryMethod(profile?.insulinDeliveryMethod);
  const targetRangeLine = formatDrivingTargetRange(settings, bgUnits);
  const recentHypoLogged = getRecentHypoForDriving(4);
  const bgPrefill = useMemo(() => getDrivingBgPrefill(), []);

  const progressPct =
    phase === "form" ? ((wizardStep + 1) / FORM_WIZARD_STEPS) * 100 : 100;

  const drivingContext = useMemo(
    () => ({
      settings,
      primaryHypoTreatment,
      isPump: isPumpUser,
    }),
    [settings, primaryHypoTreatment, isPumpUser],
  );

  const runCheck = () => {
    setFormError(null);
    if (recentHypo === "" || alertEnough === "" || treatmentInReach === "") {
      setFormError("Answer each question to get a recommendation.");
      return;
    }
    if (!bgSkipped) {
      const t = bgInput.trim().replace(",", ".");
      if (!t) {
        setFormError("Enter a blood glucose number or choose to skip.");
        return;
      }
      const n = Number(t);
      if (Number.isNaN(n) || n <= 0) {
        setFormError("Enter a valid blood glucose number.");
        return;
      }
    }

    const bgValue = bgSkipped
      ? null
      : (() => {
          const t = bgInput.trim().replace(",", ".");
          const n = Number(t);
          return Number.isNaN(n) ? null : n;
        })();

    const o = buildDrivingReadinessOutcome(
      {
        bgSkipped,
        bgValue,
        bgTrend: bgSkipped ? null : bgTrend,
        recentHypoOrSymptoms: recentHypo === "yes",
        alertEnough: alertEnough === "yes",
        treatmentInReach: treatmentInReach === "yes",
        longJourney,
      },
      profile.bgUnits,
      drivingContext,
    );
    setOutcome(o);
    setPhase("result");
  };

  const goNextWizard = () => {
    setFormError(null);
    if (wizardStep === 0) {
      if (!bgSkipped) {
        const t = bgInput.trim().replace(",", ".");
        if (!t) {
          setFormError("Enter a blood glucose number or choose to skip.");
          return;
        }
        const n = Number(t);
        if (Number.isNaN(n) || n <= 0) {
          setFormError("Enter a valid blood glucose number.");
          return;
        }
      }
      setWizardStep(1);
      return;
    }
    if (wizardStep === 1) {
      if (recentHypo === "") {
        setFormError("Choose an answer to continue.");
        return;
      }
      setWizardStep(2);
      return;
    }
    if (wizardStep === 2) {
      if (alertEnough === "") {
        setFormError("Choose an answer to continue.");
        return;
      }
      setWizardStep(3);
      return;
    }
    runCheck();
  };

  const goPrevWizard = () => {
    setFormError(null);
    if (wizardStep > 0) setWizardStep((s) => s - 1);
  };

  const reset = () => {
    setPhase("form");
    setWizardStep(0);
    setOutcome(null);
    setFormError(null);
    setBgSkipped(false);
    setBgInput("");
    setBgTrend("unknown");
    setRecentHypo("");
    setAlertEnough("");
    setTreatmentInReach("");
    setLongJourney(false);
    formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (phase === "result" && outcome) {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [phase, outcome]);

  if (!canShowDrivingReadiness(profile.dateOfBirth)) {
    return <Redirect to="/scenarios" replace />;
  }

  return (
    <div className="min-h-[50vh]">
      <PageShell variant="standard" className={cn("space-y-4", phase === "form" && "pb-24 sm:pb-4")}>
        <div ref={formTopRef}>
          <PageHeader
            leading={<PageBackButton />}
            title="Driving"
            actions={
              <>
                <ScenarioCoachLink topic="driving" />
                <PageInfoDialog title="About this check" description="How to use this tool safely">
                  <InfoSection title="Legal and medical limits">
                    <p>
                      This app does not state legal blood-glucose limits for driving. Follow local licensing rules, road
                      authority guidance, and your diabetes clinic.
                    </p>
                  </InfoSection>
                  <InfoSection title="What you get">
                    <p>
                      A short checklist-based suggestion from your answers. It does not replace professional advice or
                      confirm you are safe to drive.
                    </p>
                  </InfoSection>
                </PageInfoDialog>
              </>
            }
          />
        </div>

        {phase === "form" ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="font-medium uppercase tracking-wide">
                Step {wizardStep + 1} of {FORM_WIZARD_STEPS}
              </span>
            </div>
            <Progress value={progressPct} className="h-1.5" data-testid="driving-progress" />
          </div>
        ) : null}

        {phase === "form" ? (
          <Card className="surface-card">
            <CardHeader>
              <CardTitle className="text-h3 flex items-center gap-2 text-foreground">
                <Car className="h-6 w-6 text-primary shrink-0" />
                {wizardStep === 0
                  ? "Glucose"
                  : wizardStep === 1
                    ? "Recent lows"
                    : wizardStep === 2
                      ? "Alertness"
                      : "Carbs within reach"}
              </CardTitle>
              <CardDescription>
                {wizardStep === 0
                  ? "Enter a reading or skip — takes under a minute in total."
                  : wizardStep === 1
                    ? "One question at a time."
                    : wizardStep === 2
                      ? "Be honest — this is for your safety."
                      : "Almost done — optional longer trip tip below."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {wizardStep === 0 ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label className="text-sm font-medium">Current blood glucose</Label>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="driving-bg-skip"
                        checked={bgSkipped}
                        onCheckedChange={(c) => {
                          const on = c === true;
                          setBgSkipped(on);
                          if (on) setBgTrend("unknown");
                        }}
                      />
                      <Label htmlFor="driving-bg-skip" className="text-sm font-normal cursor-pointer">
                        Skip
                      </Label>
                    </div>
                  </div>
                  {!bgSkipped ? (
                    <div className="space-y-4">
                      {targetRangeLine ? (
                        <p className="text-xs text-muted-foreground">{targetRangeLine}</p>
                      ) : null}
                      <div className="space-y-2 max-w-xs">
                        <Label htmlFor="driving-bg">Reading ({bgUnits})</Label>
                        <Input
                          id="driving-bg"
                          type="text"
                          inputMode="decimal"
                          placeholder={bgUnits === "mmol/L" ? "e.g. 5.6" : "e.g. 100"}
                          value={bgInput}
                          onChange={(e) => setBgInput(e.target.value)}
                          autoComplete="off"
                          data-testid="input-driving-bg"
                        />
                      </div>
                      {bgPrefill && !bgInput.trim() ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9"
                          onClick={() => setBgInput(bgPrefill.value)}
                          data-testid="button-driving-use-prefill"
                        >
                          Use recent reading ({bgPrefill.value} {bgUnits})
                        </Button>
                      ) : null}
                      <BgTrendThreeButtons
                        label="Trend (if you know it)"
                        value={bgTrend}
                        onChange={(v) => setBgTrend(v as DrivingTrend)}
                        unsetValue="unknown"
                        flatLabel="Flat / stable"
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {wizardStep === 1 ? (
                <div className="space-y-3">
                  {recentHypoLogged ? (
                    <p className="text-xs text-amber-800 dark:text-amber-200 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2">
                      You logged a hypo recently — answer honestly; many teams advise waiting before driving.
                    </p>
                  ) : null}
                  <ChoiceGroup
                    name="driving-recent-hypo"
                    label="Any hypo or hypo-like symptoms in the last few hours?"
                    value={recentHypo}
                    onChange={setRecentHypo}
                    options={[
                      { value: "no", title: "No" },
                      { value: "yes", title: "Yes" },
                    ]}
                  />
                </div>
              ) : null}

              {wizardStep === 2 ? (
                <ChoiceGroup
                  name="driving-alert"
                  label="Do you feel alert enough to concentrate safely?"
                  value={alertEnough}
                  onChange={setAlertEnough}
                  options={[
                    { value: "yes", title: "Yes" },
                    { value: "no", title: "No" },
                  ]}
                />
              ) : null}

              {wizardStep === 3 ? (
                <div className="space-y-6">
                  <ChoiceGroup
                    name="driving-treatment"
                    label="Is fast-acting carbohydrate within reach (e.g. in the car with you)?"
                    value={treatmentInReach}
                    onChange={setTreatmentInReach}
                    options={[
                      { value: "yes", title: "Yes" },
                      { value: "no", title: "No" },
                    ]}
                  />
                  <div className="flex items-start gap-3 rounded-lg border border-border/80 p-4">
                    <Checkbox
                      id="driving-long"
                      checked={longJourney}
                      onCheckedChange={(c) => setLongJourney(c === true)}
                    />
                    <div className="space-y-1">
                      <Label htmlFor="driving-long" className="text-sm font-medium cursor-pointer leading-snug">
                        Longer journey (adds one planning tip)
                      </Label>
                      <p className="text-xs text-foreground/75">Optional — does not change the main recommendation.</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {formError ? (
                <p className="text-sm text-destructive" role="alert">
                  {formError}
                </p>
              ) : null}

              <div className="hidden flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-4 sm:flex">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 gap-1.5 shrink-0"
                  onClick={goPrevWizard}
                  disabled={wizardStep === 0}
                  data-testid="button-driving-wizard-back"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  type="button"
                  className="min-h-11 gap-1.5 min-w-[10rem] w-full sm:w-auto sm:flex-initial"
                  onClick={goNextWizard}
                  data-testid="button-driving-check"
                >
                  {wizardStep === FORM_WIZARD_STEPS - 1 ? "Check readiness" : "Continue"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {phase === "result" && outcome ? (
          <div ref={resultsRef} className="scroll-mt-4">
            <DrivingResultCard outcome={outcome} onReset={reset} linkWithFrom={linkWithFrom} />
          </div>
        ) : null}

        <div className="space-y-4 border-t border-border/50 pt-6">
          {phase === "form" && isPumpUser && (
            <Alert data-testid="alert-driving-pump">
              <AlertTitle className="text-sm">Pump</AlertTitle>
              <AlertDescription className="text-sm">
                Before driving, check <strong>IOB</strong>, any active temp basal, and that your pump/CGM alarms are set how
                your team recommends — automation may change delivery without a manual bolus.
              </AlertDescription>
            </Alert>
          )}
          <Alert
            data-testid="driving-footer-disclosure"
            className={cn(
              "rounded-2xl border-border/60 bg-gradient-to-br from-muted/40 via-muted/15 to-background py-4 shadow-sm sm:py-5",
              "[&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-muted-foreground [&>svg~*]:pl-11 sm:[&>svg]:left-5 sm:[&>svg]:top-5 sm:[&>svg~*]:pl-12",
            )}
          >
            <Shield className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
            <AlertDescription className="space-y-3 text-sm leading-relaxed sm:space-y-3.5">
              <p className="text-pretty text-muted-foreground">{DISCLAIMER_TEXT}</p>
              <div
                className="flex flex-col gap-1.5 border-t border-border/50 pt-3 text-xs leading-relaxed text-muted-foreground sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2 sm:text-sm"
                data-testid="medical-sources-link"
              >
                <Link
                  href="/medical-sources#driving"
                  className="inline-flex w-fit shrink-0 font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary hover:decoration-primary/50"
                >
                  Sources
                </Link>
                <span className="text-muted-foreground sm:min-w-0 sm:flex-1">
                  — references behind this check. Not a substitute for your clinic or local licensing rules.
                </span>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </PageShell>

      {phase === "form" ? (
        <div
          className="fixed bottom-[var(--bottom-nav-height,0px)] left-0 right-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden"
          data-testid="driving-sticky-wizard"
        >
          <div className="mx-auto flex w-full min-w-0 max-w-3xl items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 gap-1.5 shrink-0"
              onClick={goPrevWizard}
              disabled={wizardStep === 0}
              data-testid="button-driving-wizard-back-sticky"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              className="min-h-11 gap-1.5 min-w-[8.5rem] flex-1 sm:flex-initial"
              onClick={goNextWizard}
              data-testid="button-driving-check-sticky"
            >
              {wizardStep === FORM_WIZARD_STEPS - 1 ? "Check readiness" : "Continue"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {phase !== "form" ? (
        <PageShell variant="standard" className="flex justify-start">
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              setWizardStep(0);
              setPhase("form");
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Edit answers
          </Button>
        </PageShell>
      ) : null}
    </div>
  );
}
