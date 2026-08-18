import { useCallback, useEffect, useMemo, useState } from "react";
import { hypoTreatmentsInRollingHours } from "@/lib/hypo-context";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
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
import { insulinRoundIncrement, formatInsulinUnits, roundInsulinUnits } from "@/lib/insulin-rounding";
import { parseOptionalBolusUnits } from "@/lib/meal-dose";
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
  const [pumpIobInput, setPumpIobInput] = useState("");
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
  const isPump = isPumpDeliveryMethod(profile?.insulinDeliveryMethod);
  const roundIncrement = insulinRoundIncrement(isPump);
  const pumpIobUnits = isPump ? parseOptionalBolusUnits(pumpIobInput) : null;

  const parsedBg = parseBgInput(bgInput);
  const result =
    parsedBg != null && hasValidIsf && settings
      ? computeSimpleCorrectionDose({
          currentBg: parsedBg,
          targetBg: targetForCalc,
          correctionFactor: correctionFactor!,
          bgUnits,
          roundIncrement,
        })
      : null;

  const remainingAfterIob =
    result?.status === "dose" && pumpIobUnits != null
      ? roundInsulinUnits(Math.max(0, result.exactDose - pumpIobUnits), roundIncrement)
      : null;
  const unitLabel = bgUnits === "mg/dL" ? "mg/dL" : "mmol/L";
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

      {isPump ? <PumpDosingBanner /> : null}

      {showUnder18IsfCopy || recentHypoCount >= 2 || postExerciseCorrectionCopy ? (
        <div className="space-y-2">
          {showUnder18IsfCopy ? (
            <Alert className="rounded-2xl border-sky-200/80 bg-sky-50/70 py-2.5 dark:border-sky-900/50 dark:bg-sky-950/25" data-testid="alert-correction-under18">
              <AlertDescription className="text-xs leading-snug sm:text-sm">
                Under 18: use the ISF and targets from your diabetes team. This only does the arithmetic.
              </AlertDescription>
            </Alert>
          ) : null}
          {recentHypoCount >= 2 ? (
            <Alert
              className="rounded-2xl border-amber-200/80 bg-amber-50/70 py-2.5 dark:border-amber-800 dark:bg-amber-950/25"
              data-testid="alert-correction-recent-hypos"
            >
              <AlertDescription className="text-xs leading-snug sm:text-sm">
                <strong>{recentHypoCount}</strong> hypos in 7 days — be cautious stacking corrections.
              </AlertDescription>
            </Alert>
          ) : null}
          {postExerciseCorrectionCopy ? (
            <Alert
              className="rounded-2xl border-emerald-200/80 bg-emerald-50/70 py-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/20"
              data-testid="alert-correction-recent-exercise"
            >
              <div className="flex items-start justify-between gap-2">
                <AlertDescription className="min-w-0 text-xs leading-snug sm:text-sm">
                  <strong>Recent exercise:</strong> {postExerciseCorrectionCopy.correctionDetail}
                </AlertDescription>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 rounded-full px-2.5 text-xs"
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
                  Snooze
                </Button>
              </div>
            </Alert>
          ) : null}
        </div>
      ) : null}

      <Card
        className="overflow-hidden rounded-[1.35rem] border-primary/20 bg-gradient-to-b from-primary/[0.07] via-card to-card shadow-none dark:border-primary/15 dark:from-primary/10"
        data-testid="card-correction-calculator"
      >
        <CardContent className="space-y-4 px-4 pb-5 pt-4 sm:px-5">
          {!hasValidIsf ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Add a correction factor (ISF) in Ratios to see a dose.</p>
              <Button asChild className="h-12 w-full rounded-xl" data-testid="button-correction-open-ratios">
                <Link href="/settings/ratios">Open Ratios</Link>
              </Button>
            </div>
          ) : (
            <>
              <section className="space-y-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Glucose now</h3>
                <div className="space-y-2.5 rounded-2xl border border-border/50 bg-background/70 p-3 shadow-sm dark:bg-background/40">
                  <Label htmlFor="correction-bg" className="sr-only">
                    Current blood glucose
                  </Label>
                  <div className="flex items-stretch gap-2">
                    <Input
                      id="correction-bg"
                      type="text"
                      inputMode="decimal"
                      placeholder={bgUnits === "mg/dL" ? "180" : "10.5"}
                      value={bgInput}
                      onChange={(e) => correctionCgm.onBgChange(e.target.value)}
                      className="h-14 flex-1 rounded-xl border-border/60 bg-background text-2xl font-semibold tabular-nums tracking-tight shadow-none"
                      data-testid="input-correction-bg"
                    />
                    <span className="flex min-w-[4.5rem] items-center justify-center rounded-xl border border-border/60 bg-muted/40 px-3 text-sm font-semibold text-muted-foreground">
                      {unitLabel}
                    </span>
                  </div>
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
              </section>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <Label htmlFor="correction-target" className="text-xs font-medium text-muted-foreground">
                    Target
                  </Label>
                  <Input
                    id="correction-target"
                    type="text"
                    inputMode="decimal"
                    placeholder={`${defaultTarget}`}
                    value={targetOverride}
                    onChange={(e) => setTargetOverride(e.target.value)}
                    className="h-12 rounded-xl tabular-nums"
                    data-testid="input-correction-target"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">ISF</p>
                  <div className="flex h-12 items-center rounded-xl border border-border/50 bg-background/70 px-3 text-sm font-semibold tabular-nums">
                    {correctionFactor} {unitLabel}/u
                  </div>
                </div>
              </div>

              {isPump ? (
                <div className="space-y-1.5">
                  <Label htmlFor="correction-pump-iob" className="text-xs font-medium text-muted-foreground">
                    Pump IOB <span className="font-normal">(optional)</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="correction-pump-iob"
                      type="text"
                      inputMode="decimal"
                      placeholder="1.2"
                      value={pumpIobInput}
                      onChange={(e) => setPumpIobInput(e.target.value)}
                      className="h-12 rounded-xl tabular-nums pr-8"
                      data-testid="input-correction-pump-iob"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      u
                    </span>
                  </div>
                </div>
              ) : null}

              {parsedBg != null && result ? (
                <div className="space-y-3">
                  {result.status === "dose" ? (
                    <ScenarioResultHero
                      label={remainingAfterIob != null ? "After pump IOB" : "Standard correction"}
                      value={
                        <>
                          {formatInsulinUnits(remainingAfterIob ?? result.fullDoseRounded, roundIncrement)}
                          <ScenarioResultHeroSuffix>u</ScenarioResultHeroSuffix>
                        </>
                      }
                      data-testid="card-correction-result"
                      valueTestId="text-correction-dose"
                    >
                      <p className="mt-2 text-xs text-muted-foreground font-mono break-words" data-testid="text-correction-formula">
                        ({result.currentBg} − {result.targetBg}) ÷ {result.correctionFactor}
                        {pumpIobUnits != null ? ` − ${pumpIobUnits} IOB` : ""} ={" "}
                        {formatInsulinUnits(remainingAfterIob ?? result.fullDoseRounded, roundIncrement)}u
                      </p>
                      {remainingAfterIob != null && remainingAfterIob <= 0 ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Pump IOB already covers this correction — don&apos;t stack more insulin.
                        </p>
                      ) : null}
                    </ScenarioResultHero>
                  ) : null}
                  {result.status === "no_correction_needed" ? (
                    <ScenarioResultHero
                      tone="neutral"
                      label="No correction needed"
                      value="0u"
                      data-testid="alert-correction-none"
                    >
                      <p className="mt-2 text-sm text-muted-foreground">
                        BG is at or below {result.targetBg} {unitLabel}.
                      </p>
                    </ScenarioResultHero>
                  ) : null}
                </div>
              ) : null}

              {parsedBg == null && bgInput.trim() !== "" ? (
                <p className="text-sm text-amber-800 dark:text-amber-200">Enter a valid number for current BG.</p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
