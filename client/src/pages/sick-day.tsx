import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Activity, Info, Plane, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { storage, UserSettings } from "@/lib/storage";

interface SickDayResults {
  correctionDose: number;
  breakfastRatio: string;
  lunchRatio: string;
  dinnerRatio: string;
  snackRatio: string;
  basalAdjustment: string;
  hydrationNote: string;
  monitoringFrequency: string;
}

function calculateSickDayRecommendations(
  tdd: number,
  bgLevel: number,
  severity: string,
  settings: UserSettings
): SickDayResults {
  const correctionFactor = settings.correctionFactor || Math.round(1800 / tdd);
  const targetBg = settings.targetBgHigh || 120;
  
  let correctionDose = 0;
  if (bgLevel > targetBg) {
    correctionDose = Math.round((bgLevel - targetBg) / correctionFactor * 10) / 10;
  }

  const adjustRatio = (ratio: string | undefined, multiplier: number): string => {
    if (!ratio) return `1:${Math.round(10 * multiplier)}`;
    const match = ratio.match(/1:(\d+)/);
    if (match) {
      const originalRatio = parseInt(match[1]);
      return `1:${Math.round(originalRatio * multiplier)}`;
    }
    return ratio;
  };

  let ratioMultiplier = 1;
  let basalAdjustment = "No change recommended";
  let hydrationNote = "Drink plenty of sugar-free fluids";
  let monitoringFrequency = "Check blood glucose every 4 hours";

  switch (severity) {
    case "minor":
      ratioMultiplier = 0.9;
      basalAdjustment = "Consider 10% increase if blood glucose runs high";
      monitoringFrequency = "Check blood glucose every 4-6 hours";
      break;
    case "moderate":
      ratioMultiplier = 0.8;
      basalAdjustment = "Consider 10-20% increase if blood glucose remains elevated";
      hydrationNote = "Stay well hydrated with sugar-free fluids. Consider electrolyte drinks.";
      monitoringFrequency = "Check blood glucose every 2-4 hours";
      break;
    case "severe":
      ratioMultiplier = 0.7;
      basalAdjustment = "Consider 20% increase, but monitor closely for lows if unable to eat";
      hydrationNote = "Critical: Stay hydrated. If vomiting, seek medical attention.";
      monitoringFrequency = "Check blood glucose and ketones every 2 hours";
      break;
  }

  return {
    correctionDose,
    breakfastRatio: adjustRatio(settings.breakfastRatio, ratioMultiplier),
    lunchRatio: adjustRatio(settings.lunchRatio, ratioMultiplier),
    dinnerRatio: adjustRatio(settings.dinnerRatio, ratioMultiplier),
    snackRatio: adjustRatio(settings.snackRatio, ratioMultiplier),
    basalAdjustment,
    hydrationNote,
    monitoringFrequency,
  };
}

