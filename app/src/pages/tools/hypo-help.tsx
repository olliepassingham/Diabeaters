import { useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import {
  Activity,
  Calculator,
  ChevronDown,
  Clock,
  Droplet,
  History,
  Syringe,
  Timer,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { storage, type UserProfile, DIABEATER_PROFILE_CHANGED_EVENT } from "@/lib/storage";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import {
  formatWeightInputFromKg,
  formatWeightLabel,
  getBodyWeightKgFromProfile,
  getWeightDisplayUnitFromProfile,
  resolveHypoCalculatorWeightKg,
  type WeightDisplayUnit,
} from "@/lib/body-weight";
import { hypoCalculatorRequiresExplicitWeight } from "@/lib/user-age";
import {
  formatTargetBgInput,
  hypoTreatmentsInRollingHours,
  lastHypoWithDetail,
  suggestedRecoveryTargetBg,
} from "@/lib/hypo-context";
import { classifyHypoSeverity } from "@/lib/hypo-severity";
import { CgmPrefillButton } from "@/components/cgm-prefill-button";
import { useAutoCgmBgField } from "@/hooks/use-auto-cgm-bg-field";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { ScenarioResultHero } from "@/components/scenarios/scenario-result-hero";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
import { MedicalNumericOutputDisclaimer } from "@/components/medical-numeric-output-disclaimer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MedicalSourcesLink } from "@/components/medical-sources-link";
import { StepLadder, type StepLadderStep } from "@/components/visualizations/step-ladder";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  getPostExerciseEducationalCopy,
  inferPostExerciseLoadTier,
} from "@/lib/post-exercise-nudge";
import {
  computeHypoCarbEquivalents,
  formatCarbsForScenario,
  resolveCarbSource,
} from "@/lib/hypo-treatment-display";

const HYPO_RECHECK_FLOW_STEPS: StepLadderStep[] = [
  {
    id: "treat",
    title: "Treat with fast carbs",
    description: "Glucose tablets, juice, gel, or whatever your hypo plan lists — enough to bring you up safely.",
  },
  {
    id: "wait",
    title: "Wait about 15 minutes",
    description: "Give glucose time to work before you decide what to do next (a timer can help).",
  },
  {
    id: "recheck",
    title: "Recheck your blood glucose",
    description: "Use your meter or CGM trend — don’t guess from symptoms alone.",
  },
  {
    id: "repeat",
    title: "Still low? Repeat or escalate",
    description:
      "Treat again per your team’s rules. Use glucagon and get emergency help if you can’t swallow or someone can’t keep you safe.",
  },
];

const RECHECK_MS = 15 * 60_000;

function formatRecheckCountdown(remainingSec: number): string {
  const m = Math.floor(remainingSec / 60);
  const s = remainingSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function HypoHelpInfoDialog({ bgUnits }: { bgUnits: string }) {
  const isMgdl = bgUnits === "mg/dL";
  const unit = isMgdl ? "mg/dL" : "mmol/L";
  const mildBand = isMgdl ? "63–70" : "3.5–3.9";
  const moderateBand = isMgdl ? "50–61" : "2.8–3.4";
  const severeBand = isMgdl ? "<50" : "<2.8";
  return (
    <PageInfoDialog
      title="About Hypo help"
      description="Estimate fast-acting carbs from your reading and target. Educational only — your written hypo plan from your team always comes first."
    >
      <InfoSection title="How the estimate works">
        <p>
          We use your current BG, recovery target, and weight to suggest fast carbs. It supports more precise treatment
          than a fixed 15g rule, but if in doubt use your usual hypo plan.
        </p>
      </InfoSection>
      <InfoSection title="Typical first steps (many teams)">
        <ul className="list-disc space-y-1 pl-4">
          <li>
            <strong>
              Mild ({mildBand} {unit}):
            </strong>{" "}
            10–15g fast carbs
          </li>
          <li>
            <strong>
              Moderate ({moderateBand} {unit}):
            </strong>{" "}
            15–20g fast carbs
          </li>
          <li>
            <strong>
              Severe ({severeBand} {unit}):
            </strong>{" "}
            20–25g fast carbs; may need help
          </li>
        </ul>
        <p className="pt-1">Follow up with a slower snack if your next meal is more than 1–2 hours away.</p>
      </InfoSection>
      <InfoSection title="After treating — treat → wait → recheck">
        <StepLadder steps={HYPO_RECHECK_FLOW_STEPS} ariaLabel="Hypo treatment check-in steps" />
      </InfoSection>
      <InfoSection title="Safety">
        <p>
          Not medical advice. For severe hypos or if you can&apos;t swallow, use glucagon and get emergency help. Severe
          hypos need help straight away — follow emergency instructions you were given with your glucagon.
        </p>
        <MedicalSourcesLink anchor="hypoglycaemia" className="mt-2 inline-block" />
      </InfoSection>
    </PageInfoDialog>
  );
}

type ContextChip = {
  id: string;
  icon: typeof Activity;
  label: string;
  detail?: string;
  tone?: "default" | "emerald" | "amber";
  action?: ReactNode;
};

function HypoContextChips({ chips }: { chips: ContextChip[] }) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2" data-testid="hypo-context-chips">
      {chips.map((chip) => (
        <div
          key={chip.id}
          className={cn(
            "inline-flex max-w-full items-start gap-2 rounded-xl border px-2.5 py-2 text-xs leading-snug",
            chip.tone === "emerald" && "border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/30",
            chip.tone === "amber" && "border-amber-500/35 bg-amber-500/10 dark:bg-amber-950/30",
            (!chip.tone || chip.tone === "default") && "border-border/60 bg-muted/25",
          )}
          data-testid={`hypo-context-chip-${chip.id}`}
        >
          <chip.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <p className="font-medium text-foreground">{chip.label}</p>
            {chip.detail ? <p className="mt-0.5 text-muted-foreground">{chip.detail}</p> : null}
          </div>
          {chip.action}
        </div>
      ))}
    </div>
  );
}

