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
  Search,
  CheckCircle2,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  Sparkles,
  Calculator,
  ArrowRight,
  Save,
  Copy,
  ChevronDown,
  BookOpen,
  Pencil,
} from "lucide-react";
import { Link } from "wouter";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { storage, UserSettings, RatioFormat, DIABEATER_PROFILE_CHANGED_EVENT } from "@/lib/storage";
import { ageInWholeYearsUtc } from "@/lib/user-age";
import { getEffectiveTdd } from "@/lib/tdd";
import {
  formatRatioForStorage,
  formatRatioForDisplay,
  parseRatioToGramsPerUnit,
  calculateDoseFromCarbs,
} from "@/lib/ratio-utils";
import { STARTER_ICR_GRAMS_PER_UNIT } from "@/lib/starter-ratios";
import { MedicalNumericOutputDisclaimer } from "@/components/medical-numeric-output-disclaimer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InlineInfoHint } from "@/components/ui/field-label-with-info";
import { MedicalSourcesLink } from "@/components/medical-sources-link";
import { RatiosEditPanel } from "@/components/ratios-edit-panel";
import { insulinRoundIncrement, roundInsulinUnits } from "@/lib/insulin-rounding";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { cn } from "@/lib/utils";

type MealKey = "breakfast" | "lunch" | "dinner" | "snack";
type PatternAnswer = "consistently_high" | "consistently_low" | "sometimes_high" | "on_target" | "not_sure";
type TimingAnswer = "2_hours" | "3_4_hours" | "varies" | "not_sure";
type FrequencyAnswer = "most_days" | "few_days" | "rarely" | "not_sure";

interface AdviserResult {
  summary: string;
  direction: "tighten" | "loosen" | "monitor" | "on_track";
  detail: string;
  talkingPoints: string[];
}

