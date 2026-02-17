import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Utensils, Dumbbell, AlertCircle, Info, Calculator, ChevronDown, ChevronUp, Clock, Droplet, Pizza, Repeat, X, Sparkles, Play, Zap, Heart, Moon, Apple, ArrowRight, ArrowLeft, Wrench, Search, Thermometer, Plane } from "lucide-react";
import { InfoTooltip, DIABETES_TERMS } from "@/components/info-tooltip";
import { RoutinesContent } from "./routines";
import { RatioAdviserTool } from "@/components/ratio-adviser-tool";
import { Switch } from "@/components/ui/switch";
import { storage, UserSettings, UserProfile, ScenarioState, RatioFormat } from "@/lib/storage";
import { parseRatioToGramsPerUnit, calculateDoseFromCarbs, formatRatioForDisplay } from "@/lib/ratio-utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { FaceLogoWatermark } from "@/components/face-logo";

import { Link } from "wouter";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";


function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function getRoundingAdvice(exactDose: number, roundedDose: number, bgUnits: string): string {
  const diff = exactDose - roundedDose;
  if (Math.abs(diff) < 0.05) return "";
  
  const roundedDown = Math.floor(exactDose * 2) / 2;
  const roundedUp = Math.ceil(exactDose * 2) / 2;
  
  if (roundedDown === roundedUp) return "";
  
  const lowLabel = bgUnits === "mmol/L" ? "below 5" : "below 90";
  const highLabel = bgUnits === "mmol/L" ? "above 10" : "above 180";
  const midLabel = bgUnits === "mmol/L" ? "5-10" : "90-180";
  
  return `Exact: ${exactDose.toFixed(1)}u. ` +
    `Round down to ${roundedDown}u if BG is ${lowLabel} ${bgUnits} or trending down. ` +
    `Round up to ${roundedUp}u if BG is ${highLabel} ${bgUnits} or trending up. ` +
    `Use ${roundedDose}u if BG is steady at ${midLabel} ${bgUnits}.`;
}

type MealDoseResult = {
  carbs: number;
  mealType: string;
  dose: number;
  exactDose: number;
  roundingAdvice: string;
  exerciseContext?: "before" | "after" | "during";
  exerciseReduction?: number;
  standardDose?: number;
  tips?: string[];
  error?: string;
};

function calculateMealDose(
  carbs: number,
  mealType: string,
  settings: UserSettings,
  bgUnits: string,
  exerciseContext?: "before" | "after" | "during",
  hoursAway?: number
): MealDoseResult {
  const ratioMap: Record<string, string | undefined> = {
    breakfast: settings.breakfastRatio,
    lunch: settings.lunchRatio,
    dinner: settings.dinnerRatio,
    snack: settings.snackRatio,
    meal: settings.lunchRatio || settings.breakfastRatio,
  };

  const ratio = ratioMap[mealType];
  let exactBaseUnits = 0;

  if (ratio) {
    exactBaseUnits = calculateDoseFromCarbs(carbs, ratio);
  } else if (settings.tdd) {
    const estimatedRatio = Math.round(500 / settings.tdd);
    exactBaseUnits = carbs / estimatedRatio;
  }

  if (exactBaseUnits <= 0) {
    return { carbs, mealType, dose: 0, exactDose: 0, roundingAdvice: "", error: "no_ratios" };
  }

  if (!exerciseContext) {
    const rounded = roundToHalf(exactBaseUnits);
    return {
      carbs, mealType,
      dose: rounded,
      exactDose: Math.round(exactBaseUnits * 10) / 10,
      roundingAdvice: getRoundingAdvice(exactBaseUnits, rounded, bgUnits),
    };
  }

  const hours = hoursAway || 2;
  
  if (exerciseContext === "during") {
    return {
      carbs, mealType,
      dose: 0,
      exactDose: 0,
      roundingAdvice: "",
      exerciseContext,
      standardDose: roundToHalf(exactBaseUnits),
      tips: [
        "Carbs during exercise are usually used immediately by working muscles",
        "For sessions under 90 min: skip insulin for exercise snacks/gels",
        "For 90+ min sessions: may need 10-25% of normal dose",
        "Use fast-acting carbs (15-30g every 30-45 min)",
      ],
    };
  }

  const reductionPercent = exerciseContext === "before"
    ? (hours <= 1 ? 40 : hours <= 2 ? 30 : 20)
    : (hours <= 1 ? 35 : hours <= 2 ? 25 : 15);
  
  const adjustedExact = exactBaseUnits * (1 - reductionPercent / 100);
  const rounded = roundToHalf(adjustedExact);
  const stdDose = roundToHalf(exactBaseUnits);

  const tips = exerciseContext === "before"
    ? [
        `Start exercise with BG ${bgUnits === "mmol/L" ? "7-10" : "126-180"} ${bgUnits}`,
        "Consider slower-digesting carbs (whole grains, protein)",
        "Check BG before starting exercise",
      ]
    : [
        "Include protein to help muscle recovery",
        "Monitor for delayed lows over next 6-12 hours",
        "Consider a bedtime snack if exercised in the evening",
      ];

  return {
    carbs, mealType,
    dose: rounded,
    exactDose: Math.round(adjustedExact * 10) / 10,
    roundingAdvice: getRoundingAdvice(adjustedExact, rounded, bgUnits),
    exerciseContext,
    exerciseReduction: reductionPercent,
    standardDose: stdDose,
    tips,
  };
}

function generateExerciseTypeGuide(bgUnits: string = "mmol/L"): string {
  const lowThreshold = bgUnits === "mmol/L" ? "5.0" : "90";
  const idealLow = bgUnits === "mmol/L" ? "7.0" : "126";
  const idealHigh = bgUnits === "mmol/L" ? "10.0" : "180";
  const highStart = bgUnits === "mmol/L" ? "8.0" : "144";

  return `**Exercise Type Guide for Diabetics**

Different types of exercise affect blood sugar in different ways. Understanding this can help you exercise with confidence.

---

**CARDIO (Running, Cycling, Swimming)**
*Blood sugar effect:* Usually LOWERS blood sugar
*Why:* Muscles use glucose for sustained energy
*Timing:* Effect starts quickly, can last hours after

*Tips:*
- Start with BG ${idealLow}-${idealHigh} ${bgUnits}
- May need 15-30g carbs before longer sessions
- Reduce bolus 30-50% for meal before exercise
- Watch for delayed lows up to 24 hours later

---

**STRENGTH TRAINING (Weights, Resistance)**
*Blood sugar effect:* Can RAISE then LOWER blood sugar
*Why:* Intense effort triggers adrenaline (raises BG), then muscles refuel (lowers BG)
*Timing:* May spike during, then drop 2-6 hours after

*Tips:*
- Starting BG can be slightly higher (${highStart}+ ${bgUnits} is OK)
- Don't correct small rises during workout
- Monitor for delayed lows in the evening/overnight
- Consider reduced basal if doing heavy sessions

---

**HIIT (High Intensity Interval Training)**
*Blood sugar effect:* Often RAISES during, LOWERS after
*Why:* Intense bursts release stress hormones, then glucose uptake increases during recovery
*Timing:* Spikes during, drops 1-4 hours post-exercise

*Tips:*
- Don't start if BG below ${lowThreshold} ${bgUnits}
- Expect a temporary rise - don't over-correct
- Have snacks ready for the post-workout drop
- Shorter sessions may be easier to manage

---

**YOGA / STRETCHING / WALKING**
*Blood sugar effect:* Gentle LOWERING or stable
*Why:* Low intensity, steady glucose use
*Timing:* Gradual effect, minimal delayed impact

*Tips:*
- Great option when BG is already on the lower side
- Usually no carb pre-load needed
- Good for active recovery days
- Walking after meals can help reduce spikes

---

**TEAM SPORTS (Football, Basketball, Tennis)**
*Blood sugar effect:* UNPREDICTABLE - can go either way
*Why:* Mix of sprinting (raises) and sustained activity (lowers), plus competition adrenaline
*Timing:* Variable during, often drops after

*Tips:*
- Check BG every 30 minutes during games
- Carry fast-acting glucose on the sideline
- Consider slightly higher starting BG (${highStart}+ ${bgUnits})
- Log your patterns for each sport

---

**General Gym Tips:**
1. Always carry fast-acting glucose
2. Tell a gym buddy about your diabetes
3. Keep a log of how each activity affects you
4. Stay hydrated - dehydration affects BG readings
5. Have your phone accessible for emergencies`;
}


