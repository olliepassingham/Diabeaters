import { useCallback, useEffect, useMemo, useState } from "react";
import { hypoTreatmentsInRollingHours } from "@/lib/hypo-context";
import { Link } from "wouter";
import { Calculator } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { ScenarioResultHero, ScenarioResultHeroSuffix } from "@/components/scenarios/scenario-result-hero";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
import { MedicalSourcesLink } from "@/components/medical-sources-link";
import {
  computeSimpleCorrectionDose,
  getDefaultCorrectionTargetHigh,
  type BgUnits,
} from "@/lib/correction-dose";
import {
  storage,
  DIABEATER_SETTINGS_CHANGED_EVENT,
  DIABEATER_PROFILE_CHANGED_EVENT,
  type UserProfile,
  type UserSettings,
} from "@/lib/storage";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { PumpDosingBanner } from "@/components/pump-dosing-banner";
import { ageInWholeYearsUtc } from "@/lib/user-age";
import { useToast } from "@/hooks/use-toast";
import {
  getPostExerciseEducationalCopy,
  inferPostExerciseLoadTier,
} from "@/lib/post-exercise-nudge";
import { CgmPrefillButton } from "@/components/cgm-prefill-button";
import { useAutoCgmBgField } from "@/hooks/use-auto-cgm-bg-field";

