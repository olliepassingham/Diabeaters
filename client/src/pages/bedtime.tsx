import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Moon, Utensils, Syringe, Activity, Wine, CheckCircle2, AlertCircle, AlertTriangle, Info, Sparkles } from "lucide-react";
import { storage, UserSettings } from "@/lib/storage";

type ReadinessLevel = "steady" | "monitor" | "alert";

interface ReadinessResult {
  level: ReadinessLevel;
  title: string;
  message: string;
  tips: string[];
  factors: { label: string; status: "good" | "caution" | "concern"; note: string }[];
}

export default function Bedtime() {
  const [currentBg, setCurrentBg] = useState("");
  const [bgUnits, setBgUnits] = useState<"mmol/L" | "mg/dL">("mmol/L");
  const [hoursSinceFood, setHoursSinceFood] = useState("");
  const [hoursSinceInsulin, setHoursSinceInsulin] = useState("");
  const [exercisedToday, setExercisedToday] = useState(false);
  const [hadAlcohol, setHadAlcohol] = useState(false);
  const [result, setResult] = useState<ReadinessResult | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);

  useEffect(() => {
    const settings = storage.getSettings();
    setUserSettings(settings);
  }, []);

  const getTargetRange = () => {
    if (userSettings?.targetBgLow && userSettings?.targetBgHigh) {
      return { low: userSettings.targetBgLow, high: userSettings.targetBgHigh };
    }
    return bgUnits === "mmol/L" ? { low: 5.0, high: 8.0 } : { low: 90, high: 144 };
  };

  const calculateReadiness = () => {
    if (!currentBg) return;

    const bg = parseFloat(currentBg);
    const foodHours = hoursSinceFood ? parseFloat(hoursSinceFood) : 999;
    const insulinHours = hoursSinceInsulin ? parseFloat(hoursSinceInsulin) : 999;
    
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
      factors.push({ label: "Blood glucose", status: "caution", note: "Higher than ideal - may come down overnight" });
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
      if (exercisedToday) tips.push("Exercise can cause lows for up to 24 hours after");
    } else if (cautionCount >= 2 || concernCount >= 1) {
      level = "monitor";
      title = "Worth Keeping an Eye On";
      message = "Things look reasonable, but there's a factor or two to be aware of. You'll probably be fine, but stay mindful.";
      if (foodHours < 2) tips.push("Your glucose may rise as food digests");
      if (insulinHours < 2) tips.push("Check again before you actually fall asleep");
      if (exercisedToday) tips.push("Keep a snack nearby just in case");
      tips.push("If you wake in the night, do a quick check");
    } else {
      level = "steady";
      title = "Looking Good for Sleep";
      message = "Your glucose looks stable, no recent food or insulin actively working. You're set for a restful night.";
      tips.push("Sweet dreams - you've set yourself up well");
      tips.push("Your glucose is in a comfortable range for sleep");
    }

    setResult({ level, title, message, tips, factors });
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
    <div className="space-y-6">
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
                <Select value={bgUnits} onValueChange={(v: "mmol/L" | "mg/dL") => setBgUnits(v)}>
                  <SelectTrigger className="w-24" data-testid="select-bedtime-bg-units">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mmol/L">mmol/L</SelectItem>
                    <SelectItem value="mg/dL">mg/dL</SelectItem>
                  </SelectContent>
                </Select>
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
                Hours since last bolus
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
