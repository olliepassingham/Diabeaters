import { useState, useEffect, useMemo, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { Calculator, ChevronDown, ChevronUp, Droplet, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  lastHypoWithDetail,
  suggestedRecoveryTargetBg,
} from "@/lib/hypo-context";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { ScenarioResultHero } from "@/components/scenarios/scenario-result-hero";
import { PageInfoDialog } from "@/components/page-info-dialog";
import { MedicalNumericOutputDisclaimer } from "@/components/medical-numeric-output-disclaimer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MedicalSourcesLink } from "@/components/medical-sources-link";
import { StepLadder, type StepLadderStep } from "@/components/visualizations/step-ladder";
import { useToast } from "@/hooks/use-toast";
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
    description: "Treat again per your team’s rules. Use glucagon and get emergency help if you can’t swallow or someone can’t keep you safe.",
  },
];

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
  const [hypoCalcError, setHypoCalcError] = useState<string | null>(null);
  const [postExerciseNudgeRev, setPostExerciseNudgeRev] = useState(0);
  const [contextOpen, setContextOpen] = useState(false);

  const bgUnits = profile.bgUnits || "mmol/L";
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

  const hasResolvableWeight = useMemo(() => {
    const resolved = resolveHypoCalculatorWeightKg({
      profile,
      useProfileWeight: showingProfileWeight,
      inputValue: userWeight,
      inputUnit: weightUnit,
    });
    return resolved.ok;
  }, [profile, showingProfileWeight, userWeight, weightUnit]);

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
  };

  return (
    <PageShell variant="narrow" density="compact" className="space-y-4">
      <PageHeader
        leading={<PageBackButton />}
        title="Hypo help"
        actions={
          <PageInfoDialog
            title="About Hypo help"
            description="Estimate fast-acting carbs to bring you back toward target. Educational only — follow your care team's plan."
          >
            {null}
          </PageInfoDialog>
        }
      />

      <Card className="surface-card overflow-hidden rounded-2xl border-border/70 shadow-sm">
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-h3 flex items-center gap-2 text-foreground">
            <Droplet className="h-6 w-6 shrink-0 text-red-500" aria-hidden />
            Hypo treatment calculator
          </CardTitle>
          <CardDescription className="text-sm leading-snug">
            Enter your current reading and target — we estimate fast carbs. Your written hypo plan from your team always
            comes first.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {weightRequired && (
            <Alert data-testid="alert-hypo-minor-weight">
              <AlertDescription className="text-sm">
                For under-18s we need your real weight to size this estimate — add it in{" "}
                <Link href="/settings#settings-personal" className="font-medium text-primary underline-offset-4 hover:underline">
                  Settings
                </Link>{" "}
                or below. We will not guess from a typical adult weight. Follow your hypo plan from your diabetes team
                first.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="current-bg">Current BG ({bgUnits})</Label>
              <Input
                id="current-bg"
                type="number"
                step="0.1"
                placeholder={bgUnits === "mmol/L" ? "e.g., 3.2" : "e.g., 58"}
                value={currentBg}
                onChange={(e) => setCurrentBg(e.target.value)}
                data-testid="input-current-bg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target-bg">Target BG ({bgUnits})</Label>
              <Input
                id="target-bg"
                type="number"
                step="0.1"
                placeholder={bgUnits === "mmol/L" ? "e.g., 5.5" : "e.g., 100"}
                value={targetBg}
                onChange={(e) => setTargetBg(e.target.value)}
                data-testid="input-target-bg"
              />
              {targetPrefilledFromRange && (
                <p className="text-xs text-muted-foreground">
                  Prefilled toward the middle of your Ratios target range — adjust to match your hypo plan.
                </p>
              )}
            </div>
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="user-weight">Your weight {weightRequired ? "(required)" : "(optional)"}</Label>
              {showingProfileWeight ? (
                <div
                  className="flex min-h-10 items-center justify-between gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2"
                  data-testid="hypo-weight-from-profile"
                >
                  <p className="text-sm text-foreground">
                    Using{" "}
                    <span className="font-medium tabular-nums">
                      {formatWeightLabel(profileWeightKg, getWeightDisplayUnitFromProfile(profile))}
                    </span>{" "}
                    <span className="text-muted-foreground">from your profile</span>
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
                <>
                  <div className="flex gap-2">
                    <Input
                      id="user-weight"
                      type="number"
                      inputMode="decimal"
                      placeholder={weightUnit === "kg" ? "e.g., 70" : "e.g., 154"}
                      value={userWeight}
                      onChange={(e) => {
                        setUseProfileWeight(false);
                        setUserWeight(e.target.value);
                      }}
                      className="flex-1"
                      data-testid="input-user-weight"
                    />
                    <div className="flex shrink-0">
                      <Button
                        type="button"
                        variant={weightUnit === "kg" ? "default" : "outline"}
                        size="sm"
                        className="rounded-r-none"
                        onClick={() => setWeightUnit("kg")}
                        data-testid="button-weight-kg"
                      >
                        kg
                      </Button>
                      <Button
                        type="button"
                        variant={weightUnit === "lbs" ? "default" : "outline"}
                        size="sm"
                        className="rounded-l-none"
                        onClick={() => setWeightUnit("lbs")}
                        data-testid="button-weight-lbs"
                      >
                        lbs
                      </Button>
                    </div>
                  </div>
                  {profileWeightKg != null ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto px-0 text-xs font-normal text-muted-foreground underline-offset-4 hover:underline"
                      onClick={() => applyWeightFromProfile(profile)}
                      data-testid="button-hypo-use-profile-weight"
                    >
                      Use profile weight (
                      {formatWeightLabel(profileWeightKg, getWeightDisplayUnitFromProfile(profile))})
                    </Button>
                  ) : weightRequired ? (
                    <p className="text-xs text-muted-foreground">
                      <Link href="/settings#settings-personal" className="text-primary underline-offset-4 hover:underline">
                        Add weight in Settings
                      </Link>{" "}
                      to pre-fill next time.
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {hypoCalcError && (
            <Alert variant="destructive" data-testid="alert-hypo-calc-error">
              <AlertDescription className="text-sm">{hypoCalcError}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={calculateHypoTreatment}
            disabled={!currentBg || !targetBg || (weightRequired && !hasResolvableWeight)}
            className="w-full"
            data-testid="button-calculate-hypo"
          >
            <Calculator className="h-4 w-4 mr-2" />
            Calculate treatment
          </Button>

          {hypoResult && (
            <div className="space-y-3">
              <ScenarioResultHero label="Fast carbs" tone="hypo" value={`${hypoResult.carbsGrams}g`}>
                <p className="mt-2 text-sm text-muted-foreground">fast-acting carbs</p>
                {hypoTreatmentLine(hypoResult.carbsGrams) ? (
                  <p className="mt-2 text-xs font-medium text-foreground/90">
                    Your usual choice: {hypoTreatmentLine(hypoResult.carbsGrams)}
                  </p>
                ) : null}
              </ScenarioResultHero>
              <MedicalNumericOutputDisclaimer compact />
              <Collapsible>
                <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-left text-sm font-medium">
                  <span>{hypoCarbSource ? "Other options" : "That's about"}</span>
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid gap-2 pt-2">
                    <div className="grid gap-2 md:grid-cols-3">
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
                      <p className="text-xs text-muted-foreground">
                        Set your carb sources in{" "}
                        <Link href="/settings/carb-sources" className="text-primary underline-offset-4 hover:underline">
                          Settings → Carb sources
                        </Link>{" "}
                        for personalised hints.
                      </p>
                    ) : null}
                  </div>
                </CollapsibleContent>
              </Collapsible>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-foreground">
                <strong>Remember:</strong> Wait 15 minutes, then recheck. If still low, treat again.
              </div>
            </div>
          )}

          {parseFloat(currentBg) > 0 &&
            parseFloat(targetBg) > 0 &&
            parseFloat(currentBg) >= parseFloat(targetBg) && (
              <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-small text-green-800 dark:text-green-200">
                  Your current BG is already at or above your target — no treatment needed.
                </p>
              </div>
            )}

          <Collapsible open={contextOpen} onOpenChange={setContextOpen}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between gap-2 font-normal text-muted-foreground hover:text-foreground"
                data-testid="button-hypo-context-toggle"
                aria-expanded={contextOpen}
              >
                <span>Reminders &amp; extra context</span>
                {contextOpen ? (
                  <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
                <p className="text-small text-red-800 dark:text-red-200">
                  This supports more precise treatment than a fixed 15g rule. If in doubt, use your usual hypo plan.
                </p>
              </div>
              {postExerciseHypoCopy && (
                <Alert
                  className="border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/20"
                  data-testid="alert-hypo-recent-exercise"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <AlertDescription className="text-sm sm:min-w-0 sm:flex-1">
                      <strong>Recent exercise:</strong> {postExerciseHypoCopy.hypoDetail}
                    </AlertDescription>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 self-start"
                      onClick={() => {
                        storage.snoozePostExerciseNudges(8);
                        setPostExerciseNudgeRev((n) => n + 1);
                        toast({
                          title: "Reminders snoozed",
                          description: "Post-exercise tips are hidden for 8 hours.",
                        });
                      }}
                      data-testid="alert-hypo-post-ex-snooze"
                    >
                      Snooze 8h
                    </Button>
                  </div>
                </Alert>
              )}
              {isPumpDeliveryMethod(profile?.insulinDeliveryMethod) && (
                <Alert data-testid="alert-hypo-pump-note">
                  <AlertDescription className="text-sm">
                    On a pump: an <strong>extended bolus</strong> or recent correction may still be bringing your BG
                    down. If you use automation (loop/AID), check whether a suspend or reduced delivery is active —
                    treat the low with fast carbs first, then review IOB with your team&apos;s plan.
                  </AlertDescription>
                </Alert>
              )}
              {lastHypoDetail && (
                <Alert className="border-border bg-muted/40" data-testid="alert-last-hypo-context">
                  <AlertDescription className="text-sm text-muted-foreground">
                    Last logged hypo {formatDistanceToNow(new Date(lastHypoDetail.at), { addSuffix: true })}:{" "}
                    <span className="font-medium text-foreground">{lastHypoDetail.label}</span>
                  </AlertDescription>
                </Alert>
              )}
            </CollapsibleContent>
          </Collapsible>

          <p className="text-tiny text-muted-foreground">
            Not medical advice. For severe hypos or if you can&apos;t swallow, use glucagon and get emergency help.
          </p>
        </CardContent>
      </Card>

      <Card className="surface-card overflow-hidden rounded-2xl border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold tracking-tight">After treating — typical check-in flow</CardTitle>
          <CardDescription className="text-sm">
            A visual reminder of the usual treat → wait → recheck pattern many teams teach (often called 15–15 style).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <StepLadder
            steps={HYPO_RECHECK_FLOW_STEPS}
            ariaLabel="Hypo treatment check-in steps"
            data-testid="hypo-1515-step-ladder"
          />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Illustration only — not medical advice. Severe hypos need help straight away; follow emergency instructions
            you were given with your glucagon.
          </p>
        </CardContent>
      </Card>

      <Card className="p-4 bg-muted/30 rounded-xl border-border/80">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-2 text-small">
            <p className="font-medium text-foreground">Quick reference</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>
                <strong>Mild (3.5–3.9 {bgUnits === "mmol/L" ? "mmol/L" : "mg/dL"}):</strong> 10–15g fast carbs
              </li>
              <li>
                <strong>Moderate (2.8–3.4 {bgUnits === "mmol/L" ? "mmol/L" : "mg/dL"}):</strong> 15–20g fast carbs
              </li>
              <li>
                <strong>Severe (&lt;2.8 {bgUnits === "mmol/L" ? "mmol/L" : "mg/dL"}):</strong> 20–25g fast carbs; may need help
              </li>
            </ul>
            <p className="text-tiny text-muted-foreground mt-2">
              Follow up with a slower snack if your next meal is more than 1–2 hours away.
            </p>
          </div>
        </div>
      </Card>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/tools/hypo-history" className="font-medium text-primary underline-offset-4 hover:underline">
          View hypo treatment history
        </Link>
      </p>
      <MedicalSourcesLink anchor="hypoglycaemia" />
    </PageShell>
  );
}
