import { useState, useEffect } from "react";
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
} from "lucide-react";
import { storage, UserSettings, RatioFormat } from "@/lib/storage";
import { formatRatioForStorage, formatRatioForDisplay, parseRatioToGramsPerUnit } from "@/lib/ratio-utils";

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

interface RatioAdviserProps {
  settings: UserSettings;
  bgUnit: string;
  onSettingsUpdate?: (settings: UserSettings) => void;
  onNavigateToMeal?: () => void;
}

type AdviserMode = "detect" | "refine" | "scratch_intro" | "scratch_tdd" | "scratch_result" | "scratch_saved";

export function RatioAdviserTool({ settings, bgUnit, onSettingsUpdate, onNavigateToMeal }: RatioAdviserProps) {
  const hasAnyRatio = !!(settings.breakfastRatio || settings.lunchRatio || settings.dinnerRatio || settings.snackRatio);

  const [mode, setMode] = useState<AdviserMode>(hasAnyRatio ? "refine" : "detect");
  const [step, setStep] = useState(0);
  const [selectedMeal, setSelectedMeal] = useState<MealKey | null>(null);
  const [pattern, setPattern] = useState<PatternAnswer | null>(null);
  const [timing, setTiming] = useState<TimingAnswer | null>(null);
  const [frequency, setFrequency] = useState<FrequencyAnswer | null>(null);
  const [result, setResult] = useState<AdviserResult | null>(null);

  const [tddInput, setTddInput] = useState(settings.tdd ? settings.tdd.toString() : "");
  const [estimatedRatios, setEstimatedRatios] = useState<{ breakfast: number; lunch: number; dinner: number; snack: number } | null>(null);

  const [ratioFormat, setRatioFormat] = useState<RatioFormat>("per10g");
  const [cpSize, setCpSize] = useState<number | undefined>(undefined);

  useEffect(() => {
    const profile = storage.getProfile();
    if (profile?.ratioFormat) {
      setRatioFormat(profile.ratioFormat);
    }
    setCpSize(profile?.carbPortionSize);
  }, []);

  useEffect(() => {
    const ratiosExist = !!(settings.breakfastRatio || settings.lunchRatio || settings.dinnerRatio || settings.snackRatio);
    if (ratiosExist && (mode === "detect")) {
      setMode("refine");
    } else if (!ratiosExist && mode === "refine") {
      setMode("detect");
    }
    if (settings.tdd && !tddInput) {
      setTddInput(settings.tdd.toString());
    }
  }, [settings]);

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
    setEstimatedRatios({ breakfast: 8, lunch: 10, dinner: 9, snack: 10 });
    setMode("scratch_result");
  };

  const handleSaveEstimatedRatios = () => {
    if (!estimatedRatios) return;

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

  const stepLabels = ["Select meal", "Post-meal pattern", "When does it happen?", "How often?", "Assessment"];

  if (mode === "detect") {
    return (
      <Card data-testid="card-ratio-adviser">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Ratio Adviser</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            It looks like you haven't set up your carb ratios yet. Would you like help working them out?
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/30 rounded-lg p-3 space-y-1">
            <p className="text-sm text-muted-foreground flex items-start gap-1">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span><strong>Not medical advice.</strong> This tool provides estimated starting points only. Always confirm any ratio changes with your diabetes team before using them.</span>
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">What describes you best?</p>
            <Button
              variant="outline"
              className="w-full h-auto py-3 justify-start text-left"
              onClick={() => setMode("scratch_intro")}
              data-testid="button-adviser-no-ratios"
            >
              <div>
                <p className="font-medium text-sm">I don't know my ratios yet</p>
                <p className="text-xs text-muted-foreground">Help me estimate starting ratios</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full h-auto py-3 justify-start text-left"
              onClick={() => setMode("refine")}
              data-testid="button-adviser-have-ratios"
            >
              <div>
                <p className="font-medium text-sm">I have ratios but haven't entered them</p>
                <p className="text-xs text-muted-foreground">I'll enter them in Settings, then come back to check if they need adjusting</p>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (mode === "scratch_intro") {
    return (
      <Card data-testid="card-ratio-adviser">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Estimate Your Starting Ratios</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">
              A <strong>carb ratio</strong> tells you how many grams of carbohydrate are covered by 1 unit of fast-acting insulin. For example, a ratio of 1:10 means 1 unit of insulin covers 10g of carbs.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">How would you like to estimate your ratios?</p>

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

          <Button variant="ghost" size="sm" onClick={() => setMode("detect")} data-testid="button-back-detect">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (mode === "scratch_tdd") {
    return (
      <Card data-testid="card-ratio-adviser">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Calculate from Your TDD</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">
              Your <strong>Total Daily Dose (TDD)</strong> is the total amount of insulin you take in a typical day, including both fast-acting (bolus) and long-acting (basal) insulin combined.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tdd-input">Total Daily Dose (units)</Label>
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

          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground flex items-start gap-1">
              <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
              <span>The 500 rule is a common starting-point formula. Breakfast ratios are often slightly stronger (more insulin per gram of carb) due to the dawn phenomenon. These are estimates only.</span>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={handleCalculateFromTDD}
              disabled={!tddInput || parseFloat(tddInput) <= 0}
              data-testid="button-calculate-ratios"
            >
              <Calculator className="h-4 w-4 mr-1" />
              Calculate My Ratios
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setMode("scratch_intro")} data-testid="button-back-scratch-intro">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (mode === "scratch_result" && estimatedRatios) {
    return (
      <Card data-testid="card-ratio-adviser">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Your Estimated Starting Ratios</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-sm text-muted-foreground flex items-start gap-1">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span><strong>These are estimated starting points only.</strong> Please discuss these with your diabetes team before relying on them. Your actual ratios may differ.</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {([
              { key: "breakfast" as const, label: "Breakfast", icon: Sun, note: "Often stronger due to dawn phenomenon" },
              { key: "lunch" as const, label: "Lunch", icon: Sunset, note: "Base ratio" },
              { key: "dinner" as const, label: "Dinner", icon: Moon, note: "Slightly stronger for most people" },
              { key: "snack" as const, label: "Snack", icon: Cookie, note: "Same as base ratio" },
            ]).map(({ key, label, icon: Icon, note }) => (
              <div key={key} className="border rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <p className="text-lg font-semibold text-primary">{formatRatioForDisplay(estimatedRatios[key], ratioFormat, cpSize)}</p>
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

          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={handleSaveEstimatedRatios} data-testid="button-save-estimated-ratios">
              <Save className="h-4 w-4 mr-1" />
              Save These Ratios
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setMode("scratch_intro")} data-testid="button-back-scratch-method">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Try a different method
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (mode === "scratch_saved") {
    return (
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

          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground flex items-start gap-1">
              <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
              <span>Remember: these are starting estimates. Always discuss ratio changes with your diabetes team. You can edit your ratios any time in the Ratios page or Settings.</span>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button data-testid="button-try-meal-planner" onClick={() => onNavigateToMeal?.()}>
              <ArrowRight className="h-4 w-4 mr-1" />
              Try the Meal Planner
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setMode("refine"); handleReset(); }} data-testid="button-check-ratios">
              <Search className="h-4 w-4 mr-1" />
              Check a ratio
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-ratio-adviser">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Ratio Adviser</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Wondering if a ratio needs adjusting? Answer a few questions to spot patterns.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
          <div className="bg-muted/30 rounded-lg p-3 space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span><strong>This tool does not give medical advice or prescribe ratio changes.</strong> It helps you recognise patterns in your blood sugars so you can have a more informed conversation with your diabetes team.</span>
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Answer a few questions about your post-meal blood sugars and we'll help you spot patterns
            and prepare talking points for your next clinic appointment.
          </p>

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
            <div className="space-y-2">
              <p className="text-sm font-medium">Which meal do you want to check?</p>
              <div className="grid grid-cols-2 gap-2">
                {mealOptions.map(({ key, label, icon: Icon, ratio }) => (
                  <Button
                    key={key}
                    variant="outline"
                    className="h-auto py-3 justify-start gap-2 flex-col items-start"
                    onClick={() => handleSelectMeal(key)}
                    data-testid={`button-adviser-meal-${key}`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </div>
                    {ratio && <span className="text-xs text-muted-foreground">Current: {ratio}</span>}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && selectedMeal && (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                After {selectedMeal}, where do your blood sugars tend to end up?
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
              <div className={`rounded-lg p-4 space-y-3 ${
                result.direction === "tighten"
                  ? "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800"
                  : result.direction === "loosen"
                  ? "bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800"
                  : result.direction === "on_track"
                  ? "bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800"
                  : "bg-muted/30 border"
              }`}>
                <div className="flex items-center gap-2">
                  {result.direction === "tighten" && <TrendingDown className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
                  {result.direction === "loosen" && <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
                  {result.direction === "on_track" && <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />}
                  {result.direction === "monitor" && <Search className="h-5 w-5 text-muted-foreground" />}
                  <h4 className="font-medium">{result.summary}</h4>
                </div>
                <p className="text-sm">{result.detail}</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Talking points for your diabetes team:</p>
                <ul className="space-y-1">
                  {result.talkingPoints.map((point, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-1">&bull;</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={handleReset} data-testid="button-adviser-start-over">
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Check another meal
                </Button>
              </div>

              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Not medical advice — this tool helps you spot patterns, not prescribe changes. Always discuss ratio adjustments with your diabetes team.
              </p>
            </div>
          )}
        </CardContent>
    </Card>
  );
}
