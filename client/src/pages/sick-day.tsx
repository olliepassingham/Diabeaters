import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Activity, Info, Plane, ChevronRight, Power, Check } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { storage, UserSettings } from "@/lib/storage";
import { FaceLogoWatermark } from "@/components/face-logo";
import { InfoTooltip, DIABETES_TERMS } from "@/components/info-tooltip";

// Conversion helpers for blood glucose units
const mgdlToMmol = (mgdl: number) => Math.round(mgdl / 18 * 10) / 10;
const mmolToMgdl = (mmol: number) => Math.round(mmol * 18);

type KetoneLevel = "none" | "trace" | "small" | "moderate" | "large";

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
  originalBreakfastRatio: string;
  originalLunchRatio: string;
  originalDinnerRatio: string;
  originalSnackRatio: string;
  ratioMultiplier: number;
  basalAdjustment: string;
  hydrationNote: string;
  monitoringFrequency: string;
  ketoneWarning: string;
  ketoneGuidance: string;
  ketoneActionRequired: "none" | "monitor" | "urgent" | "emergency";
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
  ketoneLevel: KetoneLevel,
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
  
  // Settings stores units per 10g carbs (e.g., "1" = 1 unit per 10g, "1.5" = 1.5 units per 10g)
  const parseUnitsPerCP = (ratio: string | undefined): number => {
    if (!ratio) return 1; // Default 1 unit per 10g
    const num = parseFloat(ratio);
    return isNaN(num) ? 1 : num;
  };

  // Format as "X:10g" where X is units per 10g carbs (carb portion)
  const formatRatio = (units: number): string => {
    // Round to 1 decimal place for display
    const rounded = Math.round(units * 10) / 10;
    return `${rounded}:10g`;
  };

  const adjustRatio = (ratio: string | undefined, multiplier: number): string => {
    const originalUnits = parseUnitsPerCP(ratio);
    // During illness, INCREASE units (more insulin needed)
    // multiplier > 1 means more insulin (e.g., 1.2 = 20% more)
    return formatRatio(originalUnits * multiplier);
  };

  const getOriginalRatio = (ratio: string | undefined): string => {
    return formatRatio(parseUnitsPerCP(ratio));
  };

  let ratioMultiplier = 1;
  let basalAdjustment = "No change recommended";
  let hydrationNote = "Drink plenty of sugar-free fluids";
  let monitoringFrequency = "Check blood glucose every 4 hours";
  let ketoneWarning = "";
  let ketoneGuidance = "";
  let ketoneActionRequired: "none" | "monitor" | "urgent" | "emergency" = "none";
  let stackingWarning = "";

  switch (severity) {
    case "minor":
      ratioMultiplier = 1.1; // 10% more insulin
      basalAdjustment = "Consider 10% increase if blood glucose runs high";
      monitoringFrequency = "Check blood glucose every 4-6 hours";
      stackingWarning = "Wait at least 3 hours between corrections to assess effectiveness";
      break;
    case "moderate":
      ratioMultiplier = 1.2; // 20% more insulin
      basalAdjustment = "Consider 10-20% increase if blood glucose remains elevated";
      hydrationNote = "Stay well hydrated with sugar-free fluids. Consider electrolyte drinks.";
      monitoringFrequency = "Check blood glucose every 2-4 hours";
      stackingWarning = "Wait at least 4 hours between corrections - absorption may be delayed";
      break;
    case "severe":
      ratioMultiplier = 1.3; // 30% more insulin
      basalAdjustment = "Consider 20% increase, but monitor closely for lows if unable to eat";
      hydrationNote = "Critical: Stay hydrated. If vomiting, seek medical attention immediately.";
      monitoringFrequency = "Check blood glucose and ketones every 2 hours";
      stackingWarning = "Do NOT give additional corrections for at least 4-5 hours. Insulin absorption is unpredictable during severe illness.";
      break;
  }

  // === KETONE-SPECIFIC GUIDANCE ===
  // Based on combination of ketone level and blood glucose
  const isHighBg = bgLevel > 250; // 13.9 mmol/L
  const isVeryHighBg = bgLevel > 300; // 16.7 mmol/L
  const isCriticalBg = bgLevel >= 400; // 22.2 mmol/L

  switch (ketoneLevel) {
    case "none":
      if (isHighBg) {
        ketoneGuidance = "No ketones detected - good sign. Continue monitoring blood glucose and recheck ketones in 2-4 hours if glucose stays high.";
        ketoneActionRequired = "monitor";
      } else {
        ketoneGuidance = "No ketones detected. Continue regular sick day monitoring.";
        ketoneActionRequired = "none";
      }
      break;
    case "trace":
      ketoneGuidance = "Trace ketones can appear during illness or if you haven't eaten. Drink extra fluids (250ml water per hour) and recheck in 2 hours.";
      ketoneActionRequired = "monitor";
      if (isHighBg) {
        ketoneWarning = "Trace ketones with elevated glucose - take correction dose and increase fluids.";
      }
      break;
    case "small":
      ketoneGuidance = "Small ketones indicate your body needs more insulin. Drink 250-500ml fluids per hour. Take correction dose if not already given. Recheck ketones every 2 hours.";
      ketoneActionRequired = "monitor";
      ketoneWarning = "Small ketones present - ensure you're getting enough insulin and fluids.";
      if (isVeryHighBg) {
        ketoneActionRequired = "urgent";
        ketoneWarning = "Small ketones with high glucose - contact your diabetes team for guidance if ketones don't improve in 2 hours.";
      }
      break;
    case "moderate":
      ketoneGuidance = "Moderate ketones are a warning sign of developing DKA (diabetic ketoacidosis). You need extra insulin NOW. Drink 500ml fluids per hour. Contact your diabetes team immediately.";
      ketoneActionRequired = "urgent";
      ketoneWarning = "URGENT: Moderate ketones detected. This requires immediate attention. Contact your diabetes team now.";
      if (isVeryHighBg || severity === "severe") {
        ketoneActionRequired = "emergency";
        ketoneWarning = "EMERGENCY: Moderate ketones with high glucose or severe illness. Go to A&E or call 999 if you cannot reach your diabetes team.";
      }
      break;
    case "large":
      ketoneGuidance = "Large ketones are a medical emergency. You are at high risk of DKA (diabetic ketoacidosis). Do NOT wait - seek emergency medical care immediately.";
      ketoneActionRequired = "emergency";
      ketoneWarning = "EMERGENCY: Large ketones detected. Go to A&E immediately or call 999. This is a medical emergency.";
      break;
  }

  // Override with critical BG warning if applicable
  if (isCriticalBg) {
    ketoneWarning = "URGENT: Blood glucose is critically high. " + (ketoneLevel === "none" 
      ? "Check ketones immediately and contact your healthcare team."
      : ketoneWarning);
    if (ketoneLevel !== "large") {
      ketoneActionRequired = ketoneActionRequired === "emergency" ? "emergency" : "urgent";
    }
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
    originalBreakfastRatio: getOriginalRatio(settings.breakfastRatio),
    originalLunchRatio: getOriginalRatio(settings.lunchRatio),
    originalDinnerRatio: getOriginalRatio(settings.dinnerRatio),
    originalSnackRatio: getOriginalRatio(settings.snackRatio),
    ratioMultiplier,
    basalAdjustment,
    hydrationNote,
    monitoringFrequency,
    ketoneWarning,
    ketoneGuidance,
    ketoneActionRequired,
    stackingWarning,
  };
}

