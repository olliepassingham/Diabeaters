import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Moon, Utensils, Syringe, Activity, Wine, CheckCircle2, AlertCircle, AlertTriangle, Info, Sparkles, Calculator, Plane, Thermometer, ArrowRight, Clock } from "lucide-react";
import { Link } from "wouter";
import { storage, UserSettings, ScenarioState } from "@/lib/storage";
import { InfoTooltip, DIABETES_TERMS } from "@/components/info-tooltip";

type ReadinessLevel = "steady" | "monitor" | "alert";

interface CorrectionSuggestion {
  fullDose: number;
  suggestedDose: number;
  currentBg: number;
  targetBg: number;
  correctionFactor: number;
  bgUnits: string;
  hasIOB: boolean;
  iobWarning: string;
  exerciseWarning: string;
  alcoholWarning: string;
  sickDayWarning: string;
}

interface ReadinessResult {
  level: ReadinessLevel;
  title: string;
  message: string;
  tips: string[];
  factors: { label: string; status: "good" | "caution" | "concern"; note: string }[];
  correction: CorrectionSuggestion | null;
}

export default function Bedtime() {
  const [currentBg, setCurrentBg] = useState("");
  const [bgUnits, setBgUnits] = useState<"mmol/L" | "mg/dL">("mmol/L");
  const [hoursSinceFood, setHoursSinceFood] = useState("");
  const [hoursSinceInsulin, setHoursSinceInsulin] = useState("");
  const [hoursUntilSleep, setHoursUntilSleep] = useState("");
  const [exercisedToday, setExercisedToday] = useState(false);
  const [hadAlcohol, setHadAlcohol] = useState(false);
  const [result, setResult] = useState<ReadinessResult | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [scenarioState, setScenarioState] = useState<ScenarioState>({ travelModeActive: false, sickDayActive: false });
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const settings = storage.getSettings();
    setUserSettings(settings);
    const profile = storage.getProfile();
    if (profile?.bgUnits) {
      setBgUnits(profile.bgUnits as "mmol/L" | "mg/dL");
    }
    setProfile(storage.getProfile());
    setScenarioState(storage.getScenarioState());
  }, []);

  const isPumpUser = profile?.insulinDeliveryMethod === "pump";

  const getTargetRange = () => {
    if (userSettings?.targetBgLow && userSettings?.targetBgHigh) {
      return { low: userSettings.targetBgLow, high: userSettings.targetBgHigh };
    }
    return bgUnits === "mmol/L" ? { low: 5.0, high: 8.0 } : { low: 90, high: 144 };
  };

  const calculateCorrectionDose = (bgMmol: number, targetHighMmol: number, insulinHours: number): CorrectionSuggestion | null => {
    if (bgMmol <= targetHighMmol) return null;

    const correctionFactor = userSettings?.correctionFactor;
    if (!correctionFactor || correctionFactor <= 0) return null;

    const bgInUserUnits = bgUnits === "mg/dL" ? Math.round(bgMmol * 18) : Math.round(bgMmol * 10) / 10;
    const targetInUserUnits = bgUnits === "mg/dL" ? Math.round(targetHighMmol * 18) : Math.round(targetHighMmol * 10) / 10;
    const cfInUserUnits = correctionFactor;

    const diff = bgInUserUnits - targetInUserUnits;
    if (diff <= 0) return null;

    const fullDose = Math.round((diff / cfInUserUnits) * 10) / 10;

    const hasIOB = insulinHours < 4;
    let iobReduction = 0;
    if (insulinHours < 1) iobReduction = 0.6;
    else if (insulinHours < 2) iobReduction = 0.4;
    else if (insulinHours < 3) iobReduction = 0.2;
    else if (insulinHours < 4) iobReduction = 0.1;

    const bedtimeReduction = 0.5;
    const effectiveDose = fullDose * bedtimeReduction * (1 - iobReduction);
    const suggestedDose = Math.round(effectiveDose * 2) / 2;

    if (suggestedDose <= 0) return null;

    let iobWarning = "";
    if (insulinHours < 1) {
      iobWarning = "You have significant active insulin from less than 1 hour ago. This may bring you down on its own.";
    } else if (insulinHours < 2) {
      iobWarning = "You still have active insulin from your recent dose. It may bring you down further.";
    } else if (insulinHours < 4) {
      iobWarning = "Some insulin is still active from earlier. A smaller correction accounts for this.";
    }

    let exerciseWarning = "";
    if (exercisedToday) {
      exerciseWarning = "Exercise increases your sensitivity to insulin, especially overnight. Be extra cautious with any correction.";
    }

    let alcoholWarning = "";
    if (hadAlcohol) {
      alcoholWarning = "Alcohol can cause delayed lows. Correcting at bedtime after drinking carries extra risk.";
    }

    let sickDayWarning = "";
    if (scenarioState.sickDayActive) {
      sickDayWarning = "You're in sick day mode. Illness can make blood glucose harder to predict. Consider a smaller correction or consult your diabetes team.";
    }

    return {
      fullDose,
      suggestedDose,
      currentBg: bgInUserUnits,
      targetBg: targetInUserUnits,
      correctionFactor: cfInUserUnits,
      bgUnits,
      hasIOB,
      iobWarning,
      exerciseWarning,
      alcoholWarning,
      sickDayWarning,
    };
  };

  const calculateReadiness = () => {
    if (!currentBg) return;

    const bg = parseFloat(currentBg);
    const foodHours = hoursSinceFood ? parseFloat(hoursSinceFood) : 999;
    const insulinHours = hoursSinceInsulin ? parseFloat(hoursSinceInsulin) : 999;
    const sleepHours = hoursUntilSleep ? parseFloat(hoursUntilSleep) : null;
    
    if (isNaN(bg)) return;

    const bgMmol = bgUnits === "mg/dL" ? bg / 18 : bg;
    const targetRange = getTargetRange();
    const targetLowMmol = bgUnits === "mg/dL" ? targetRange.low / 18 : targetRange.low;
    const targetHighMmol = bgUnits === "mg/dL" ? targetRange.high / 18 : targetRange.high;

    const factors: ReadinessResult["factors"] = [];
    let concernCount = 0;
    let cautionCount = 0;

    if (bgMmol < targetLowMmol - 1) {
      factors.push({ label: "Blood glucose", status: "concern", note: "Below target - consider a small snack" });
      concernCount++;
    } else if (bgMmol < targetLowMmol) {
      factors.push({ label: "Blood glucose", status: "caution", note: "On the lower side of target" });
      cautionCount++;
    } else if (bgMmol > targetHighMmol + 3) {
      factors.push({ label: "Blood glucose", status: "caution", note: "Higher than ideal - a bedtime correction may help" });
      cautionCount++;
    } else if (bgMmol > targetHighMmol) {
      factors.push({ label: "Blood glucose", status: "caution", note: "Slightly above target" });
      cautionCount++;
    } else {
      factors.push({ label: "Blood glucose", status: "good", note: "In a comfortable range" });
    }

    if (foodHours < 2) {
      factors.push({ label: "Last food", status: "caution", note: "Still digesting - glucose may rise" });
      cautionCount++;
    } else if (foodHours < 3) {
      factors.push({ label: "Last food", status: "good", note: "Mostly digested" });
    } else {
      factors.push({ label: "Last food", status: "good", note: "Fully digested" });
    }

    if (insulinHours < 2) {
      factors.push({ label: "Last bolus", status: "caution", note: "Insulin still active - watch for drops" });
      cautionCount++;
    } else if (insulinHours < 4) {
      factors.push({ label: "Last bolus", status: "good", note: "Some insulin still working" });
    } else {
      factors.push({ label: "Last bolus", status: "good", note: "No active bolus insulin" });
    }

    if (exercisedToday) {
      factors.push({ label: "Exercise today", status: "caution", note: "Increased hypo risk overnight" });
      cautionCount++;
    }

    if (hadAlcohol) {
      factors.push({ label: "Alcohol", status: "concern", note: "Can cause delayed lows - set an alarm" });
      concernCount++;
    }

    if (sleepHours !== null) {
      if (sleepHours <= 0.25) {
        factors.push({ label: "Time to sleep", status: "good", note: "Heading to bed now" });
      } else if (sleepHours <= 1) {
        factors.push({ label: "Time to sleep", status: "good", note: "Soon - good time to do this check" });
      } else if (sleepHours <= 2) {
        factors.push({ label: "Time to sleep", status: "caution", note: "Glucose may change before bed - recheck closer to sleep" });
        cautionCount++;
      } else {
        factors.push({ label: "Time to sleep", status: "caution", note: "Still a while yet - consider rechecking nearer bedtime" });
        cautionCount++;
      }
    }

    if (scenarioState.sickDayActive) {
      const severity = scenarioState.sickDaySeverity || "moderate";
      factors.push({
        label: "Sick day",
        status: severity === "severe" ? "concern" : "caution",
        note: "Being unwell affects overnight glucose - check more often",
      });
      if (severity === "severe") concernCount++;
      else cautionCount++;
    }

    if (scenarioState.travelModeActive) {
      const hasTimezoneShift = scenarioState.travelTimezoneShift && Math.abs(scenarioState.travelTimezoneShift) >= 2;
      factors.push({
        label: "Travel mode",
        status: "caution",
        note: hasTimezoneShift
          ? "Timezone changes can affect overnight glucose patterns"
          : "Travel and routine changes can affect overnight levels",
      });
      cautionCount++;
    }

    let level: ReadinessLevel;
    let title: string;
    let message: string;
    const tips: string[] = [];

    if (concernCount >= 2 || (concernCount >= 1 && cautionCount >= 2)) {
      level = "alert";
      title = "Set an Alarm Tonight";
      message = "There are a few things that could affect your overnight glucose. Setting an alarm to check would be wise.";
      tips.push("Set an alarm for 2-3am to check your levels");
      tips.push("Keep fast-acting glucose by your bed");
      if (bgMmol < targetLowMmol) tips.push("Have a small snack before bed");
      if (hadAlcohol) tips.push("Alcohol can cause delayed lows for up to 24 hours");
      if (hadAlcohol && isPumpUser) tips.push("Check your pump's IOB display before deciding on a correction");
      if (exercisedToday) tips.push("Exercise can cause lows for up to 24 hours after");
      if (exercisedToday && isPumpUser) tips.push("Consider setting a temporary basal rate at 80-90% overnight after exercise");
      if (sleepHours !== null && sleepHours > 1) tips.push("Re-run this check closer to when you actually go to bed");
    } else if (cautionCount >= 2 || concernCount >= 1) {
      level = "monitor";
      title = "Worth Keeping an Eye On";
      message = "Things look reasonable, but there's a factor or two to be aware of. You'll probably be fine, but stay mindful.";
      if (foodHours < 2) tips.push("Your glucose may rise as food digests");
      if (insulinHours < 2) tips.push("Check again before you actually fall asleep");
      if (exercisedToday) tips.push("Keep a snack nearby just in case");
      if (sleepHours !== null && sleepHours > 1.5) tips.push("You've got time - recheck before you head to bed");
      tips.push("If you wake in the night, do a quick check");
    } else {
      level = "steady";
      title = "Looking Good for Sleep";
      message = "Your glucose looks stable, no recent food or insulin actively working. You're set for a restful night.";
      tips.push("Sweet dreams - you've set yourself up well");
      tips.push("Your glucose is in a comfortable range for sleep");
      if (isPumpUser) tips.push("Your pump's basal rate should keep you steady overnight");
    }

    if (scenarioState.sickDayActive) {
      tips.push("When unwell, set an alarm to check ketones and glucose overnight");
      if (scenarioState.sickDaySeverity === "severe") {
        tips.push("With severe illness, consider checking every 2-3 hours overnight");
      }
    }

    if (scenarioState.travelModeActive) {
      const hasTimezoneShift = scenarioState.travelTimezoneShift && Math.abs(scenarioState.travelTimezoneShift) >= 2;
      if (hasTimezoneShift) {
        tips.push("Your body clock may still be adjusting - overnight patterns could differ from normal");
      }
      tips.push("Keep your hypo kit easily accessible in an unfamiliar room");
    }

    const correction = calculateCorrectionDose(bgMmol, targetHighMmol, insulinHours);

    setResult({ level, title, message, tips, factors, correction });
  };

  const getLevelColors = (level: ReadinessLevel) => {
    switch (level) {
      case "steady":
        return {
          bg: "bg-green-50 dark:bg-green-950/30",
          border: "border-green-200 dark:border-green-800",
          icon: "text-green-600 dark:text-green-400",
          title: "text-green-700 dark:text-green-300",
        };
      case "monitor":
        return {
          bg: "bg-amber-50 dark:bg-amber-950/30",
          border: "border-amber-200 dark:border-amber-800",
          icon: "text-amber-600 dark:text-amber-400",
          title: "text-amber-700 dark:text-amber-300",
        };
      case "alert":
        return {
          bg: "bg-red-50 dark:bg-red-950/30",
          border: "border-red-200 dark:border-red-800",
          icon: "text-red-600 dark:text-red-400",
          title: "text-red-700 dark:text-red-300",
        };
    }
  };

  const getStatusIcon = (status: "good" | "caution" | "concern") => {
    switch (status) {
      case "good":
        return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case "caution":
        return <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      case "concern":
        return <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />;
    }
  };

  const canCalculate = currentBg && !isNaN(parseFloat(currentBg));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {(scenarioState.sickDayActive || scenarioState.travelModeActive) && (
        <div className="flex flex-wrap gap-2" data-testid="container-active-scenarios">
          {scenarioState.sickDayActive && (
            <Link href="/scenarios?tab=sick-day">
              <Badge variant="secondary" className="cursor-pointer" data-testid="badge-sick-day-active">
                <Thermometer className="h-3 w-3 mr-1" />
                Sick Day Active ({scenarioState.sickDaySeverity || "moderate"})
              </Badge>
            </Link>
          )}
          {scenarioState.travelModeActive && (
            <Link href="/scenarios?tab=travel">
              <Badge variant="secondary" className="cursor-pointer" data-testid="badge-travel-active">
                <Plane className="h-3 w-3 mr-1" />
                Travel Mode Active{scenarioState.travelDestination ? ` — ${scenarioState.travelDestination}` : ""}
              </Badge>
            </Link>
          )}
        </div>
      )}

      <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-indigo-100 dark:border-indigo-900">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-900">
              <Moon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <CardTitle className="text-xl">Bedtime Readiness Check</CardTitle>
              <CardDescription>
                A calm check to see if you're set for a steady night
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="current-bg" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Current blood glucose
              </Label>
              <div className="flex gap-2">
                <Input
                  id="current-bg"
                  type="number"
                  step="0.1"
                  placeholder={bgUnits === "mmol/L" ? "e.g., 7.2" : "e.g., 130"}
                  value={currentBg}
                  onChange={(e) => setCurrentBg(e.target.value)}
                  className="flex-1"
                  data-testid="input-bedtime-bg"
                />
                <span className="flex items-center text-sm text-muted-foreground px-2">{bgUnits}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hours-food" className="flex items-center gap-2">
                <Utensils className="h-4 w-4" />
                Hours since last food
              </Label>
              <Select value={hoursSinceFood} onValueChange={setHoursSinceFood}>
                <SelectTrigger id="hours-food" data-testid="select-hours-food">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">Less than 1 hour</SelectItem>
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="2">2 hours</SelectItem>
                  <SelectItem value="3">3 hours</SelectItem>
                  <SelectItem value="4">4+ hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hours-insulin" className="flex items-center gap-2">
                <Syringe className="h-4 w-4" />
                Hours since last mealtime dose
                <InfoTooltip {...DIABETES_TERMS.bolus} />
              </Label>
              <Select value={hoursSinceInsulin} onValueChange={setHoursSinceInsulin}>
                <SelectTrigger id="hours-insulin" data-testid="select-hours-insulin">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">Less than 1 hour</SelectItem>
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="2">2 hours</SelectItem>
                  <SelectItem value="3">3 hours</SelectItem>
                  <SelectItem value="4">4+ hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hours-sleep" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                How long until you plan to sleep?
              </Label>
              <Select value={hoursUntilSleep} onValueChange={setHoursUntilSleep}>
                <SelectTrigger id="hours-sleep" data-testid="select-hours-sleep">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.25">Going to bed now</SelectItem>
                  <SelectItem value="0.5">About 30 minutes</SelectItem>
                  <SelectItem value="1">About 1 hour</SelectItem>
                  <SelectItem value="1.5">About 1.5 hours</SelectItem>
                  <SelectItem value="2">About 2 hours</SelectItem>
                  <SelectItem value="3">3+ hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="exercised" className="flex items-center gap-2 cursor-pointer">
                  <Activity className="h-4 w-4" />
                  Exercised today?
                </Label>
                <Switch
                  id="exercised"
                  checked={exercisedToday}
                  onCheckedChange={setExercisedToday}
                  data-testid="switch-exercised"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="alcohol" className="flex items-center gap-2 cursor-pointer">
                  <Wine className="h-4 w-4" />
                  Had alcohol?
                </Label>
                <Switch
                  id="alcohol"
                  checked={hadAlcohol}
                  onCheckedChange={setHadAlcohol}
                  data-testid="switch-alcohol"
                />
              </div>
            </div>
          </div>

          <Button 
            onClick={calculateReadiness} 
            disabled={!canCalculate}
            className="w-full"
            data-testid="button-check-bedtime"
          >
            <Moon className="h-4 w-4 mr-2" />
            Check Bedtime Readiness
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card className={`${getLevelColors(result.level).bg} ${getLevelColors(result.level).border} border`} data-testid="card-bedtime-result">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start gap-3">
              {result.level === "steady" && (
                <CheckCircle2 className={`h-8 w-8 ${getLevelColors(result.level).icon}`} />
              )}
              {result.level === "monitor" && (
                <AlertCircle className={`h-8 w-8 ${getLevelColors(result.level).icon}`} />
              )}
              {result.level === "alert" && (
                <AlertTriangle className={`h-8 w-8 ${getLevelColors(result.level).icon}`} />
              )}
              <div>
                <h3 className={`text-xl font-semibold ${getLevelColors(result.level).title}`} data-testid="text-bedtime-result-title">
                  {result.title}
                </h3>
                <p className="text-muted-foreground mt-1" data-testid="text-bedtime-result-message">{result.message}</p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground">Your factors:</h4>
              <div className="grid gap-2 md:grid-cols-2" data-testid="container-bedtime-factors">
                {result.factors.map((factor, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-background/50 rounded-lg" data-testid={`card-factor-${i}`}>
                    {getStatusIcon(factor.status)}
                    <div>
                      <p className="text-sm font-medium" data-testid={`text-factor-label-${i}`}>{factor.label}</p>
                      <p className="text-xs text-muted-foreground" data-testid={`text-factor-note-${i}`}>{factor.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {result.correction && (
              <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20" data-testid="card-correction-suggestion">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    <h4 className="font-medium text-sm">Bedtime Correction Suggestion</h4>
                  </div>

                  <div className="p-3 rounded-lg bg-background/60 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Current:</span>
                      <span className="font-mono font-medium" data-testid="text-correction-current-bg">
                        {result.correction.currentBg} {result.correction.bgUnits}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Target:</span>
                      <span className="font-mono font-medium" data-testid="text-correction-target-bg">
                        {result.correction.targetBg} {result.correction.bgUnits}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ({result.correction.currentBg} - {result.correction.targetBg}) / {result.correction.correctionFactor} = {result.correction.fullDose}u full correction
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-purple-100/50 dark:bg-purple-900/30">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Suggested bedtime dose</p>
                        <p className="text-2xl font-bold font-mono text-purple-700 dark:text-purple-300" data-testid="text-correction-suggested-dose">
                          {result.correction.suggestedDose}u
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        ~{Math.round((result.correction.suggestedDose / result.correction.fullDose) * 100)}% of full dose
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Reduced from {result.correction.fullDose}u because bedtime corrections carry overnight hypo risk. Many diabetes teams recommend a cautious approach at night.
                    </p>
                    {isPumpUser && (
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1" data-testid="text-pump-correction-tip">
                        Your pump tracks active insulin (IOB). Check your pump's IOB before correcting — it may already account for recent boluses.
                      </p>
                    )}
                  </div>

                  {(result.correction.hasIOB || result.correction.exerciseWarning || result.correction.alcoholWarning || result.correction.sickDayWarning) && (
                    <div className="space-y-2">
                      {result.correction.iobWarning && (
                        <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-800 dark:text-amber-200" data-testid="text-correction-iob-warning">{result.correction.iobWarning}</p>
                        </div>
                      )}
                      {result.correction.exerciseWarning && (
                        <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                          <Activity className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-800 dark:text-amber-200" data-testid="text-correction-exercise-warning">{result.correction.exerciseWarning}</p>
                        </div>
                      )}
                      {result.correction.alcoholWarning && (
                        <div className="flex items-start gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/30">
                          <Wine className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-red-800 dark:text-red-200" data-testid="text-correction-alcohol-warning">{result.correction.alcoholWarning}</p>
                        </div>
                      )}
                      {result.correction.sickDayWarning && (
                        <div className="flex items-start gap-2 p-2 rounded-lg bg-orange-50 dark:bg-orange-950/30">
                          <Thermometer className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-orange-800 dark:text-orange-200" data-testid="text-correction-sick-warning">{result.correction.sickDayWarning}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {hoursUntilSleep && parseFloat(hoursUntilSleep) > 1.5 && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                      <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-800 dark:text-blue-200" data-testid="text-correction-timing-note">
                        You're not sleeping just yet. If you correct now, recheck before bed as your levels may change.
                      </p>
                    </div>
                  )}

                  <p className="text-xs italic text-muted-foreground" data-testid="text-correction-disclaimer">
                    [Not medical advice. This is a calculation based on your settings, not a prescription. Always follow your diabetes team's guidance on bedtime corrections.]
                  </p>
                </CardContent>
              </Card>
            )}

            {isPumpUser && result && (result.level === "monitor" || result.level === "alert") && (
              <Card className="border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20" data-testid="card-pump-overnight">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Syringe className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <h4 className="font-medium text-sm">Pump Overnight Tips</h4>
                  </div>
                  <div className="space-y-1.5 text-sm text-indigo-800 dark:text-indigo-200">
                    {exercisedToday && (
                      <p>Consider a temporary basal rate at 80-90% for 4-6 hours overnight to reduce post-exercise hypo risk.</p>
                    )}
                    {hadAlcohol && (
                      <p>Alcohol can cause delayed lows. Consider reducing basal by 10-20% overnight and setting an alarm.</p>
                    )}
                    <p>If your BG is trending down, a small temporary basal reduction (80-90%) may help prevent an overnight low.</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {result.tips.length > 0 && (
              <div className="space-y-2" data-testid="container-bedtime-tips">
                <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Tips for tonight:
                </h4>
                <ul className="space-y-1">
                  {result.tips.map((tip, i) => (
                    <li key={i} className="text-sm flex items-start gap-2" data-testid={`text-tip-${i}`}>
                      <span className="text-muted-foreground">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-bedtime-disclaimer">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong>About this check:</strong> This tool looks at common factors that affect overnight glucose stability. 
                It's designed to help you build awareness and confidence, not to replace your own judgement or medical advice.
              </p>
              <p>
                Everyone's diabetes is different. Over time, you'll learn which factors matter most for your own steady nights.
              </p>
              <p className="text-xs italic" data-testid="text-bedtime-disclaimer">
                [Not medical advice. Always follow your healthcare team's guidance for overnight management.]
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
