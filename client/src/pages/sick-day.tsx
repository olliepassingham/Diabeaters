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
import { FaceLogoWatermark } from "@/components/face-logo";

// Conversion helpers for blood glucose units
const mgdlToMmol = (mgdl: number) => Math.round(mgdl / 18 * 10) / 10;
const mmolToMgdl = (mmol: number) => Math.round(mmol * 18);

interface SickDayResults {
  correctionDose: number;
  correctionExplanation: string;
  baseCorrectionDose: number;
  severityModifier: number;
  bgZoneModifier: number;
  breakfastRatio: string;
  lunchRatio: string;
  dinnerRatio: string;
  snackRatio: string;
  basalAdjustment: string;
  hydrationNote: string;
  monitoringFrequency: string;
  ketoneWarning: string;
  stackingWarning: string;
}

// Blood glucose zones for tiered correction approach
const BG_ZONES = {
  SLIGHTLY_HIGH: { min: 0, max: 180, name: "Slightly Elevated" },
  MODERATELY_HIGH: { min: 180, max: 250, name: "Moderately Elevated" },
  HIGH: { min: 250, max: 300, name: "High" },
  VERY_HIGH: { min: 300, max: 400, name: "Very High" },
  CRITICAL: { min: 400, max: Infinity, name: "Critical" },
};