function parseBgInput(raw: string): number | null {
  const n = parseFloat(raw.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return n;
}

export default function CorrectionHelpPage() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<Partial<UserProfile> | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [bgUnits, setBgUnits] = useState<BgUnits>("mmol/L");
  const [bgInput, setBgInput] = useState("");
  const correctionCgm = useAutoCgmBgField({
    bgValue: bgInput,
    onApplyBg: setBgInput,
    autoApplyKey: "correction",
  });
  const [targetOverride, setTargetOverride] = useState("");
  const [postExerciseNudgeRev, setPostExerciseNudgeRev] = useState(0);
  const load = useCallback(() => {
    setProfile(storage.getProfile());
    setSettings(storage.getSettings());
    const p = storage.getProfile();
    if (p?.bgUnits === "mg/dL" || p?.bgUnits === "mmol/L") {
      setBgUnits(p.bgUnits);
    }
  }, []);

  useEffect(() => {
    load();
    if (typeof window === "undefined") return;
    window.addEventListener(DIABEATER_SETTINGS_CHANGED_EVENT, load);
    window.addEventListener(DIABEATER_PROFILE_CHANGED_EVENT, load);
    return () => {
      window.removeEventListener(DIABEATER_SETTINGS_CHANGED_EVENT, load);
      window.removeEventListener(DIABEATER_PROFILE_CHANGED_EVENT, load);
    };
  }, [load]);

  const defaultTarget = useMemo(() => {
    if (!settings) return bgUnits === "mg/dL" ? 144 : 8.0;
    return getDefaultCorrectionTargetHigh(settings, bgUnits);
  }, [settings, bgUnits]);

  const targetForCalc = useMemo(() => {
    const o = targetOverride.trim();
    if (!o) return defaultTarget;
    const n = parseBgInput(o);
    return n ?? defaultTarget;
  }, [targetOverride, defaultTarget]);

  const correctionFactor = settings?.correctionFactor;
  const hasValidIsf = typeof correctionFactor === "number" && correctionFactor > 0 && Number.isFinite(correctionFactor);

  const parsedBg = parseBgInput(bgInput);
  const result =
    parsedBg != null && hasValidIsf && settings
      ? computeSimpleCorrectionDose({
          currentBg: parsedBg,
          targetBg: targetForCalc,
          correctionFactor: correctionFactor!,
          bgUnits,
        })
      : null;

  const unitLabel = bgUnits === "mg/dL" ? "mg/dL" : "mmol/L";
  const isPump = isPumpDeliveryMethod(profile?.insulinDeliveryMethod);
  const postExerciseCorrectionCopy = useMemo(() => {
    void postExerciseNudgeRev;
    if (!storage.shouldShowPostExerciseEducationalNudges()) return null;
    return getPostExerciseEducationalCopy(inferPostExerciseLoadTier(storage.getLastExerciseSummary()));
  }, [postExerciseNudgeRev]);

  const recentHypoCount = useMemo(() => {
    return hypoTreatmentsInRollingHours(storage.getHypoTreatments(), 7 * 24).length;
  }, []);

  const showUnder18IsfCopy = useMemo(() => {
    const a = ageInWholeYearsUtc(profile?.dateOfBirth);
    return a !== null && a < 18;
  }, [profile?.dateOfBirth]);

  return (
    <PageShell variant="narrow" density="compact" className="space-y-4">
      <PageHeader
        leading={<PageBackButton />}
        title="Correction helper"
        actions={
          <PageInfoDialog
            title="About Correction helper"
            description="Estimate a standard correction dose from your current BG and the correction factor (ISF) saved in Ratios."
          >
            <InfoSection title="How the estimate works">
              <p>
                Uses: (current BG − correction target) ÷ ISF. Default target is your upper target BG from settings (same
                idea as the Bedtime tool before overnight safeguards).
              </p>
            </InfoSection>
            <InfoSection title="Educational estimate only">
              <p>
                Diabeaters is not a medical device. These numbers are not a prescription. Confirm any doses or treatment
                changes with your diabetes team. Seek emergency care for severe hypoglycaemia, DKA symptoms, or any
                emergency.
              </p>
              <MedicalSourcesLink anchor="insulin" className="mt-2 inline-block" />
            </InfoSection>
          </PageInfoDialog>
        }
      />

      {showUnder18IsfCopy && (
        <Alert className="border-sky-200 dark:border-sky-900/50 bg-sky-50/80 dark:bg-sky-950/25" data-testid="alert-correction-under18">
          <AlertDescription className="text-sm">
            For children and young people, correction factors and targets should come from your diabetes team. Enter the
            values they give you in Ratios — this tool only does the arithmetic.
          </AlertDescription>
        </Alert>
      )}

      {isPump ? <PumpDosingBanner /> : null}

      {recentHypoCount >= 2 && (
        <Alert
          className="border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/25"
          data-testid="alert-correction-recent-hypos"
        >
          <AlertDescription className="text-sm">
            You&apos;ve logged <strong>{recentHypoCount}</strong> hypo treatments in the
            last 7 days. Be extra cautious stacking corrections — check IOB and your team&apos;s plan for lows.
          </AlertDescription>
        </Alert>
      )}

      {postExerciseCorrectionCopy && (
        <Alert
          className="border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/20"
          data-testid="alert-correction-recent-exercise"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <AlertDescription className="text-sm sm:min-w-0 sm:flex-1">
              <strong>Recent exercise:</strong> {postExerciseCorrectionCopy.correctionDetail}
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
              data-testid="alert-correction-post-ex-snooze"
            >
              Snooze 8h
            </Button>
          </div>
        </Alert>
      )}

      <Card data-testid="card-correction-calculator">
        <CardHeader className="pb-3">
          <CardTitle className="text-h3 flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Correction estimate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasValidIsf ? (
            <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/25">
              <AlertDescription className="text-sm space-y-3">
                <p>Add a correction factor (ISF) in Ratios to see a dose estimate.</p>
                <Button asChild size="sm" data-testid="button-correction-open-ratios">
                  <Link href="/settings/ratios">Open Ratios</Link>
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="correction-bg">Current BG ({unitLabel})</Label>
                  <Input
                    id="correction-bg"
                    type="text"
                    inputMode="decimal"
                    placeholder={bgUnits === "mg/dL" ? "e.g., 180" : "e.g., 10.5"}
                    value={bgInput}
                    onChange={(e) => correctionCgm.onBgChange(e.target.value)}
                    data-testid="input-correction-bg"
                  />
                  <CgmPrefillButton
                    prefill={correctionCgm.prefill}
                    loading={correctionCgm.loading}
                    bgUnits={unitLabel}
                    currentValue={bgInput}
                    onApply={correctionCgm.onBgChange}
                    onRefresh={correctionCgm.refresh}
                    emptyHint={correctionCgm.emptyHint}
                    allowSync
                    testId="button-correction-cgm-prefill"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="correction-target">
                    Correction target ({unitLabel}){" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="correction-target"
                    type="text"
                    inputMode="decimal"
                    placeholder={`Default ${defaultTarget}`}
                    value={targetOverride}
                    onChange={(e) => setTargetOverride(e.target.value)}
                    data-testid="input-correction-target"
                  />
                  <p className="text-xs text-muted-foreground">Leave blank to use {defaultTarget} {unitLabel}.</p>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">ISF (from settings):</span>{" "}
                {correctionFactor} {unitLabel} per 1 unit
              </div>

              {parsedBg != null && result && (
                <div className="space-y-3">
                  {result.status === "dose" && (
                    <ScenarioResultHero
                      label="Standard correction"
                      value={
                        <>
                          {result.fullDoseRounded}
                          <ScenarioResultHeroSuffix>u</ScenarioResultHeroSuffix>
                        </>
                      }
                      data-testid="card-correction-result"
                      valueTestId="text-correction-dose"
                    >
                      <p className="mt-2 text-xs text-muted-foreground font-mono break-words" data-testid="text-correction-formula">
                        ({result.currentBg} − {result.targetBg}) ÷ {result.correctionFactor} = {result.fullDoseRounded}u
                      </p>
                    </ScenarioResultHero>
                  )}
                  {result.status === "no_correction_needed" && (
                    <Alert data-testid="alert-correction-none">
                      <AlertDescription className="text-sm">
                        No correction needed — BG is at or below the correction target ({result.targetBg} {unitLabel}).
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {parsedBg == null && bgInput.trim() !== "" && (
                <p className="text-sm text-amber-800 dark:text-amber-200">Enter a valid number for current BG.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