interface ExercisePlanResult {
  duration: number;
  intensity: string;
  exerciseType: string;
  summary: string;
  pre: {
    targetBg: string;
    lowThreshold: string;
    carbsIfLow: number;
    bolusReduction: string;
    snackIdeas: string[];
    timing: string;
  };
  during: {
    carbsNeeded: number;
    needsCarbs: boolean;
    carbFrequency: string;
    checkBg: boolean;
    tips: string[];
  };
  post: {
    carbs: number;
    protein: string;
    bolusReduction: string;
    snackIdeas: string[];
    timing: string;
  };
  recovery: {
    monitorHours: string;
    tips: string[];
  };
  pumpTips: {
    pre: string[];
    during: string[];
    post: string[];
    recovery: string[];
  };
}

function calculateExercisePlan(message: string, settings: UserSettings, bgUnits: string = "mmol/L"): ExercisePlanResult {
  const durationMatch = message.match(/(\d+)\s*(?:min|minute)/i);
  const duration = durationMatch ? parseInt(durationMatch[1]) : 45;
  
  const lowerMessage = message.toLowerCase();
  const intensity = lowerMessage.includes("intense") || lowerMessage.includes("hard") ? "intense" :
                    lowerMessage.includes("light") || lowerMessage.includes("easy") ? "light" : "moderate";
  
  const exerciseType = lowerMessage.includes("cardio") || lowerMessage.includes("run") || lowerMessage.includes("cycl") ? "cardio" :
                       lowerMessage.includes("strength") || lowerMessage.includes("weight") ? "strength" :
                       lowerMessage.includes("hiit") ? "HIIT" :
                       lowerMessage.includes("yoga") || lowerMessage.includes("stretch") ? "yoga" :
                       lowerMessage.includes("walk") ? "walking" :
                       lowerMessage.includes("swim") ? "swimming" :
                       lowerMessage.includes("sport") ? "sports" : "exercise";

  let preExerciseCarbs = 0;
  let duringCarbs = 0;
  let postExerciseCarbs = 0;
  let bolusReduction = "";

  switch (intensity) {
    case "light":
      preExerciseCarbs = duration < 30 ? 0 : 15;
      duringCarbs = duration > 60 ? 15 : 0;
      postExerciseCarbs = 15;
      bolusReduction = "15-25%";
      break;
    case "moderate":
      preExerciseCarbs = duration < 20 ? 10 : 20;
      duringCarbs = duration > 45 ? Math.round(duration / 30 * 15) : 0;
      postExerciseCarbs = 20;
      bolusReduction = "25-35%";
      break;
    case "intense":
      preExerciseCarbs = 25;
      duringCarbs = duration > 30 ? Math.round(duration / 30 * 20) : 0;
      postExerciseCarbs = 30;
      bolusReduction = "35-50%";
      break;
  }

  const idealStart = bgUnits === "mmol/L" ? "7-10" : "126-180";
  const lowThreshold = bgUnits === "mmol/L" ? "5.6" : "100";

  const exerciseLabels: Record<string, string> = {
    cardio: "Cardio", strength: "Strength", HIIT: "HIIT", yoga: "Yoga",
    walking: "Walking", swimming: "Swimming", sports: "Sports", exercise: "Exercise"
  };

  return {
    duration,
    intensity,
    exerciseType: exerciseLabels[exerciseType] || exerciseType,
    summary: `${duration} min ${intensity} ${exerciseLabels[exerciseType] || exerciseType}`,
    pre: {
      targetBg: idealStart,
      lowThreshold,
      carbsIfLow: preExerciseCarbs,
      bolusReduction,
      snackIdeas: ["Banana", "Toast with peanut butter", "Oat bar"],
      timing: "30-60 min before",
    },
    during: {
      carbsNeeded: duringCarbs,
      needsCarbs: duringCarbs > 0,
      carbFrequency: "every 30-45 min",
      checkBg: duration > 45,
      tips: duringCarbs > 0
        ? [`Have ${duringCarbs}g fast-acting carbs ready`, "Take 15g if BG starts dropping", "Check BG halfway through"]
        : ["You may not need extra carbs for this session", "Keep 15-20g fast glucose nearby just in case"],
    },
    post: {
      carbs: postExerciseCarbs,
      protein: "15-20g",
      bolusReduction,
      snackIdeas: ["Chocolate milk", "Greek yoghurt", "Sandwich"],
      timing: "Within 30-60 min after",
    },
    recovery: {
      monitorHours: "6-24",
      tips: [
        "Monitor BG closely for delayed lows",
        "Consider a small bedtime snack to prevent overnight lows",
        "Have a protein-carb snack before bed if you exercised in the evening",
        "Stay hydrated — dehydration affects BG readings",
      ],
    },
    pumpTips: intensity === "light"
      ? {
          pre: ["Consider a 20-30% temporary basal reduction starting 60 min before"],
          during: ["Your pump's current basal may be sufficient for light activity"],
          post: ["Resume normal basal rate after light exercise"],
          recovery: ["No overnight basal change typically needed for light exercise"],
        }
      : intensity === "moderate"
      ? {
          pre: ["Set a temporary basal rate at 50-70% (30-50% reduction) starting 60-90 min before exercise"],
          during: ["If BG drops below target, reduce or suspend temp basal"],
          post: ["Keep temp basal running at 70-80% for 1-2 hours after exercise"],
          recovery: ["Consider running basal at 80-90% overnight if exercised in the evening"],
        }
      : {
          pre: ["Set a temporary basal rate at 30-50% (50-70% reduction) starting 60-90 min before exercise"],
          during: ["Be ready to suspend pump briefly if BG drops rapidly", "Some people disconnect for water sports - discuss with your team first"],
          post: ["Keep temp basal at 60-70% for 2-3 hours post-exercise"],
          recovery: ["Run basal at 70-80% overnight - intense exercise increases hypo risk for up to 24 hours"],
        },
  };
}


