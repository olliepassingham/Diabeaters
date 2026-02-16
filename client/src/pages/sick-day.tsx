import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Activity, Info, Plane, ChevronRight, Power, Check, Clock, ShieldAlert, Heart, Package, Syringe, Droplets, AlertTriangle, ArrowLeft, Thermometer, TrendingUp, TrendingDown, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { storage, UserSettings, Supply, SickDayJournalEntry } from "@/lib/storage";
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
  const [sickDayActivatedAt, setSickDayActivatedAt] = useState<string | undefined>();
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [isTravelAlsoActive, setIsTravelAlsoActive] = useState(false);
  const [travelDestination, setTravelDestination] = useState<string | undefined>();
  const [isPumpUser, setIsPumpUser] = useState(false);
  const [journalEntries, setJournalEntries] = useState<SickDayJournalEntry[]>([]);
  const [journalBg, setJournalBg] = useState("");
  const [journalKetone, setJournalKetone] = useState<string>("");
  const [journalCorrection, setJournalCorrection] = useState("");
  const [journalFluids, setJournalFluids] = useState("");
  const [journalSymptoms, setJournalSymptoms] = useState("");
  const [journalNotes, setJournalNotes] = useState("");

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
    
    const profile = storage.getProfile();
    if (profile?.bgUnits) {
      setBgUnits(profile.bgUnits);
    }
    setIsPumpUser(profile?.insulinDeliveryMethod === "pump");

    setSupplies(storage.getSupplies());

    const scenarioState = storage.getScenarioState();
    setIsSickDayActive(scenarioState.sickDayActive || false);
    setSickDayActivatedAt(scenarioState.sickDayActivatedAt);
    setIsTravelAlsoActive(scenarioState.travelModeActive || false);
    setTravelDestination(scenarioState.travelDestination);

    setJournalEntries(storage.getSickDayJournal());

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

    if (isSickDayActive) {
      storage.activateSickDay(severity);
    }

    storage.addActivityLog({
      activityType: "sick_day_calculation",
      activityDetails: `TDD: ${tddNum}, BG: ${bgNum}, Severity: ${severity}, Ketones: ${ketoneLevel}`,
      recommendation: `Correction: ${recommendations.correctionDose}u, Ratios adjusted`,
    });
  };

  const getSickDayDuration = () => {
    if (!sickDayActivatedAt) return { hours: 0, days: 0, label: "Just started" };
    const start = new Date(sickDayActivatedAt);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (days === 0) {
      return { hours, days: 0, label: hours <= 1 ? "Less than 1 hour" : `${hours} hours` };
    }
    return { hours, days, label: `${days} day${days !== 1 ? "s" : ""}, ${remainingHours}h` };
  };

  const calculateSickDaySupplyImpact = () => {
    if (!supplies.length) return [];

    const sickDayMultipliers: Record<string, { multiplier: number; reason: string }> = {
      insulin_short: { multiplier: severity === "severe" ? 1.3 : severity === "moderate" ? 1.2 : 1.1, reason: "Higher correction doses needed" },
      insulin_long: { multiplier: 1.0, reason: "Keep basal dose consistent" },
      insulin_vial: { multiplier: severity === "severe" ? 1.3 : severity === "moderate" ? 1.2 : 1.1, reason: "Higher doses during illness" },
      insulin: { multiplier: severity === "severe" ? 1.3 : severity === "moderate" ? 1.2 : 1.1, reason: "Higher doses during illness" },
      needle: { multiplier: severity === "severe" ? 1.5 : severity === "moderate" ? 1.3 : 1.1, reason: "More frequent injections for corrections" },
      cgm: { multiplier: 1.0, reason: "No change - continuous monitoring" },
      infusion_set: { multiplier: severity === "severe" ? 1.3 : 1.0, reason: severity === "severe" ? "May need more frequent changes if site issues" : "No change expected" },
      reservoir: { multiplier: severity === "severe" ? 1.2 : 1.0, reason: severity === "severe" ? "Higher insulin use may require more refills" : "No change expected" },
    };

    return supplies
      .filter(supply => supply.dailyUsage > 0 && supply.currentQuantity > 0)
      .map(supply => {
        const info = sickDayMultipliers[supply.type] || { multiplier: 1.0, reason: "No sick day impact" };
        const adjustedDailyUsage = supply.dailyUsage * info.multiplier;
        const normalDaysLeft = Math.floor(supply.currentQuantity / supply.dailyUsage);
        const sickDaysLeft = Math.floor(supply.currentQuantity / adjustedDailyUsage);
        return {
          ...supply,
          adjustedDailyUsage: Math.round(adjustedDailyUsage * 10) / 10,
          normalDaysLeft: Math.min(normalDaysLeft, 365),
          sickDaysLeft: Math.min(sickDaysLeft, 365),
          multiplier: info.multiplier,
          reason: info.reason,
          impacted: info.multiplier > 1.0,
        };
      });
  };

  const handleLogJournalEntry = () => {
    if (!journalBg || !journalKetone) {
      toast({
        title: "Missing information",
        description: "Please enter at least your blood glucose and ketone level.",
        variant: "destructive",
      });
      return;
    }
    const bgNum = parseFloat(journalBg);
    if (isNaN(bgNum) || bgNum <= 0) {
      toast({
        title: "Invalid BG value",
        description: "Please enter a valid blood glucose number.",
        variant: "destructive",
      });
      return;
    }
    const entry: SickDayJournalEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      bg: bgNum,
      bgUnits,
      ketoneLevel: journalKetone,
      correctionDose: journalCorrection ? parseFloat(journalCorrection) : null,
      fluidsml: journalFluids ? parseFloat(journalFluids) : null,
      symptoms: journalSymptoms,
      notes: journalNotes,
      severity,
    };
    storage.addSickDayJournalEntry(entry);
    setJournalEntries(storage.getSickDayJournal());
    setJournalBg("");
    setJournalKetone("");
    setJournalCorrection("");
    setJournalFluids("");
    setJournalSymptoms("");
    setJournalNotes("");
    toast({
      title: "Check logged",
      description: `BG ${bgNum} ${bgUnits} recorded at ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.`,
    });
  };

  const handleDeleteJournalEntry = (id: string) => {
    storage.deleteSickDayJournalEntry(id);
    setJournalEntries(storage.getSickDayJournal());
    toast({ title: "Entry deleted" });
  };

  const getTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getBgColor = (bg: number, units: string) => {
    const bgMgdl = units === "mmol/L" ? mmolToMgdl(bg) : bg;
    if (bgMgdl <= 180) return "text-green-600 dark:text-green-400";
    if (bgMgdl <= 250) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getKetoneBadgeVariant = (level: string) => {
    if (level === "none") return "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300";
    if (level === "trace") return "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300";
    if (level === "small") return "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300";
    if (level === "moderate") return "bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300";
    return "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300";
  };

  const getJournalBgTrend = () => {
    if (journalEntries.length < 2) return null;
    const latest = journalEntries[0].bg;
    const previous = journalEntries[1].bg;
    const latestMgdl = journalEntries[0].bgUnits === "mmol/L" ? mmolToMgdl(latest) : latest;
    const prevMgdl = journalEntries[1].bgUnits === "mmol/L" ? mmolToMgdl(previous) : previous;
    const diff = latestMgdl - prevMgdl;
    if (Math.abs(diff) < 10) return "stable";
    return diff < 0 ? "down" : "up";
  };

  if (isSickDayActive && results) {
    const duration = getSickDayDuration();
    const supplyImpact = calculateSickDaySupplyImpact();
    const impactedSupplies = supplyImpact.filter(s => s.impacted);
    const isExtended = duration.days >= 2;

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className={`bg-gradient-to-br ${
          severity === "severe" 
            ? "from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 border-red-200 dark:border-red-800"
            : severity === "moderate"
            ? "from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border-orange-200 dark:border-orange-800"
            : "from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-amber-200 dark:border-amber-800"
        }`}>
          <CardHeader>
            <div className="flex items-center gap-3 flex-wrap">
              <div className={`p-2 rounded-full ${
                severity === "severe" ? "bg-red-100 dark:bg-red-900" : severity === "moderate" ? "bg-orange-100 dark:bg-orange-900" : "bg-amber-100 dark:bg-amber-900"
              }`}>
                <Thermometer className={`h-6 w-6 ${
                  severity === "severe" ? "text-red-600 dark:text-red-400" : severity === "moderate" ? "text-orange-600 dark:text-orange-400" : "text-amber-600 dark:text-amber-400"
                }`} />
              </div>
              <div className="flex-1">
                <CardTitle className="text-xl" data-testid="text-sick-day-dashboard-title">
                  Sick Day Mode Active
                </CardTitle>
                <CardDescription className="capitalize">{severity} severity</CardDescription>
              </div>
              <Badge variant="secondary" className={`${
                severity === "severe" ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300" 
                : severity === "moderate" ? "bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300"
                : "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300"
              }`}>
                <Clock className="h-3 w-3 mr-1" />
                {duration.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">
                  Started {sickDayActivatedAt ? new Date(sickDayActivatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "recently"}
                </span>
                <span className="font-medium" data-testid="text-sick-day-duration">{duration.label}</span>
              </div>
              <Progress 
                value={Math.min(100, (duration.hours / 72) * 100)} 
                className="h-2" 
                data-testid="progress-sick-day" 
              />
              <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                <span>0h</span>
                <span className={duration.hours >= 24 ? "font-medium text-foreground" : ""}>24h</span>
                <span className={duration.hours >= 48 ? "font-medium text-orange-600 dark:text-orange-400" : ""}>48h</span>
                <span className={duration.hours >= 72 ? "font-medium text-red-600 dark:text-red-400" : ""}>72h+</span>
              </div>
            </div>
            {isExtended && (
              <div className={`p-3 rounded-lg ${
                duration.days >= 3 
                  ? "bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700"
                  : "bg-orange-100 dark:bg-orange-900/50 border border-orange-300 dark:border-orange-700"
              }`}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
                    duration.days >= 3 ? "text-red-600 dark:text-red-400" : "text-orange-600 dark:text-orange-400"
                  }`} />
                  <div>
                    <p className="text-sm font-medium" data-testid="text-extended-sick-warning">
                      {duration.days >= 3 
                        ? "You've been unwell for 3+ days — contact your diabetes team"
                        : "You've been unwell for 2 days — consider contacting your diabetes team if not improving"
                      }
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Extended illness increases the risk of complications. Your healthcare team can provide specific guidance.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {isTravelAlsoActive && (
          <Card className="border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20" data-testid="card-travel-also-active">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-900 shrink-0">
                  <Plane className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Travel Mode is also active{travelDestination ? ` — ${travelDestination}` : ""}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Being unwell while travelling increases your supply needs. Your supply forecasts on the Supplies page now show the combined impact of both scenarios.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Link href="/scenarios?tab=travel">
                      <Button variant="outline" size="sm" data-testid="button-view-travel-from-sick">
                        <Plane className="h-3 w-3 mr-1" />
                        View Travel Dashboard
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldAlert className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Sick Day Rules
            </CardTitle>
            <CardDescription>Key principles to follow when unwell</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <Syringe className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Never stop taking insulin</p>
                  <p className="text-xs text-muted-foreground">
                    {isPumpUser 
                      ? "Even if you're not eating, your body needs insulin. Keep your pump running and do not disconnect. If your pump fails, switch to backup injections immediately."
                      : "Even if you're not eating, your body needs insulin. Your long-acting (basal) insulin must continue."}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                <Droplets className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Test blood glucose more frequently</p>
                  <p className="text-xs text-muted-foreground">{results.monitoringFrequency}. Illness often causes blood glucose to rise unpredictably.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                <Activity className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Check for ketones if BG is high</p>
                  <p className="text-xs text-muted-foreground">
                    Test ketones if blood glucose stays above {bgUnits === "mmol/L" ? "13.9 mmol/L" : "250 mg/dL"}. Rising ketones need urgent attention.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-cyan-50 dark:bg-cyan-950/30 rounded-lg">
                <Heart className="h-5 w-5 text-cyan-600 dark:text-cyan-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Stay hydrated</p>
                  <p className="text-xs text-muted-foreground">{results.hydrationNote}</p>
                </div>
              </div>
              {isPumpUser && (
                <div className="flex items-start gap-3 p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg">
                  <Syringe className="h-5 w-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Check your pump site</p>
                    <p className="text-xs text-muted-foreground">
                      Illness can affect infusion site absorption. If blood glucose stays high despite corrections, 
                      change your infusion set and site. A blocked or kinked cannula could be making things worse.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {impactedSupplies.length > 0 && (
          <Card className="border-orange-200 dark:border-orange-800">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                Adjusted Supply Forecast
              </CardTitle>
              <CardDescription>
                Sick days can increase insulin and testing supply usage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {impactedSupplies.map(supply => (
                <div key={supply.id} className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{supply.name}</p>
                      <p className="text-xs text-muted-foreground">{supply.reason}</p>
                    </div>
                    <Badge variant="outline" className="text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700">
                      {Math.round((supply.multiplier - 1) * 100)}% more
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2 bg-background rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">Normal</p>
                      <p className="text-sm font-medium" data-testid={`text-normal-days-${supply.id}`}>
                        {supply.normalDaysLeft > 365 ? "365+" : supply.normalDaysLeft} days
                      </p>
                      <p className="text-[10px] text-muted-foreground">{supply.dailyUsage}/day</p>
                    </div>
                    <div className={`p-2 rounded-lg text-center ${
                      supply.sickDaysLeft <= 3 
                        ? "bg-red-50 dark:bg-red-950/30"
                        : supply.sickDaysLeft <= 7 
                        ? "bg-orange-50 dark:bg-orange-950/30"
                        : "bg-background"
                    }`}>
                      <p className="text-xs text-muted-foreground">Sick Day Rate</p>
                      <p className={`text-sm font-medium ${
                        supply.sickDaysLeft <= 3 ? "text-red-600 dark:text-red-400" : supply.sickDaysLeft <= 7 ? "text-orange-600 dark:text-orange-400" : ""
                      }`} data-testid={`text-sick-days-${supply.id}`}>
                        {supply.sickDaysLeft > 365 ? "365+" : supply.sickDaysLeft} days
                      </p>
                      <p className="text-[10px] text-muted-foreground">{supply.adjustedDailyUsage}/day</p>
                    </div>
                  </div>
                  {supply.sickDaysLeft <= 7 && (
                    <p className={`text-xs ${supply.sickDaysLeft <= 3 ? "text-red-600 dark:text-red-400 font-medium" : "text-orange-600 dark:text-orange-400"}`}>
                      {supply.sickDaysLeft <= 3 ? "Running low — check your supplies urgently" : "Keep an eye on this supply"}
                    </p>
                  )}
                </div>
              ))}
              <Link href="/supplies">
                <Button variant="outline" className="w-full mt-2" data-testid="button-view-supplies">
                  <Package className="h-4 w-4 mr-2" />
                  View All Supplies
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <Card className="border-red-300 dark:border-red-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              When to Seek Urgent Help
            </CardTitle>
            <CardDescription>
              Contact your diabetes team or go to A&E immediately if any of these apply
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { text: "Persistent vomiting — unable to keep fluids down for more than 2 hours", severity: "high" },
              { text: "Moderate or large ketones that are not coming down despite extra insulin", severity: "high" },
              { text: "Blood glucose consistently above " + (bgUnits === "mmol/L" ? "16.7 mmol/L" : "300 mg/dL") + " despite corrections", severity: "high" },
              { text: "Confusion, drowsiness, or difficulty staying awake", severity: "critical" },
              { text: "Rapid or laboured breathing (possible sign of DKA)", severity: "critical" },
              { text: "Chest pain or severe abdominal pain", severity: "critical" },
              { text: "Fruity smell on breath (sign of ketoacidosis)", severity: "high" },
              { text: "Illness lasting more than 48 hours with no improvement", severity: "medium" },
              ...(isPumpUser ? [{ text: "Pump site failure or suspected blocked cannula with rising blood glucose and ketones", severity: "high" as const }] : []),
            ].map((item, idx) => (
              <div 
                key={idx} 
                className={`flex items-start gap-3 p-3 rounded-lg ${
                  item.severity === "critical" 
                    ? "bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-700"
                    : item.severity === "high"
                    ? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800"
                    : "bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800"
                }`}
                data-testid={`escalation-item-${idx}`}
              >
                <AlertCircle className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
                  item.severity === "critical" ? "text-red-700 dark:text-red-300" : item.severity === "high" ? "text-red-600 dark:text-red-400" : "text-orange-600 dark:text-orange-400"
                }`} />
                <p className={`text-sm ${item.severity === "critical" ? "font-medium" : ""}`}>{item.text}</p>
              </div>
            ))}
            
            <div className="pt-3 space-y-2">
              <Link href="/help">
                <Button variant="outline" className="w-full" data-testid="button-help-now-sick">
                  <Heart className="h-4 w-4 mr-2 text-red-600" />
                  Help Now Page
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Button>
              </Link>
              <p className="text-xs text-center text-muted-foreground">
                UK Emergency: 999 | NHS 111 for non-emergency advice
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-900 dark:text-yellow-100">Not Medical Advice</p>
                <p className="text-yellow-800 dark:text-yellow-200 mt-1">
                  This tool provides educational estimates only. Always consult your healthcare 
                  provider when sick, especially if blood glucose is consistently high, you have 
                  ketones, or symptoms worsen.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

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
              <Label htmlFor="update-severity-active" className="text-sm">Illness Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger id="update-severity-active" data-testid="select-update-severity-active">
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
                <Label htmlFor="update-bg-active" className="text-sm">Blood Glucose ({bgUnits})</Label>
                <Input
                  id="update-bg-active"
                  type="number"
                  placeholder={bgUnits === "mmol/L" ? "e.g., 10.0" : "e.g., 180"}
                  value={bgLevel}
                  onChange={(e) => setBgLevel(e.target.value)}
                  data-testid="input-update-bg-active"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="update-ketones-active" className="text-sm flex items-center">
                  Ketone Level
                  <InfoTooltip {...DIABETES_TERMS.ketones} />
                </Label>
                <Select value={ketoneLevel} onValueChange={(val) => setKetoneLevel(val as KetoneLevel)}>
                  <SelectTrigger id="update-ketones-active" data-testid="select-update-ketone-active">
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
              data-testid="button-update-readings-active"
            >
              Update Recommendations
            </Button>
          </CardContent>
        </Card>

        {results.correctionDose > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Current Recommendations</CardTitle>
              <CardDescription>Based on your latest readings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {results.ketoneActionRequired === "emergency" && (
                <div className="p-4 bg-red-600 dark:bg-red-700 rounded-lg border-2 border-red-700 dark:border-red-500 animate-pulse">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-6 w-6 text-white flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-base text-white">EMERGENCY - Seek Medical Help Now</p>
                      <p className="text-sm text-red-100 mt-1">{results.ketoneWarning}</p>
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
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 bg-primary/5 rounded-lg space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm text-muted-foreground">Suggested Correction Dose:</span>
                  <span className="text-2xl font-semibold" data-testid="text-active-correction-dose">
                    {results.correctionDose} units
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{results.correctionExplanation}</p>
              </div>

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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-sm">Adjusted Mealtime Ratios</h3>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                    x{results.ratioMultiplier} adjustment
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Breakfast", ratio: results.breakfastRatio, original: results.originalBreakfastRatio },
                    { label: "Lunch", ratio: results.lunchRatio, original: results.originalLunchRatio },
                    { label: "Dinner", ratio: results.dinnerRatio, original: results.originalDinnerRatio },
                    { label: "Snacks", ratio: results.snackRatio, original: results.originalSnackRatio },
                  ].map(r => (
                    <div key={r.label} className="p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">{r.label}</p>
                      <div className="flex items-baseline gap-2 mt-1">
                        <p className="font-semibold">{r.ratio}</p>
                        <span className="text-xs text-muted-foreground line-through">{r.original}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className={`${
          severity === "severe"
            ? "border-red-500/50 bg-red-50/30 dark:bg-red-950/20"
            : severity === "moderate"
            ? "border-orange-500/50 bg-orange-50/30 dark:bg-orange-950/20"
            : "border-amber-500/50 bg-amber-50/30 dark:bg-amber-950/20"
        }`}>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Thermometer className={`h-5 w-5 ${
                  severity === "severe" ? "text-red-600" : severity === "moderate" ? "text-orange-600" : "text-amber-600"
                }`} />
                <div>
                  <p className="font-medium capitalize">{severity} Sick Day Mode</p>
                  <p className="text-xs text-muted-foreground">
                    Active for {duration.label}
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={handleDeactivateSickDay} data-testid="button-end-sick-day-active">
                Feeling Better
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sick Day Journal Summary */}
        {journalEntries.length > 0 && (
          <Card data-testid="card-journal-summary">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Journal Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="text-sm font-semibold mt-1" data-testid="text-journal-duration">{duration.label}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Entries</p>
                  <p className="text-sm font-semibold mt-1" data-testid="text-journal-count">{journalEntries.length}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">BG Trend</p>
                  {(() => {
                    const trend = getJournalBgTrend();
                    if (!trend) return <p className="text-sm font-semibold mt-1 text-muted-foreground" data-testid="text-journal-trend">--</p>;
                    if (trend === "down") return (
                      <div className="flex items-center justify-center gap-1 mt-1" data-testid="text-journal-trend">
                        <TrendingDown className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm font-semibold text-green-600 dark:text-green-400">Down</span>
                      </div>
                    );
                    if (trend === "up") return (
                      <div className="flex items-center justify-center gap-1 mt-1" data-testid="text-journal-trend">
                        <TrendingUp className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <span className="text-sm font-semibold text-red-600 dark:text-red-400">Up</span>
                      </div>
                    );
                    return (
                      <div className="flex items-center justify-center gap-1 mt-1" data-testid="text-journal-trend">
                        <Activity className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">Stable</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Log a Check */}
        <Card data-testid="card-log-check">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-green-600 dark:text-green-400" />
              Log a Check
            </CardTitle>
            <CardDescription>Record your current readings and symptoms</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="journal-bg" className="text-sm">Blood Glucose ({bgUnits})</Label>
                <Input
                  id="journal-bg"
                  type="number"
                  placeholder={bgUnits === "mmol/L" ? "e.g., 12.5" : "e.g., 225"}
                  value={journalBg}
                  onChange={(e) => setJournalBg(e.target.value)}
                  data-testid="input-journal-bg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="journal-ketone" className="text-sm">Ketone Level</Label>
                <Select value={journalKetone} onValueChange={setJournalKetone}>
                  <SelectTrigger id="journal-ketone" data-testid="select-journal-ketone">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="trace">Trace</SelectItem>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="journal-correction" className="text-sm">Correction Dose (units)</Label>
                <Input
                  id="journal-correction"
                  type="number"
                  placeholder="Optional"
                  value={journalCorrection}
                  onChange={(e) => setJournalCorrection(e.target.value)}
                  data-testid="input-journal-correction"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="journal-fluids" className="text-sm">Fluids (ml)</Label>
                <Input
                  id="journal-fluids"
                  type="number"
                  placeholder="Optional"
                  value={journalFluids}
                  onChange={(e) => setJournalFluids(e.target.value)}
                  data-testid="input-journal-fluids"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="journal-symptoms" className="text-sm">Symptoms</Label>
              <Input
                id="journal-symptoms"
                type="text"
                placeholder="e.g., headache, nausea, fever"
                value={journalSymptoms}
                onChange={(e) => setJournalSymptoms(e.target.value)}
                data-testid="input-journal-symptoms"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="journal-notes" className="text-sm">Notes</Label>
              <Textarea
                id="journal-notes"
                placeholder="Any additional notes..."
                value={journalNotes}
                onChange={(e) => setJournalNotes(e.target.value)}
                className="resize-none"
                rows={2}
                data-testid="textarea-journal-notes"
              />
            </div>
            <Button
              onClick={handleLogJournalEntry}
              className="w-full"
              data-testid="button-log-journal-entry"
            >
              <Check className="h-4 w-4 mr-2" />
              Log Entry
            </Button>
          </CardContent>
        </Card>

        {/* Sick Day Timeline */}
        {journalEntries.length > 0 && (
          <Card data-testid="card-journal-timeline">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                Sick Day Timeline
              </CardTitle>
              <CardDescription>{journalEntries.length} {journalEntries.length === 1 ? "entry" : "entries"} logged</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {journalEntries.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className="relative flex gap-3 pb-4"
                    data-testid={`journal-entry-${entry.id}`}
                  >
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                        idx === 0 ? "border-primary bg-primary" : "border-muted-foreground/40 bg-background"
                      }`} />
                      {idx < journalEntries.length - 1 && (
                        <div className="w-0.5 flex-1 bg-muted-foreground/20 mt-1" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 -mt-0.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-lg font-bold ${getBgColor(entry.bg, entry.bgUnits)}`} data-testid={`text-journal-bg-${entry.id}`}>
                            {entry.bg} {entry.bgUnits}
                          </span>
                          <Badge variant="secondary" className={`text-xs ${getKetoneBadgeVariant(entry.ketoneLevel)}`} data-testid={`badge-journal-ketone-${entry.id}`}>
                            {entry.ketoneLevel}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground" data-testid={`text-journal-time-${entry.id}`}>
                            {getTimeAgo(entry.timestamp)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteJournalEntry(entry.id)}
                            data-testid={`button-delete-journal-${entry.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                        {entry.correctionDose !== null && entry.correctionDose > 0 && (
                          <span className="flex items-center gap-1">
                            <Syringe className="h-3 w-3" />
                            {entry.correctionDose}u correction
                          </span>
                        )}
                        {entry.fluidsml !== null && entry.fluidsml > 0 && (
                          <span className="flex items-center gap-1">
                            <Droplets className="h-3 w-3" />
                            {entry.fluidsml}ml fluids
                          </span>
                        )}
                      </div>
                      {entry.symptoms && (
                        <p className="text-xs text-muted-foreground mt-1">{entry.symptoms}</p>
                      )}
                      {entry.notes && (
                        <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{entry.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center">
          <Link href="/">
            <Button variant="ghost" data-testid="link-back-dashboard-sick">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

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
                      From your <Link href="/settings?tab=insulin" className="text-primary hover:underline" data-testid="link-insulin-settings">Insulin & Ratios</Link>
                    </p>
                  </>
                ) : (
                  <>
                    <div className="p-3 rounded-md bg-muted border border-dashed">
                      <p className="text-sm text-muted-foreground">
                        TDD not configured. Please set your Total Daily Dose in{" "}
                        <Link href="/settings?tab=insulin" className="text-primary hover:underline font-medium" data-testid="link-settings-insulin">
                          Settings → Insulin & Ratios
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
                      <p className="font-medium text-sm">{isPumpUser ? "Basal Rate Adjustment" : "Basal (Long-Acting) Insulin"}</p>
                      <p className="text-xs text-muted-foreground">{results.basalAdjustment}</p>
                      {isPumpUser && (
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                          Adjust your temporary basal rate on your pump rather than changing your programmed profile.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {isPumpUser && (
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border border-indigo-200 dark:border-indigo-800 space-y-2" data-testid="pump-tip-sick-day">
                    <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase">Pump Users</p>
                    <div className="space-y-1.5 text-sm text-indigo-800 dark:text-indigo-200">
                      <p>Change your infusion set and site if blood glucose remains high after 2 corrections.</p>
                      <p>Use your pump's correction bolus calculator, but verify it accounts for active insulin (IOB).</p>
                      {(ketoneLevel === "moderate" || ketoneLevel === "large") && (
                        <p className="font-medium">With moderate/large ketones: consider switching to pen injections. Pump site absorption may be compromised. Contact your diabetes team.</p>
                      )}
                      <p>If you suspect pump failure, switch to backup pen injections and contact your pump supplier.</p>
                    </div>
                  </div>
                )}

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
