import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { UserSettings } from "@/lib/storage";

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
    summary: `${mealLabel} pattern is variable`,
    direction: "monitor",
    detail: `Your post-${mealLabel.toLowerCase()} readings are sometimes high${ratioText}. Variable patterns can be harder to pin down \u2014 it might be the ratio, but it could also be affected by the type of food, portion estimation, activity, or stress.`,
    talkingPoints: [
      `Post-${mealLabel.toLowerCase()} readings are inconsistent`,
      "Try eating a similar, measured meal for a few days to isolate the ratio",
      "Variable patterns might point to food type (high fat/protein) rather than ratio",
      "Keep a brief food + BG diary for 5-7 days to spot trends",
    ],
  };
}

export function RatioAdviserTool({ settings, bgUnit, defaultOpen = false }: { settings: UserSettings; bgUnit: string; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [step, setStep] = useState(0);
  const [selectedMeal, setSelectedMeal] = useState<MealKey | null>(null);
  const [pattern, setPattern] = useState<PatternAnswer | null>(null);
  const [timing, setTiming] = useState<TimingAnswer | null>(null);
  const [frequency, setFrequency] = useState<FrequencyAnswer | null>(null);
  const [result, setResult] = useState<AdviserResult | null>(null);

  const mealOptions: { key: MealKey; label: string; icon: typeof Sun; ratio?: string }[] = [
    { key: "breakfast", label: "Breakfast", icon: Sun, ratio: settings.breakfastRatio },
    { key: "lunch", label: "Lunch", icon: Sunset, ratio: settings.lunchRatio },
    { key: "dinner", label: "Dinner", icon: Moon, ratio: settings.dinnerRatio },
    { key: "snack", label: "Snack", icon: Cookie, ratio: settings.snackRatio },
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
      const currentRatio = selectedMeal ? settings[`${selectedMeal}Ratio` as keyof UserSettings] as string | undefined : undefined;
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
    const currentRatio = selectedMeal ? settings[`${selectedMeal}Ratio` as keyof UserSettings] as string | undefined : undefined;
    setResult(getAdviserResult(selectedMeal!, pattern!, timing!, f, currentRatio));
    setStep(4);
  };

  const stepLabels = ["Select meal", "Post-meal pattern", "When does it happen?", "How often?", "Assessment"];

  return (
    <Card data-testid="card-ratio-adviser">
      <CardHeader className="pb-2">
        <div
          className="flex items-center justify-between gap-2 cursor-pointer"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Ratio Adviser</CardTitle>
          </div>
          {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
        {!isOpen && (
          <p className="text-sm text-muted-foreground mt-1">
            Wondering if a ratio needs adjusting? This guided tool helps you spot patterns.
          </p>
        )}
      </CardHeader>
      {isOpen && (
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
      )}
    </Card>
  );
}