function RatioCalculationGuide({ settings, bgUnits, ratioFormat }: { settings: UserSettings; bgUnits: string; ratioFormat: RatioFormat }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const correctionRule = bgUnits === "mmol/L" ? 100 : 1800;
  const ruleName = bgUnits === "mmol/L" ? "100 Rule" : "1800 Rule";
  const exampleResult = bgUnits === "mmol/L" ? "2.5" : "45";
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-3 h-auto" data-testid="button-ratio-guide">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">How to Calculate Insulin Ratios</span>
          </div>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3">
        <div className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Starting Point: The 500 Rule</p>
            <p>500 ÷ TDD = grams of carbs covered by 1 unit</p>
            {settings.tdd && (
              <p className="text-primary">Your starting estimate: 500 ÷ {settings.tdd} = {formatRatioForDisplay(Math.round(500 / settings.tdd), ratioFormat)}</p>
            )}
          </div>
          
          <div>
            <p className="font-medium text-foreground">Fine-Tuning by Trial</p>
            <p>The 500 rule gives you a starting point, but everyone is different. Here's how to adjust:</p>
            <ol className="list-decimal list-inside space-y-1 mt-2 text-xs">
              <li>Start with your calculated ratio (e.g., {formatRatioForDisplay(10, ratioFormat)})</li>
              <li>Eat a measured meal with known carbs when blood sugar is stable</li>
              <li>Check blood sugar 2-3 hours after eating</li>
              <li>If still high: try a stronger ratio (e.g., {formatRatioForDisplay(8, ratioFormat)})</li>
              <li>If going low: try a weaker ratio (e.g., {formatRatioForDisplay(12, ratioFormat)})</li>
              <li>Repeat until you find what works for each meal</li>
            </ol>
          </div>

          <div>
            <p className="font-medium text-foreground">Correction Factor: {ruleName}</p>
            <p>{correctionRule} ÷ TDD = {bgUnits} drop per 1 unit</p>
            {settings.tdd && (
              <p className="text-primary">Your estimate: {correctionRule} ÷ {settings.tdd} = {Math.round(correctionRule / settings.tdd * 10) / 10} {bgUnits}</p>
            )}
          </div>

          <div className="text-xs bg-muted p-2 rounded">
            <p><strong>Why ratios differ by meal:</strong></p>
            <p>Many people need stronger ratios at breakfast (e.g., {formatRatioForDisplay(8, ratioFormat)}) due to morning hormone changes, and weaker ratios at lunch/dinner (e.g., {formatRatioForDisplay(12, ratioFormat)}). Trial each meal separately.</p>
          </div>
          
          <p className="text-xs text-muted-foreground italic">Note: Always work with your healthcare team when adjusting ratios. Keep a log of your trials to spot patterns.</p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}


function getInitialTab(): string {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  if (tab === "meal" || tab === "exercise" || tab === "routines" || tab === "tools" || tab === "ratios") {
    return tab;
  }
  if (tab === "ratio-adviser") return "ratios";
  return "meal";
}