function getAdviserResult(
  meal: MealKey,
  pattern: PatternAnswer,
  timing: TimingAnswer,
  frequency: FrequencyAnswer,
  currentRatio: string | undefined,
): AdviserResult {
  const mealLabel = meal.charAt(0).toUpperCase() + meal.slice(1);
  const ratioText = currentRatio ? ` (currently ${currentRatio})` : "";

  if (pattern === "on_target") {
    return {
      summary: `Your ${mealLabel} ratio looks good`,
      direction: "on_track",
      detail: `Your blood sugars after ${mealLabel.toLowerCase()} are generally on target. Your current ratio${ratioText} appears to be working well for you right now.`,
      talkingPoints: [
        `${mealLabel} ratio seems well-matched to your current needs`,
        "Continue monitoring \u2014 ratios can shift over time",
        "Seasonal changes, stress, or activity levels may affect this",
      ],
    };
  }

  if (pattern === "not_sure") {
    return {
      summary: `More data needed for ${mealLabel}`,
      direction: "monitor",
      detail: `To assess your ${mealLabel.toLowerCase()} ratio, try checking your blood sugar about 2-3 hours after eating for the next few days. Write down what you ate (especially the carbs) and your reading.`,
      talkingPoints: [
        `Try checking BG 2-3 hours after ${mealLabel.toLowerCase()} for a week`,
        "Note the carbs in each meal alongside your readings",
        "Look for patterns \u2014 are readings mostly above, below, or within your target?",
      ],
    };
  }

  if (pattern === "consistently_high") {
    const isStrong = frequency === "most_days";
    const confidence = isStrong ? "strong" : frequency === "few_days" ? "possible" : "weak";

    return {
      summary: `Your ${mealLabel} ratio may need tightening`,
      direction: "tighten",
      detail: isStrong
        ? `You're running high after ${mealLabel.toLowerCase()} on most days${ratioText}. This is a ${confidence} pattern that suggests your current ratio may not be covering your carbs fully. Your diabetes team can help you decide whether an adjustment is appropriate.`
        : `You're sometimes high after ${mealLabel.toLowerCase()}${ratioText}. This could be a ratio issue, but it could also be due to food choices, portion estimation, timing, or other factors. Worth monitoring more closely before drawing conclusions.`,
      talkingPoints: [
        `Consistently high after ${mealLabel.toLowerCase()}${frequency === "most_days" ? " on most days" : ""}`,
        timing === "2_hours"
          ? "High readings at 2 hours suggest the ratio itself may be the issue"
          : timing === "3_4_hours"
          ? "High readings at 3-4 hours could also involve delayed digestion or high-fat meals"
          : "Timing of highs varies \u2014 worth tracking more precisely",
        `Current ratio${ratioText} \u2014 your diabetes team can advise whether this needs changing`,
        isStrong ? "Persistent highs after meals should be discussed with your diabetes team soon" : "Monitor for another week to confirm the pattern before making changes",
      ],
    };
  }

  if (pattern === "consistently_low") {
    const isStrong = frequency === "most_days";

    return {
      summary: `Your ${mealLabel} ratio may need loosening`,
      direction: "loosen",
      detail: isStrong
        ? `You're dropping low after ${mealLabel.toLowerCase()} on most days${ratioText}. This pattern suggests your current ratio may be giving you more insulin than you need for the carbs you're eating. Contact your diabetes team to discuss \u2014 frequent hypos after meals are important to address.`
        : `You're sometimes going low after ${mealLabel.toLowerCase()}${ratioText}. This could be a ratio issue, or it might be related to activity levels, meal timing, or portion sizes. Worth keeping a closer eye on before drawing conclusions.`,
      talkingPoints: [
        `Going low after ${mealLabel.toLowerCase()}${frequency === "most_days" ? " on most days" : ""}`,
        timing === "2_hours"
          ? "Lows at 2 hours suggest the ratio may be too strong for the carbs consumed"
          : "Consider whether activity or meal timing might also be contributing",
        `Current ratio${ratioText} \u2014 discuss with your diabetes team whether adjustment is needed`,
        isStrong ? "Frequent post-meal hypos should be discussed with your diabetes team promptly" : "Track your readings for another week to see if the pattern continues",
      ],
    };
  }

  return {
    summary: `${meal.charAt(0).toUpperCase() + meal.slice(1)} pattern is variable`,
    direction: "monitor",
    detail: `Your post-${meal.toLowerCase()} readings are sometimes high${ratioText}. Variable patterns can be harder to pin down \u2014 it might be the ratio, but it could also be affected by the type of food, portion estimation, activity, or stress.`,
    talkingPoints: [
      `Post-${meal.toLowerCase()} readings are inconsistent`,
      "Try eating a similar, measured meal for a few days to isolate the ratio",
      "Variable patterns might point to food type (high fat/protein) rather than ratio",
      "Keep a brief food + BG diary for 5-7 days to spot trends",
    ],
  };
}

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
              This tool helps you spot patterns and prepare for clinic — it does not prescribe ratio changes. Always
              confirm adjustments with your diabetes team.
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
  const [step, setStep] = useState(0);
  const [selectedMeal, setSelectedMeal] = useState<MealKey | null>(null);
  const [pattern, setPattern] = useState<PatternAnswer | null>(null);
  const [timing, setTiming] = useState<TimingAnswer | null>(null);
  const [frequency, setFrequency] = useState<FrequencyAnswer | null>(null);
  const [result, setResult] = useState<AdviserResult | null>(null);

  const [tddInput, setTddInput] = useState(() => {
    const effective = getEffectiveTdd(settings);
    return effective ? effective.toString() : "";
  });
  const [estimatedRatios, setEstimatedRatios] = useState<{ breakfast: number; lunch: number; dinner: number; snack: number } | null>(null);

  const [ratioFormat, setRatioFormat] = useState<RatioFormat>("per10g");
  const [cpSize, setCpSize] = useState<number | undefined>(undefined);

  const [previewMeal, setPreviewMeal] = useState<MealKey>("lunch");
  const [previewCarbs, setPreviewCarbs] = useState("");
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
    if (step !== 0) setRatiosEditOpen(false);
  }, [step]);

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
    setStep(0);
    setSelectedMeal(null);
    setPattern(null);
    setTiming(null);
    setFrequency(null);
    setResult(null);
  };

  const handleSelectMeal = (meal: MealKey) => {
    setSelectedMeal(meal);
    setPreviewMeal(meal);
    setStep(1);
  };

  const handleSelectPattern = (p: PatternAnswer) => {
    setPattern(p);
    if (p === "on_target" || p === "not_sure") {
      const currentRatio = selectedMeal ? formatStoredRatio(settings[`${selectedMeal}Ratio` as keyof UserSettings] as string | undefined) : undefined;
      setResult(getAdviserResult(selectedMeal!, p, "not_sure", "not_sure", currentRatio));
      setStep(4);
    } else {
      setStep(2);
    }
  };

  const handleSelectTiming = (t: TimingAnswer) => {
    setTiming(t);
    setStep(3);
  };

  const handleSelectFrequency = (f: FrequencyAnswer) => {
    setFrequency(f);
    const currentRatio = selectedMeal ? formatStoredRatio(settings[`${selectedMeal}Ratio` as keyof UserSettings] as string | undefined) : undefined;
    setResult(getAdviserResult(selectedMeal!, pattern!, timing!, f, currentRatio));
    setStep(4);
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

  const copyAssessmentToClipboard = async () => {
    if (!result || !selectedMeal) return;
    const meal = mealLabel(selectedMeal);
    const lines = [
      `Diabeaters Ratio Adviser — ${meal}`,
      "",
      result.summary,
      "",
      result.detail,
      "",
      "Talking points for my diabetes team:",
      ...result.talkingPoints.map((p) => `• ${p}`),
      "",
      "Not medical advice — for discussion with my care team only.",
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast({ title: "Copied", description: "You can paste this into notes or take it to your clinic." });
    } catch {
      toast({ title: "Could not copy", description: "Try selecting the text manually.", variant: "destructive" });
    }
  };

  const previewRatioStr = settings[settingsRatioKey(previewMeal)] as string | undefined;
  const previewCarbsNum = parseFloat(previewCarbs);
  const previewExact =
    Number.isFinite(previewCarbsNum) && previewCarbsNum > 0 ? calculateDoseFromCarbs(previewCarbsNum, previewRatioStr) : 0;
  const previewRounded = previewExact > 0 ? roundInsulinUnits(previewExact, insulinRoundIncrement(isPumpDeliveryMethod(storage.getProfile()?.insulinDeliveryMethod))) : 0;
  const previewHasRatio = !!previewRatioStr && parseRatioToGramsPerUnit(previewRatioStr);

  const stepLabels = ["Select meal", "Post-meal pattern", "When does it happen?", "How often?", "Assessment"];

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
              <p className="font-medium text-sm">I have ratios — check a pattern</p>
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
              <Search className="h-4 w-4 mr-1" />
              Check a ratio
            </Button>
          </div>
        </CardContent>
      </Card>
      </RatioAdviserShell>
    );
  }

  return (
    <RatioAdviserShell>
    <Card data-testid="card-ratio-adviser">
      <CardHeader className="space-y-0 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Search className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <CardTitle className="text-lg tracking-tight">Ratio Adviser</CardTitle>
          </div>
          <InlineInfoHint
            ariaLabel="About Ratio Adviser"
            content="Answer a few questions about post-meal blood sugars to spot patterns and prepare talking points for your clinic. This does not prescribe ratio changes."
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
          {step >= 1 && step < 4 && selectedMeal && (
            <div
              className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border bg-muted/30 px-3 py-2 text-sm"
              data-testid="adviser-wizard-meal-context"
            >
              <span className="font-medium text-foreground">{mealLabel(selectedMeal)}</span>
              <span className="text-muted-foreground hidden sm:inline">·</span>
              <span className="text-muted-foreground">
                Saved ratio:{" "}
                <strong className="text-foreground tabular-nums">
                  {formatStoredRatio(settings[settingsRatioKey(selectedMeal)] as string | undefined) ?? "Not set"}
                </strong>
              </span>
            </div>
          )}

          {step > 0 && step < 4 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {stepLabels.map((label, i) => (
                <span key={i} className={`${i === step ? "font-medium text-foreground" : ""} ${i > step ? "hidden sm:inline" : ""}`}>
                  {i > 0 && i <= step && <span className="mx-1">&rsaquo;</span>}
                  {i <= step && label}
                </span>
              ))}
            </div>
          )}

          {step === 0 && (
            <>
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

              {!ratiosEditOpen && hasAnyRatio && (
                <div
                  className="space-y-3 rounded-xl border border-primary/25 bg-primary/[0.04] p-3 dark:bg-primary/10 sm:p-4"
                  data-testid="adviser-saved-ratios-strip"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your saved ratios</p>
                  <div className="grid grid-cols-2 gap-2">
                    {mealOptions.map(({ key, label, icon: Icon, ratio }) => (
                      <div
                        key={key}
                        className="rounded-lg border border-border/80 bg-background/60 px-2 py-2 dark:bg-background/40"
                      >
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                          <span className="font-medium text-foreground/90">{label}</span>
                        </div>
                        <p className="mt-0.5 text-lg font-bold tabular-nums tracking-tight" data-testid={`adviser-strip-ratio-${key}`}>
                          {ratio ?? "Not set"}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border/60 pt-2 text-sm">
                    <span>
                      <span className="text-muted-foreground">ISF </span>
                      <span className="font-semibold tabular-nums">
                        {settings.correctionFactor != null
                          ? `${settings.correctionFactor} ${bgUnit}`
                          : <span className="font-normal italic text-muted-foreground">Not set</span>}
                      </span>
                    </span>
                    <span>
                      <span className="text-muted-foreground">Target </span>
                      <span className="font-semibold tabular-nums">
                        {settings.targetBgLow != null && settings.targetBgHigh != null
                          ? `${settings.targetBgLow}–${settings.targetBgHigh} ${bgUnit}`
                          : <span className="font-normal italic text-muted-foreground">Not set</span>}
                      </span>
                    </span>
                  </div>
                </div>
              )}

              {!ratiosEditOpen ? (
              <>
              <div className="space-y-2">
                <p className="text-sm font-medium">Which meal do you want to check?</p>
                <div className="grid grid-cols-2 gap-2">
                  {mealOptions.map(({ key, label, icon: Icon, ratio }) => (
                    <Button
                      key={key}
                      variant="outline"
                      className="min-h-[4.25rem] h-auto flex-col items-stretch justify-start gap-2 py-3 text-left"
                      onClick={() => handleSelectMeal(key)}
                      data-testid={`button-adviser-meal-${key}`}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="font-medium">{label}</span>
                      </div>
                      {ratio ? (
                        <span className="text-base font-bold tabular-nums tracking-tight text-foreground w-full" data-testid={`adviser-meal-button-ratio-${key}`}>
                          {ratio}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not set</span>
                      )}
                    </Button>
                  ))}
                </div>
              </div>

              {hasAnyRatio && (
                <Collapsible defaultOpen={false} className="rounded-xl border border-border/80 bg-muted/15">
                  <CollapsibleTrigger
                    className="group flex w-full min-h-11 items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
                    data-testid="adviser-quick-bolus-preview-trigger"
                  >
                    <span className="flex items-center gap-2">
                      <Calculator className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                      Quick carb bolus preview
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" aria-hidden />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 border-t border-border/60 px-3 pb-3 pt-2" data-testid="adviser-quick-bolus-preview">
                    <div className="flex items-start gap-0.5">
                      <p className="flex-1 text-xs text-muted-foreground">Carb-only estimate from your saved meal ratio.</p>
                      <InlineInfoHint
                        ariaLabel="About bolus preview"
                        content="Uses only your meal ratio and carb grams — no correction for high BG, no IOB, no fat/protein bolus. Your team may use different rules."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {mealOptions.map(({ key, label, icon: Icon }) => (
                        <Button
                          key={key}
                          type="button"
                          size="sm"
                          variant={previewMeal === key ? "default" : "outline"}
                          className="min-h-11 h-auto justify-start gap-2 py-2"
                          onClick={() => setPreviewMeal(key)}
                        >
                          <Icon className="h-4 w-4 shrink-0" aria-hidden />
                          {label}
                        </Button>
                      ))}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="preview-carbs">Carbs for this meal (g)</Label>
                      <Input
                        id="preview-carbs"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="1"
                        placeholder="e.g. 45"
                        className="h-11 text-base"
                        value={previewCarbs}
                        onChange={(e) => setPreviewCarbs(e.target.value)}
                        data-testid="input-ratio-preview-carbs"
                      />
                    </div>
                    {previewCarbsNum > 0 && (
                      <div className="space-y-1 rounded-md bg-muted/40 p-3 text-sm">
                        {!previewHasRatio ? (
                          <p className="text-muted-foreground">
                            No ratio saved for {mealLabel(previewMeal).toLowerCase()} yet. Use{" "}
                            <span className="font-medium text-foreground">Edit ratios &amp; targets</span> above.
                          </p>
                        ) : (
                          <>
                            <p>
                              <span className="text-muted-foreground">Carb bolus estimate:</span>{" "}
                              <span className="text-lg font-semibold tabular-nums">{previewRounded} units</span>
                              {Math.abs(previewRounded - previewExact) >= 0.05 && (
                                <span className="text-xs text-muted-foreground">
                                  {" "}
                                  (exact {previewExact.toFixed(2)}u)
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Ratio: {formatStoredRatio(previewRatioStr)}
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {!hasAnyRatio && (
                <Button
                  variant="outline"
                  className="min-h-11 w-full justify-start gap-2"
                  onClick={() => setMode("scratch_intro")}
                  data-testid="button-open-estimate-flow"
                >
                  <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
                  Estimate starting ratios
                </Button>
              )}
              </>
              ) : null}
            </>
          )}

          {step === 1 && selectedMeal && (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                After {mealLabel(selectedMeal).toLowerCase()}, where do your blood sugars tend to end up?
              </p>
              <div className="space-y-2">
                {([
                  { value: "consistently_high" as const, label: "Consistently too high", desc: `Above my target range (>${settings.targetBgHigh || "8"} ${bgUnit})` },
                  { value: "consistently_low" as const, label: "Consistently too low", desc: `Below my target range (<${settings.targetBgLow || "4"} ${bgUnit})` },
                  { value: "sometimes_high" as const, label: "Sometimes high, sometimes OK", desc: "It varies from day to day" },
                  { value: "on_target" as const, label: "Usually on target", desc: "Within my target range most of the time" },
                  { value: "not_sure" as const, label: "I'm not sure", desc: "I haven't been checking regularly" },
                ]).map(opt => (
                  <Button
                    key={opt.value}
                    variant="outline"
                    className="w-full h-auto py-3 justify-start text-left"
                    onClick={() => handleSelectPattern(opt.value)}
                    data-testid={`button-pattern-${opt.value}`}
                  >
                    <div>
                      <p className="font-medium text-sm">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                  </Button>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setStep(0); setSelectedMeal(null); }} data-testid="button-adviser-back-meal">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                When do you notice the {pattern === "consistently_high" ? "high" : pattern === "consistently_low" ? "low" : "unusual"} readings?
              </p>
              <div className="space-y-2">
                {([
                  { value: "2_hours" as const, label: "About 2 hours after eating", desc: "The peak of fast-acting insulin" },
                  { value: "3_4_hours" as const, label: "3-4 hours after eating", desc: "When insulin is wearing off" },
                  { value: "varies" as const, label: "It varies", desc: "No consistent timing" },
                  { value: "not_sure" as const, label: "I'm not sure", desc: "I don't always check at the same time" },
                ]).map(opt => (
                  <Button
                    key={opt.value}
                    variant="outline"
                    className="w-full h-auto py-3 justify-start text-left"
                    onClick={() => handleSelectTiming(opt.value)}
                    data-testid={`button-timing-${opt.value}`}
                  >
                    <div>
                      <p className="font-medium text-sm">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                  </Button>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setStep(1); setPattern(null); }} data-testid="button-adviser-back-pattern">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">How often does this happen?</p>
              <div className="space-y-2">
                {([
                  { value: "most_days" as const, label: "Most days", desc: "4+ days a week" },
                  { value: "few_days" as const, label: "A few days a week", desc: "2-3 days a week" },
                  { value: "rarely" as const, label: "Occasionally", desc: "Once a week or less" },
                  { value: "not_sure" as const, label: "I'm not sure", desc: "I haven't tracked it closely" },
                ]).map(opt => (
                  <Button
                    key={opt.value}
                    variant="outline"
                    className="w-full h-auto py-3 justify-start text-left"
                    onClick={() => handleSelectFrequency(opt.value)}
                    data-testid={`button-frequency-${opt.value}`}
                  >
                    <div>
                      <p className="font-medium text-sm">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                  </Button>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setStep(2); setTiming(null); }} data-testid="button-adviser-back-timing">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </div>
          )}

          {step === 4 && result && (
            <div className="space-y-4">
              {(() => {
                const accent =
                  result.direction === "tighten"
                    ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20"
                    : result.direction === "loosen"
                      ? "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20"
                      : result.direction === "on_track"
                        ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20"
                        : "border-border bg-muted/20";
                const Icon =
                  result.direction === "tighten"
                    ? TrendingDown
                    : result.direction === "loosen"
                      ? TrendingUp
                      : result.direction === "on_track"
                        ? CheckCircle2
                        : Search;
                const iconClass =
                  result.direction === "tighten"
                    ? "text-amber-600 dark:text-amber-400"
                    : result.direction === "loosen"
                      ? "text-blue-600 dark:text-blue-400"
                      : result.direction === "on_track"
                        ? "text-green-600 dark:text-green-400"
                        : "text-muted-foreground";

                const sentences = result.detail
                  .split(/(?<=[.!?])\s+/)
                  .map((s) => s.trim())
                  .filter(Boolean);
                const shortDetail = sentences.slice(0, 2).join(" ");
                const remainingDetail = sentences.slice(2).join(" ");

                const nextSteps: string[] =
                  result.direction === "monitor"
                    ? [
                        "Check 2–3 hours after this meal for 5–7 days",
                        "Write down the carbs (and any high-fat/high-protein meals)",
                        "Note insulin timing (before/after eating) and activity",
                      ]
                    : result.direction === "on_track"
                      ? [
                          "Keep an eye on it — needs can change with stress, illness, activity, and seasons",
                          "If you start seeing a new pattern, re-run this tool for that meal",
                        ]
                      : [
                          "Track 3–5 examples of this meal with carbs + timing + BG at 2h and 4h",
                          "Bring the pattern to your diabetes team before changing ratios",
                          "If you’re having frequent hypos, treat per your plan and contact your team promptly",
                        ];

                return (
                  <>
                    <div className={`rounded-xl border p-4 space-y-3 ${accent}`}>
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">
                          <Icon className={`h-5 w-5 ${iconClass}`} aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold leading-snug">{result.summary}</h4>
                          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{shortDetail}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={copyAssessmentToClipboard}
                          data-testid="button-copy-ratio-assessment"
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleReset} data-testid="button-adviser-start-over">
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Another meal
                        </Button>
                        <Button variant="outline" size="sm" asChild data-testid="link-assessment-to-ratios">
                          <Link href="/settings/ratios">Ratios</Link>
                        </Button>
                        {onNavigateToMeal && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onNavigateToMeal()}
                            data-testid="button-assessment-meal-planner"
                          >
                            <ArrowRight className="h-4 w-4 mr-1" />
                            Meal planner
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                        <p className="text-sm font-semibold">What to do next</p>
                        <ul className="mt-2 space-y-2">
                          {nextSteps.map((s, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/70 shrink-0" />
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                        <p className="text-sm font-semibold">Talking points for your diabetes team</p>
                        <ul className="mt-2 space-y-2">
                          {result.talkingPoints.map((point, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <Collapsible className="border rounded-xl px-3 py-2">
                      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 text-sm font-semibold py-2 hover:opacity-90">
                        <span className="flex items-center gap-2 text-left">
                          <BookOpen className="h-4 w-4 shrink-0 text-primary" />
                          Details (why this is the suggestion)
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2 pb-3 text-xs text-muted-foreground leading-relaxed">
                        <p>{result.detail}</p>
                        {remainingDetail ? null : null}
                      </CollapsibleContent>
                    </Collapsible>
                  </>
                );
              })()}

              {(result.direction === "tighten" || result.direction === "loosen") && (
                <Collapsible className="border rounded-lg px-3 py-2">
                  <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 text-sm font-medium py-2 hover:opacity-90">
                    <span className="flex items-center gap-2 text-left">
                      <BookOpen className="h-4 w-4 shrink-0 text-primary" />
                      How teams often approach ratio changes
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pb-3 text-xs text-muted-foreground leading-relaxed">
                    <p>
                      Many clinics change carb ratios in <strong>small steps</strong> (often around 10–20% at a time), then
                      review glucose data for several days before the next tweak. They also rule out carb counting,
                      timing, illness, stress, and activity before blaming the ratio alone.
                    </p>
                    <p>
                      <strong>Do not change ratios on your own</strong> unless your team has given you a clear plan for
                      self-adjustment. This app does not calculate a new ratio for you.
                    </p>
                  </CollapsibleContent>
                </Collapsible>
              )}

            </div>
          )}
        </CardContent>
    </Card>
    </RatioAdviserShell>
  );
}