function calculateSickDayRecommendations(
  tdd: number,
  bgLevel: number,
  severity: string,
  settings: UserSettings,
  bgUnits: string
): SickDayResults {
  // Default correction factor uses the 1800 rule (for mg/dL)
  let correctionFactor = settings.correctionFactor || Math.round(1800 / tdd);
  
  // Default target is 120 mg/dL (6.7 mmol/L)
  let targetBg = 120;
  if (settings.targetBgHigh) {
    targetBg = bgUnits === "mmol/L" ? mmolToMgdl(settings.targetBgHigh) : settings.targetBgHigh;
  }
  
  // Convert correction factor if stored in mmol/L terms
  if (settings.correctionFactor && bgUnits === "mmol/L" && settings.correctionFactor < 10) {
    correctionFactor = settings.correctionFactor * 18;
  }

  // === SOPHISTICATED CORRECTION DOSE CALCULATION ===
  
  // Step 1: Calculate base correction dose
  let baseCorrectionDose = 0;
  if (bgLevel > targetBg) {
    baseCorrectionDose = (bgLevel - targetBg) / correctionFactor;
  }

  // Step 2: Apply severity modifier
  // During illness, insulin resistance increases, but we must balance against:
  // - Risk of insulin stacking if absorption is delayed
  // - Unpredictable BG swings from illness
  // - Potential for hypoglycemia if unable to eat
  let severityModifier = 1.0;
  let severityExplanation = "";
  
  switch (severity) {
    case "minor":
      // Minor illness: slight increase in resistance, full correction appropriate
      severityModifier = 1.0;
      severityExplanation = "Full correction - minor illness has minimal impact on insulin absorption";
      break;
    case "moderate":
      // Moderate illness: noticeable resistance but also absorption concerns
      // Use 80% of calculated dose to avoid stacking risk
      severityModifier = 0.8;
      severityExplanation = "80% of calculated dose - being cautious as insulin may absorb unpredictably";
      break;
    case "severe":
      // Severe illness: high resistance but HIGH risk of complications
      // Conservative approach - use only 60% and recommend more frequent monitoring
      severityModifier = 0.6;
      severityExplanation = "60% of calculated dose - extra caution to prevent dangerous lows if you can't eat";
      break;
  }

  // Step 3: Apply blood glucose zone modifier
  // Higher BG levels may warrant slightly more aggressive correction
  // But extremely high levels need medical attention, not just more insulin
  let bgZoneModifier = 1.0;
  let bgZoneExplanation = "";
  
  if (bgLevel <= BG_ZONES.SLIGHTLY_HIGH.max) {
    bgZoneModifier = 1.0;
    bgZoneExplanation = "Standard correction for slightly elevated range";
  } else if (bgLevel <= BG_ZONES.MODERATELY_HIGH.max) {
    // Moderate elevation: can be slightly more assertive
    bgZoneModifier = 1.1;
    bgZoneExplanation = "10% boost for moderately elevated glucose";
  } else if (bgLevel <= BG_ZONES.HIGH.max) {
    // High but not critical: balance urgency with safety
    bgZoneModifier = 1.15;
    bgZoneExplanation = "15% boost for high glucose (monitor closely)";
  } else if (bgLevel <= BG_ZONES.VERY_HIGH.max) {
    // Very high: serious but cap the boost to avoid over-correction
    bgZoneModifier = 1.2;
    bgZoneExplanation = "20% boost for very high glucose (check ketones immediately)";
  } else {
    // Critical: DO NOT increase further - needs medical attention
    bgZoneModifier = 1.0;
    bgZoneExplanation = "No additional boost at critical levels - seek medical help";
  }

  // Step 4: Calculate final dose with safety caps
  let correctionDose = baseCorrectionDose * severityModifier * bgZoneModifier;
  
  // Safety cap: never suggest more than 20% of TDD as a single correction
  const maxSafeCorrection = tdd * 0.2;
  if (correctionDose > maxSafeCorrection) {
    correctionDose = maxSafeCorrection;
  }
  
  // Round to 0.5 unit increments for practical dosing
  correctionDose = Math.round(correctionDose * 2) / 2;
  baseCorrectionDose = Math.round(baseCorrectionDose * 10) / 10;

  // Build explanation
  const correctionExplanation = baseCorrectionDose > 0 
    ? `Base: ${baseCorrectionDose}u × ${severityModifier} (safety) × ${bgZoneModifier} (BG zone) = ${correctionDose}u`
    : "No correction needed - blood glucose is within target";

  // === RATIO AND OTHER ADJUSTMENTS ===
  
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
  let ketoneWarning = "";
  let stackingWarning = "";

  switch (severity) {
    case "minor":
      ratioMultiplier = 0.9;
      basalAdjustment = "Consider 10% increase if blood glucose runs high";
      monitoringFrequency = "Check blood glucose every 4-6 hours";
      stackingWarning = "Wait at least 3 hours between corrections to assess effectiveness";
      break;
    case "moderate":
      ratioMultiplier = 0.8;
      basalAdjustment = "Consider 10-20% increase if blood glucose remains elevated";
      hydrationNote = "Stay well hydrated with sugar-free fluids. Consider electrolyte drinks.";
      monitoringFrequency = "Check blood glucose every 2-4 hours";
      ketoneWarning = bgLevel > 250 ? "Check ketones now and every 2-4 hours while elevated" : "";
      stackingWarning = "Wait at least 4 hours between corrections - absorption may be delayed";
      break;
    case "severe":
      ratioMultiplier = 0.7;
      basalAdjustment = "Consider 20% increase, but monitor closely for lows if unable to eat";
      hydrationNote = "Critical: Stay hydrated. If vomiting, seek medical attention immediately.";
      monitoringFrequency = "Check blood glucose and ketones every 2 hours";
      ketoneWarning = "Check ketones immediately and every 2 hours. Seek help if ketones are moderate/large.";
      stackingWarning = "Do NOT give additional corrections for at least 4-5 hours. Insulin absorption is unpredictable during severe illness.";
      break;
  }

  // Additional warnings based on BG level
  if (bgLevel >= BG_ZONES.CRITICAL.min) {
    ketoneWarning = "URGENT: Blood glucose is critically high. Check ketones immediately and contact your healthcare team or go to A&E if ketones are present.";
  }

  return {
    correctionDose,
    correctionExplanation,
    baseCorrectionDose,
    severityModifier,
    bgZoneModifier,
    breakfastRatio: adjustRatio(settings.breakfastRatio, ratioMultiplier),
    lunchRatio: adjustRatio(settings.lunchRatio, ratioMultiplier),
    dinnerRatio: adjustRatio(settings.dinnerRatio, ratioMultiplier),
    snackRatio: adjustRatio(settings.snackRatio, ratioMultiplier),
    basalAdjustment,
    hydrationNote,
    monitoringFrequency,
    ketoneWarning,
    stackingWarning,
  };
}