const SICK_DAY_STORAGE_KEY = "diabeater_sick_day_session";

interface SickDaySession {
  bgLevel: string;
  severity: string;
  ketoneLevel: KetoneLevel | "";
  results: SickDayResults | null;
  lastUpdated: string;
}

export default function SickDay() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<UserSettings>({});
  const [tdd, setTdd] = useState("");
  const [bgLevel, setBgLevel] = useState("");
  const [severity, setSeverity] = useState<string>("");
  const [ketoneLevel, setKetoneLevel] = useState<KetoneLevel | "">("");
  const [results, setResults] = useState<SickDayResults | null>(null);
  const [bgUnits, setBgUnits] = useState("mg/dL");
  const [isSickDayActive, setIsSickDayActive] = useState(false);

  const saveSession = (newResults: SickDayResults | null) => {
    const session: SickDaySession = {
      bgLevel,
      severity,
      ketoneLevel,
      results: newResults,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(SICK_DAY_STORAGE_KEY, JSON.stringify(session));
  };

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

    // Check if sick day mode is already active
    const scenarioState = storage.getScenarioState();
    setIsSickDayActive(scenarioState.sickDayActive || false);

    // Load saved session only if sick day is active
    if (scenarioState.sickDayActive) {
      const savedSession = localStorage.getItem(SICK_DAY_STORAGE_KEY);
      if (savedSession) {
        try {
          const session: SickDaySession = JSON.parse(savedSession);
          if (session.bgLevel) setBgLevel(session.bgLevel);
          if (session.severity) setSeverity(session.severity);
          if (session.ketoneLevel) setKetoneLevel(session.ketoneLevel);
          if (session.results) setResults(session.results);
        } catch (e) {
          console.error("Failed to load sick day session", e);
        }
      } else if (scenarioState.sickDaySeverity) {
        setSeverity(scenarioState.sickDaySeverity);
      }
    } else {
      // Clear any stale session data if sick day is not active
      localStorage.removeItem(SICK_DAY_STORAGE_KEY);
    }
  }, []);

  const handleActivateSickDay = () => {
    if (!severity) return;
    storage.activateSickDay(severity);
    setIsSickDayActive(true);
    toast({
      title: "Sick Day Mode Activated",
      description: `Your dashboard will now show sick day status (${severity} severity).`,
    });
  };

  const handleDeactivateSickDay = () => {
    storage.deactivateSickDay();
    setIsSickDayActive(false);
    localStorage.removeItem(SICK_DAY_STORAGE_KEY);
    setResults(null);
    setBgLevel("");
    setKetoneLevel("");
    toast({
      title: "Sick Day Mode Deactivated",
      description: "Glad you're feeling better! Status removed from dashboard.",
    });
  };

  const handleCalculate = () => {
    if (!settings.tdd) {
      toast({
        title: "TDD not configured",
        description: "Please set your Total Daily Dose in Settings first.",
        variant: "destructive",
      });
      return;
    }
    
    if (!bgLevel || !severity || !ketoneLevel) {
      toast({
        title: "Missing information",
        description: "Please fill in blood glucose, severity, and ketone level to calculate recommendations.",
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
    const recommendations = calculateSickDayRecommendations(tddNum, bgInMgdl, severity, ketoneLevel as KetoneLevel, settings, bgUnits);
    
    if (isNaN(recommendations.correctionDose)) {
      toast({
        title: "Calculation error",
        description: "Unable to calculate recommendations. Please check your input values.",
        variant: "destructive",
      });
      return;
    }
    
    setResults(recommendations);
    saveSession(recommendations);

    storage.addActivityLog({
      activityType: "sick_day_calculation",
      activityDetails: `TDD: ${tddNum}, BG: ${bgNum}, Severity: ${severity}, Ketones: ${ketoneLevel}`,
      recommendation: `Correction: ${recommendations.correctionDose}u, Ratios adjusted`,
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 border-orange-100 dark:border-orange-900">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900">
              <Activity className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <CardTitle className="text-xl">Sick Day Adviser</CardTitle>
              <CardDescription>Calculate insulin adjustments when you're feeling unwell</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6">
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

        {!results ? (
          <Card>
            <CardHeader>
              <CardTitle>Input Information</CardTitle>
              <CardDescription>
                Enter your details to calculate sick day adjustments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tdd" className="flex items-center">
                  Total Daily Dose (TDD) - Units
                  <InfoTooltip {...DIABETES_TERMS.tdd} />
                </Label>
                {settings.tdd ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Input
                        id="tdd"
                        type="number"
                        value={tdd}
                        readOnly
                        className="bg-muted cursor-default"
                        data-testid="input-tdd"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">units/day</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      From your <Link href="/settings" className="text-primary hover:underline">Insulin Settings</Link>
                    </p>
                  </>
                ) : (
                  <>
                    <div className="p-3 rounded-md bg-muted border border-dashed">
                      <p className="text-sm text-muted-foreground">
                        TDD not configured. Please set your Total Daily Dose in{" "}
                        <Link href="/settings" className="text-primary hover:underline font-medium">
                          Settings → Insulin Settings
                        </Link>{" "}
                        to use the Sick Day Adviser.
                      </p>
                    </div>
                  </>
                )}
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

              <div className="space-y-2">
                <Label htmlFor="ketone-level" className="flex items-center">
                  Ketone Level
                  <InfoTooltip {...DIABETES_TERMS.ketones} />
                </Label>
                <Select value={ketoneLevel} onValueChange={(v) => setKetoneLevel(v as KetoneLevel)}>
                  <SelectTrigger id="ketone-level" data-testid="select-ketone-level">
                    <SelectValue placeholder="Select ketone level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None / Negative</SelectItem>
                    <SelectItem value="trace">Trace (0.1-0.5 mmol/L)</SelectItem>
                    <SelectItem value="small">Small (0.6-1.5 mmol/L)</SelectItem>
                    <SelectItem value="moderate">Moderate (1.6-3.0 mmol/L)</SelectItem>
                    <SelectItem value="large">Large (&gt;3.0 mmol/L)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Use blood ketone meter or urine ketone strips to check
                </p>
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
        ) : (
          <>
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Update Your Readings
              </CardTitle>
              <CardDescription>Update your glucose, ketones, or severity and recalculate</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="update-severity" className="text-sm">Illness Severity</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger id="update-severity" data-testid="select-update-severity">
                    <SelectValue placeholder="Select severity level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minor">Minor (slight cold, feeling off)</SelectItem>
                    <SelectItem value="moderate">Moderate (fever, flu symptoms)</SelectItem>
                    <SelectItem value="severe">Severe (high fever, vomiting, unable to eat)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="update-bg" className="text-sm">Blood Glucose ({bgUnits})</Label>
                  <Input
                    id="update-bg"
                    type="number"
                    placeholder={bgUnits === "mmol/L" ? "e.g., 10.0" : "e.g., 180"}
                    value={bgLevel}
                    onChange={(e) => setBgLevel(e.target.value)}
                    data-testid="input-update-bg-level"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="update-ketones" className="text-sm flex items-center">
                    Ketone Level
                    <InfoTooltip {...DIABETES_TERMS.ketones} />
                  </Label>
                  <Select value={ketoneLevel} onValueChange={(val) => setKetoneLevel(val as KetoneLevel)}>
                    <SelectTrigger id="update-ketones" data-testid="select-update-ketone-level">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (negative)</SelectItem>
                      <SelectItem value="trace">Trace (0.1-0.5)</SelectItem>
                      <SelectItem value="small">Small (0.6-1.5)</SelectItem>
                      <SelectItem value="moderate">Moderate (1.6-3.0)</SelectItem>
                      <SelectItem value="large">Large (3.0+)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button 
                onClick={handleCalculate} 
                className="w-full"
                data-testid="button-update-readings"
              >
                Update Recommendations
              </Button>
            </CardContent>
          </Card>

          <Card className="border-primary/50">
            <CardHeader>
              <CardTitle>Sick Day Recommendations</CardTitle>
              <CardDescription>Based on your current condition</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {results.ketoneActionRequired === "emergency" && (
                <div className="p-4 bg-red-600 dark:bg-red-700 rounded-lg border-2 border-red-700 dark:border-red-500 animate-pulse">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-6 w-6 text-white flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-base text-white">EMERGENCY - Seek Medical Help Now</p>
                      <p className="text-sm text-red-100 mt-1">{results.ketoneWarning}</p>
                      <p className="text-sm text-white mt-2 font-medium">{results.ketoneGuidance}</p>
                    </div>
                  </div>
                </div>
              )}

              {results.ketoneActionRequired === "urgent" && (
                <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm text-red-900 dark:text-red-100">Urgent - Contact Diabetes Team</p>
                      <p className="text-xs text-red-800 dark:text-red-200 mt-1">{results.ketoneWarning}</p>
                      <p className="text-xs text-red-700 dark:text-red-300 mt-2">{results.ketoneGuidance}</p>
                    </div>
                  </div>
                </div>
              )}

              {results.ketoneActionRequired === "monitor" && results.ketoneGuidance && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm text-amber-900 dark:text-amber-100">Ketone Monitoring</p>
                      {results.ketoneWarning && (
                        <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">{results.ketoneWarning}</p>
                      )}
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">{results.ketoneGuidance}</p>
                    </div>
                  </div>
                </div>
              )}

              {results.ketoneActionRequired === "none" && results.ketoneGuidance && (
                <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-green-800 dark:text-green-200">{results.ketoneGuidance}</p>
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
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Adjusted Mealtime Ratios</h3>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                    ×{results.ratioMultiplier} adjustment
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Breakfast</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <p className="font-semibold" data-testid="text-breakfast-ratio">{results.breakfastRatio}</p>
                      <span className="text-xs text-muted-foreground line-through">{results.originalBreakfastRatio}</span>
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Lunch</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <p className="font-semibold" data-testid="text-lunch-ratio">{results.lunchRatio}</p>
                      <span className="text-xs text-muted-foreground line-through">{results.originalLunchRatio}</span>
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Dinner</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <p className="font-semibold" data-testid="text-dinner-ratio">{results.dinnerRatio}</p>
                      <span className="text-xs text-muted-foreground line-through">{results.originalDinnerRatio}</span>
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Snacks</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <p className="font-semibold" data-testid="text-snack-ratio">{results.snackRatio}</p>
                      <span className="text-xs text-muted-foreground line-through">{results.originalSnackRatio}</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Higher units per 10g = more insulin to overcome illness-related insulin resistance
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

              {/* Sick Day Mode Activation */}
              <div className="pt-2 border-t">
                {isSickDayActive ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                      <Check className="h-5 w-5 text-orange-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-orange-900 dark:text-orange-100">Sick Day Mode Active</p>
                        <p className="text-xs text-orange-700 dark:text-orange-300 capitalize">{severity} severity</p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={handleDeactivateSickDay}
                      data-testid="button-deactivate-sick-day"
                    >
                      <Power className="h-4 w-4 mr-2" />
                      Deactivate Sick Day Mode
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Click when you're feeling better to remove the status from your dashboard
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Button 
                      className="w-full" 
                      onClick={handleActivateSickDay}
                      data-testid="button-activate-sick-day"
                    >
                      <Power className="h-4 w-4 mr-2" />
                      Activate Sick Day Mode
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      This will show a sick day status on your dashboard and remind you of adjusted ratios
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          </>
        )}

      </div>
    </div>
  );
}
