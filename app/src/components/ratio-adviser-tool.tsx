import { useState, useEffect, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sun,
  Sunset,
  Moon,
  Cookie,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Calculator,
  ArrowRight,
  Save,
  Pencil,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { storage, UserSettings, RatioFormat, DIABEATER_PROFILE_CHANGED_EVENT } from "@/lib/storage";
import { ageInWholeYearsUtc } from "@/lib/user-age";
import { getEffectiveTdd } from "@/lib/tdd";
import {
  formatRatioForStorage,
  formatRatioForDisplay,
  parseRatioToGramsPerUnit,
} from "@/lib/ratio-utils";
import { STARTER_ICR_GRAMS_PER_UNIT } from "@/lib/starter-ratios";
import { formatTargetBgRangeLabel, resolveUserTargetBgRange } from "@/lib/target-bg-range";
import { MedicalNumericOutputDisclaimer } from "@/components/medical-numeric-output-disclaimer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InlineInfoHint } from "@/components/ui/field-label-with-info";
import { MedicalSourcesLink } from "@/components/medical-sources-link";
import { RatiosEditPanel } from "@/components/ratios-edit-panel";
import { formatInsulinUnits, insulinRoundIncrement } from "@/lib/insulin-rounding";
import { assessMealRatio, compareLaterBg, illustrateRatioStep } from "@/lib/ratio-adviser";
import { formatTargetBgInput } from "@/lib/hypo-context";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { cn } from "@/lib/utils";

type MealKey = "breakfast" | "lunch" | "dinner" | "snack";

function mealLabel(key: MealKey): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function settingsRatioKey(meal: MealKey): keyof UserSettings {
  return `${meal}Ratio` as keyof UserSettings;
}

interface RatioAdviserProps {
  settings: UserSettings;
  bgUnit: string;
  onSettingsUpdate?: (settings: UserSettings) => void;
  onNavigateToMeal?: () => void;
}

type AdviserMode = "detect" | "refine" | "scratch_intro" | "scratch_tdd" | "scratch_result" | "scratch_saved";

function RatioAdviserDisclaimerFooter({ className }: { className?: string }) {
  return (
    <Card
      className={cn(
        "rounded-2xl border-amber-500/40 bg-amber-50/60 shadow-sm dark:border-amber-500/25 dark:bg-amber-950/25",
        className,
      )}
      data-testid="ratio-adviser-disclaimer-footer"
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-amber-950 dark:text-amber-50">Not medical advice</p>
            <p className="mt-1.5 leading-relaxed text-amber-900/90 dark:text-amber-100/90">
              This shows what your saved ratio does for one meal. A suggested step is an illustration — confirm it with
              your diabetes team before you rely on it.
            </p>
            <div className="pt-2.5">
              <MedicalSourcesLink anchor="insulin" compact />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RatioAdviserShell({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4" data-testid="ratio-adviser-shell">
      {children}
      <RatioAdviserDisclaimerFooter />
    </div>
  );
}

export function RatioAdviserTool({ settings, bgUnit, onSettingsUpdate, onNavigateToMeal }: RatioAdviserProps) {
  const { toast } = useToast();
  const hasAnyRatio = !!(settings.breakfastRatio || settings.lunchRatio || settings.dinnerRatio || settings.snackRatio);

  const [mode, setMode] = useState<AdviserMode>(hasAnyRatio ? "refine" : "detect");
  const [selectedMeal, setSelectedMeal] = useState<MealKey | null>(null);
  const [carbsInput, setCarbsInput] = useState("");
  const [bgNowInput, setBgNowInput] = useState("");
  const [laterBgInput, setLaterBgInput] = useState("");

  const [tddInput, setTddInput] = useState(() => {
    const effective = getEffectiveTdd(settings);
    return effective ? effective.toString() : "";
  });
  const [estimatedRatios, setEstimatedRatios] = useState<{ breakfast: number; lunch: number; dinner: number; snack: number } | null>(null);

  const [ratioFormat, setRatioFormat] = useState<RatioFormat>("per10g");
  const [cpSize, setCpSize] = useState<number | undefined>(undefined);

  const [minorKnown, setMinorKnown] = useState(false);
  const [ratiosEditOpen, setRatiosEditOpen] = useState(false);

  const handleRatiosSaved = (updated: UserSettings) => {
    onSettingsUpdate?.(updated);
    setRatiosEditOpen(false);
    const ratiosExist = !!(
      updated.breakfastRatio ||
      updated.lunchRatio ||
      updated.dinnerRatio ||
      updated.snackRatio
    );
    if (ratiosExist && mode === "detect") {
      setMode("refine");
    }
  };

  useEffect(() => {
    const sync = () => {
      const a = ageInWholeYearsUtc(storage.getProfile()?.dateOfBirth);
      setMinorKnown(a !== null && a < 18);
    };
    sync();
    if (typeof window === "undefined") return;
    window.addEventListener(DIABEATER_PROFILE_CHANGED_EVENT, sync);
    return () => window.removeEventListener(DIABEATER_PROFILE_CHANGED_EVENT, sync);
  }, []);

  useEffect(() => {
    if (minorKnown && mode === "scratch_tdd") setMode("scratch_intro");
  }, [minorKnown, mode]);

  useEffect(() => {
    const profile = storage.getProfile();
    if (profile?.ratioFormat) {
      setRatioFormat(profile.ratioFormat);
    }
    setCpSize(profile?.carbPortionSize);
  }, []);

  useEffect(() => {
    const ratiosExist = !!(settings.breakfastRatio || settings.lunchRatio || settings.dinnerRatio || settings.snackRatio);
    if (ratiosExist && mode === "detect") {
      setMode("refine");
    } else if (!ratiosExist && mode === "refine") {
      setMode("detect");
    }
    const effectiveTdd = getEffectiveTdd(settings);
    if (effectiveTdd && tddInput === "") {
      setTddInput(effectiveTdd.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync TDD placeholder when settings load; avoid fighting user input
  }, [settings, mode]);

  const formatStoredRatio = (storedRatio: string | undefined): string | undefined => {
    if (!storedRatio) return undefined;
    const gpu = parseRatioToGramsPerUnit(storedRatio);
    if (!gpu) return storedRatio;
    return formatRatioForDisplay(gpu, ratioFormat, cpSize);
  };

  const mealOptions: { key: MealKey; label: string; icon: typeof Sun; ratio?: string }[] = [
    { key: "breakfast", label: "Breakfast", icon: Sun, ratio: formatStoredRatio(settings.breakfastRatio) },
    { key: "lunch", label: "Lunch", icon: Sunset, ratio: formatStoredRatio(settings.lunchRatio) },
    { key: "dinner", label: "Dinner", icon: Moon, ratio: formatStoredRatio(settings.dinnerRatio) },
    { key: "snack", label: "Snack", icon: Cookie, ratio: formatStoredRatio(settings.snackRatio) },
  ];

  const handleReset = () => {
    setSelectedMeal(null);
    setCarbsInput("");
    setBgNowInput("");
    setLaterBgInput("");
  };

  const handleCalculateFromTDD = () => {
    const dob = storage.getProfile()?.dateOfBirth;
    const ageYears = ageInWholeYearsUtc(dob);
    if (ageYears !== null && ageYears < 18) {
      toast({
        title: "Not available for your age group",
        description:
          "The 500-rule estimate is for adults. Ask your diabetes team for starting carb ratios and enter them in Settings.",
        variant: "destructive",
      });
      return;
    }
    const tdd = parseFloat(tddInput);
    if (!tdd || tdd <= 0) return;

    const baseRatio = Math.round((500 / tdd) * 10) / 10;
    const breakfastRatio = Math.round((baseRatio * 0.85) * 10) / 10;
    const lunchRatio = baseRatio;
    const dinnerRatio = Math.round((baseRatio * 0.95) * 10) / 10;
    const snackRatio = baseRatio;

    setEstimatedRatios({ breakfast: breakfastRatio, lunch: lunchRatio, dinner: dinnerRatio, snack: snackRatio });
    setMode("scratch_result");
  };

  const handleUseDefaults = () => {
    setEstimatedRatios({ ...STARTER_ICR_GRAMS_PER_UNIT });
    setMode("scratch_result");
  };

  const handleSaveEstimatedRatios = () => {
    if (!estimatedRatios) return;

    const bounds = { min: 1, max: 150 };
    const meals: MealKey[] = ["breakfast", "lunch", "dinner", "snack"];
    for (const m of meals) {
      const v = estimatedRatios[m];
      if (!Number.isFinite(v) || v < bounds.min || v > bounds.max) {
        toast({
          title: "Check your numbers",
          description: `Each meal needs a value between ${bounds.min} and ${bounds.max} grams of carb per 1 unit.`,
          variant: "destructive",
        });
        return;
      }
    }

    const updatedSettings: UserSettings = {
      ...settings,
      breakfastRatio: formatRatioForStorage(estimatedRatios.breakfast),
      lunchRatio: formatRatioForStorage(estimatedRatios.lunch),
      dinnerRatio: formatRatioForStorage(estimatedRatios.dinner),
      snackRatio: formatRatioForStorage(estimatedRatios.snack),
    };

    if (tddInput && parseFloat(tddInput) > 0) {
      updatedSettings.tdd = parseFloat(tddInput);
    }

    storage.saveSettings(updatedSettings);
    if (onSettingsUpdate) {
      onSettingsUpdate(updatedSettings);
    }
    setMode("scratch_saved");
  };

  if (mode === "detect") {
    return (
      <RatioAdviserShell>
      <Card data-testid="card-ratio-adviser">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Calculator className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <CardTitle className="text-lg tracking-tight">Ratio Adviser</CardTitle>
            </div>
            <InlineInfoHint
              ariaLabel="About starting ratios"
              content="Estimated starting points only. Always confirm any ratio changes with your diabetes team before using them."
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Set up carb ratios to use the meal planner and this adviser.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {ratiosEditOpen ? (
            <RatiosEditPanel
              settings={settings}
              bgUnit={bgUnit}
              ratioFormat={ratioFormat}
              carbPortionSize={cpSize}
              onSaved={handleRatiosSaved}
              onCancel={() => setRatiosEditOpen(false)}
              idPrefix="ratio-adviser-detect-edit"
            />
          ) : (
            <Button
              type="button"
              className="min-h-12 w-full rounded-xl text-base font-semibold"
              onClick={() => setRatiosEditOpen(true)}
              data-testid="button-open-ratio-edit-detect"
            >
              <Pencil className="mr-2 h-4 w-4" aria-hidden />
              Edit ratios &amp; targets
            </Button>
          )}

          {!ratiosEditOpen ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">What describes you best?</p>
            <Button
              variant="outline"
              className="min-h-12 h-auto w-full justify-start py-3 text-left"
              onClick={() => setMode("scratch_intro")}
              data-testid="button-adviser-no-ratios"
            >
              <p className="font-medium text-sm">I don&apos;t know my ratios yet</p>
            </Button>
            <Button
              variant="outline"
              className="min-h-12 h-auto w-full justify-start py-3 text-left"
              onClick={() => setMode("refine")}
              data-testid="button-adviser-have-ratios"
            >
              <p className="font-medium text-sm">I have ratios — check a meal</p>
            </Button>
          </div>
          ) : null}
        </CardContent>
      </Card>
      </RatioAdviserShell>
    );
  }

  if (mode === "scratch_intro") {
    return (
      <RatioAdviserShell>
      <Card data-testid="card-ratio-adviser">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Estimate Your Starting Ratios</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-0.5">
            <p className="text-sm font-medium">How would you like to estimate?</p>
            <InlineInfoHint
              ariaLabel="What is a carb ratio"
              content="A carb ratio is how many grams of carbohydrate 1 unit of fast-acting insulin covers — for example 1:10 means 1 unit covers 10g of carbs."
            />
          </div>

          <div className="space-y-3">

            {minorKnown ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  The <strong>500 rule</strong> estimate is aimed at adults. Use ratios from your diabetes team and save
                  them in Settings, or use the starting-point option below and review with your team before relying on it.
                </AlertDescription>
              </Alert>
            ) : (
              <Button
                variant="outline"
                className="w-full h-auto py-3 justify-start text-left"
                onClick={() => setMode("scratch_tdd")}
                data-testid="button-estimate-from-tdd"
              >
                <div className="flex items-start gap-3">
                  <Calculator className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">I know my Total Daily Dose (TDD)</p>
                    <p className="text-xs text-muted-foreground">Estimate using the 500 rule</p>
                  </div>
                </div>
              </Button>
            )}

            <Button
              variant="outline"
              className="w-full h-auto py-3 justify-start text-left"
              onClick={handleUseDefaults}
              data-testid="button-use-defaults"
            >
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">I don't know my TDD</p>
                  <p className="text-xs text-muted-foreground">Use common starting points to adjust later</p>
                </div>
              </div>
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="min-h-11"
            onClick={() => setMode(hasAnyRatio ? "refine" : "detect")}
            data-testid="button-back-detect"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </CardContent>
      </Card>
      </RatioAdviserShell>
    );
  }

  if (mode === "scratch_tdd") {
    return (
      <RatioAdviserShell>
      <Card data-testid="card-ratio-adviser">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Calculate from Your TDD</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-0.5">
              <Label htmlFor="tdd-input">Total Daily Dose (units)</Label>
              <InlineInfoHint
                ariaLabel="What is TDD"
                content="Your total daily dose is all insulin in a typical day — fast-acting (bolus) and long-acting (basal) combined."
              />
            </div>
            <Input
              id="tdd-input"
              type="number"
              placeholder="e.g. 40"
              value={tddInput}
              onChange={(e) => setTddInput(e.target.value)}
              data-testid="input-tdd-estimate"
            />
            {tddInput && parseFloat(tddInput) > 0 && (
              <p className="text-xs text-muted-foreground">
                Using the 500 rule: 500 / {tddInput} = approximately {formatRatioForDisplay(Math.round((500 / parseFloat(tddInput)) * 10) / 10, ratioFormat, cpSize)} base ratio
              </p>
            )}
          </div>

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Uses the 500 rule (500 ÷ TDD).</span>
            <InlineInfoHint
              ariaLabel="About the 500 rule"
              content="The 500 rule estimates grams of carb per 1 unit as roughly 500 ÷ TDD. Some teams use 450 or 400. Breakfast is often a bit stronger; dinner sometimes slightly stronger than lunch. Starting points only."
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              className="min-h-11 w-full sm:w-auto"
              onClick={handleCalculateFromTDD}
              disabled={!tddInput || parseFloat(tddInput) <= 0}
              data-testid="button-calculate-ratios"
            >
              <Calculator className="h-4 w-4 mr-1" />
              Calculate My Ratios
            </Button>
            <Button variant="ghost" size="sm" className="min-h-11" onClick={() => setMode("scratch_intro")} data-testid="button-back-scratch-intro">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
        </CardContent>
      </Card>
      </RatioAdviserShell>
    );
  }

  if (mode === "scratch_result" && estimatedRatios) {
    return (
      <RatioAdviserShell>
      <Card data-testid="card-ratio-adviser">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Your Estimated Starting Ratios</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <MedicalNumericOutputDisclaimer compact />

          <div className="grid grid-cols-2 gap-3">
            {([
              { key: "breakfast" as const, label: "Breakfast", icon: Sun, note: "Often stronger due to dawn phenomenon" },
              { key: "lunch" as const, label: "Lunch", icon: Sunset, note: "Base ratio" },
              { key: "dinner" as const, label: "Dinner", icon: Moon, note: "Slightly stronger for most people" },
              { key: "snack" as const, label: "Snack", icon: Cookie, note: "Same as base ratio" },
            ]).map(({ key, label, icon: Icon, note }) => (
              <div key={key} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`estimate-${key}`} className="text-xs text-muted-foreground">
                    Grams carb per 1 unit (1:X g)
                  </Label>
                  <Input
                    id={`estimate-${key}`}
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min={1}
                    max={150}
                    className="h-9"
                    value={estimatedRatios[key]}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v)) {
                        setEstimatedRatios((prev) => (prev ? { ...prev, [key]: v } : prev));
                      }
                    }}
                    data-testid={`input-estimate-ratio-${key}`}
                  />
                </div>
                <p className="text-sm font-medium text-primary">{formatRatioForDisplay(estimatedRatios[key], ratioFormat, cpSize)}</p>
                <p className="text-xs text-muted-foreground">{note}</p>
              </div>
            ))}
          </div>

          {tddInput && parseFloat(tddInput) > 0 && (
            <p className="text-xs text-muted-foreground">
              Based on TDD of {tddInput} units using the 500 rule, with adjustments for meal timing.
            </p>
          )}
          {(!tddInput || parseFloat(tddInput) <= 0) && (
            <p className="text-xs text-muted-foreground">
              Based on common starting points for Type 1 diabetes. These are conservative estimates.
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button className="min-h-11 w-full sm:w-auto" onClick={handleSaveEstimatedRatios} data-testid="button-save-estimated-ratios">
              <Save className="h-4 w-4 mr-1" />
              Save These Ratios
            </Button>
            <Button variant="ghost" size="sm" className="min-h-11" onClick={() => setMode("scratch_intro")} data-testid="button-back-scratch-method">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Try a different method
            </Button>
          </div>
        </CardContent>
      </Card>
      </RatioAdviserShell>
    );
  }

  if (mode === "scratch_saved") {
    return (
      <RatioAdviserShell>
      <Card data-testid="card-ratio-adviser">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            <CardTitle className="text-base">Ratios Saved</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">Your estimated starting ratios have been saved.</p>
            <p className="text-sm text-muted-foreground">
              You can now use the Meal Planner to get dose suggestions. As you learn how your body responds, come back here to check whether your ratios need adjusting.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button className="min-h-11 w-full sm:w-auto" data-testid="button-try-meal-planner" onClick={() => onNavigateToMeal?.()}>
              <ArrowRight className="h-4 w-4 mr-1" />
              Try the Meal Planner
            </Button>
            <Button variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => { setMode("refine"); handleReset(); }} data-testid="button-check-ratios">
              <Calculator className="h-4 w-4 mr-1" />
              Check a ratio
            </Button>
          </div>
        </CardContent>
      </Card>
      </RatioAdviserShell>
    );
  }

  const units = bgUnit === "mg/dL" ? "mg/dL" : "mmol/L";
  const target = resolveUserTargetBgRange(settings, units);
  const roundIncrement = insulinRoundIncrement(isPumpDeliveryMethod(storage.getProfile()?.insulinDeliveryMethod));
  const selectedRatio = selectedMeal ? (settings[settingsRatioKey(selectedMeal)] as string | undefined) : undefined;
  const carbs = parseFloat(carbsInput.replace(",", "."));
  const bgNow = parseFloat(bgNowInput.replace(",", "."));
  const laterBg = parseFloat(laterBgInput.replace(",", "."));
  const check =
    selectedMeal && selectedRatio
      ? assessMealRatio({
          carbs,
          currentBg: bgNow,
          ratio: selectedRatio,
          correctionFactor: settings.correctionFactor,
          targetLow: target.low,
          targetHigh: target.high,
          bgUnits: units,
          roundIncrement,
        })
      : null;
  const verdict = Number.isFinite(laterBg) ? compareLaterBg(laterBg, target.low, target.high) : null;
  const step =
    check && (verdict === "high" || verdict === "low")
      ? illustrateRatioStep({
          gramsPerUnit: check.gramsPerUnit,
          direction: verdict === "high" ? "tighten" : "loosen",
          carbs,
          roundIncrement,
          ratioFormat,
          carbPortionSize: cpSize,
        })
      : null;

  const unitsLabel = (n: number) => `${formatInsulinUnits(n, roundIncrement)}u`;
  const exactLabel = (n: number) => {
    const rounded = Math.round(n * 10) / 10;
    return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)}u`;
  };

  const saveIllustratedRatio = () => {
    if (!selectedMeal || !step) return;
    const updated: UserSettings = {
      ...settings,
      [settingsRatioKey(selectedMeal)]: step.storageRatio,
    };
    storage.saveSettings(updated);
    onSettingsUpdate?.(updated);
    toast({
      title: "Ratio saved",
      description: `${mealLabel(selectedMeal)} is now ${step.ratioLabel}.`,
    });
  };

  return (
    <RatioAdviserShell>
      <Card data-testid="card-ratio-adviser">
        <CardHeader className="space-y-0 pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Calculator className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <CardTitle className="text-lg tracking-tight">Ratio Adviser</CardTitle>
            </div>
            <InlineInfoHint
              ariaLabel="About Ratio Adviser"
              content="Enter the carbs and glucose for one meal. This shows what your saved ratio does, and what one small step would change. It does not change a ratio unless you save it."
            />
          </div>
          <p className="pt-2 text-sm text-muted-foreground">
            See what this meal&apos;s ratio does, then compare it with the reading about 2 hours later.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {ratiosEditOpen ? (
            <RatiosEditPanel
              settings={settings}
              bgUnit={bgUnit}
              ratioFormat={ratioFormat}
              carbPortionSize={cpSize}
              onSaved={handleRatiosSaved}
              onCancel={() => setRatiosEditOpen(false)}
              idPrefix="ratio-adviser-edit"
            />
          ) : (
            <Button
              type="button"
              className="min-h-12 w-full rounded-xl text-base font-semibold shadow-sm"
              onClick={() => setRatiosEditOpen(true)}
              data-testid="button-open-ratio-edit"
            >
              <Pencil className="mr-2 h-4 w-4" aria-hidden />
              Edit ratios &amp; targets
            </Button>
          )}

          {!ratiosEditOpen ? (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium">Which meal?</p>
                <div className="grid grid-cols-2 gap-2">
                  {mealOptions.map(({ key, label, icon: Icon, ratio }) => {
                    const selected = selectedMeal === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        className={cn(
                          "flex min-h-[4.25rem] flex-col items-start justify-center gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-all",
                          selected
                            ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/30"
                            : "border-border/70 bg-muted/20 text-muted-foreground hover:border-border hover:bg-muted/40",
                        )}
                        onClick={() => setSelectedMeal(key)}
                        data-testid={`button-adviser-meal-${key}`}
                      >
                        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <Icon className="h-4 w-4 shrink-0" aria-hidden />
                          {label}
                        </span>
                        <span className="text-base font-bold tabular-nums tracking-tight text-foreground">
                          {ratio ?? "Not set"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  ISF{" "}
                  <span className="font-medium text-foreground">
                    {settings.correctionFactor != null ? `${settings.correctionFactor} ${units}` : "not set"}
                  </span>
                  {" · "}
                  Target <span className="font-medium text-foreground">{formatTargetBgRangeLabel(settings, units)}</span>
                </p>
              </div>

              {selectedMeal && !selectedRatio ? (
                <p className="text-sm text-muted-foreground" data-testid="adviser-missing-ratio">
                  No ratio saved for {mealLabel(selectedMeal).toLowerCase()} yet. Use Edit ratios &amp; targets above.
                </p>
              ) : null}

              {selectedMeal && selectedRatio ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="min-w-0 space-y-1.5">
                      <Label htmlFor="ratio-check-carbs" className="text-xs font-medium text-muted-foreground">
                        Carbs (g)
                      </Label>
                      <Input
                        id="ratio-check-carbs"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="1"
                        placeholder="e.g. 40"
                        className="h-11 rounded-xl"
                        value={carbsInput}
                        onChange={(e) => setCarbsInput(e.target.value)}
                        data-testid="input-ratio-check-carbs"
                      />
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <Label htmlFor="ratio-check-bg" className="text-xs font-medium text-muted-foreground">
                        BG now ({units})
                      </Label>
                      <Input
                        id="ratio-check-bg"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={units === "mmol/L" ? "0.1" : "1"}
                        placeholder={units === "mmol/L" ? "e.g. 8.2" : "e.g. 148"}
                        className="h-11 w-full min-w-0 rounded-xl"
                        value={bgNowInput}
                        onChange={(e) => setBgNowInput(e.target.value)}
                        data-testid="input-ratio-check-bg"
                      />
                    </div>
                  </div>

                  {check ? (
                    <div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 px-3.5 py-3" data-testid="ratio-check-result">
                      <p className="text-sm">
                        <span className="text-muted-foreground">Carb bolus </span>
                        <span className="font-semibold tabular-nums">{exactLabel(check.carbBolusExact)}</span>
                        <span className="text-muted-foreground"> from {formatStoredRatio(selectedRatio)}</span>
                      </p>
                      <p className="text-sm">
                        <span className="text-muted-foreground">Correction </span>
                        <span className="font-semibold tabular-nums">
                          {Math.abs(check.correctionExact) < 0.05
                            ? "none"
                            : `${check.correctionExact > 0 ? "+" : "−"}${exactLabel(Math.abs(check.correctionExact)).replace(/u$/, "")}u`}
                        </span>
                        <span className="text-muted-foreground">
                          {settings.correctionFactor == null
                            ? " — set an ISF to include one"
                            : Math.abs(check.correctionExact) < 0.05
                              ? " — glucose is inside your target"
                              : check.correctionExact > 0
                                ? " — glucose is above your target"
                                : " — glucose is below your target"}
                        </span>
                      </p>
                      <p className="text-sm">
                        <span className="text-muted-foreground">Rounded total </span>
                        <span className="text-lg font-semibold tabular-nums" data-testid="text-ratio-check-total">
                          {unitsLabel(check.totalRounded)}
                        </span>
                        {Math.abs(check.totalRounded - check.totalExact) >= 0.05 ? (
                          <span className="text-xs text-muted-foreground"> (exact {exactLabel(check.totalExact)})</span>
                        ) : null}
                      </p>
                      {check.expectedLanding != null ? (
                        <p className="text-sm text-muted-foreground" data-testid="text-ratio-check-landing">
                          With this dose, glucose would be expected around{" "}
                          <span className="font-semibold text-foreground">
                            {formatTargetBgInput(check.expectedLanding, units)} {units}
                          </span>
                          .
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground" data-testid="text-ratio-check-landing">
                          Add an ISF under Edit ratios to see where this dose would land.
                        </p>
                      )}
                    </div>
                  ) : null}

                  <div className="space-y-1.5">
                    <Label htmlFor="ratio-check-later" className="text-xs font-medium text-muted-foreground">
                      BG about 2 hours later ({units})
                    </Label>
                    <Input
                      id="ratio-check-later"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={units === "mmol/L" ? "0.1" : "1"}
                      placeholder={units === "mmol/L" ? "e.g. 9.4" : "e.g. 170"}
                      className="h-11 rounded-xl"
                      value={laterBgInput}
                      onChange={(e) => setLaterBgInput(e.target.value)}
                      data-testid="input-ratio-check-later"
                    />
                  </div>

                  {verdict === "held" ? (
                    <p className="text-sm font-medium" data-testid="text-ratio-check-verdict">
                      This ratio held for this meal. The 2-hour reading is inside your target.
                    </p>
                  ) : null}

                  {verdict === "high" || verdict === "low" ? (
                    <div className="space-y-3 rounded-xl border border-border/70 px-3.5 py-3" data-testid="text-ratio-check-verdict">
                      <p className="text-sm font-medium">
                        {verdict === "high"
                          ? "Above your target. The ratio may be too weak — one unit is covering too many grams."
                          : "Below your target. The ratio may be too strong — one unit is covering too few grams."}
                      </p>
                      {check && step ? (
                        <div className="space-y-2 text-sm">
                          <p className="text-muted-foreground">
                            Now{" "}
                            <span className="font-semibold text-foreground">{formatStoredRatio(selectedRatio)}</span>
                            {" · "}
                            <span className="font-semibold tabular-nums text-foreground">
                              {unitsLabel(step.currentCarbBolusRounded)}
                            </span>{" "}
                            for {carbs}g
                          </p>
                          <p>
                            One step {verdict === "high" ? "tighter" : "looser"}{" "}
                            <span className="font-semibold">
                              {step.ratioLabel}
                              {step.ratioLabel !== `${step.storageRatio}g` ? ` · ${step.storageRatio}` : ""}
                            </span>
                            {" · "}
                            <span className="font-semibold tabular-nums">{unitsLabel(step.carbBolusRounded)}</span> for the
                            same carbs
                          </p>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            An illustration for you and your team, not a dose order. Fat, protein, illness, and activity
                            can move the landing too.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-11 w-full rounded-xl"
                            onClick={saveIllustratedRatio}
                            data-testid="button-save-ratio-step"
                          >
                            <Save className="mr-2 h-4 w-4" aria-hidden />
                            Save this ratio
                          </Button>
                        </div>
                      ) : check ? (
                        <p className="text-xs text-muted-foreground">
                          This ratio is already at the edge of a small step. Fat, protein, illness, and activity can move
                          the landing too.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>
    </RatioAdviserShell>
  );
}