export default function SickDay() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<UserSettings>({});
  const [tdd, setTdd] = useState("");
  const [bgLevel, setBgLevel] = useState("");
  const [severity, setSeverity] = useState<string>("");
  const [results, setResults] = useState<SickDayResults | null>(null);

  useEffect(() => {
    const storedSettings = storage.getSettings();
    setSettings(storedSettings);
    if (storedSettings.tdd) {
      setTdd(storedSettings.tdd.toString());
    }
  }, []);

  const handleCalculate = () => {
    if (!tdd || !bgLevel || !severity) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields to calculate recommendations.",
        variant: "destructive",
      });
      return;
    }

    const tddNum = parseFloat(tdd);
    const bgNum = parseFloat(bgLevel);

    if (isNaN(tddNum) || isNaN(bgNum) || tddNum <= 0 || bgNum <= 0) {
      toast({
        title: "Invalid values",
        description: "Please enter valid positive numbers for TDD and blood glucose.",
        variant: "destructive",
      });
      return;
    }

    const recommendations = calculateSickDayRecommendations(tddNum, bgNum, severity, settings);
    
    if (isNaN(recommendations.correctionDose)) {
      toast({
        title: "Calculation error",
        description: "Unable to calculate recommendations. Please check your input values.",
        variant: "destructive",
      });
      return;
    }
    
    setResults(recommendations);

    storage.addActivityLog({
      activityType: "sick_day_calculation",
      activityDetails: `TDD: ${tddNum}, BG: ${bgNum}, Severity: ${severity}`,
      recommendation: `Correction: ${recommendations.correctionDose}u, Ratios adjusted`,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Sick Day Adviser</h1>
        <p className="text-muted-foreground mt-1">
          Calculate insulin adjustments when you're feeling unwell.
        </p>
      </div>

      <div className="grid gap-6 max-w-4xl">
        <Card className="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-900 dark:text-yellow-100">Not Medical Advice</p>
                <p className="text-yellow-800 dark:text-yellow-200 mt-1">
                  This tool provides educational estimates only based on general guidelines. 
                  Always consult your healthcare provider when sick, especially if blood glucose 
                  is consistently high, you have ketones, or symptoms worsen.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Input Information</CardTitle>
            <CardDescription>
              Enter your details to calculate sick day adjustments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tdd">Total Daily Dose (TDD) - Units</Label>
              <Input
                id="tdd"
                type="number"
                placeholder="e.g., 40"
                value={tdd}
                onChange={(e) => setTdd(e.target.value)}
                data-testid="input-tdd"
              />
              <p className="text-xs text-muted-foreground">
                Your typical total insulin dose per day (basal + bolus combined)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="severity">Illness Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger id="severity" data-testid="select-severity">
                  <SelectValue placeholder="Select severity level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minor">Minor (slight cold, feeling off)</SelectItem>
                  <SelectItem value="moderate">Moderate (fever, flu symptoms)</SelectItem>
                  <SelectItem value="severe">Severe (high fever, vomiting, unable to eat)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bg-level">Current Blood Glucose (mg/dL)</Label>
              <Input
                id="bg-level"
                type="number"
                placeholder="e.g., 180"
                value={bgLevel}
                onChange={(e) => setBgLevel(e.target.value)}
                data-testid="input-bg-level"
              />
            </div>

            <Button 
              onClick={handleCalculate} 
              className="w-full" 
              data-testid="button-calculate"
            >
              <Activity className="h-4 w-4 mr-2" />
              Calculate Recommendations
            </Button>
          </CardContent>
        </Card>

        {results && (
          <Card className="border-primary/50">
            <CardHeader>
              <CardTitle>Sick Day Recommendations</CardTitle>
              <CardDescription>Based on your current condition</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {results.correctionDose > 0 && (
                <div className="p-4 bg-primary/5 rounded-lg">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm text-muted-foreground">Suggested Correction Dose:</span>
                    <span className="text-2xl font-semibold" data-testid="text-correction-dose">
                      {results.correctionDose} units
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    To help bring your current blood glucose toward target
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Adjusted Mealtime Ratios</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Breakfast</p>
                    <p className="font-semibold mt-1" data-testid="text-breakfast-ratio">{results.breakfastRatio}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Lunch</p>
                    <p className="font-semibold mt-1" data-testid="text-lunch-ratio">{results.lunchRatio}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Dinner</p>
                    <p className="font-semibold mt-1" data-testid="text-dinner-ratio">{results.dinnerRatio}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Snacks</p>
                    <p className="font-semibold mt-1" data-testid="text-snack-ratio">{results.snackRatio}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ratios show: 1 unit of insulin per X grams of carbohydrates (tighter than usual)
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Basal Insulin</p>
                      <p className="text-xs text-muted-foreground">{results.basalAdjustment}</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="font-medium text-sm text-blue-900 dark:text-blue-100">Hydration</p>
                  <p className="text-xs text-blue-800 dark:text-blue-200">{results.hydrationNote}</p>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="font-medium text-sm">Monitoring</p>
                  <p className="text-xs text-muted-foreground">{results.monitoringFrequency}</p>
                </div>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                <p className="font-medium">Important Reminders:</p>
                <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                  <li>Never skip basal insulin, even if not eating</li>
                  <li>Check for ketones if BG remains above 250 mg/dL</li>
                  <li>Seek medical help if you have moderate/large ketones</li>
                  <li>Contact your healthcare team if symptoms worsen</li>
                </ul>
              </div>

              <Card className="border-yellow-500/30 bg-yellow-50/30 dark:bg-yellow-950/10">
                <CardContent className="p-3">
                  <p className="text-xs text-yellow-800 dark:text-yellow-200">
                    <strong>Disclaimer:</strong> These recommendations are educational estimates based on 
                    general sick day guidelines. Individual insulin needs vary significantly. Always follow 
                    your healthcare provider's specific instructions for sick day management.
                  </p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        )}

        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Other Scenarios</CardTitle>
            <CardDescription>Explore other situation-specific guidance</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/travel">
              <div className="flex items-center justify-between p-3 rounded-lg hover-elevate cursor-pointer bg-background">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Plane className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Travel Mode</p>
                    <p className="text-xs text-muted-foreground">Plan supplies for your trips</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