export default function Advisor() {
  const [settings, setSettings] = useState<UserSettings>({});
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [cameFromRatios, setCameFromRatios] = useState(false);
  const [scenarioState, setScenarioState] = useState<ScenarioState>({ travelModeActive: false, sickDayActive: false });
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "meal" || tab === "exercise" || tab === "routines" || tab === "tools" || tab === "ratios") {
      setActiveTab(tab);
    }
    if (tab === "ratio-adviser") {
      setActiveTab("ratios");
    }
    if (params.get("from") === "ratios") {
      setCameFromRatios(true);
    }
  }, []);
  
  const [mealResult, setMealResult] = useState<MealDoseResult | null>(null);
  const [exerciseResult, setExerciseResult] = useState<ExercisePlanResult | null>(null);
  const [exerciseResultTab, setExerciseResultTab] = useState("before");
  
  const [mealCarbs, setMealCarbs] = useState("");
  const [carbUnit, setCarbUnit] = useState<"grams" | "cp">("grams");
  const [mealTime, setMealTime] = useState<string>("lunch");
  
  const [exerciseType, setExerciseType] = useState("cardio");
  const [exerciseDuration, setExerciseDuration] = useState("");
  const [exerciseIntensity, setExerciseIntensity] = useState("moderate");
  const [showExerciseGuide, setShowExerciseGuide] = useState(false);
  
  const [planningAroundExercise, setPlanningAroundExercise] = useState(false);
  const [exerciseTiming, setExerciseTiming] = useState<"before" | "after" | "during">("before");
  const [exerciseWithin, setExerciseWithin] = useState("2");
  
  const [sessionTimingFromNow, setSessionTimingFromNow] = useState("60");

  // Split Bolus Calculator state
  const [splitCarbs, setSplitCarbs] = useState("");
  const [splitFatLevel, setSplitFatLevel] = useState<"low" | "medium" | "high">("high");
  const [splitMealTime, setSplitMealTime] = useState<"breakfast" | "lunch" | "dinner" | "snack">("dinner");
  const [showSplitCalculator, setShowSplitCalculator] = useState(false);
  const [splitResult, setSplitResult] = useState<{
    totalUnits: number;
    firstDose: number;
    secondDose: number;
    secondDoseDelay: number;
    splitRatio: string;
    ratioUsed: string;
  } | null>(null);

  // Hypo Treatment Calculator state
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

  const bgUnits = profile.bgUnits || "mmol/L";

  useEffect(() => {
    setSettings(storage.getSettings());
    setScenarioState(storage.getScenarioState());
    const storedProfile = storage.getProfile();
    if (storedProfile) {
      setProfile(storedProfile);
      if (storedProfile.carbUnits) {
        setCarbUnit(storedProfile.carbUnits === "cp" ? "cp" : "grams");
      }
    }
  }, []);

  // Split Bolus Calculator function
  const calculateSplitBolus = () => {
    if (!splitCarbs) return;
    
    const carbValue = parseInt(splitCarbs);
    if (isNaN(carbValue) || carbValue <= 0) return;
    
    // Get ratio based on selected meal time
    const ratioMap: Record<string, string | undefined> = {
      breakfast: settings.breakfastRatio,
      lunch: settings.lunchRatio,
      dinner: settings.dinnerRatio,
      snack: settings.snackRatio || settings.lunchRatio, // Fallback snack to lunch
    };
    const selectedRatio = ratioMap[splitMealTime];
    
    let totalUnits = 0;
    let ratioUsed = "";
    const ratioFmt: RatioFormat = profile.ratioFormat || "per10g";
    
    if (selectedRatio) {
      const gpu = parseRatioToGramsPerUnit(selectedRatio);
      if (gpu && gpu > 0) {
        totalUnits = Math.round((carbValue / gpu) * 10) / 10;
        ratioUsed = `Using your ${splitMealTime} ratio (${formatRatioForDisplay(gpu, ratioFmt)})`;
      }
    } else if (settings.tdd) {
      const estimatedRatio = Math.round(500 / settings.tdd);
      totalUnits = Math.round((carbValue / estimatedRatio) * 10) / 10;
      ratioUsed = `Estimated from TDD (${formatRatioForDisplay(estimatedRatio, ratioFmt)})`;
    }
    
    if (totalUnits <= 0) {
      setSplitResult(null);
      return;
    }
    
    // Split ratios and timing based on fat content
    let firstPercent: number;
    let secondDoseDelay: number;
    let splitRatio: string;
    
    switch (splitFatLevel) {
      case "low":
        firstPercent = 70;
        secondDoseDelay = 1.5;
        splitRatio = "70/30";
        break;
      case "medium":
        firstPercent = 60;
        secondDoseDelay = 2;
        splitRatio = "60/40";
        break;
      case "high":
        firstPercent = 50;
        secondDoseDelay = 3;
        splitRatio = "50/50";
        break;
    }
    
    const totalRounded = roundToHalf(totalUnits);
    const firstDose = roundToHalf(totalRounded * (firstPercent / 100));
    const secondDose = roundToHalf(totalRounded - firstDose);
    
    setSplitResult({
      totalUnits: totalRounded,
      firstDose,
      secondDose,
      secondDoseDelay,
      splitRatio,
      ratioUsed,
    });
  };

  // Hypo Treatment Calculator function
  const calculateHypoTreatment = () => {
    if (!currentBg || !targetBg) return;
    
    const current = parseFloat(currentBg);
    const target = parseFloat(targetBg);
    const parsedWeight = userWeight ? parseFloat(userWeight) : 70;
    const rawWeight = (isNaN(parsedWeight) || parsedWeight <= 0) ? 70 : parsedWeight;
    const weight = weightUnit === "lbs" ? rawWeight * 0.4536 : rawWeight;
    
    if (isNaN(current) || isNaN(target)) return;
    
    // Convert to mmol/L if using mg/dL for calculation
    const currentMmol = bgUnits === "mg/dL" ? current / 18 : current;
    const targetMmol = bgUnits === "mg/dL" ? target / 18 : target;
    
    const bgDifference = targetMmol - currentMmol;
    
    if (bgDifference <= 0) {
      setHypoResult(null);
      return;
    }
    
    // Rule of thumb: 1g glucose raises BG by ~0.2-0.3 mmol/L for a 70kg adult
    // Lighter people need less, heavier people need more
    const sensitivityFactor = 70 / weight; // Adjust for weight
    const baseRise = 0.25; // mmol/L per gram of glucose
    const effectiveRise = baseRise * sensitivityFactor;
    
    const carbsNeeded = Math.ceil(bgDifference / effectiveRise);
    
    // Common hypo treatment equivalents (UK focused)
    const glucoseTablets = Math.ceil(carbsNeeded / 4); // ~4g per tablet
    const juiceMl = Math.round(carbsNeeded * 10); // ~10ml juice per 1g carb
    const jellyBabies = Math.ceil(carbsNeeded / 5); // ~5g per jelly baby
    
    setHypoResult({
      carbsNeeded: Math.max(carbsNeeded, 10), // Minimum 10g
      glucoseTablets: Math.max(glucoseTablets, 3), // Minimum 3 tablets
      juiceMl: Math.max(juiceMl, 100), // Minimum 100ml
      jellyBabies: Math.max(jellyBabies, 2), // Minimum 2
    });
  };

  const handleQuickMealPlan = () => {
    if (!mealCarbs) return;
    const carbValue = carbUnit === "cp" ? parseInt(mealCarbs) * 10 : parseInt(mealCarbs);
    const freshSettings = storage.getSettings();
    const exerciseContext = planningAroundExercise ? exerciseTiming : undefined;
    const hoursAway = planningAroundExercise ? parseInt(exerciseWithin) : undefined;
    
    const result = calculateMealDose(carbValue, mealTime, freshSettings, bgUnits, exerciseContext, hoursAway);
    setMealResult(result);
    
    try {
      storage.addActivityLog({
        activityType: "meal_planning",
        activityDetails: `${carbValue}g carbs for ${mealTime}`,
        recommendation: `${result.dose} units`,
      });
    } catch {}
  };

  const handleQuickExercisePlan = () => {
    if (!exerciseDuration) return;
    const freshSettings = storage.getSettings();
    const message = `${exerciseIntensity} ${exerciseType} for ${exerciseDuration} minutes`;
    
    const result = calculateExercisePlan(message, freshSettings, bgUnits);
    setExerciseResult(result);
    setExerciseResultTab("before");
    
    try {
      storage.addActivityLog({
        activityType: "exercise_planning",
        activityDetails: message,
        recommendation: result.summary,
      });
    } catch {}
  };
  
  const getRatioForMeal = (meal: string): string => {
    const ratioMap: Record<string, string | undefined> = {
      breakfast: settings.breakfastRatio,
      lunch: settings.lunchRatio,
      dinner: settings.dinnerRatio,
      snack: settings.snackRatio,
    };
    const val = ratioMap[meal];
    if (!val) return "Not set";
    if (val.includes(":")) return val;
    return `${val} u/10g`;
  };

  return (
    <div className="flex flex-col min-h-full relative overflow-auto">
      <FaceLogoWatermark />
      <div className="mb-4 flex items-center gap-2">
        <div>
          <h1 className="text-3xl font-semibold">Activity Advisor</h1>
          <p className="text-muted-foreground mt-1">Get calculated recommendations for meals and exercise based on your settings.</p>
        </div>
        <PageInfoDialog
          title="About Activity Advisor"
          description="Get calculated recommendations for meals and exercise"
        >
          <InfoSection title="Meal Tab">
            <p>Enter carbs and meal type for a dose suggestion based on your ratios. Toggle "Planning around exercise?" to get adjusted doses for meals before, during, or after workouts.</p>
          </InfoSection>
          <InfoSection title="Exercise Tab">
            <p>Plan workouts by type, duration, and intensity. Get preparation tips including what to eat before, during, and after exercise.</p>
          </InfoSection>
          <InfoSection title="Routines Tab">
            <p>Save your regular activities and meals as routines for quick access.</p>
          </InfoSection>
          <InfoSection title="How It Works">
            <p>All calculations use the ratios and settings you've entered (carb ratios, TDD, correction factor). The more accurate your settings, the better the recommendations.</p>
          </InfoSection>
          <InfoSection title="Safety Note">
            <p>All suggestions are for informational purposes only. Always verify with your own calculations and healthcare team. Not medical advice.</p>
          </InfoSection>
        </PageInfoDialog>
      </div>

      <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 mb-4">
        <CardContent className="p-3">
          <div className="flex gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-200">
              <strong>Not Medical Advice:</strong> All suggestions are calculated from your settings and are educational only. 
              Always verify with your own calculations and consult your healthcare provider.
            </p>
          </div>
        </CardContent>
      </Card>

      {scenarioState.sickDayActive && (
        <Alert className="mb-4 border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20" data-testid="banner-sick-day-active">
          <Thermometer className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm text-amber-800 dark:text-amber-200">
              Sick Day Mode is active. Your insulin needs may be different — ratios are adjusted and exercise should be approached cautiously.
            </span>
            <Link href="/scenarios?tab=sick-day">
              <Badge variant="outline" className="cursor-pointer text-amber-700 dark:text-amber-300 border-amber-400" data-testid="link-sick-day-scenarios">
                Sick Day Settings
              </Badge>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {scenarioState.travelModeActive && (
        <Alert className="mb-4 border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20" data-testid="banner-travel-mode-active">
          <Plane className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm text-blue-800 dark:text-blue-200">
              Travel Mode is active{scenarioState.travelDestination ? ` — ${scenarioState.travelDestination}` : ''}. Be mindful of timezone and routine changes affecting your levels.
            </span>
            <Link href="/scenarios?tab=travel">
              <Badge variant="outline" className="cursor-pointer text-blue-700 dark:text-blue-300 border-blue-400" data-testid="link-travel-scenarios">
                Travel Settings
              </Badge>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-5 max-w-2xl">
          <TabsTrigger value="meal" className="gap-1.5 text-xs sm:text-sm" data-testid="tab-meal">
            <Utensils className="h-4 w-4" /><span>Meal</span>
          </TabsTrigger>
          <TabsTrigger value="exercise" className="gap-1.5 text-xs sm:text-sm" data-testid="tab-exercise">
            <Dumbbell className="h-4 w-4" /><span>Exercise</span>
          </TabsTrigger>
          <TabsTrigger value="routines" className="gap-1.5 text-xs sm:text-sm" data-testid="tab-routines">
            <Repeat className="h-4 w-4" /><span>Routines</span>
          </TabsTrigger>
          <TabsTrigger value="ratios" className="gap-1.5 text-xs sm:text-sm" data-testid="tab-ratios">
            <Search className="h-4 w-4" /><span>Ratios</span>
          </TabsTrigger>
          <TabsTrigger value="tools" className="gap-1.5 text-xs sm:text-sm" data-testid="tab-tools">
            <Droplet className="h-4 w-4" /><span>Hypo Help</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="meal" className="space-y-4 mt-4 animate-fade-in-up">
          {cameFromRatios && (
            <Link href="/ratios">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" data-testid="button-back-to-ratios-meal">
                <ArrowLeft className="h-4 w-4" />
                Back to Ratios
              </Button>
            </Link>
          )}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Utensils className="h-5 w-5 text-primary" />
                Quick Meal Planner
              </CardTitle>
              <CardDescription className="flex items-center gap-1">
                Enter your carbs and get a mealtime dose suggestion
                <InfoTooltip {...DIABETES_TERMS.bolus} />
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="meal-carbs" className="flex items-center">
                    How many carbs? ({carbUnit === "cp" ? "CP" : "grams"})
                    <InfoTooltip {...DIABETES_TERMS.carbRatio} />
                  </Label>
                  <Input
                    id="meal-carbs"
                    type="number"
                    placeholder={carbUnit === "cp" ? "e.g., 6" : "e.g., 60"}
                    value={mealCarbs}
                    onChange={(e) => setMealCarbs(e.target.value)}
                    data-testid="input-meal-carbs"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meal-time">Which meal?</Label>
                  <Select value={mealTime} onValueChange={setMealTime}>
                    <SelectTrigger id="meal-time" data-testid="select-meal-time">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="breakfast">Breakfast</SelectItem>
                      <SelectItem value="lunch">Lunch</SelectItem>
                      <SelectItem value="dinner">Dinner</SelectItem>
                      <SelectItem value="snack">Snack</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg">
                <div className="flex items-center gap-2">
                  <Dumbbell className="h-4 w-4 text-primary" />
                  <Label htmlFor="exercise-toggle" className="text-sm font-medium cursor-pointer">
                    Planning around exercise?
                  </Label>
                </div>
                <Switch
                  id="exercise-toggle"
                  checked={planningAroundExercise}
                  onCheckedChange={setPlanningAroundExercise}
                  data-testid="switch-exercise-toggle"
                />
              </div>

              {planningAroundExercise && (
                <div className="grid gap-4 md:grid-cols-2 p-3 bg-muted/50 rounded-lg">
                  <div className="space-y-2">
                    <Label>When is exercise?</Label>
                    <Select value={exerciseTiming} onValueChange={(v: "before" | "after" | "during") => setExerciseTiming(v)}>
                      <SelectTrigger data-testid="select-exercise-timing">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="before">Before this meal</SelectItem>
                        <SelectItem value="after">After this meal</SelectItem>
                        <SelectItem value="during">During exercise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {exerciseTiming !== "during" && (
                    <div className="space-y-2">
                      <Label>How many hours {exerciseTiming === "before" ? "until" : "since"} exercise?</Label>
                      <Select value={exerciseWithin} onValueChange={setExerciseWithin}>
                        <SelectTrigger data-testid="select-exercise-hours">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">About 1 hour</SelectItem>
                          <SelectItem value="2">About 2 hours</SelectItem>
                          <SelectItem value="3">About 3 hours</SelectItem>
                          <SelectItem value="4">4+ hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm font-medium mb-2">Your Current Ratios</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div className="flex justify-between gap-1 flex-wrap">
                    <span className="text-muted-foreground">Breakfast:</span>
                    <span className={getRatioForMeal("breakfast") === "Not set" ? "text-muted-foreground" : "font-medium"}>{getRatioForMeal("breakfast")}</span>
                  </div>
                  <div className="flex justify-between gap-1 flex-wrap">
                    <span className="text-muted-foreground">Lunch:</span>
                    <span className={getRatioForMeal("lunch") === "Not set" ? "text-muted-foreground" : "font-medium"}>{getRatioForMeal("lunch")}</span>
                  </div>
                  <div className="flex justify-between gap-1 flex-wrap">
                    <span className="text-muted-foreground">Dinner:</span>
                    <span className={getRatioForMeal("dinner") === "Not set" ? "text-muted-foreground" : "font-medium"}>{getRatioForMeal("dinner")}</span>
                  </div>
                  <div className="flex justify-between gap-1 flex-wrap">
                    <span className="text-muted-foreground">Snack:</span>
                    <span className={getRatioForMeal("snack") === "Not set" ? "text-muted-foreground" : "font-medium"}>{getRatioForMeal("snack")}</span>
                  </div>
                </div>
                {(!settings.breakfastRatio && !settings.lunchRatio && !settings.dinnerRatio) && (
                  <p className="text-xs text-muted-foreground mt-2">
                    <Link href="/settings" className="text-primary hover:underline" data-testid="link-settings-ratios">Set your ratios in Settings</Link> for accurate calculations.
                  </p>
                )}
              </div>

              <Button onClick={handleQuickMealPlan} disabled={!mealCarbs} className="w-full" data-testid="button-get-meal-advice">
                Get Dose Suggestion
              </Button>
            </CardContent>
          </Card>

          {mealResult && (
            <Card data-testid="card-meal-result">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Utensils className="h-4 w-4 text-primary" />
                    {mealResult.exerciseContext === "during" ? "During-Exercise Fuel" :
                     mealResult.exerciseContext === "before" ? "Pre-Exercise Dose" :
                     mealResult.exerciseContext === "after" ? "Post-Exercise Dose" :
                     "Your Dose Suggestion"}
                  </h4>
                  <Button variant="ghost" size="icon" onClick={() => setMealResult(null)} data-testid="button-clear-meal-result">
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {mealResult.error === "no_ratios" ? (
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">Add your carb ratios or TDD in <Link href="/settings" className="text-primary hover:underline">Settings</Link> to get dose suggestions.</p>
                  </div>
                ) : mealResult.exerciseContext === "during" ? (
                  <div className="space-y-3">
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">DURING EXERCISE</p>
                      <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">Usually no insulin</p>
                      <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">{mealResult.carbs}g carbs - standard dose would be {mealResult.standardDose}u</p>
                    </div>
                    {mealResult.tips && (
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {mealResult.tips.map((tip, i) => <li key={i} className="flex gap-2"><span className="text-primary">-</span>{tip}</li>)}
                      </ul>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mealResult.exerciseContext && mealResult.standardDose !== undefined && (
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="p-3 bg-muted/50 rounded-lg text-center">
                          <p className="text-xs text-muted-foreground font-medium">STANDARD DOSE</p>
                          <p className="text-xl font-bold line-through text-muted-foreground">{mealResult.standardDose} units</p>
                          <p className="text-xs text-muted-foreground">{mealResult.carbs}g carbs at {mealResult.mealType}</p>
                        </div>
                        <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800 text-center">
                          <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                            {mealResult.exerciseContext === "before" ? "PRE-EXERCISE" : "POST-EXERCISE"} (-{mealResult.exerciseReduction}%)
                          </p>
                          <p className="text-3xl font-bold text-green-700 dark:text-green-300" data-testid="text-meal-dose">{mealResult.dose} units</p>
                          <p className="text-xs text-green-600 dark:text-green-400">suggested dose</p>
                        </div>
                      </div>
                    )}
                    {!mealResult.exerciseContext && (
                      <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                        <p className="text-xs text-green-600 dark:text-green-400 font-medium">SUGGESTED DOSE</p>
                        <p className="text-4xl font-bold text-green-700 dark:text-green-300" data-testid="text-meal-dose">{mealResult.dose} units</p>
                        <p className="text-sm text-green-600 dark:text-green-400">for {mealResult.carbs}g carbs at {mealResult.mealType}</p>
                      </div>
                    )}
                    {mealResult.roundingAdvice && (
                      <div className="p-2 bg-muted rounded text-xs text-muted-foreground">
                        <strong>Rounding guide:</strong> {mealResult.roundingAdvice}
                      </div>
                    )}
                    {mealResult.tips && (
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {mealResult.tips.map((tip, i) => <li key={i} className="flex gap-2"><span className="text-primary">-</span>{tip}</li>)}
                      </ul>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">[Not medical advice. Always verify with your own calculations.]</p>
              </CardContent>
            </Card>
          )}

          {scenarioState.sickDayActive && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800" data-testid="meal-note-sick-day">
              <div className="flex items-start gap-2">
                <Thermometer className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Sick Day Note:</strong> Your ratios may need 10-30% more insulin during illness. The Sick Day tool has adjusted ratios for you.
                </p>
              </div>
            </div>
          )}

          {scenarioState.travelModeActive && Math.abs(scenarioState.travelTimezoneShift || 0) >= 2 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800" data-testid="meal-note-travel">
              <div className="flex items-start gap-2">
                <Plane className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Travel Note:</strong> You're in a different timezone. Your usual meal times and ratios may need adjusting as your body clock adapts.
                </p>
              </div>
            </div>
          )}

          <Card className="border-0 bg-transparent shadow-none">
            <RatioCalculationGuide settings={settings} bgUnits={bgUnits} ratioFormat={profile.ratioFormat || "per10g"} />
          </Card>

          <Card>
            <Collapsible open={showSplitCalculator} onOpenChange={setShowSplitCalculator}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-4 h-auto" data-testid="button-split-calculator-toggle">
                  <div className="flex items-center gap-2">
                    <Pizza className="h-5 w-5 text-primary" />
                    <div className="text-left">
                      <span className="font-medium">Split Dose Calculator</span>
                      <p className="text-xs text-muted-foreground font-normal">For high-fat meals like pizza, fish & chips</p>
                    </div>
                  </div>
                  {showSplitCalculator ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      High-fat meals slow down carb absorption. Taking all insulin upfront can cause an initial hypo, 
                      then a late spike. Split your dose to match the slower digestion.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="split-carbs">Total carbs (g)</Label>
                      <Input
                        id="split-carbs"
                        type="number"
                        placeholder="e.g., 80"
                        value={splitCarbs}
                        onChange={(e) => setSplitCarbs(e.target.value)}
                        data-testid="input-split-carbs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="split-meal">Which meal?</Label>
                      <Select value={splitMealTime} onValueChange={(v: "breakfast" | "lunch" | "dinner" | "snack") => setSplitMealTime(v)}>
                        <SelectTrigger id="split-meal" data-testid="select-split-meal">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="breakfast">Breakfast</SelectItem>
                          <SelectItem value="lunch">Lunch</SelectItem>
                          <SelectItem value="dinner">Dinner</SelectItem>
                          <SelectItem value="snack">Snack</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="split-fat">Fat content</Label>
                      <Select value={splitFatLevel} onValueChange={(v: "low" | "medium" | "high") => setSplitFatLevel(v)}>
                        <SelectTrigger id="split-fat" data-testid="select-split-fat">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low fat (pasta, rice)</SelectItem>
                          <SelectItem value="medium">Medium fat (burgers, curries)</SelectItem>
                          <SelectItem value="high">High fat (pizza, fish & chips)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button onClick={calculateSplitBolus} disabled={!splitCarbs} className="w-full" data-testid="button-calculate-split">
                    <Calculator className="h-4 w-4 mr-2" />
                    Calculate Split Doses
                  </Button>

                  {splitResult && (
                    <div className="p-4 bg-primary/5 rounded-lg space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <Pizza className="h-4 w-4 text-primary" />
                        Your Split Dose Plan ({splitResult.splitRatio})
                      </h4>
                      
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                          <p className="text-xs text-green-600 dark:text-green-400 font-medium">FIRST DOSE - NOW</p>
                          <p className="text-2xl font-bold text-green-700 dark:text-green-300">{splitResult.firstDose} units</p>
                          <p className="text-xs text-green-600 dark:text-green-400">Take when you start eating</p>
                        </div>
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">SECOND DOSE - LATER</p>
                          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{splitResult.secondDose} units</p>
                          <p className="text-xs text-amber-600 dark:text-amber-400">Take in {splitResult.secondDoseDelay} hours</p>
                        </div>
                      </div>

                      <div className="text-sm text-muted-foreground space-y-1">
                        <p><strong>Total:</strong> {splitResult.totalUnits} units for {splitCarbs}g carbs</p>
                        <p className="text-xs">{splitResult.ratioUsed}</p>
                        <p><strong>Why split?</strong> Fat slows carb absorption by {splitResult.secondDoseDelay - 1} to {splitResult.secondDoseDelay + 1} hours.</p>
                      </div>

                      <div className="p-2 bg-muted rounded text-xs text-muted-foreground space-y-1">
                        <p><strong>Rounding guide:</strong> If BG is trending high or above target, round doses up to the nearest 0.5. If trending low or below target, round down.</p>
                        <p><strong>Tip:</strong> Set a timer for your second dose! Check BG before taking it.</p>
                      </div>

                      {profile.insulinDeliveryMethod === "pump" && (
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border border-indigo-200 dark:border-indigo-800" data-testid="pump-tip-split-bolus">
                          <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-1">Pump Users</p>
                          <p className="text-sm text-indigo-800 dark:text-indigo-200">
                            Your pump may have an extended/square wave bolus feature that handles this automatically. 
                            Check your pump's manual for how to set up a dual-wave or combo bolus instead of manually splitting doses.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    [Not medical advice. Everyone's response to fat varies. Start conservatively and adjust based on your experience.]
                  </p>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          <Card className="border-dashed border-2 bg-muted/20">
            <CardContent className="p-6 text-center space-y-2">
              <Sparkles className="h-8 w-8 text-muted-foreground/50 mx-auto" />
              <p className="font-medium text-muted-foreground">Ask the AI Advisor</p>
              <p className="text-sm text-muted-foreground/70">Conversational meal planning with personalised AI recommendations is coming in a future update.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exercise" className="space-y-4 mt-4 animate-fade-in-up">
          {scenarioState.sickDayActive && (
            <div className="p-3 rounded-lg border" data-testid="exercise-warning-sick-day">
              {scenarioState.sickDaySeverity === "severe" ? (
                <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-800 dark:text-red-200">
                    <strong>Exercise is generally not recommended during severe illness.</strong> Focus on rest and monitoring.
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 p-3 rounded-lg">
                  <Thermometer className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Exercise During Illness:</strong> Take extra care when exercising while unwell. Your body is under stress and blood glucose can be unpredictable. Consider lighter activities and monitor closely.
                  </p>
                </div>
              )}
            </div>
          )}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Dumbbell className="h-5 w-5 text-primary" />
                Exercise Planner
              </CardTitle>
              <CardDescription>Plan your workout with before, during, and after recommendations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="exercise-type">Type of Exercise</Label>
                  <Select value={exerciseType} onValueChange={setExerciseType}>
                    <SelectTrigger id="exercise-type" data-testid="select-exercise-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cardio">Cardio (Running, Cycling)</SelectItem>
                      <SelectItem value="strength">Strength Training</SelectItem>
                      <SelectItem value="hiit">HIIT</SelectItem>
                      <SelectItem value="yoga">Yoga / Stretching</SelectItem>
                      <SelectItem value="walking">Walking</SelectItem>
                      <SelectItem value="sports">Team Sports</SelectItem>
                      <SelectItem value="swimming">Swimming</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exercise-duration">Duration</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      id="exercise-duration"
                      type="number"
                      placeholder="e.g., 45"
                      value={exerciseDuration}
                      onChange={(e) => setExerciseDuration(e.target.value)}
                      data-testid="input-exercise-duration"
                    />
                    <span className="text-muted-foreground text-sm">mins</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="exercise-intensity">Intensity</Label>
                  <Select value={exerciseIntensity} onValueChange={setExerciseIntensity}>
                    <SelectTrigger id="exercise-intensity" data-testid="select-exercise-intensity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="intense">Intense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exercise-timing">Starting in...</Label>
                  <Select value={sessionTimingFromNow} onValueChange={setSessionTimingFromNow}>
                    <SelectTrigger id="exercise-timing" data-testid="select-exercise-timing">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="90">1.5 hours</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                      <SelectItem value="180">3 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="bg-primary/5 p-3 rounded-lg">
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-primary mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Complete Workout Plan</p>
                    <p className="text-muted-foreground">Get recommendations for what to eat before, during, and after your workout, plus adjusted insulin guidance.</p>
                  </div>
                </div>
              </div>

              <Button onClick={handleQuickExercisePlan} disabled={!exerciseDuration} className="w-full" data-testid="button-get-exercise-advice">
                Plan My Workout
              </Button>
            </CardContent>
          </Card>

          {exerciseResult && (
            <Card data-testid="card-exercise-result">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Dumbbell className="h-5 w-5 text-primary" />
                      Your Workout Plan
                    </CardTitle>
                    <CardDescription className="mt-1">{exerciseResult.summary}</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setExerciseResult(null)} data-testid="button-clear-exercise-result">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-2 bg-primary/5 rounded-lg">
                    <p className="text-2xl font-bold text-primary">{exerciseResult.duration}</p>
                    <p className="text-xs text-muted-foreground">minutes</p>
                  </div>
                  <div className="p-2 bg-primary/5 rounded-lg">
                    <p className="text-2xl font-bold text-primary capitalize">{exerciseResult.intensity}</p>
                    <p className="text-xs text-muted-foreground">intensity</p>
                  </div>
                  <div className="p-2 bg-primary/5 rounded-lg">
                    <p className="text-2xl font-bold text-primary">{exerciseResult.pre.bolusReduction}</p>
                    <p className="text-xs text-muted-foreground">reduce bolus</p>
                  </div>
                </div>

                <Tabs value={exerciseResultTab} onValueChange={setExerciseResultTab}>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="before" data-testid="tab-exercise-before" className="text-xs gap-1">
                      <Play className="h-3 w-3" />
                      Before
                    </TabsTrigger>
                    <TabsTrigger value="during" data-testid="tab-exercise-during" className="text-xs gap-1">
                      <Zap className="h-3 w-3" />
                      During
                    </TabsTrigger>
                    <TabsTrigger value="after" data-testid="tab-exercise-after" className="text-xs gap-1">
                      <Heart className="h-3 w-3" />
                      After
                    </TabsTrigger>
                    <TabsTrigger value="recovery" data-testid="tab-exercise-recovery" className="text-xs gap-1">
                      <Moon className="h-3 w-3" />
                      Later
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="before" className="mt-3 space-y-3 animate-fade-in-up">
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800 space-y-3">
                      <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">{exerciseResult.pre.timing}</p>
                      
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <ArrowRight className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            <strong>Target BG:</strong> {exerciseResult.pre.targetBg} {bgUnits} before you start
                          </p>
                        </div>
                        
                        {exerciseResult.pre.carbsIfLow > 0 && (
                          <div className="flex items-start gap-2">
                            <ArrowRight className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                              <strong>If BG is below {exerciseResult.pre.lowThreshold}:</strong> eat {exerciseResult.pre.carbsIfLow}g carbs first
                            </p>
                          </div>
                        )}

                        <div className="flex items-start gap-2">
                          <ArrowRight className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            <strong>Reduce meal bolus</strong> by {exerciseResult.pre.bolusReduction} if eating before
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-blue-200 dark:border-blue-700">
                        <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <Apple className="h-3 w-3" />
                          Good snack options: {exerciseResult.pre.snackIdeas.join(", ")}
                        </p>
                      </div>
                    </div>
                    {profile.insulinDeliveryMethod === "pump" && exerciseResult.pumpTips.pre.length > 0 && (
                      <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border border-indigo-200 dark:border-indigo-800" data-testid="pump-tip-before">
                        <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase mb-2">Pump Users</p>
                        {exerciseResult.pumpTips.pre.map((tip, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <ArrowRight className="h-3.5 w-3.5 text-indigo-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-indigo-800 dark:text-indigo-200">{tip}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="during" className="mt-3 space-y-3 animate-fade-in-up">
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 space-y-3">
                      <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase">During your workout</p>
                      
                      {exerciseResult.during.needsCarbs && (
                        <div className="p-3 bg-white dark:bg-amber-900/30 rounded-lg text-center">
                          <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">{exerciseResult.during.carbsNeeded}g</p>
                          <p className="text-xs text-amber-600 dark:text-amber-400">fast-acting carbs to have ready</p>
                        </div>
                      )}

                      <div className="space-y-2">
                        {exerciseResult.during.tips.map((tip, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <ArrowRight className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-amber-800 dark:text-amber-200">{tip}</p>
                          </div>
                        ))}
                      </div>

                      {exerciseResult.during.checkBg && (
                        <div className="pt-2 border-t border-amber-200 dark:border-amber-700">
                          <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Check BG at the halfway mark
                          </p>
                        </div>
                      )}
                    </div>
                    {profile.insulinDeliveryMethod === "pump" && exerciseResult.pumpTips.during.length > 0 && (
                      <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border border-indigo-200 dark:border-indigo-800" data-testid="pump-tip-during">
                        <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase mb-2">Pump Users</p>
                        {exerciseResult.pumpTips.during.map((tip, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <ArrowRight className="h-3.5 w-3.5 text-indigo-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-indigo-800 dark:text-indigo-200">{tip}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="after" className="mt-3 space-y-3 animate-fade-in-up">
                    <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800 space-y-3">
                      <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase">{exerciseResult.post.timing}</p>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-white dark:bg-green-900/30 rounded-lg text-center">
                          <p className="text-2xl font-bold text-green-700 dark:text-green-300">{exerciseResult.post.carbs}g</p>
                          <p className="text-xs text-green-600 dark:text-green-400">carbs for recovery</p>
                        </div>
                        <div className="p-3 bg-white dark:bg-green-900/30 rounded-lg text-center">
                          <p className="text-2xl font-bold text-green-700 dark:text-green-300">{exerciseResult.post.protein}</p>
                          <p className="text-xs text-green-600 dark:text-green-400">protein for muscles</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <ArrowRight className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-green-800 dark:text-green-200">
                          <strong>Reduce recovery meal bolus</strong> by {exerciseResult.post.bolusReduction}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-green-200 dark:border-green-700">
                        <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                          <Apple className="h-3 w-3" />
                          Good options: {exerciseResult.post.snackIdeas.join(", ")}
                        </p>
                      </div>
                    </div>
                    {profile.insulinDeliveryMethod === "pump" && exerciseResult.pumpTips.post.length > 0 && (
                      <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border border-indigo-200 dark:border-indigo-800" data-testid="pump-tip-after">
                        <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase mb-2">Pump Users</p>
                        {exerciseResult.pumpTips.post.map((tip, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <ArrowRight className="h-3.5 w-3.5 text-indigo-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-indigo-800 dark:text-indigo-200">{tip}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="recovery" className="mt-3 space-y-3 animate-fade-in-up">
                    <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800 space-y-3">
                      <p className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase">Next {exerciseResult.recovery.monitorHours} hours</p>

                      <div className="space-y-2">
                        {exerciseResult.recovery.tips.map((tip, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <ArrowRight className="h-3.5 w-3.5 text-purple-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-purple-800 dark:text-purple-200">{tip}</p>
                          </div>
                        ))}
                      </div>

                      <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded text-xs text-purple-700 dark:text-purple-300">
                        <strong>Why delayed lows happen:</strong> Your muscles keep absorbing glucose for hours after exercise to replenish their stores.
                      </div>
                    </div>
                    {profile.insulinDeliveryMethod === "pump" && exerciseResult.pumpTips.recovery.length > 0 && (
                      <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border border-indigo-200 dark:border-indigo-800" data-testid="pump-tip-recovery">
                        <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase mb-2">Pump Users</p>
                        {exerciseResult.pumpTips.recovery.map((tip, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <ArrowRight className="h-3.5 w-3.5 text-indigo-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-indigo-800 dark:text-indigo-200">{tip}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>

                <p className="text-xs text-muted-foreground">[Not medical advice. Individual responses to exercise vary. Track your patterns.]</p>
              </CardContent>
            </Card>
          )}

          <Card className="border-0 bg-transparent shadow-none">
            <Collapsible open={showExerciseGuide} onOpenChange={setShowExerciseGuide}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-3 h-auto" data-testid="button-exercise-guide">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Exercise Type Guide</span>
                  </div>
                  {showExerciseGuide ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-3">
                <ScrollArea className="h-72">
                  <div className="max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm bg-transparent p-0 text-foreground">
                      {generateExerciseTypeGuide(bgUnits)}
                    </pre>
                  </div>
                </ScrollArea>
                <p className="text-xs text-muted-foreground mt-4">
                  Not medical advice. Everyone responds differently to exercise.
                </p>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          <Card className="border-dashed border-2 bg-muted/20">
            <CardContent className="p-6 text-center space-y-2">
              <Sparkles className="h-8 w-8 text-muted-foreground/50 mx-auto" />
              <p className="font-medium text-muted-foreground">Ask the AI Advisor</p>
              <p className="text-sm text-muted-foreground/70">Conversational exercise planning with personalised AI recommendations is coming in a future update.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="routines" className="mt-4 animate-fade-in-up">
          <RoutinesContent />
        </TabsContent>

        <TabsContent value="tools" className="space-y-4 mt-4 animate-fade-in-up">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Droplet className="h-5 w-5 text-red-500" />
                Hypo Treatment Calculator
              </CardTitle>
              <CardDescription>Calculate exactly how much fast-acting glucose you need</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-800 dark:text-red-200">
                  Instead of always eating 15g carbs, this calculator helps you treat hypos more precisely 
                  based on your current reading and target - helping avoid over-treating and rebounding high.
                </p>
              </div>

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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-weight">Your weight (optional)</Label>
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

              <Button onClick={calculateHypoTreatment} disabled={!currentBg || !targetBg} className="w-full" data-testid="button-calculate-hypo">
                <Calculator className="h-4 w-4 mr-2" />
                Calculate Treatment
              </Button>

              {hypoResult && (
                <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800 space-y-4">
                  <h4 className="font-medium flex items-center gap-2 text-red-800 dark:text-red-200">
                    <Droplet className="h-4 w-4" />
                    You need approximately:
                  </h4>
                  
                  <div className="text-center p-4 bg-white dark:bg-red-900/30 rounded-lg">
                    <p className="text-4xl font-bold text-red-600 dark:text-red-400">{hypoResult.carbsNeeded}g</p>
                    <p className="text-sm text-red-700 dark:text-red-300">fast-acting carbs</p>
                  </div>

                  <div className="grid gap-2 text-sm">
                    <p className="font-medium text-red-800 dark:text-red-200">That's about:</p>
                    <div className="grid gap-2 md:grid-cols-3">
                      <div className="p-2 bg-white dark:bg-red-900/30 rounded text-center">
                        <p className="text-lg font-bold text-red-700 dark:text-red-300">{hypoResult.glucoseTablets}</p>
                        <p className="text-xs text-red-600 dark:text-red-400">glucose tablets</p>
                      </div>
                      <div className="p-2 bg-white dark:bg-red-900/30 rounded text-center">
                        <p className="text-lg font-bold text-red-700 dark:text-red-300">{hypoResult.juiceMl}ml</p>
                        <p className="text-xs text-red-600 dark:text-red-400">fruit juice</p>
                      </div>
                      <div className="p-2 bg-white dark:bg-red-900/30 rounded text-center">
                        <p className="text-lg font-bold text-red-700 dark:text-red-300">{hypoResult.jellyBabies}</p>
                        <p className="text-xs text-red-600 dark:text-red-400">jelly babies</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded text-xs text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                    <strong>Remember:</strong> Wait 15 minutes, then recheck. If still low, treat again.
                  </div>
                </div>
              )}

              {parseFloat(currentBg) > 0 && parseFloat(targetBg) > 0 && parseFloat(currentBg) >= parseFloat(targetBg) && (
                <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Your current BG is already at or above your target - no treatment needed!
                  </p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                [Not medical advice. Individual responses vary. If in doubt, use the standard 15g rule. 
                For severe hypos or if you're unable to swallow, use glucagon and call for help.]
              </p>
            </CardContent>
          </Card>

          <Card className="p-4 bg-muted/30">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm">
                <p className="font-medium">Quick Reference - Standard Hypo Treatment</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li><strong>Mild hypo (3.5-3.9 {bgUnits === "mmol/L" ? "mmol/L" : "mg/dL"}):</strong> 10-15g fast carbs</li>
                  <li><strong>Moderate hypo (2.8-3.4 {bgUnits === "mmol/L" ? "mmol/L" : "mg/dL"}):</strong> 15-20g fast carbs</li>
                  <li><strong>Severe hypo (&lt;2.8 {bgUnits === "mmol/L" ? "mmol/L" : "mg/dL"}):</strong> 20-25g fast carbs, may need help</li>
                </ul>
                <p className="text-xs text-muted-foreground mt-2">
                  Always follow up with a slower-acting snack if your next meal is more than 1-2 hours away.
                </p>
              </div>
            </div>
          </Card>

        </TabsContent>

        <TabsContent value="ratios" className="space-y-4 mt-4 animate-fade-in-up">
          {cameFromRatios && (
            <Link href="/ratios">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" data-testid="button-back-to-ratios">
                <ArrowLeft className="h-4 w-4" />
                Back to Ratios
              </Button>
            </Link>
          )}
          <RatioAdviserTool settings={settings} bgUnit={bgUnits} onSettingsUpdate={(s) => setSettings(s)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