export default function HypoHelpPage() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<Partial<UserProfile>>(() => storage.getProfile() ?? {});
  const [lastHypoDetail, setLastHypoDetail] = useState<{ at: string; label: string } | null>(null);
  const [targetPrefilledFromRange, setTargetPrefilledFromRange] = useState(false);
  const [currentBg, setCurrentBg] = useState("");
  const [targetBg, setTargetBg] = useState("");
  const [userWeight, setUserWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState<WeightDisplayUnit>("kg");
  const [useProfileWeight, setUseProfileWeight] = useState(true);
  const [hypoResult, setHypoResult] = useState<ReturnType<typeof computeHypoCarbEquivalents> | null>(null);
  const hypoCgm = useAutoCgmBgField({
    bgValue: currentBg,
    onApplyBg: (v) => {
      setCurrentBg(v);
      setHypoResult(null);
    },
    autoApplyKey: "hypo-help",
  });
  const [hypoCalcError, setHypoCalcError] = useState<string | null>(null);
  const [postExerciseNudgeRev, setPostExerciseNudgeRev] = useState(0);
  const [recheckEndsAt, setRecheckEndsAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const bgUnits = profile.bgUnits === "mg/dL" ? "mg/dL" : "mmol/L";
  const hypoCarbSource = resolveCarbSource(profile, "hypo");
  const hypoTreatmentLine = (grams: number) => formatCarbsForScenario(grams, profile, "hypo");
  const postExerciseHypoCopy = useMemo(() => {
    void postExerciseNudgeRev;
    if (!storage.shouldShowPostExerciseEducationalNudges()) return null;
    return getPostExerciseEducationalCopy(inferPostExerciseLoadTier(storage.getLastExerciseSummary()));
  }, [postExerciseNudgeRev]);
  const weightRequired = hypoCalculatorRequiresExplicitWeight(profile.dateOfBirth);
  const profileWeightKg = getBodyWeightKgFromProfile(profile);
  const showingProfileWeight = useProfileWeight && profileWeightKg != null;
  const parsedCurrentBg = parseFloat(currentBg);
  const severityView =
    Number.isFinite(parsedCurrentBg) && parsedCurrentBg > 0
      ? classifyHypoSeverity(parsedCurrentBg, bgUnits)
      : null;
  const hyposLast24h = useMemo(
    () => hypoTreatmentsInRollingHours(storage.getHypoTreatments(), 24).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when hypo logged elsewhere in session
    [hypoResult],
  );

  const applyWeightFromProfile = useCallback((p: Partial<UserProfile>) => {
    const kg = getBodyWeightKgFromProfile(p);
    if (kg == null) return;
    const unit = getWeightDisplayUnitFromProfile(p);
    setWeightUnit(unit);
    setUserWeight(formatWeightInputFromKg(kg, unit));
    setUseProfileWeight(true);
  }, []);

  useEffect(() => {
    const p = storage.getProfile();
    if (p) {
      setProfile(p);
      if (getBodyWeightKgFromProfile(p)) applyWeightFromProfile(p);
    }
    const s = storage.getSettings();
    const units = p?.bgUnits === "mg/dL" ? "mg/dL" : "mmol/L";
    const sug = suggestedRecoveryTargetBg(s, units);
    if (sug != null) {
      setTargetBg(formatTargetBgInput(sug, units));
      setTargetPrefilledFromRange(true);
    }
    setLastHypoDetail(lastHypoWithDetail(storage.getHypoTreatments()));
  }, [applyWeightFromProfile]);

  useEffect(() => {
    const onProfile = () => {
      const p = storage.getProfile();
      if (!p) return;
      setProfile(p);
      if (useProfileWeight && getBodyWeightKgFromProfile(p)) applyWeightFromProfile(p);
    };
    window.addEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
    return () => window.removeEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
  }, [applyWeightFromProfile, useProfileWeight]);

  useEffect(() => {
    if (recheckEndsAt == null) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [recheckEndsAt]);

  const recheckRemainingSec =
    recheckEndsAt != null ? Math.max(0, Math.floor((recheckEndsAt - nowMs) / 1000)) : null;

  const hasResolvableWeight = useMemo(() => {
    const resolved = resolveHypoCalculatorWeightKg({
      profile,
      useProfileWeight: showingProfileWeight,
      inputValue: userWeight,
      inputUnit: weightUnit,
    });
    return resolved.ok;
  }, [profile, showingProfileWeight, userWeight, weightUnit]);

  const contextChips = useMemo((): ContextChip[] => {
    const chips: ContextChip[] = [];
    if (postExerciseHypoCopy) {
      chips.push({
        id: "exercise",
        icon: Activity,
        label: "Recent exercise",
        detail: postExerciseHypoCopy.hypoDetail,
        tone: "emerald",
        action: (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 -my-1.5"
            aria-label="Snooze exercise reminders for 8 hours"
            onClick={() => {
              storage.snoozePostExerciseNudges(8);
              setPostExerciseNudgeRev((n) => n + 1);
              toast({ title: "Reminders snoozed", description: "Post-exercise tips hidden for 8 hours." });
            }}
            data-testid="alert-hypo-recent-exercise"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ),
      });
    }
    if (isPumpDeliveryMethod(profile?.insulinDeliveryMethod)) {
      chips.push({
        id: "pump",
        icon: Syringe,
        label: "On a pump",
        detail: "Recent bolus or loop activity may still be lowering BG — treat with fast carbs first.",
      });
    }
    if (hyposLast24h >= 2) {
      chips.push({
        id: "repeat",
        icon: History,
        label: `${hyposLast24h} hypos in 24h`,
        detail: "Follow your team's plan for repeat lows.",
        tone: "amber",
      });
    }
    if (lastHypoDetail) {
      chips.push({
        id: "last",
        icon: Clock,
        label: `Last hypo ${formatDistanceToNow(new Date(lastHypoDetail.at), { addSuffix: true })}`,
        detail: lastHypoDetail.label,
      });
    }
    return chips;
  }, [postExerciseHypoCopy, profile?.insulinDeliveryMethod, hyposLast24h, lastHypoDetail, toast]);

  const calculateHypoTreatment = () => {
    setHypoCalcError(null);
    if (!currentBg || !targetBg) return;
    const current = parseFloat(currentBg);
    const target = parseFloat(targetBg);
    const resolved = resolveHypoCalculatorWeightKg({
      profile,
      useProfileWeight: showingProfileWeight,
      inputValue: userWeight,
      inputUnit: weightUnit,
    });
    if (!resolved.ok) {
      setHypoCalcError(resolved.error);
      setHypoResult(null);
      return;
    }
    const weight = resolved.weightKg;
    if (Number.isNaN(current) || Number.isNaN(target)) return;
    const currentMmol = bgUnits === "mg/dL" ? current / 18 : current;
    const targetMmol = bgUnits === "mg/dL" ? target / 18 : target;
    const bgDifference = targetMmol - currentMmol;
    if (bgDifference <= 0) {
      setHypoResult(null);
      return;
    }
    const sensitivityFactor = 70 / weight;
    const baseRise = 0.25;
    const effectiveRise = baseRise * sensitivityFactor;
    const carbsNeeded = Math.ceil(bgDifference / effectiveRise);
    setHypoResult(computeHypoCarbEquivalents(carbsNeeded));
    setRecheckEndsAt(null);
  };

  const startRecheckTimer = () => setRecheckEndsAt(Date.now() + RECHECK_MS);

  return (
    <PageShell variant="narrow" density="compact" className="space-y-4 pb-6">
      <PageHeader
        leading={<PageBackButton />}
        title="Hypo help"
        actions={<HypoHelpInfoDialog bgUnits={bgUnits} />}
      />

      <Card className="surface-card overflow-hidden rounded-2xl border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-h3 flex items-center gap-2 text-foreground">
            <Droplet className="h-5 w-5 shrink-0 text-red-500 dark:text-red-400" aria-hidden />
            Treatment estimate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-bg" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Current BG ({bgUnits})
            </Label>
            <Input
              id="current-bg"
              type="number"
              inputMode="decimal"
              step={bgUnits === "mg/dL" ? "1" : "0.1"}
              placeholder={bgUnits === "mmol/L" ? "3.2" : "58"}
              value={currentBg}
              onChange={(e) => {
                hypoCgm.onBgChange(e.target.value);
                setHypoResult(null);
              }}
              className="h-16 border-border/60 bg-muted/15 text-center text-3xl font-semibold tabular-nums tracking-tight"
              data-testid="input-current-bg"
            />
            <CgmPrefillButton
              prefill={hypoCgm.prefill}
              loading={hypoCgm.loading}
              bgUnits={bgUnits}
              currentValue={currentBg}
              onApply={hypoCgm.onBgChange}
              onRefresh={hypoCgm.refresh}
              emptyHint={hypoCgm.emptyHint}
              allowSync
              testId="button-hypo-cgm-prefill"
            />
            {severityView ? (
              <div
                className={cn(
                  "flex flex-wrap items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm",
                  severityView.tone === "critical"
                    ? "border border-red-500/35 bg-red-500/10 dark:bg-red-950/35"
                    : "border border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/30",
                )}
                data-testid="hypo-severity-band"
              >
                <Badge
                  variant={severityView.tone === "critical" ? "destructive" : "secondary"}
                  className="h-5 rounded-full px-2 text-[10px] font-semibold uppercase tracking-wide"
                >
                  {severityView.label}
                </Badge>
                <span className="text-muted-foreground">{severityView.typicalCarbs}</span>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="target-bg" className="text-xs text-muted-foreground">
                Target ({bgUnits})
              </Label>
              <Input
                id="target-bg"
                type="number"
                inputMode="decimal"
                step={bgUnits === "mg/dL" ? "1" : "0.1"}
                placeholder={bgUnits === "mmol/L" ? "5.5" : "100"}
                value={targetBg}
                onChange={(e) => {
                  setTargetBg(e.target.value);
                  setTargetPrefilledFromRange(false);
                  setHypoResult(null);
                }}
                className="h-11 tabular-nums"
                data-testid="input-target-bg"
              />
              {targetPrefilledFromRange ? (
                <p className="text-[11px] text-muted-foreground">From your Ratios target range</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="user-weight" className="text-xs text-muted-foreground">
                Weight {weightRequired ? "(required)" : "(optional)"}
              </Label>
              {weightRequired ? (
                <p className="text-[11px] leading-snug text-muted-foreground" data-testid="text-hypo-weight-required-hint">
                  Enter your weight here — we won&apos;t guess an adult default.
                </p>
              ) : null}
              {showingProfileWeight ? (
                <div
                  className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-border/50 bg-muted/20 px-3"
                  data-testid="hypo-weight-from-profile"
                >
                  <p className="text-sm tabular-nums text-foreground">
                    {formatWeightLabel(profileWeightKg, getWeightDisplayUnitFromProfile(profile))}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 px-2 text-xs"
                    onClick={() => {
                      setUseProfileWeight(false);
                      setUserWeight("");
                    }}
                    data-testid="button-hypo-weight-change"
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    id="user-weight"
                    type="number"
                    inputMode="decimal"
                    placeholder={weightUnit === "kg" ? "70" : "154"}
                    value={userWeight}
                    onChange={(e) => {
                      setUseProfileWeight(false);
                      setUserWeight(e.target.value);
                    }}
                    className="h-11 flex-1 tabular-nums"
                    data-testid="input-user-weight"
                  />
                  <div className="flex shrink-0">
                    <Button
                      type="button"
                      variant={weightUnit === "kg" ? "default" : "outline"}
                      size="sm"
                      className="h-11 rounded-r-none px-3"
                      onClick={() => setWeightUnit("kg")}
                      data-testid="button-weight-kg"
                    >
                      kg
                    </Button>
                    <Button
                      type="button"
                      variant={weightUnit === "lbs" ? "default" : "outline"}
                      size="sm"
                      className="h-11 rounded-l-none px-3"
                      onClick={() => setWeightUnit("lbs")}
                      data-testid="button-weight-lbs"
                    >
                      lbs
                    </Button>
                  </div>
                </div>
              )}
              {!showingProfileWeight && profileWeightKg != null ? (
                <Button
                  type="button"
                  variant="link"
                  className="h-auto px-0 text-[11px] text-muted-foreground"
                  onClick={() => applyWeightFromProfile(profile)}
                  data-testid="button-hypo-use-profile-weight"
                >
                  Use profile ({formatWeightLabel(profileWeightKg, getWeightDisplayUnitFromProfile(profile))})
                </Button>
              ) : null}
            </div>
          </div>

          <HypoContextChips chips={contextChips} />

          {hypoCalcError && (
            <Alert variant="destructive" data-testid="alert-hypo-calc-error">
              <AlertDescription className="text-sm">{hypoCalcError}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={calculateHypoTreatment}
            disabled={!currentBg || !targetBg || (weightRequired && !hasResolvableWeight)}
            className="h-11 w-full rounded-xl text-sm font-semibold"
            data-testid="button-calculate-hypo"
          >
            <Calculator className="mr-2 h-4 w-4" aria-hidden />
            Calculate
          </Button>

          {parseFloat(currentBg) > 0 &&
            parseFloat(targetBg) > 0 &&
            parseFloat(currentBg) >= parseFloat(targetBg) && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                Already at or above target — no treatment needed.
              </div>
            )}

          {hypoResult && (
            <div className="space-y-3">
              <ScenarioResultHero label="Fast carbs" tone="hypo" value={`${hypoResult.carbsGrams}g`}>
                {hypoTreatmentLine(hypoResult.carbsGrams) ? (
                  <p className="mt-2 text-sm font-medium text-foreground/90">
                    {hypoTreatmentLine(hypoResult.carbsGrams)}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">fast-acting carbs</p>
                )}
              </ScenarioResultHero>

              <MedicalNumericOutputDisclaimer compact />

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl"
                  onClick={startRecheckTimer}
                  data-testid="button-hypo-recheck-timer"
                >
                  <Timer className="mr-1.5 h-4 w-4" aria-hidden />
                  15 min recheck
                </Button>
              </div>

              {recheckRemainingSec != null ? (
                <div
                  className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 dark:bg-amber-950/30"
                  data-testid="panel-hypo-recheck-timer"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Recheck when timer ends</p>
                    <p className="text-xs text-muted-foreground">Treat first, then wait before deciding next steps.</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
                      {formatRecheckCountdown(recheckRemainingSec)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10"
                      aria-label="Dismiss timer"
                      onClick={() => setRecheckEndsAt(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}

              <Collapsible>
                <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-left text-sm font-medium">
                  <span>{hypoCarbSource ? "Other options" : "Portion equivalents"}</span>
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid gap-2 pt-2 md:grid-cols-3">
                    <div className="rounded-lg border border-border/60 bg-muted/15 p-2 text-center">
                      <p className="text-lg font-bold tabular-nums text-foreground">{hypoResult.glucoseTablets}</p>
                      <p className="text-xs text-muted-foreground">glucose tablets</p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/15 p-2 text-center">
                      <p className="text-lg font-bold tabular-nums text-foreground">{hypoResult.juiceMl}ml</p>
                      <p className="text-xs text-muted-foreground">fruit juice</p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/15 p-2 text-center">
                      <p className="text-lg font-bold tabular-nums text-foreground">{hypoResult.jellyBabies}</p>
                      <p className="text-xs text-muted-foreground">jelly babies</p>
                    </div>
                  </div>
                  {!hypoCarbSource ? (
                    <p className="pt-2 text-xs text-muted-foreground">
                      <Link href="/settings/carb-sources" className="text-primary underline-offset-4 hover:underline">
                        Carb sources
                      </Link>{" "}
                      personalises hints.
                    </p>
                  ) : null}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-sm">
        <Link href="/tools/hypo-history" className="font-medium text-primary underline-offset-4 hover:underline">
          Hypo treatment history
        </Link>
      </p>
    </PageShell>
  );
}
