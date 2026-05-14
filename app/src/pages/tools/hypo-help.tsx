import { useState, useEffect, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { Calculator, ChevronDown, ChevronUp, Droplet, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { storage, type UserProfile } from "@/lib/storage";
import { hypoCalculatorRequiresExplicitWeight } from "@/lib/user-age";
import {
  formatTargetBgInput,
  lastHypoWithDetail,
  suggestedRecoveryTargetBg,
} from "@/lib/hypo-context";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
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
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">("kg");
  const [hypoResult, setHypoResult] = useState<{
    carbsNeeded: number;
    glucoseTablets: number;
    juiceMl: number;
    jellyBabies: number;
  } | null>(null);
  const [hypoCalcError, setHypoCalcError] = useState<string | null>(null);
  const [postExerciseNudgeRev, setPostExerciseNudgeRev] = useState(0);
  const [contextOpen, setContextOpen] = useState(false);

  const bgUnits = profile.bgUnits || "mmol/L";
  const postExerciseHypoCopy = useMemo(() => {
    void postExerciseNudgeRev;
    if (!storage.shouldShowPostExerciseEducationalNudges()) return null;
    return getPostExerciseEducationalCopy(inferPostExerciseLoadTier(storage.getLastExerciseSummary()));
  }, [postExerciseNudgeRev]);
  const weightRequired = hypoCalculatorRequiresExplicitWeight(profile.dateOfBirth);

  useEffect(() => {
    const p = storage.getProfile();
    if (p) setProfile(p);
    const s = storage.getSettings();
    const units = p?.bgUnits === "mg/dL" ? "mg/dL" : "mmol/L";
    const sug = suggestedRecoveryTargetBg(s, units);
    if (sug != null) {
      setTargetBg(formatTargetBgInput(sug, units));
      setTargetPrefilledFromRange(true);
    }
    setLastHypoDetail(lastHypoWithDetail(storage.getHypoTreatments()));
  }, []);

  const calculateHypoTreatment = () => {
    setHypoCalcError(null);
    if (!currentBg || !targetBg) return;
    const current = parseFloat(currentBg);
    const target = parseFloat(targetBg);
    const parsedFromInput = userWeight.trim() ? parseFloat(userWeight) : Number.NaN;
    const hasValidInputWeight = Number.isFinite(parsedFromInput) && parsedFromInput > 0;
    if (weightRequired && !hasValidInputWeight) {
      setHypoCalcError("Add your weight in kg or lbs so we do not assume an adult default.");
      setHypoResult(null);
      return;
    }
    const rawWeight = hasValidInputWeight ? parsedFromInput : 70;
    const weight = weightUnit === "lbs" ? rawWeight * 0.4536 : rawWeight;
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
    const glucoseTablets = Math.ceil(carbsNeeded / 4);
    const juiceMl = Math.round(carbsNeeded * 10);
    const jellyBabies = Math.ceil(carbsNeeded / 5);
    setHypoResult({
      carbsNeeded: Math.max(carbsNeeded, 10),
      glucoseTablets: Math.max(glucoseTablets, 3),
      juiceMl: Math.max(juiceMl, 100),
      jellyBabies: Math.max(jellyBabies, 2),
    });
  };

  return (
    <PageShell variant="standard" className="space-y-6">
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
                For under-18s we need your real weight to size this estimate — we will not guess from a typical adult
                weight. Follow your hypo plan from your diabetes team first.
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
            <div className="space-y-2">
              <Label htmlFor="user-weight">Your weight {weightRequired ? "(required)" : "(optional)"}</Label>
              <div className="flex gap-2">
                <Input
                  id="user-weight"
                  type="number"
                  placeholder={weightUnit === "kg" ? "e.g., 70" : "e.g., 154"}
                  value={userWeight}
                  onChange={(e) => setUserWeight(e.target.value)}
                  className="flex-1"
                  data-testid="input-user-weight"
                />
                <div className="flex">
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
            </div>
          </div>

          {hypoCalcError && (
            <Alert variant="destructive" data-testid="alert-hypo-calc-error">
              <AlertDescription className="text-sm">{hypoCalcError}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={calculateHypoTreatment}
            disabled={!currentBg || !targetBg || (weightRequired && !userWeight.trim())}
            className="w-full"
            data-testid="button-calculate-hypo"
          >
            <Calculator className="h-4 w-4 mr-2" />
            Calculate treatment
          </Button>

          {hypoResult && (
            <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800 space-y-4">
              <MedicalNumericOutputDisclaimer compact />
              <h4 className="font-medium flex items-center gap-2 text-red-800 dark:text-red-200">
                <Droplet className="h-4 w-4" />
                You need approximately:
              </h4>
              <div className="text-center p-4 bg-card rounded-lg border border-red-200/60 dark:border-red-800/50">
                <p className="text-4xl font-bold text-red-600 dark:text-red-400">{hypoResult.carbsNeeded}g</p>
                <p className="text-small text-red-700 dark:text-red-300">fast-acting carbs</p>
              </div>
              <div className="grid gap-2 text-small">
                <p className="font-medium text-red-800 dark:text-red-200">That&apos;s about:</p>
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="p-2 bg-card rounded text-center border border-red-200/40 dark:border-red-900/40">
                    <p className="text-lg font-bold text-red-700 dark:text-red-300">{hypoResult.glucoseTablets}</p>
                    <p className="text-tiny text-red-600 dark:text-red-400">glucose tablets</p>
                  </div>
                  <div className="p-2 bg-card rounded text-center border border-red-200/40 dark:border-red-900/40">
                    <p className="text-lg font-bold text-red-700 dark:text-red-300">{hypoResult.juiceMl}ml</p>
                    <p className="text-tiny text-red-600 dark:text-red-400">fruit juice</p>
                  </div>
                  <div className="p-2 bg-card rounded text-center border border-red-200/40 dark:border-red-900/40">
                    <p className="text-lg font-bold text-red-700 dark:text-red-300">{hypoResult.jellyBabies}</p>
                    <p className="text-tiny text-red-600 dark:text-red-400">jelly babies</p>
                  </div>
                </div>
              </div>
              <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded text-tiny text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
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
              {profile?.insulinDeliveryMethod === "pump" && (
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
      <MedicalSourcesLink anchor="hypoglycaemia" />
    </PageShell>
  );
}
