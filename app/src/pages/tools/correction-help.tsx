import { useCallback, useEffect, useMemo, useState } from "react";
import { hypoTreatmentsInRollingHours } from "@/lib/hypo-context";
import { Link } from "wouter";
import { Calculator } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { PageInfoDialog } from "@/components/page-info-dialog";
import { MedicalNumericOutputDisclaimer } from "@/components/medical-numeric-output-disclaimer";
import { MedicalSourcesLink } from "@/components/medical-sources-link";
import {
  computeSimpleCorrectionDose,
  getDefaultCorrectionTargetHigh,
  type BgUnits,
} from "@/lib/correction-dose";
import { storage, DIABEATER_SETTINGS_CHANGED_EVENT, type UserProfile, type UserSettings } from "@/lib/storage";

function parseBgInput(raw: string): number | null {
  const n = parseFloat(raw.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return n;
}

export default function CorrectionHelpPage() {
  const [profile, setProfile] = useState<Partial<UserProfile> | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [bgUnits, setBgUnits] = useState<BgUnits>("mmol/L");
  const [bgInput, setBgInput] = useState("");
  const [targetOverride, setTargetOverride] = useState("");
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
    return () => window.removeEventListener(DIABEATER_SETTINGS_CHANGED_EVENT, load);
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
  const isPump = profile?.insulinDeliveryMethod === "pump";
  const exercisedRecently24h = storage.didExerciseRecently(24);

  const recentHypoCount = useMemo(() => {
    return hypoTreatmentsInRollingHours(storage.getHypoTreatments(), 7 * 24).length;
  }, []);

  return (
    <PageShell variant="standard" className="space-y-6">
      <PageHeader
        leading={<PageBackButton />}
        title="Correction helper"
        actions={
          <PageInfoDialog
            title="About Correction helper"
            description="Estimate a standard correction dose from your current BG and the correction factor (ISF) saved in Ratios."
          >
            {null}
          </PageInfoDialog>
        }
      />

      {isPump && (
        <Alert data-testid="alert-correction-pump-iob">
          <AlertDescription className="text-sm">
            <strong>Pump users:</strong> Before stacking a manual correction, check <strong>active insulin (IOB)</strong> on
            your pump — the pump may already credit recent boluses. Temp basals and extended boluses also affect how much
            extra insulin is safe.
          </AlertDescription>
        </Alert>
      )}

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

      {exercisedRecently24h && (
        <Alert className="border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/20" data-testid="alert-correction-recent-exercise">
          <AlertDescription className="text-sm">
            <strong>Recent exercise:</strong> you may be more insulin sensitive for up to 24 hours. Be cautious stacking corrections and watch for delayed lows (especially overnight).
          </AlertDescription>
        </Alert>
      )}

      <Card data-testid="card-correction-calculator">
        <CardHeader>
          <CardTitle className="text-h3 flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Correction estimate
          </CardTitle>
          <CardDescription>
            Uses: (current BG − correction target) ÷ ISF. Default target is your upper target BG from settings (same idea
            as the Bedtime tool before overnight safeguards).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasValidIsf ? (
            <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/25">
              <AlertDescription className="text-sm space-y-3">
                <p>Add a correction factor (ISF) in Ratios to see a dose estimate.</p>
                <Button asChild size="sm" data-testid="button-correction-open-ratios">
                  <Link href="/ratios">Open Ratios</Link>
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
                    onChange={(e) => setBgInput(e.target.value)}
                    data-testid="input-correction-bg"
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
                    <div
                      className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2"
                      data-testid="card-correction-result"
                    >
                      <p className="text-sm font-medium text-foreground">Standard correction (full dose)</p>
                      <p className="text-3xl font-bold font-mono text-primary" data-testid="text-correction-dose">
                        {result.fullDoseRounded}u
                      </p>
                      <p className="text-xs text-muted-foreground font-mono break-words" data-testid="text-correction-formula">
                        ({result.currentBg} − {result.targetBg}) ÷ {result.correctionFactor} = {result.fullDoseRounded}u
                      </p>
                    </div>
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

      <MedicalNumericOutputDisclaimer compact />

      <MedicalSourcesLink anchor="insulin" />
    </PageShell>
  );
}
