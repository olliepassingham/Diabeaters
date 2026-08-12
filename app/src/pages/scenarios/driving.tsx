import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Redirect } from "wouter";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { ScenarioCoachLink } from "@/components/ai-coach/ScenarioCoachLink";
import { Disclaimer } from "@/components/disclaimer";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
import { DrivingResultCard } from "@/components/scenarios/driving-result-card";
import { trackFeatureEngagement } from "@/components/discovery-prompts";
import { storage, type UserProfile, DIABEATER_PROFILE_CHANGED_EVENT } from "@/lib/storage";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { canShowDrivingReadiness } from "@/lib/user-age";
import { normalizeBgUnits } from "@/lib/alcohol-night-tool";
import { formatDrivingTargetRange, getRecentHypoForDriving } from "@/lib/driving-prefill";
import { useAutoCgmBgField } from "@/hooks/use-auto-cgm-bg-field";
import { CgmPrefillButton } from "@/components/cgm-prefill-button";
import { cgmTrendForDriving } from "@/lib/cgm/apply-cgm-trend";
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

const STEP_TITLES = ["Glucose", "Recent lows", "Alertness", "Carbs in reach"] as const;

type YesNo = "yes" | "no" | "";

function YesNoChoice({
  label,
  value,
  onChange,
  name,
}: {
  label: string;
  value: YesNo;
  onChange: (v: YesNo) => void;
  name: string;
}) {
  const options: { value: YesNo; title: string }[] = [
    { value: "no", title: "No" },
    { value: "yes", title: "Yes" },
  ];
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={label}>
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
                "min-h-12 rounded-xl border px-3 py-3 text-sm font-medium transition-colors",
                selected
                  ? "border-primary bg-primary/10 text-foreground shadow-sm"
                  : "border-border/70 bg-card/40 text-foreground hover:bg-muted/40",
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
  const isPumpUser = isPumpDeliveryMethod(profile?.insulinDeliveryMethod);
  const targetRangeLine = formatDrivingTargetRange(settings, bgUnits);
  const recentHypoLogged = getRecentHypoForDriving(4);
  const drivingCgm = useAutoCgmBgField({
    bgValue: bgInput,
    onApplyBg: setBgInput,
    onApplyTrend: (trend) => {
      const mapped = cgmTrendForDriving(trend);
      if (mapped) setBgTrend(mapped);
    },
    autoApplyKey: phase === "form" ? "driving" : undefined,
  });

  const progressPct = phase === "form" ? ((wizardStep + 1) / FORM_WIZARD_STEPS) * 100 : 100;

  const drivingContext = useMemo(
    () => ({
      settings,
      profile,
      isPump: isPumpUser,
    }),
    [settings, profile, isPumpUser],
  );

  const runCheck = () => {
    setFormError(null);
    if (recentHypo === "" || alertEnough === "" || treatmentInReach === "") {
      setFormError("Answer each question to continue.");
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

  const editAnswers = () => {
    setPhase("form");
    setOutcome(null);
    setWizardStep(0);
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
      <PageShell variant="narrow" density="compact" className={cn(phase === "form" && "pb-24")}>
        <div ref={formTopRef}>
          <PageHeader
            leading={<PageBackButton />}
            title="Driving"
            actions={
              <>
                <ScenarioCoachLink topic="driving" />
                <PageInfoDialog title="About this check" description="Driving and glucose safety">
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
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span>
                Step {wizardStep + 1} of {FORM_WIZARD_STEPS}
              </span>
            </div>
            <Progress value={progressPct} className="h-1" data-testid="driving-progress" />
          </div>
        ) : null}

        {phase === "form" && isPumpUser ? (
          <p
            className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs leading-snug text-muted-foreground"
            data-testid="alert-driving-pump"
          >
            <span className="font-medium text-foreground">Pump:</span> Check IOB and alarms before you drive.
          </p>
        ) : null}

        {phase === "form" ? (
          <section className="space-y-4 overflow-hidden rounded-[1.35rem] border border-sky-500/20 bg-gradient-to-b from-sky-500/[0.07] via-card to-card p-4 shadow-none dark:border-sky-400/15 dark:from-sky-950/35 sm:p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {STEP_TITLES[wizardStep]}
            </h2>

            {wizardStep === 0 ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Glucose now</span>
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
                    <Label htmlFor="driving-bg-skip" className="text-xs font-normal cursor-pointer text-muted-foreground">
                      Skip
                    </Label>
                  </div>
                </div>
                {!bgSkipped ? (
                  <div className="space-y-3 rounded-2xl border border-border/50 bg-background/70 p-3 shadow-sm dark:bg-background/40">
                    {targetRangeLine ? (
                      <p className="text-xs text-muted-foreground">{targetRangeLine}</p>
                    ) : null}
                    <Label htmlFor="driving-bg" className="sr-only">
                      Reading ({bgUnits})
                    </Label>
                    <div className="flex items-stretch gap-2">
                      <Input
                        id="driving-bg"
                        type="text"
                        inputMode="decimal"
                        placeholder={bgUnits === "mmol/L" ? "5.6" : "100"}
                        value={bgInput}
                        onChange={(e) => drivingCgm.onBgChange(e.target.value)}
                        autoComplete="off"
                        className="h-14 flex-1 rounded-xl border-border/60 bg-background text-2xl font-semibold tabular-nums tracking-tight shadow-none"
                        data-testid="input-driving-bg"
                      />
                      <span className="flex min-w-[4.5rem] items-center justify-center rounded-xl border border-border/60 bg-muted/40 px-3 text-sm font-semibold text-muted-foreground">
                        {bgUnits}
                      </span>
                    </div>
                    <CgmPrefillButton
                      prefill={drivingCgm.prefill}
                      loading={drivingCgm.loading}
                      bgUnits={bgUnits}
                      currentValue={bgInput}
                      onApply={drivingCgm.onBgChange}
                      onApplyTrend={(trend) => {
                        const mapped = cgmTrendForDriving(trend);
                        if (mapped) setBgTrend(mapped);
                      }}
                      onRefresh={drivingCgm.refresh}
                      emptyHint={drivingCgm.emptyHint}
                      allowSync
                      testId="button-driving-use-prefill"
                    />
                    <BgTrendThreeButtons
                      label="Trend"
                      labelClassName="text-xs font-medium text-muted-foreground"
                      value={bgTrend}
                      onChange={(v) => setBgTrend(v as DrivingTrend)}
                      unsetValue="unknown"
                      flatLabel="Stable"
                      buttonClassName="h-11 rounded-xl"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {wizardStep === 1 ? (
              <div className="space-y-3">
                {recentHypoLogged ? (
                  <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-snug text-amber-950 dark:text-amber-100">
                    You logged a hypo recently — many teams advise waiting before driving.
                  </p>
                ) : null}
                <YesNoChoice
                  name="driving-recent-hypo"
                  label="Hypo or hypo-like symptoms in the last few hours?"
                  value={recentHypo}
                  onChange={setRecentHypo}
                />
              </div>
            ) : null}

            {wizardStep === 2 ? (
              <YesNoChoice
                name="driving-alert"
                label="Feel alert enough to concentrate safely?"
                value={alertEnough}
                onChange={setAlertEnough}
              />
            ) : null}

            {wizardStep === 3 ? (
              <div className="space-y-4">
                <YesNoChoice
                  name="driving-treatment"
                  label="Fast-acting carbs within reach in the car?"
                  value={treatmentInReach}
                  onChange={setTreatmentInReach}
                />
                <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
                  <Checkbox
                    id="driving-long"
                    checked={longJourney}
                    onCheckedChange={(c) => setLongJourney(c === true)}
                    className="mt-0.5"
                  />
                  <Label htmlFor="driving-long" className="cursor-pointer text-sm font-normal leading-snug">
                    Longer journey <span className="text-muted-foreground">(optional tip)</span>
                  </Label>
                </div>
              </div>
            ) : null}

            {formError ? (
              <p className="text-sm text-destructive" role="alert">
                {formError}
              </p>
            ) : null}

            <div className="hidden items-center justify-between gap-2 border-t border-border/50 pt-4 sm:flex">
              <Button
                type="button"
                variant="outline"
                className="h-12 gap-1.5 rounded-xl px-4"
                onClick={goPrevWizard}
                disabled={wizardStep === 0}
                data-testid="button-driving-wizard-back"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                type="button"
                className="h-12 gap-1.5 rounded-xl px-5 text-sm font-semibold"
                onClick={goNextWizard}
                data-testid="button-driving-check"
              >
                {wizardStep === FORM_WIZARD_STEPS - 1 ? "Check readiness" : "Continue"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </section>
        ) : null}

        {phase === "result" && outcome ? (
          <div ref={resultsRef} className="scroll-mt-4 space-y-3">
            <DrivingResultCard outcome={outcome} onReset={reset} linkWithFrom={linkWithFrom} />
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={editAnswers}>
              <ArrowLeft className="h-4 w-4" />
              Edit answers
            </Button>
          </div>
        ) : null}

        <div className="space-y-2 pt-1" data-testid="driving-footer-disclosure">
          <Disclaimer className="text-center text-[11px] leading-relaxed opacity-80" />
          <p className="text-center text-[11px] text-muted-foreground">
            <Link
              href="/medical-sources#driving"
              className="font-medium text-foreground/80 underline decoration-border underline-offset-2 hover:text-primary"
              data-testid="medical-sources-link"
            >
              Sources
            </Link>
            {" · "}
            Not a substitute for your clinic or licensing rules.
          </p>
        </div>
      </PageShell>

      {phase === "form" ? (
        <div
          className="fixed bottom-[var(--bottom-nav-height,0px)] left-0 right-0 z-40 border-t border-border/80 bg-background/95 px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/85"
          data-testid="driving-sticky-wizard"
        >
          <div className="mx-auto flex w-full min-w-0 max-w-lg items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-12 shrink-0 gap-1.5 rounded-xl px-4"
              onClick={goPrevWizard}
              disabled={wizardStep === 0}
              data-testid="button-driving-wizard-back-sticky"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              className="h-12 min-w-0 flex-1 gap-1.5 rounded-xl text-sm font-semibold"
              onClick={goNextWizard}
              data-testid="button-driving-check-sticky"
            >
              {wizardStep === FORM_WIZARD_STEPS - 1 ? "Check readiness" : "Continue"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