export default function SickDay() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<UserSettings>({});
  const [tdd, setTdd] = useState("");
  const [bgLevel, setBgLevel] = useState("");
  const [severity, setSeverity] = useState<string>("");
  const [results, setResults] = useState<SickDayResults | null>(null);
  const [bgUnits, setBgUnits] = useState("mg/dL");

  useEffect(() => {
    const storedSettings = storage.getSettings();
    setSettings(storedSettings);
    if (storedSettings.tdd) {
      setTdd(storedSettings.tdd.toString());
    }
    
    // Load blood glucose units from profile
    const profile = storage.getProfile();
    if (profile?.bgUnits) {
      setBgUnits(profile.bgUnits);
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

    // Convert to mg/dL for internal calculations if user uses mmol/L
    const bgInMgdl = bgUnits === "mmol/L" ? mmolToMgdl(bgNum) : bgNum;
    const recommendations = calculateSickDayRecommendations(tddNum, bgInMgdl, severity, settings, bgUnits);
    
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
    <div className="space-y-6 relative">
      <FaceLogoWatermark />
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
              <Label htmlFor="bg-level">Current Blood Glucose ({bgUnits})</Label>
              <Input
                id="bg-level"
                type="number"
                placeholder={bgUnits === "mmol/L" ? "e.g., 10.0" : "e.g., 180"}
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
              {results.ketoneWarning && (
                <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm text-red-900 dark:text-red-100">Ketone Alert</p>
                      <p className="text-xs text-red-800 dark:text-red-200 mt-1">{results.ketoneWarning}</p>
                    </div>
                  </div>
                </div>
              )}

              {results.correctionDose > 0 && (
                <div className="p-4 bg-primary/5 rounded-lg space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm text-muted-foreground">Suggested Correction Dose:</span>
                    <span className="text-2xl font-semibold" data-testid="text-correction-dose">
                      {results.correctionDose} units
                    </span>
                  </div>
                  
                  <div className="text-xs text-muted-foreground space-y-2 border-t border-primary/10 pt-3">
                    <p className="font-medium text-foreground">How this was calculated:</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-2 bg-background rounded text-center">
                        <p className="text-[10px] uppercase tracking-wide opacity-70">Base Dose</p>
                        <p className="font-semibold text-sm">{results.baseCorrectionDose}u</p>
                      </div>
                      <div className="p-2 bg-background rounded text-center">
                        <p className="text-[10px] uppercase tracking-wide opacity-70">Safety Factor</p>
                        <p className="font-semibold text-sm">×{results.severityModifier}</p>
                        <p className="text-[9px] opacity-60">(lower = more caution)</p>
                      </div>
                      <div className="p-2 bg-background rounded text-center">
                        <p className="text-[10px] uppercase tracking-wide opacity-70">BG Zone Factor</p>
                        <p className="font-semibold text-sm">×{results.bgZoneModifier}</p>
                      </div>
                    </div>
                    <p className="text-[11px] italic">{results.correctionExplanation}</p>
                  </div>
                </div>
              )}

              {results.stackingWarning && (
                <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm text-orange-900 dark:text-orange-100">Stacking Warning</p>
                      <p className="text-xs text-orange-800 dark:text-orange-200">{results.stackingWarning}</p>
                    </div>
                  </div>
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
                  <li>Check for ketones if BG remains above {bgUnits === "mmol/L" ? "13.9 mmol/L" : "250 mg/dL"}</li>
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

      </div>
    </div>
  );
}
