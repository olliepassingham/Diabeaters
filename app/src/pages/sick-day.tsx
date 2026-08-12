import { useMemo, useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Plane, ChevronRight, ChevronDown, Power, Check, Clock, ShieldAlert, Heart, Package, Syringe, Droplets, AlertTriangle, ArrowLeft, Thermometer, TrendingUp, TrendingDown, Trash2, Pill } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import {
  storage,
  UserSettings,
  Supply,
  SickDayJournalEntry,
  RatioFormat,
  SickDayMedicationLogEntry,
  SickDayMedicationDoseLogEntry,
  SickDayTemperatureEntry,
  DIABEATER_PROFILE_CHANGED_EVENT,
} from "@/lib/storage";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { getEffectiveTdd, hasConfiguredTdd } from "@/lib/tdd";
import { parseRatioToGramsPerUnit, formatRatioForDisplay } from "@/lib/ratio-utils";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { ScenarioActiveCard } from "@/components/scenarios/ScenarioActiveCard";
import { ScenarioCoachLink } from "@/components/ai-coach/ScenarioCoachLink";
import {
  upsertScenario,
  fetchScenarioStateForUser,
  syncSickDayDeactivatedToCloud,
  repairSickDayCloudIfLocalInactive,
} from "@/lib/scenarios-supabase";
import { invokeNotifyScenarioStarted } from "@/lib/invoke-notify-scenario-started";
import { NOTIFY_EDGE_FAILURE_TITLE, notifyEdgeFailureDescription } from "@/lib/notify-toast-messages";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SickDayDisclaimerFooter,
  SickDayResultsPanel,
  SickDayUpdateReadingsCollapsible,
  SickDayReadingsFields,
  SickDayTddField,
  scrollToSickDayPageTop,
  type SickDayCgmBgFieldProps,
  type SickDayVerdictViewModel,
} from "@/components/scenarios/sick-day-results-ui";
import { CgmPrefillButton } from "@/components/cgm-prefill-button";
import { useAutoCgmBgField } from "@/hooks/use-auto-cgm-bg-field";
import { cancelSickDayMedReminder, scheduleSickDayMedReminder } from "@/lib/sick-day-med-reminders";
import { SICK_DAY_MEDS_CHANGED_EVENT } from "@/lib/sick-day-med-actions";
import { createSickDayMedInAppNotification } from "@/lib/sick-day-med-inapp";
import {
  mergeMedicationDoseLogs,
  medicationDoseLogToScenarioRows,
  parseMedicationDoseLogFromScenario,
} from "@/lib/sick-day-dose-log";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { recordLastInteraction } from "@/lib/last-interaction";
import { ageInWholeYearsUtc } from "@/lib/user-age";
import { normalizeBgUnits } from "@/lib/alcohol-night-tool";
import {
  formatAppDate,
  formatAppDateTime,
  formatAppTime,
  getKetoneEmergencyCopy,
  getProfileRegion,
  getRegionDefaultsForProfile,
  getRegionEmergencyFooter,
} from "@/lib/region";

// Conversion helpers for blood glucose units
const mgdlToMmol = (mgdl: number) => Math.round(mgdl / 18 * 10) / 10;
const mmolToMgdl = (mmol: number) => Math.round(mmol * 18);

type KetoneLevel = "none" | "trace" | "small" | "moderate" | "large";

type SickDayCalcOptions = {
  /** When true, do not use the adult 1800÷TDD default if no correction factor is saved (under-18 with known age). */
  minorKnownAgeNoSavedIsf?: boolean;
};

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
  /** Short line for summary UI; optional on older saved sessions */
  basalAdjustmentBrief?: string;
  hydrationNote: string;
  hydrationBrief?: string;
  monitoringFrequency: string;
  monitoringBrief?: string;
  ketoneWarning: string;
  ketoneWarningBrief?: string;
  ketoneGuidance: string;
  ketoneGuidanceBrief?: string;
  ketoneActionRequired: "none" | "monitor" | "urgent" | "emergency";
  stackingWarning: string;
  stackingWarningBrief?: string;
}

// Blood glucose zones for tiered correction approach
const BG_ZONES = {
  SLIGHTLY_HIGH: { min: 0, max: 180, name: "Slightly Elevated" },
  MODERATELY_HIGH: { min: 180, max: 250, name: "Moderately Elevated" },
  HIGH: { min: 250, max: 300, name: "High" },
  VERY_HIGH: { min: 300, max: 400, name: "Very High" },
  CRITICAL: { min: 400, max: Infinity, name: "Critical" },
};

function formatCountdownMs(ms: number): string {
  const abs = Math.abs(ms);
  const mins = Math.round(abs / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const label = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return ms <= 0 ? `Due ${label} ago` : `Due in ${label}`;
}

function calculateSickDayRecommendations(
  tdd: number,
  bgLevel: number,
  severity: string,
  ketoneLevel: KetoneLevel,
  settings: UserSettings,
  bgUnits: string,
  opts: SickDayCalcOptions = {},
): SickDayResults {
  const hasTeamIsf =
    typeof settings.correctionFactor === "number" &&
    Number.isFinite(settings.correctionFactor) &&
    settings.correctionFactor > 0;

  let correctionFactor: number;
  if (hasTeamIsf) {
    correctionFactor = settings.correctionFactor as number;
  } else if (opts.minorKnownAgeNoSavedIsf) {
    correctionFactor = Number.POSITIVE_INFINITY;
  } else {
    correctionFactor = Math.round(1800 / tdd);
  }

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
  
  // Round to whole units for pen dosing.
  correctionDose = Math.round(correctionDose);
  baseCorrectionDose = Math.round(baseCorrectionDose);

  // Build explanation
  const correctionExplanation =
    opts.minorKnownAgeNoSavedIsf && !hasTeamIsf
      ? "Correction dose is not estimated here: under-18 users should use the correction factor (ISF) from their diabetes team. Add it in Settings → Ratios, then run this planner again."
      : baseCorrectionDose > 0
        ? `Base: ${baseCorrectionDose}u × ${severityModifier} (safety) × ${bgZoneModifier} (BG zone) = ${correctionDose}u`
        : "No correction needed - blood glucose is within target";

  // === RATIO AND OTHER ADJUSTMENTS ===
  
  const sickDayProfile = storage.getProfile();
  const ketoneEmergency = getKetoneEmergencyCopy(getProfileRegion(sickDayProfile));
  const ratioFmt: RatioFormat = sickDayProfile?.ratioFormat || "per10g";
  const cpSize = sickDayProfile?.carbPortionSize;

  const adjustRatio = (ratio: string | undefined, multiplier: number): string => {
    const gpu = parseRatioToGramsPerUnit(ratio);
    if (!gpu) return formatRatioForDisplay(10, ratioFmt, cpSize);
    const adjustedGpu = gpu / multiplier;
    return formatRatioForDisplay(adjustedGpu, ratioFmt, cpSize);
  };

  const getOriginalRatio = (ratio: string | undefined): string => {
    const gpu = parseRatioToGramsPerUnit(ratio);
    return formatRatioForDisplay(gpu || 10, ratioFmt, cpSize);
  };

  let ratioMultiplier = 1;
  let basalAdjustment = "No change recommended";
  let basalAdjustmentBrief = "No change unless your team advises";
  let hydrationNote = "Drink plenty of sugar-free fluids";
  let hydrationBrief = "Sugar-free fluids often";
  let monitoringFrequency = "Check blood glucose every 4 hours";
  let monitoringBrief = "Check BG about every 4 hours";
  let ketoneWarning = "";
  let ketoneWarningBrief = "";
  let ketoneGuidance = "";
  let ketoneGuidanceBrief = "";
  let ketoneActionRequired: "none" | "monitor" | "urgent" | "emergency" = "none";
  let stackingWarning = "";
  let stackingWarningBrief = "";

  switch (severity) {
    case "minor":
      ratioMultiplier = 1.1; // 10% more insulin
      basalAdjustment = "Consider 10% increase if blood glucose runs high";
      basalAdjustmentBrief = "Consider up to ~10% more basal if BG runs high";
      monitoringFrequency = "Check blood glucose every 4-6 hours";
      monitoringBrief = "Check BG every 4–6 hours";
      stackingWarning = "Wait at least 3 hours between corrections to assess effectiveness";
      stackingWarningBrief = "Wait at least 3 hours between corrections";
      break;
    case "moderate":
      ratioMultiplier = 1.2; // 20% more insulin
      basalAdjustment = "Consider 10-20% increase if blood glucose remains elevated";
      basalAdjustmentBrief = "Consider ~10–20% more basal if BG stays up";
      hydrationNote = "Stay well hydrated with sugar-free fluids. Consider electrolyte drinks.";
      hydrationBrief = "Water + sugar-free fluids; electrolytes if advised";
      monitoringFrequency = "Check blood glucose every 2-4 hours";
      monitoringBrief = "Check BG every 2–4 hours";
      stackingWarning = "Wait at least 4 hours between corrections - absorption may be delayed";
      stackingWarningBrief = "Wait at least 4 hours between corrections";
      break;
    case "severe":
      ratioMultiplier = 1.3; // 30% more insulin
      basalAdjustment = "Consider 20% increase, but monitor closely for lows if unable to eat";
      basalAdjustmentBrief = "Consider ~20% more basal; watch for hypos if not eating";
      hydrationNote = "Critical: Stay hydrated. If vomiting, seek medical attention immediately.";
      hydrationBrief = "Keep drinking; vomiting needs urgent care";
      monitoringFrequency = "Check blood glucose and ketones every 2 hours";
      monitoringBrief = "Check BG and ketones about every 2 hours";
      stackingWarning = "Do NOT give additional corrections for at least 4-5 hours. Insulin absorption is unpredictable during severe illness.";
      stackingWarningBrief = "No extra corrections for 4–5 hours";
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
        ketoneGuidanceBrief = "Recheck ketones if glucose stays high.";
        ketoneActionRequired = "monitor";
      } else {
        ketoneGuidance = "No ketones detected. Continue regular sick day monitoring.";
        ketoneGuidanceBrief = "No ketones—keep your usual sick-day checks.";
        ketoneActionRequired = "none";
      }
      break;
    case "trace":
      ketoneGuidance = "Trace ketones can appear during illness or if you haven't eaten. Drink extra fluids (250ml water per hour) and recheck in 2 hours.";
      ketoneGuidanceBrief = "Extra fluids; recheck ketones in 2 hours.";
      ketoneActionRequired = "monitor";
      if (isHighBg) {
        ketoneWarning = "Trace ketones with elevated glucose - take correction dose and increase fluids.";
        ketoneWarningBrief = "Take correction and drink more fluids.";
      }
      break;
    case "small":
      ketoneGuidance = "Small ketones indicate your body needs more insulin. Drink 250-500ml fluids per hour. Take correction dose if not already given. Recheck ketones every 2 hours.";
      ketoneGuidanceBrief = "More fluids + insulin as needed; recheck ketones every 2 hours.";
      ketoneActionRequired = "monitor";
      ketoneWarning = "Small ketones present - ensure you're getting enough insulin and fluids.";
      ketoneWarningBrief = "Ensure enough insulin and fluids.";
      if (isVeryHighBg) {
        ketoneActionRequired = "urgent";
        ketoneWarning = "Small ketones with high glucose - contact your diabetes team for guidance if ketones don't improve in 2 hours.";
        ketoneWarningBrief = "Call your team if not improving in 2 hours.";
      }
      break;
    case "moderate":
      ketoneGuidance = "Moderate ketones are a warning sign of developing DKA (diabetic ketoacidosis). You need extra insulin NOW. Drink 500ml fluids per hour. Contact your diabetes team immediately.";
      ketoneGuidanceBrief = "Extra insulin and fluids now—contact your diabetes team.";
      ketoneActionRequired = "urgent";
      ketoneWarning = "URGENT: Moderate ketones detected. This requires immediate attention. Contact your diabetes team now.";
      ketoneWarningBrief = "Urgent: contact your diabetes team now.";
      if (isVeryHighBg || severity === "severe") {
        ketoneActionRequired = "emergency";
        ketoneWarning = ketoneEmergency.moderateWithHighBg;
        ketoneWarningBrief = ketoneEmergency.moderateWithHighBgBrief;
      }
      break;
    case "large":
      ketoneGuidance = "Large ketones are a medical emergency. You are at high risk of DKA (diabetic ketoacidosis). Do NOT wait - seek emergency medical care immediately.";
      ketoneGuidanceBrief = "Medical emergency—seek care now.";
      ketoneActionRequired = "emergency";
      ketoneWarning = ketoneEmergency.large;
      ketoneWarningBrief = ketoneEmergency.largeBrief;
      break;
  }

  // Override with critical BG warning if applicable
  if (isCriticalBg) {
    ketoneWarning = "URGENT: Blood glucose is critically high. " + (ketoneLevel === "none" 
      ? "Check ketones immediately and contact your healthcare team."
      : ketoneWarning);
    ketoneWarningBrief = "Critically high glucose—get urgent medical advice.";
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
    basalAdjustmentBrief,
    hydrationNote,
    hydrationBrief,
    monitoringFrequency,
    monitoringBrief,
    ketoneWarning,
    ketoneWarningBrief,
    ketoneGuidance,
    ketoneGuidanceBrief,
    ketoneActionRequired,
    stackingWarning,
    stackingWarningBrief,
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
  const [localeProfile, setLocaleProfile] = useState(() => storage.getProfile());
  const regionDefaults = getRegionDefaultsForProfile(localeProfile);
  const [settings, setSettings] = useState<UserSettings>({});
  const [tdd, setTdd] = useState("");
  const [bgLevel, setBgLevel] = useState("");
  const [severity, setSeverity] = useState<string>("");
  const [ketoneLevel, setKetoneLevel] = useState<KetoneLevel | "">("");
  const [results, setResults] = useState<SickDayResults | null>(null);
  const [bgUnits, setBgUnits] = useState(() => normalizeBgUnits(storage.getProfile()?.bgUnits));
  const [isSickDayActive, setIsSickDayActive] = useState(false);
  const [sickDayActivatedAt, setSickDayActivatedAt] = useState<string | undefined>();
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [isTravelAlsoActive, setIsTravelAlsoActive] = useState(false);
  const [travelDestination, setTravelDestination] = useState<string | undefined>();
  const [isPumpUser, setIsPumpUser] = useState(false);
  const [journalEntries, setJournalEntries] = useState<SickDayJournalEntry[]>([]);
  const [medEntries, setMedEntries] = useState<SickDayMedicationLogEntry[]>([]);
  const [medDoseLog, setMedDoseLog] = useState<SickDayMedicationDoseLogEntry[]>([]);
  const [tempEntries, setTempEntries] = useState<SickDayTemperatureEntry[]>([]);
  const [medTakenAtOpen, setMedTakenAtOpen] = useState(false);
  const [medTakenAtId, setMedTakenAtId] = useState<string | null>(null);
  const [medTakenAtLocal, setMedTakenAtLocal] = useState("");
  const [tempValue, setTempValue] = useState("");
  const [tempUnit, setTempUnit] = useState<"c" | "f">("c");
  const [medPreset, setMedPreset] = useState<"paracetamol" | "ibuprofen" | "antibiotic" | "custom">("paracetamol");
  const [medCustomName, setMedCustomName] = useState("");
  const [medDoseLabel, setMedDoseLabel] = useState("");
  const [medRepeat, setMedRepeat] = useState<string>("4h");
  const [medRepeatCustomMins, setMedRepeatCustomMins] = useState<string>("");
  const [medNotes, setMedNotes] = useState("");
  /** Local `datetime-local` value — when the last dose was (or is) taken; next reminder = this + repeat interval. */
  const [medClockStartLocal, setMedClockStartLocal] = useState(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [journalBg, setJournalBg] = useState("");
  const [journalKetone, setJournalKetone] = useState<string>("");
  const [journalCorrection, setJournalCorrection] = useState("");
  const [journalFluids, setJournalFluids] = useState("");
  const [journalSymptoms, setJournalSymptoms] = useState("");
  const [journalNotes, setJournalNotes] = useState("");
  const [updateReadingsOpen, setUpdateReadingsOpen] = useState(false);
  const [activeModeTab, setActiveModeTab] = useState<"now" | "checklist" | "log">(() => {
    if (typeof window === "undefined") return "now";
    const hash = window.location.hash;
    if (hash === "#sickday-checklist") return "checklist";
    if (hash === "#sickday-log") return "log";
    return "now";
  });
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [pageHydrated, setPageHydrated] = useState(false);

  const readingsCgm = useAutoCgmBgField({
    bgValue: bgLevel,
    onApplyBg: setBgLevel,
    autoApplyKey: pageHydrated ? "sickday-readings" : undefined,
  });

  const journalCgm = useAutoCgmBgField({
    bgValue: journalBg,
    onApplyBg: setJournalBg,
    autoApplyKey: pageHydrated && activeModeTab === "log" ? "sickday-journal" : undefined,
  });

  const sickDayCgmProps: SickDayCgmBgFieldProps = {
    prefill: readingsCgm.prefill,
    loading: readingsCgm.loading,
    onRefresh: readingsCgm.refresh,
    emptyHint: readingsCgm.emptyHint,
  };

  useEffect(() => {
    if (storage.getScenarioState().sickDayActive) {
      recordLastInteraction("scenario:sick-day");
    }
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

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
    const effectiveTdd = getEffectiveTdd(storedSettings);
    if (effectiveTdd) {
      setTdd(effectiveTdd.toString());
    }
    
    const profile = storage.getProfile();
    setBgUnits(normalizeBgUnits(profile?.bgUnits));
    setIsPumpUser(isPumpDeliveryMethod(profile?.insulinDeliveryMethod));

    setSupplies(storage.getSupplies());

    const scenarioState = storage.getScenarioState();
    setIsSickDayActive(scenarioState.sickDayActive || false);
    setSickDayActivatedAt(scenarioState.sickDayActivatedAt);
    setIsTravelAlsoActive(scenarioState.travelModeActive || false);
    setTravelDestination(scenarioState.travelDestination);

    setJournalEntries(storage.getSickDayJournal());
    setMedEntries(storage.getSickDayMedicationLog());
    setMedDoseLog(storage.getSickDayMedicationDoseLog());
    setTempEntries(storage.getSickDayTemperatureLog());

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
    setPageHydrated(true);
  }, []);

  // Refresh med state when a dose is logged outside this page (e.g. notification "Taken" button).
  useEffect(() => {
    const onMedsChanged = () => {
      setMedEntries(storage.getSickDayMedicationLog());
      setMedDoseLog(storage.getSickDayMedicationDoseLog());
    };
    window.addEventListener(SICK_DAY_MEDS_CHANGED_EVENT, onMedsChanged);
    return () => window.removeEventListener(SICK_DAY_MEDS_CHANGED_EVENT, onMedsChanged);
  }, []);

  useEffect(() => {
    const onProfile = () => {
      const p = storage.getProfile();
      setLocaleProfile(p);
      setIsPumpUser(isPumpDeliveryMethod(p?.insulinDeliveryMethod));
    };
    window.addEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
    return () => window.removeEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
  }, []);

  useEffect(() => {
    void repairSickDayCloudIfLocalInactive();
  }, []);

  useEffect(() => {
    if (!isSickDayActive) return;
    const hash = window.location.hash;
    if (hash === "#sickday-checklist") setActiveModeTab("checklist");
    else if (hash === "#sickday-log") setActiveModeTab("log");
  }, [isSickDayActive]);

  /** Merge supporter-logged doses & temperatures from cloud when sick day is active. */
  useEffect(() => {
    if (!isSickDayActive) return;
    let cancelled = false;
    void (async () => {
      const remote = await fetchScenarioStateForUser("sick_day");
      if (cancelled || !remote) return;

      const remoteDoses = parseMedicationDoseLogFromScenario(remote.medication_dose_log);
      const localDoses = storage.getSickDayMedicationDoseLog();
      const mergedDoses = mergeMedicationDoseLogs(localDoses, remoteDoses);
      const localIds = new Set(localDoses.map((d) => d.id));
      const hasNewDose = mergedDoses.some((d) => !localIds.has(d.id));
      if (mergedDoses.length !== localDoses.length || hasNewDose) {
        storage.saveSickDayMedicationDoseLog(mergedDoses);
        setMedDoseLog(mergedDoses);
      }

      const localTemps = storage.getSickDayTemperatureLog();
      const tempIds = new Set(localTemps.map((t) => t.id));
      const carerTemps = Array.isArray(remote.carer_temp_recent) ? remote.carer_temp_recent : [];
      let addedTemp = false;
      for (const raw of carerTemps as Record<string, unknown>[]) {
        if (!raw || typeof raw !== "object") continue;
        const id = typeof raw.id === "string" ? raw.id.trim() : "";
        if (!id || tempIds.has(id)) continue;
        const value = typeof raw.value === "number" ? raw.value : Number(raw.value);
        const unit = raw.unit === "c" || raw.unit === "f" ? raw.unit : null;
        const at = typeof raw.at === "string" ? raw.at.trim() : "";
        if (!Number.isFinite(value) || !unit || !at || Number.isNaN(new Date(at).getTime())) continue;
        storage.addSickDayTemperatureEntry({
          id,
          value,
          unit,
          loggedAtIso: at,
          loggedBy: "carer",
        });
        tempIds.add(id);
        addedTemp = true;
      }
      if (addedTemp) {
        setTempEntries(storage.getSickDayTemperatureLog());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSickDayActive]);

  const scrollToId = (id: string) => {
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const lastCheckAtIso = journalEntries[0]?.timestamp ?? null;

  const recommendedCheckIntervalMs = useMemo(() => {
    // Conservative defaults based on severity + ketone escalation.
    // minor: ~4h, moderate: ~3h, severe: ~2h.
    const baseHours = severity === "severe" ? 2 : severity === "moderate" ? 3 : 4;
    const escalation =
      results?.ketoneActionRequired === "urgent" || results?.ketoneActionRequired === "emergency" ? 2 : baseHours;
    return escalation * 60 * 60 * 1000;
  }, [severity, results?.ketoneActionRequired]);

  const nextCheckDueAtIso = useMemo(() => {
    const anchor = lastCheckAtIso ?? sickDayActivatedAt ?? null;
    if (!anchor) return null;
    const dueMs = new Date(anchor).getTime() + recommendedCheckIntervalMs;
    return new Date(dueMs).toISOString();
  }, [lastCheckAtIso, sickDayActivatedAt, recommendedCheckIntervalMs]);

  const nextCheckCountdown = useMemo(() => {
    if (!nextCheckDueAtIso) return null;
    const dueMs = new Date(nextCheckDueAtIso).getTime();
    const diffMs = dueMs - nowTick;
    const overdue = diffMs <= 0;
    const abs = Math.abs(diffMs);
    const mins = Math.round(abs / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const label = h > 0 ? `${h}h ${m}m` : `${m}m`;
    return { overdue, label };
  }, [nextCheckDueAtIso, nowTick]);

  const verdict = useMemo((): SickDayVerdictViewModel | null => {
    if (!results) return null;
    const urgent = results.ketoneActionRequired === "urgent" || results.ketoneActionRequired === "emergency";
    const caution = results.ketoneActionRequired === "monitor" || severity === "severe";
    const label = urgent ? "Needs attention" : caution ? "Caution" : "Ready";
    const tone: SickDayVerdictViewModel["tone"] = urgent ? "critical" : caution ? "caution" : "ok";
    const title = urgent
      ? "Act now"
      : caution
        ? "Proceed carefully"
        : "You’re in a safer zone";
    const message = urgent
      ? "Follow urgent steps below and contact your team."
      : caution
        ? "Check more often and follow the plan below."
        : "Keep monitoring and stay hydrated.";
    return { label, tone, title, message };
  }, [results, severity]);

  const activeMedReminders = useMemo(() => {
    const now = Date.now();
    return medEntries
      .filter((e) => !e.dismissedAtIso)
      .map((e) => ({ e, dueMs: new Date(e.nextDueAtIso).getTime() - now }))
      .filter((x) => Number.isFinite(new Date(x.e.nextDueAtIso).getTime()))
      .sort((a, b) => a.dueMs - b.dueMs);
  }, [medEntries, nowTick]);

  const medTakenPendingEntry = useMemo(
    () => (medTakenAtId ? medEntries.find((e) => e.id === medTakenAtId) ?? null : null),
    [medEntries, medTakenAtId],
  );

  const sickDayEpisodeRows = useMemo(() => {
    type Row = { at: string; kind: "dose" | "temp"; id: string; title: string; subtitle: string };
    const rows: Row[] = [];
    for (const d of medDoseLog) {
      rows.push({
        at: d.takenAtIso,
        kind: "dose",
        id: `dose-${d.id}`,
        title: `${d.name}${d.doseLabel ? ` · ${d.doseLabel}` : ""}`,
        subtitle: d.source === "carer" ? "Supporter" : "You",
      });
    }
    for (const t of tempEntries) {
      rows.push({
        at: t.loggedAtIso,
        kind: "temp",
        id: `temp-${t.id}`,
        title: `${t.value}°${t.unit.toUpperCase()}`,
        subtitle: t.loggedBy === "carer" ? "Supporter" : "You",
      });
    }
    rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return rows.slice(0, 80);
  }, [medDoseLog, tempEntries]);

  const resolvedRepeatMinutes = (repeatKey: string, customMins: string): number | null => {
    if (repeatKey === "custom") {
      const n = parseInt(customMins, 10);
      if (!Number.isFinite(n) || n <= 0) return null;
      return Math.min(7 * 24 * 60, Math.max(5, n));
    }
    const map: Record<string, number> = { "2h": 120, "4h": 240, "6h": 360, "8h": 480, "12h": 720, "24h": 1440 };
    return map[repeatKey] ?? null;
  };

  const buildLocalSickDayScenarioState = useCallback((): Record<string, unknown> => {
    const sc = storage.getScenarioState();
    const journal = storage.getSickDayJournal();
    const lastCheck = journal[0]?.timestamp ?? null;
    const meds = storage.getSickDayMedicationLog();
    const tempsLog = storage.getSickDayTemperatureLog();
    const activeMeds = meds
      .filter((e) => !e.dismissedAtIso)
      .sort((a, b) => new Date(a.nextDueAtIso).getTime() - new Date(b.nextDueAtIso).getTime());
    const upcoming = activeMeds[0];
    const temps = tempsLog.slice(0, 10).map((e) => ({
      id: e.id,
      value: e.value,
      unit: e.unit,
      at: e.loggedAtIso,
    }));
    const doseRows = medicationDoseLogToScenarioRows(storage.getSickDayMedicationDoseLog());
    return {
      sick_day_active: !!sc.sickDayActive,
      severity: sc.sickDaySeverity ?? severity ?? null,
      started_at: sc.sickDayActivatedAt ?? sickDayActivatedAt ?? null,
      ended_at: null,
      last_check_at: lastCheck,
      meds_next_due: upcoming
        ? {
            name: upcoming.name,
            due_at: upcoming.nextDueAtIso,
            repeat_mins: upcoming.repeatEveryMinutes,
          }
        : null,
      meds_active: activeMeds.slice(0, 10).map((e) => ({
        id: e.id,
        name: e.name,
        due_at: e.nextDueAtIso,
        repeat_mins: e.repeatEveryMinutes,
        dose_label: e.doseLabel ?? null,
      })),
      temp_latest: temps[0] ? { value: temps[0].value, unit: temps[0].unit, at: temps[0].at } : null,
      temp_recent: temps,
      medication_dose_log: doseRows,
    };
  }, [severity, sickDayActivatedAt]);

  const pushSickDayScenario = useCallback(
    async (overrides: Record<string, unknown> = {}, labelOverride?: string) => {
      const remote = await fetchScenarioStateForUser("sick_day");
      const preservedCarerTemps = Array.isArray(remote?.carer_temp_recent) ? remote!.carer_temp_recent : [];
      const preservedCarerNotes = Array.isArray(remote?.carer_med_notes) ? remote!.carer_med_notes : [];
      const off = overrides.sick_day_active === false;
      if (!off) {
        const remoteDoses = parseMedicationDoseLogFromScenario(remote?.medication_dose_log);
        const localDoses = storage.getSickDayMedicationDoseLog();
        const mergedDoses = mergeMedicationDoseLogs(localDoses, remoteDoses);
        storage.saveSickDayMedicationDoseLog(mergedDoses);
        setMedDoseLog(mergedDoses);
      }
      const localBase = off ? {} : buildLocalSickDayScenarioState();
      await upsertScenario({
        scenarioKey: "sick_day",
        title: "Sick day",
        label: labelOverride ?? (off ? "Sick day mode (off)" : `Sick day mode${severity ? ` (${severity})` : ""}`),
        state: {
          ...localBase,
          ...overrides,
          carer_temp_recent: preservedCarerTemps,
          carer_med_notes: preservedCarerNotes,
        },
      });
    },
    [buildLocalSickDayScenarioState, severity],
  );

  const handleAddMedicationReminder = () => {
    const name =
      medPreset === "custom"
        ? medCustomName.trim()
        : medPreset === "paracetamol"
          ? regionDefaults.paracetamolLabel
          : medPreset === "ibuprofen"
            ? "Ibuprofen"
            : "Antibiotic";
    if (!name) {
      toast({ title: "Add a medication name", description: "Choose a preset or enter a custom medication.", variant: "destructive" });
      return;
    }
    const repeatMins = resolvedRepeatMinutes(medRepeat, medRepeatCustomMins);
    if (!repeatMins) {
      toast({ title: "Choose a reminder interval", description: "Select how long until the next reminder.", variant: "destructive" });
      return;
    }
    const anchorRaw = medClockStartLocal.trim();
    const anchor = anchorRaw ? new Date(anchorRaw) : new Date();
    if (anchorRaw && Number.isNaN(anchor.getTime())) {
      toast({ title: "Invalid time", description: "Check “When did you take it?” — use a valid date and time.", variant: "destructive" });
      return;
    }
    if (anchor.getTime() > Date.now() + 60_000) {
      toast({ title: "Time is in the future", description: "Use a dose time up to now (or leave as now).", variant: "destructive" });
      return;
    }
    const takenAtIso = anchor.toISOString();
    const stepAdd = repeatMins * 60_000;
    let nextMs = anchor.getTime() + stepAdd;
    while (nextMs <= Date.now()) {
      nextMs += stepAdd;
    }
    const nextDue = new Date(nextMs).toISOString();
    const entry: SickDayMedicationLogEntry = {
      id: crypto.randomUUID(),
      name,
      doseLabel: medDoseLabel.trim() || undefined,
      notes: medNotes.trim() || undefined,
      takenAtIso,
      repeatEveryMinutes: repeatMins,
      nextDueAtIso: nextDue,
      createdAtIso: takenAtIso,
    };
    storage.addSickDayMedicationEntry(entry);
    const next = storage.getSickDayMedicationLog();
    setMedEntries(next);
    setMedDoseLabel("");
    setMedNotes("");
    if (medPreset === "custom") setMedCustomName("");
    {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      setMedClockStartLocal(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    }
    void (async () => {
      const res = await scheduleSickDayMedReminder(entry);
      if (res.permission === "denied") {
        toast({
          title: "Notifications not enabled",
          description: "We’ll still track reminders here, but enable notifications to get a phone alert.",
          variant: "destructive",
        });
      }
      await createSickDayMedInAppNotification({
        title: "Medication reminder set",
        body: `${entry.name} · next due ${new Date(entry.nextDueAtIso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`,
        reminderId: entry.id,
        dueAtIso: entry.nextDueAtIso,
        name: entry.name,
      });
      await pushSickDayScenario({
        inputs_summary: results
          ? {
              bg_level: bgLevel ? parseFloat(bgLevel) : null,
              bg_units: bgUnits,
              ketone_level: ketoneLevel || null,
              correction_dose_units: results.correctionDose,
            }
          : null,
      });
    })();
    toast({
      title: "Reminder added",
      description: `Next reminder ${new Date(nextDue).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} (${repeatMins >= 60 ? `${Math.round(repeatMins / 60)}h` : `${repeatMins}m`} after your dose time).`,
    });
  };

  const handleStopMedicationReminder = (id: string) => {
    void cancelSickDayMedReminder(id);
    storage.updateSickDayMedicationEntry(id, { dismissedAtIso: new Date().toISOString() });
    const next = storage.getSickDayMedicationLog();
    setMedEntries(next);
    void (async () => {
      await createSickDayMedInAppNotification({
        title: "Medication reminder stopped",
        body: "A medication reminder was stopped.",
        reminderId: id,
        dueAtIso: new Date().toISOString(),
        name: "Medication",
      });
      await pushSickDayScenario({});
    })();
  };

  const handleSnoozeMedicationReminder = (id: string, minutes: number) => {
    const now = Date.now();
    storage.updateSickDayMedicationEntry(id, {
      nextDueAtIso: new Date(now + minutes * 60_000).toISOString(),
      lastInAppNotifiedDueAtIso: undefined,
    });
    const next = storage.getSickDayMedicationLog();
    setMedEntries(next);
    const updated = next.find((e) => e.id === id);
    if (updated) {
      void scheduleSickDayMedReminder(updated);
      void createSickDayMedInAppNotification({
        title: "Medication reminder snoozed",
        body: `${updated.name} · snoozed ${minutes}m`,
        reminderId: updated.id,
        dueAtIso: updated.nextDueAtIso,
        name: updated.name,
      });
      void pushSickDayScenario({});
    }
  };

  const openMedicationTakenDialog = (id: string) => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const local = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    setMedTakenAtId(id);
    setMedTakenAtLocal(local);
    setMedTakenAtOpen(true);
  };

  const handleMedicationTakenSave = () => {
    const id = medTakenAtId;
    if (!id) return;
    const entry = medEntries.find((e) => e.id === id);
    if (!entry) return;

    const raw = medTakenAtLocal.trim();
    const takenAt = raw ? new Date(raw) : null;
    if (!takenAt || Number.isNaN(takenAt.getTime())) {
      toast({ title: "Choose a valid time", description: "Pick when you took the medication.", variant: "destructive" });
      return;
    }
    if (takenAt.getTime() > Date.now() + 60_000) {
      toast({ title: "Time is in the future", description: "Use a time up to now.", variant: "destructive" });
      return;
    }

    const takenAtIso = takenAt.toISOString();
    const stepMs = Math.max(1, Math.round(entry.repeatEveryMinutes)) * 60_000;
    let nextMs = takenAt.getTime() + stepMs;
    while (nextMs <= Date.now()) {
      nextMs += stepMs;
    }
    const nextDueAtIso = new Date(nextMs).toISOString();

    const dose: SickDayMedicationDoseLogEntry = {
      id: crypto.randomUUID(),
      reminderId: id,
      name: entry.name,
      doseLabel: entry.doseLabel,
      takenAtIso,
      source: "user",
    };
    storage.addSickDayMedicationDoseEntry(dose);
    setMedDoseLog(storage.getSickDayMedicationDoseLog());

    storage.updateSickDayMedicationEntry(id, {
      takenAtIso,
      nextDueAtIso,
      lastInAppNotifiedDueAtIso: undefined,
    });
    const next = storage.getSickDayMedicationLog();
    setMedEntries(next);
    const updated = next.find((e) => e.id === id);
    if (updated) {
      void scheduleSickDayMedReminder(updated);
      void createSickDayMedInAppNotification({
        title: "Medication logged",
        body: `${updated.name} · taken ${new Date(takenAtIso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} · next reminder ${new Date(nextDueAtIso).toLocaleString(undefined, { timeStyle: "short" })}`,
        reminderId: updated.id,
        dueAtIso: nextDueAtIso,
        name: updated.name,
      });
      void pushSickDayScenario({});
    }

    setMedTakenAtOpen(false);
    setMedTakenAtId(null);
  };

  const latestTemp = useMemo(() => tempEntries[0] ?? null, [tempEntries]);
  const recentTemps = useMemo(() => tempEntries.slice(0, 10), [tempEntries]);

  const handleLogTemperature = () => {
    const raw = tempValue.trim().replace(",", ".");
    const n = parseFloat(raw);
    if (!Number.isFinite(n) || n <= 0) {
      toast({ title: "Enter a valid temperature", description: "Please enter a number like 38.2.", variant: "destructive" });
      return;
    }
    const entry: SickDayTemperatureEntry = {
      id: crypto.randomUUID(),
      value: Math.round(n * 10) / 10,
      unit: tempUnit,
      loggedAtIso: new Date().toISOString(),
      loggedBy: "user",
    };
    storage.addSickDayTemperatureEntry(entry);
    setTempEntries(storage.getSickDayTemperatureLog());
    setTempValue("");
    toast({
      title: "Temperature logged",
      description: `${entry.value}°${entry.unit.toUpperCase()} recorded ${new Date(entry.loggedAtIso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}.`,
    });
    void pushSickDayScenario({});
  };

  const handleDeleteTemperature = (id: string) => {
    storage.deleteSickDayTemperatureEntry(id);
    setTempEntries(storage.getSickDayTemperatureLog());
    toast({ title: "Temperature deleted" });
    void pushSickDayScenario({});
  };

  const handleActivateSickDay = () => {
    if (!severity) return;
    storage.activateSickDay(severity);
    setIsSickDayActive(true);
    const scAfter = storage.getScenarioState();
    const startedAt = scAfter.sickDayActivatedAt || new Date().toISOString();
    setSickDayActivatedAt(scAfter.sickDayActivatedAt);
    void pushSickDayScenario({
      sick_day_active: true,
      severity,
      started_at: startedAt,
      ended_at: null,
      inputs_summary: {
        bg_level: bgLevel ? Number(bgLevel) : null,
        bg_units: bgUnits,
        ketone_level: ketoneLevel || null,
      },
    });
    toast({
      title: "Sick day mode activated",
      description: `Your dashboard will now show sick day status (${severity} severity).`,
    });
    void (async () => {
      const res = await invokeNotifyScenarioStarted({
        scenarioKey: "sick_day",
        title: "Sick day started",
        summary: severity ? `Severity: ${severity}` : null,
      });
      if (!res.success) {
        toast({
          title: NOTIFY_EDGE_FAILURE_TITLE,
          description: notifyEdgeFailureDescription(res),
          variant: "destructive",
        });
      }
    })();
  };

  const handleDeactivateSickDay = () => {
    for (const m of storage.getSickDayMedicationLog()) {
      void cancelSickDayMedReminder(m.id);
    }
    storage.deactivateSickDay();
    setMedDoseLog([]);
    setIsSickDayActive(false);
    localStorage.removeItem(SICK_DAY_STORAGE_KEY);
    setResults(null);
    setBgLevel("");
    setKetoneLevel("");
    const endedAt = new Date().toISOString();
    const startedAt = sickDayActivatedAt || null;
    void syncSickDayDeactivatedToCloud({
      endedAt,
      startedAt,
      lastCheckAt: lastCheckAtIso,
    });
    toast({
      title: "Sick day mode deactivated",
      description: "Glad you're feeling better! Status removed from dashboard.",
    });
  };

  const handleCalculate = () => {
    if (!hasConfiguredTdd(settings)) {
      toast({
        title: "TDD not configured",
        description: "Set your total daily dose under Settings → Ratios, or enter short- and long-acting units under Personal & usage.",
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

    const tddNum = getEffectiveTdd(settings);
    const bgNum = parseFloat(bgLevel);

    if (!tddNum || isNaN(bgNum) || bgNum <= 0) {
      toast({
        title: "Invalid values",
        description: "Please enter valid blood glucose and ensure TDD is set in Settings.",
        variant: "destructive",
      });
      return;
    }

    // Convert to mg/dL for internal calculations if user uses mmol/L
    const bgInMgdl = bgUnits === "mmol/L" ? mmolToMgdl(bgNum) : bgNum;
    const dob = storage.getProfile()?.dateOfBirth;
    const ageYears = ageInWholeYearsUtc(dob);
    const hasTeamIsf =
      typeof settings.correctionFactor === "number" &&
      Number.isFinite(settings.correctionFactor) &&
      settings.correctionFactor > 0;
    const minorKnownAgeNoSavedIsf = ageYears !== null && ageYears < 18 && !hasTeamIsf;
    const recommendations = calculateSickDayRecommendations(
      tddNum,
      bgInMgdl,
      severity,
      ketoneLevel as KetoneLevel,
      settings,
      bgUnits,
      { minorKnownAgeNoSavedIsf },
    );
    
    if (isNaN(recommendations.correctionDose)) {
      toast({
        title: "Calculation error",
        description: "Unable to calculate recommendations. Please check your input values.",
        variant: "destructive",
      });
      return;
    }
    
    setResults(recommendations);
    setUpdateReadingsOpen(false);
    saveSession(recommendations);
    void pushSickDayScenario({
      inputs_summary: {
        bg_level: bgNum,
        bg_units: bgUnits,
        ketone_level: ketoneLevel,
        correction_dose_units: recommendations.correctionDose,
      },
    });

    if (isSickDayActive) {
      storage.activateSickDay(severity);
    }

    storage.addActivityLog({
      activityType: "sick_day_calculation",
      activityDetails: `TDD: ${tddNum}, BG: ${bgNum}, Severity: ${severity}, Ketones: ${ketoneLevel}`,
      recommendation: `Correction: ${recommendations.correctionDose}u, Ratios adjusted`,
    });

    if (isSickDayActive) {
      setActiveModeTab("now");
    }
    scrollToSickDayPageTop();
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
    void pushSickDayScenario({
      inputs_summary: {
        bg: bgNum,
        bg_units: bgUnits,
        ketone_level: journalKetone,
        correction_dose_units: journalCorrection ? parseFloat(journalCorrection) : null,
      },
      last_check_at: entry.timestamp,
    });
    setJournalBg("");
    setJournalKetone("");
    setJournalCorrection("");
    setJournalFluids("");
    setJournalSymptoms("");
    setJournalNotes("");
    toast({
      title: "Check logged",
      description: `BG ${bgNum} ${bgUnits} recorded at ${formatAppTime(new Date(), localeProfile, { hour: "2-digit", minute: "2-digit" })}.`,
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
      <PageShell variant="narrow" density="compact">
        <div id="sickday-page-top" tabIndex={-1} className="sr-only outline-none" aria-hidden />
        <PageHeader
          stackActionsMaxSm
          leading={<PageBackButton />}
          title={
            <span className="inline-flex min-w-0 flex-wrap items-center gap-2.5" data-testid="text-sick-day-dashboard-title">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  severity === "severe"
                    ? "bg-red-500/15 dark:bg-red-950/40"
                    : severity === "moderate"
                      ? "bg-orange-500/15 dark:bg-orange-950/40"
                      : "bg-amber-500/15 dark:bg-amber-950/40"
                }`}
              >
                <Thermometer
                  className={`h-5 w-5 ${
                    severity === "severe"
                      ? "text-red-600 dark:text-red-400"
                      : severity === "moderate"
                        ? "text-orange-600 dark:text-orange-400"
                        : "text-amber-600 dark:text-amber-400"
                  }`}
                  aria-hidden
                />
              </span>
              <span className="min-w-0">Sick day</span>
            </span>
          }
          actions={
            <div className="flex flex-wrap items-center justify-end gap-2">
              {verdict ? (
                <Badge
                  variant="secondary"
                  className={
                    verdict.tone === "critical"
                      ? "bg-red-500/15 text-red-800 dark:bg-red-950/40 dark:text-red-200"
                      : verdict.tone === "caution"
                        ? "bg-amber-500/15 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
                        : "bg-emerald-500/15 text-emerald-900 dark:text-emerald-100"
                  }
                >
                  {verdict.label}
                </Badge>
              ) : null}
              <Badge variant="outline" className="rounded-full tabular-nums">
                <Clock className="h-3 w-3 mr-1" aria-hidden />
                {duration.label}
              </Badge>
            </div>
          }
        />

        {isExtended ? (
          <p
            className={cn(
              "rounded-xl border px-3 py-2.5 text-sm leading-snug",
              duration.days >= 3
                ? "border-red-500/35 bg-red-500/10 text-foreground dark:bg-red-950/30"
                : "border-orange-500/35 bg-orange-500/10 text-foreground dark:bg-orange-950/30",
            )}
            data-testid="text-extended-sick-warning"
          >
            <AlertTriangle className="mb-1 inline h-4 w-4 shrink-0 align-text-bottom mr-1.5" aria-hidden />
            {duration.days >= 3
              ? "Unwell 3+ days — contact your diabetes team."
              : "Unwell 2 days — contact your team if not improving."}
          </p>
        ) : null}

        <ScenarioActiveCard
          title="Sick day mode"
          subtitle={
            `Started ${
              sickDayActivatedAt
                ? formatAppDateTime(sickDayActivatedAt, localeProfile, {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "recently"
            } · ${duration.label}`
          }
          badgeText="Active"
          tone="amber"
          icon={<Thermometer className="h-4 w-4 text-primary" aria-hidden />}
          actions={
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setActiveModeTab("log");
                scrollToId("sickday-log");
              }}
              data-testid="button-strip-log-check"
            >
              <Activity className="h-4 w-4 mr-2" />
              Log a check
            </Button>
          }
          facts={[
            {
              label: "Next check",
              value: nextCheckCountdown ? (
                <span className={nextCheckCountdown.overdue ? "text-red-700 dark:text-red-300" : ""}>
                  {nextCheckCountdown.overdue ? "Due" : "In"} {nextCheckCountdown.label}
                </span>
              ) : (
                "—"
              ),
            },
            { label: "Ketones", value: ketoneLevel || "—" },
            { label: "Severity", value: severity ? String(severity) : "—" },
          ]}
          data-testid="sickday-status-strip"
        />

        <Tabs value={activeModeTab} onValueChange={(v) => setActiveModeTab(v as "now" | "checklist" | "log")} className="w-full">
          <TabsList className="grid h-11 w-full grid-cols-3 gap-1 rounded-xl bg-muted/45 p-1">
            <TabsTrigger
              value="now"
              className="rounded-lg text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
              data-testid="tab-sickday-now"
            >
              Now
            </TabsTrigger>
            <TabsTrigger
              value="checklist"
              className="rounded-lg text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
              data-testid="tab-sickday-checklist"
            >
              Reminders
            </TabsTrigger>
            <TabsTrigger
              value="log"
              className="rounded-lg text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
              data-testid="tab-sickday-update"
            >
              Update
            </TabsTrigger>
          </TabsList>

          <TabsContent value="now" className="mt-4 space-y-4 animate-fade-in-up" data-testid="tabcontent-sickday-now">
            <div id="sickday-now-recommendations" className="space-y-3">
              {results ? (
                <>
                  <SickDayResultsPanel
                    results={results}
                    verdict={verdict}
                    bgLevel={bgLevel}
                    bgUnits={bgUnits}
                    severity={severity}
                    ketoneLevel={ketoneLevel}
                    isPumpUser={isPumpUser}
                    title="Current recommendations"
                    lastUpdatedLabel={
                      lastCheckAtIso
                        ? `Latest check: ${formatAppDateTime(lastCheckAtIso, localeProfile, {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : "Based on your last entered readings"
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full rounded-xl"
                    onClick={() => {
                      setActiveModeTab("log");
                      setUpdateReadingsOpen(true);
                      scrollToSickDayPageTop();
                    }}
                    data-testid="button-now-update-reading"
                  >
                    Update readings
                  </Button>
                </>
              ) : (
                <Card className="rounded-2xl border-dashed border-border/70 bg-muted/15">
                  <CardContent className="p-6 text-center text-sm text-muted-foreground" data-testid="sickday-now-no-results">
                    Add your current blood glucose, ketones, and how unwell you feel on the Update tab to see guidance here.
                  </CardContent>
                </Card>
              )}
            </div>

            {isTravelAlsoActive && (
              <Card className="overflow-hidden rounded-[1.35rem] border-sky-500/25 bg-sky-500/[0.06] shadow-none dark:bg-sky-950/30" data-testid="card-travel-also-active">
                <CardContent className="flex items-center gap-3 p-3.5">
                  <Plane className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
                  <p className="min-w-0 flex-1 text-sm font-medium">
                    Travel also on{travelDestination ? ` · ${travelDestination}` : ""}
                  </p>
                  <Link href="/scenarios?tab=travel">
                    <Button variant="outline" size="sm" className="h-9 rounded-lg" data-testid="button-view-travel-from-sick">
                      Travel
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            <Card className="overflow-hidden rounded-[1.35rem] border-border/50 shadow-none">
              <Collapsible className="group">
                <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3.5 text-left">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <ShieldAlert className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
                    <span className="text-sm font-semibold">Sick day rules</span>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-2 border-t border-border/50 px-4 pb-4 pt-3">
                    {[
                      {
                        icon: Syringe,
                        title: "Keep taking insulin",
                        body: isPumpUser
                          ? "Keep the pump running. If it fails, switch to backup injections."
                          : "Long-acting insulin must continue even if you are not eating.",
                      },
                      {
                        icon: Droplets,
                        title: "Check more often",
                        body: results.monitoringBrief || results.monitoringFrequency,
                      },
                      {
                        icon: Activity,
                        title: "Ketones if BG is high",
                        body: `Test if glucose stays above ${bgUnits === "mmol/L" ? "13.9 mmol/L" : "250 mg/dL"}.`,
                      },
                      {
                        icon: Heart,
                        title: "Stay hydrated",
                        body: results.hydrationBrief || results.hydrationNote,
                      },
                      ...(isPumpUser
                        ? [{
                            icon: Syringe,
                            title: "Check pump site",
                            body: "If glucose stays high after corrections, change set and site.",
                          }]
                        : []),
                    ].map((rule) => {
                      const Icon = rule.icon;
                      return (
                        <div key={rule.title} className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">{rule.title}</p>
                            <p className="mt-0.5 text-sm leading-snug text-foreground/85">{rule.body}</p>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          </TabsContent>

          <TabsContent value="checklist" className="mt-4 space-y-4 animate-fade-in-up" data-testid="tabcontent-sickday-checklist">
            <Card className="overflow-hidden rounded-[1.35rem] border-border/50 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Reminders</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Card className="border-border/60" data-testid="card-sickday-med-reminders">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                      <Pill className="h-4 w-4 text-primary" />
                      Medication
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Dialog
                      open={medTakenAtOpen}
                      onOpenChange={(v) => {
                        setMedTakenAtOpen(v);
                        if (!v) setMedTakenAtId(null);
                      }}
                    >
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Log dose taken</DialogTitle>
                          <DialogDescription>
                            {medTakenPendingEntry
                              ? (() => {
                                  const rm = medTakenPendingEntry.repeatEveryMinutes;
                                  const every =
                                    rm >= 60 ? `${Math.round(rm / 60)} hour${Math.round(rm / 60) === 1 ? "" : "s"}` : `${rm} minutes`;
                                  return `Enter when you had this dose. Your next reminder is that time plus every ${every}.`;
                                })()
                              : "Enter when you had this dose. Your next reminder follows from that time plus your repeat interval."}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3">
                          {medTakenPendingEntry ? (
                            <p className="text-sm font-medium text-foreground">
                              {medTakenPendingEntry.name}
                              {medTakenPendingEntry.doseLabel ? ` · ${medTakenPendingEntry.doseLabel}` : null}
                            </p>
                          ) : null}
                          <div className="space-y-2">
                            <Label htmlFor="input-med-taken-at" className="text-sm">
                              When did you take it?
                            </Label>
                            <Input
                              id="input-med-taken-at"
                              type="datetime-local"
                              step={60}
                              value={medTakenAtLocal}
                              onChange={(e) => setMedTakenAtLocal(e.target.value)}
                              data-testid="input-med-taken-at"
                            />
                            <p className="text-xs text-muted-foreground">
                              On some phones, use the system date and time picker if the field looks blank.
                            </p>
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setMedTakenAtOpen(false)}
                              data-testid="button-med-taken-at-cancel"
                            >
                              Cancel
                            </Button>
                            <Button type="button" onClick={handleMedicationTakenSave} data-testid="button-med-taken-at-save">
                              Save
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-sm">What did you take?</Label>
                        <Select value={medPreset} onValueChange={(v) => setMedPreset(v as any)}>
                          <SelectTrigger data-testid="select-med-preset">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="paracetamol">{regionDefaults.paracetamolLabel}</SelectItem>
                            <SelectItem value="ibuprofen">Ibuprofen</SelectItem>
                            <SelectItem value="antibiotic">Antibiotic</SelectItem>
                            <SelectItem value="custom">Custom…</SelectItem>
                          </SelectContent>
                        </Select>
                        {medPreset === "custom" && (
                          <Input
                            placeholder="Medication name"
                            value={medCustomName}
                            onChange={(e) => setMedCustomName(e.target.value)}
                            data-testid="input-med-custom-name"
                          />
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Remind me again in</Label>
                        <Select value={medRepeat} onValueChange={setMedRepeat}>
                          <SelectTrigger data-testid="select-med-repeat">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2h">2 hours</SelectItem>
                            <SelectItem value="4h">4 hours</SelectItem>
                            <SelectItem value="6h">6 hours</SelectItem>
                            <SelectItem value="8h">8 hours</SelectItem>
                            <SelectItem value="12h">12 hours</SelectItem>
                            <SelectItem value="24h">24 hours</SelectItem>
                            <SelectItem value="custom">Custom…</SelectItem>
                          </SelectContent>
                        </Select>
                        {medRepeat === "custom" && (
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={5}
                            step={5}
                            placeholder="Minutes"
                            value={medRepeatCustomMins}
                            onChange={(e) => setMedRepeatCustomMins(e.target.value)}
                            data-testid="input-med-repeat-custom"
                          />
                        )}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-sm">Dose (optional)</Label>
                        <Input
                          placeholder="e.g. 500mg, 2 tablets"
                          value={medDoseLabel}
                          onChange={(e) => setMedDoseLabel(e.target.value)}
                          data-testid="input-med-dose"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Notes (optional)</Label>
                        <Input
                          placeholder="e.g. with food"
                          value={medNotes}
                          onChange={(e) => setMedNotes(e.target.value)}
                          data-testid="input-med-notes"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="input-med-clock-start" className="text-sm">
                        When did you take it? (starts the reminder clock)
                      </Label>
                      <Input
                        id="input-med-clock-start"
                        type="datetime-local"
                        step={60}
                        value={medClockStartLocal}
                        onChange={(e) => setMedClockStartLocal(e.target.value)}
                        data-testid="input-med-clock-start"
                      />
                      <p className="text-sm text-muted-foreground">
                        First reminder is this time plus the interval. Edit later with Taken.
                      </p>
                    </div>

                    <Button type="button" className="w-full" onClick={handleAddMedicationReminder} data-testid="button-add-med-reminder">
                      Add reminder
                    </Button>

                    {activeMedReminders.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Active reminders</p>
                        <div className="space-y-2">
                          {activeMedReminders.map(({ e, dueMs }) => (
                            <div
                              key={e.id}
                              className={[
                                "rounded-xl border px-3 py-3 space-y-2",
                                dueMs <= 0 ? "border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20" : "border-border/60",
                              ].join(" ")}
                              data-testid={`med-reminder-${e.id}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-foreground">
                                    {e.name}
                                    {e.doseLabel ? <span className="text-muted-foreground font-normal"> · {e.doseLabel}</span> : null}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatCountdownMs(dueMs)} · next due{" "}
                                    {new Date(e.nextDueAtIso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}{" "}
                                    <span className="block sm:inline sm:ml-1">(dose time + repeat)</span>
                                  </p>
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                  every {e.repeatEveryMinutes >= 60 ? `${Math.round(e.repeatEveryMinutes / 60)}h` : `${e.repeatEveryMinutes}m`}
                                </Badge>
                              </div>
                              {e.notes ? <p className="text-xs text-muted-foreground">{e.notes}</p> : null}
                              <div className="flex flex-wrap gap-2">
                                <Button size="sm" onClick={() => openMedicationTakenDialog(e.id)} data-testid={`button-med-taken-${e.id}`}>
                                  Taken
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => handleSnoozeMedicationReminder(e.id, 30)} data-testid={`button-med-snooze-${e.id}`}>
                                  Snooze 30m
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleStopMedicationReminder(e.id)} data-testid={`button-med-stop-${e.id}`}>
                                  Stop
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No active reminders yet.</p>
                    )}

                    {sickDayEpisodeRows.length > 0 ? (
                      <div className="rounded-xl border border-border/60 bg-muted/10 px-3 py-3 space-y-2" data-testid="sickday-episode-log">
                        <p className="text-sm font-medium">This sick day — activity</p>
                        <p className="text-xs text-muted-foreground">
                          Medication doses you mark as taken and every temperature logged during this sick day period.
                        </p>
                        <ul className="space-y-2 max-h-64 overflow-y-auto">
                          {sickDayEpisodeRows.map((row) => (
                            <li
                              key={row.id}
                              className="flex items-start gap-2 rounded-lg border border-border/50 bg-background/80 px-2 py-2 text-sm"
                            >
                              {row.kind === "dose" ? (
                                <Pill className="h-4 w-4 shrink-0 mt-0.5 text-primary" aria-hidden />
                              ) : (
                                <Thermometer className="h-4 w-4 shrink-0 mt-0.5 text-orange-600 dark:text-orange-400" aria-hidden />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="font-medium leading-snug">{row.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(row.at).toLocaleString(undefined, {
                                    weekday: "short",
                                    day: "numeric",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}{" "}
                                  · {row.subtitle}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <div className="border-t border-border/60 pt-4 space-y-3" data-testid="sickday-temperature-log">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">Temperature</p>
                        <span className="text-xs text-muted-foreground">
                          {recentTemps.length > 0 ? `${recentTemps.length} logged` : "No temperature logged yet"}
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="sm:col-span-2 space-y-2">
                          <Label htmlFor="input-sickday-temp" className="text-sm">Log temperature</Label>
                          <Input
                            id="input-sickday-temp"
                            type="number"
                            inputMode="decimal"
                            step="0.1"
                            placeholder={tempUnit === "c" ? "e.g. 38.2" : "e.g. 101.3"}
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            data-testid="input-sickday-temp"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">Unit</Label>
                          <Select value={tempUnit} onValueChange={(v) => setTempUnit(v as "c" | "f")}>
                            <SelectTrigger data-testid="select-sickday-temp-unit">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="c">°C</SelectItem>
                              <SelectItem value="f">°F</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button type="button" variant="outline" className="w-full" onClick={handleLogTemperature} data-testid="button-log-temperature">
                        Log temperature
                      </Button>

                      {recentTemps.length > 0 && (
                        <div className="space-y-2" data-testid="sickday-temperature-history">
                          <p className="text-sm font-medium">Recent temperatures</p>
                          <div className="space-y-2">
                            {recentTemps.map((t) => (
                              <div
                                key={t.id}
                                className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 flex items-center justify-between gap-3"
                                data-testid={`sickday-temp-row-${t.id}`}
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold tabular-nums">
                                    {t.value}°{t.unit.toUpperCase()}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(t.loggedAtIso).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })} ·{" "}
                                    {t.loggedBy === "carer" ? "Supporter · " : ""}
                                    {getTimeAgo(t.loggedAtIso)}
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteTemperature(t.id)}
                                  data-testid={`button-delete-temp-${t.id}`}
                                >
                                  Delete
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => {
                      setActiveModeTab("log");
                      scrollToId("sickday-log");
                    }}
                    data-testid="button-log-check-from-checklist"
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    Log a check
                  </Button>
                  <Button variant="outline" asChild data-testid="button-open-help-now">
                    <Link href="/help-now">Open Help now</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="log" className="mt-4 space-y-4 animate-fade-in-up" data-testid="tabcontent-sickday-update">
            <SickDayUpdateReadingsCollapsible
              open={updateReadingsOpen}
              onOpenChange={setUpdateReadingsOpen}
              severity={severity}
              onSeverityChange={setSeverity}
              bgLevel={bgLevel}
              onBgLevelChange={readingsCgm.onBgChange}
              ketoneLevel={ketoneLevel}
              onKetoneLevelChange={setKetoneLevel}
              bgUnits={bgUnits}
              onCalculate={handleCalculate}
              idPrefix="active"
              cgm={sickDayCgmProps}
            />

            {/* Sick Day Journal Summary */}
            {journalEntries.length > 0 && (
              <Card className="overflow-hidden rounded-[1.35rem] border-border/50 shadow-none" data-testid="card-journal-summary">
                <CardContent className="p-3.5">
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="rounded-xl bg-muted/40 px-2 py-2.5 text-center">
                      <p className="text-[11px] font-medium text-muted-foreground">Duration</p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums" data-testid="text-journal-duration">{duration.label}</p>
                    </div>
                    <div className="rounded-xl bg-muted/40 px-2 py-2.5 text-center">
                      <p className="text-[11px] font-medium text-muted-foreground">Entries</p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums" data-testid="text-journal-count">{journalEntries.length}</p>
                    </div>
                    <div className="rounded-xl bg-muted/40 px-2 py-2.5 text-center">
                      <p className="text-[11px] font-medium text-muted-foreground">Trend</p>
                      {(() => {
                        const trend = getJournalBgTrend();
                        if (!trend) return <p className="mt-0.5 text-sm font-semibold text-muted-foreground" data-testid="text-journal-trend">—</p>;
                        if (trend === "down") return (
                          <div className="mt-0.5 flex items-center justify-center gap-1" data-testid="text-journal-trend">
                            <TrendingDown className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Down</span>
                          </div>
                        );
                        if (trend === "up") return (
                          <div className="mt-0.5 flex items-center justify-center gap-1" data-testid="text-journal-trend">
                            <TrendingUp className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                            <span className="text-sm font-semibold text-red-600 dark:text-red-400">Up</span>
                          </div>
                        );
                        return (
                          <div className="mt-0.5 flex items-center justify-center gap-1" data-testid="text-journal-trend">
                            <Activity className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
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
            <Card
              id="sickday-log"
              data-testid="card-log-check"
              className="overflow-hidden rounded-[1.35rem] border-border/50 bg-card shadow-none"
            >
              <CardHeader className="space-y-0 px-4 pb-3 pt-4 sm:px-5">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-200"
                    aria-hidden
                  >
                    <Activity className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg font-semibold tracking-tight">Log a check</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 border-t border-border/50 px-4 py-4 sm:px-5">
                <section className="space-y-3" aria-labelledby="sickday-log-section-readings">
                  <h3 id="sickday-log-section-readings" className="text-sm font-semibold">
                    Readings
                  </h3>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1.5">
                      <Label htmlFor="journal-bg" className="text-xs font-medium text-muted-foreground">
                        Glucose ({bgUnits})
                      </Label>
                      <Input
                        id="journal-bg"
                        type="number"
                        placeholder={bgUnits === "mmol/L" ? "12.5" : "225"}
                        value={journalBg}
                        onChange={(e) => journalCgm.onBgChange(e.target.value)}
                        className="h-11 rounded-xl"
                        data-testid="input-journal-bg"
                      />
                      <CgmPrefillButton
                        prefill={journalCgm.prefill}
                        loading={journalCgm.loading}
                        bgUnits={bgUnits}
                        currentValue={journalBg}
                        onApply={journalCgm.onBgChange}
                        onRefresh={journalCgm.refresh}
                        emptyHint={journalCgm.emptyHint}
                        allowSync
                        testId="button-sickday-journal-cgm-prefill"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="journal-ketone" className="text-xs font-medium text-muted-foreground">
                        Ketones
                      </Label>
                      <Select value={journalKetone} onValueChange={setJournalKetone}>
                        <SelectTrigger id="journal-ketone" className="h-11 rounded-xl" data-testid="select-journal-ketone">
                          <SelectValue placeholder="Select" />
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
                </section>
                <section className="space-y-3" aria-labelledby="sickday-log-section-care">
                  <h3 id="sickday-log-section-care" className="text-sm font-semibold">
                    Care
                  </h3>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1.5">
                      <Label htmlFor="journal-correction" className="text-xs font-medium text-muted-foreground">
                        Correction (u)
                      </Label>
                      <Input
                        id="journal-correction"
                        type="number"
                        placeholder="—"
                        value={journalCorrection}
                        onChange={(e) => setJournalCorrection(e.target.value)}
                        className="h-11 rounded-xl"
                        data-testid="input-journal-correction"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="journal-fluids" className="text-xs font-medium text-muted-foreground">
                        Fluids (ml)
                      </Label>
                      <Input
                        id="journal-fluids"
                        type="number"
                        placeholder="—"
                        value={journalFluids}
                        onChange={(e) => setJournalFluids(e.target.value)}
                        className="h-11 rounded-xl"
                        data-testid="input-journal-fluids"
                      />
                    </div>
                  </div>
                </section>
                <section className="space-y-3" aria-labelledby="sickday-log-section-notes">
                  <h3 id="sickday-log-section-notes" className="text-sm font-semibold">
                    Notes
                  </h3>
                  <Input
                    id="journal-symptoms"
                    type="text"
                    placeholder="Symptoms"
                    value={journalSymptoms}
                    onChange={(e) => setJournalSymptoms(e.target.value)}
                    className="h-11 rounded-xl"
                    data-testid="input-journal-symptoms"
                  />
                  <Textarea
                    id="journal-notes"
                    placeholder="Anything else"
                    value={journalNotes}
                    onChange={(e) => setJournalNotes(e.target.value)}
                    className="resize-none rounded-xl"
                    rows={2}
                    data-testid="textarea-journal-notes"
                  />
                </section>
                <Button
                  onClick={handleLogJournalEntry}
                  className="h-12 w-full rounded-xl text-base font-semibold"
                  data-testid="button-log-journal-entry"
                >
                  <Check className="mr-2 h-4 w-4" aria-hidden />
                  Log entry
                </Button>
              </CardContent>
            </Card>

            {/* Sick Day Timeline */}
            {journalEntries.length > 0 && (
              <Card className="overflow-hidden rounded-[1.35rem] border-border/50 shadow-none" data-testid="card-journal-timeline">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-base font-semibold">Timeline</CardTitle>
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
                          <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                            idx === 0 ? "bg-primary" : "bg-muted-foreground/35"
                          }`} />
                          {idx < journalEntries.length - 1 && (
                            <div className="mt-1 w-px flex-1 bg-border" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 -mt-0.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className={`text-lg font-bold tabular-nums leading-none ${getBgColor(entry.bg, entry.bgUnits)}`} data-testid={`text-journal-bg-${entry.id}`}>
                                {entry.bg} {entry.bgUnits}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground" data-testid={`text-journal-time-${entry.id}`}>
                                {getTimeAgo(entry.timestamp)} ·{" "}
                                <span data-testid={`badge-journal-ketone-${entry.id}`}>{entry.ketoneLevel}</span>
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={() => handleDeleteJournalEntry(entry.id)}
                              aria-label="Delete journal entry"
                              data-testid={`button-delete-journal-${entry.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                          {(entry.correctionDose || entry.fluidsml || entry.symptoms) ? (
                            <p className="mt-1.5 text-sm text-foreground/85">
                              {[
                                entry.correctionDose ? `${entry.correctionDose}u` : null,
                                entry.fluidsml ? `${entry.fluidsml}ml` : null,
                                entry.symptoms || null,
                              ].filter(Boolean).join(" · ")}
                            </p>
                          ) : null}
                          {entry.notes ? (
                            <p className="mt-0.5 text-sm text-muted-foreground">{entry.notes}</p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Mobile-only sticky action bar for long forms */}
            <div className="md:hidden fixed bottom-[var(--keyboard-inset-bottom,0px)] left-0 right-0 z-40 border-t bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
              <div className="mx-auto w-full max-w-screen-md px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <Button
                  onClick={() => {
                    scrollToId("sickday-log");
                    handleLogJournalEntry();
                  }}
                  className="h-12 w-full rounded-xl text-base font-semibold"
                  disabled={!journalBg.trim() || !journalKetone}
                  data-testid="button-log-journal-entry-sticky"
                >
                  <Check className="mr-2 h-4 w-4" aria-hidden />
                  Log entry
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {activeModeTab === "now" ? (
          <>
        {impactedSupplies.length > 0 && (
          <Card className="overflow-hidden rounded-[1.35rem] border-amber-500/25 shadow-none">
            <Collapsible className="group">
              <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3.5 text-left">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Package className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
                  <span className="text-sm font-semibold">Supplies</span>
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
                    {impactedSupplies.length}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-2.5 border-t border-border/50 px-4 pb-4 pt-3">
                    {impactedSupplies.map(supply => (
                      <div key={supply.id} className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="min-w-0 truncate text-sm font-semibold">{supply.name}</p>
                          <span className="shrink-0 text-sm font-semibold tabular-nums text-amber-800 dark:text-amber-200">
                            +{Math.round((supply.multiplier - 1) * 100)}%
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                          <div className="rounded-lg bg-background/70 px-2 py-1.5 text-center">
                            <p className="text-[11px] text-muted-foreground">Usual</p>
                            <p className="text-sm font-semibold tabular-nums" data-testid={`text-normal-days-${supply.id}`}>
                              {supply.normalDaysLeft > 365 ? "365+" : supply.normalDaysLeft}d
                            </p>
                          </div>
                          <div className={cn(
                            "rounded-lg px-2 py-1.5 text-center",
                            supply.sickDaysLeft <= 3
                              ? "bg-red-500/10"
                              : supply.sickDaysLeft <= 7
                                ? "bg-amber-500/10"
                                : "bg-background/70",
                          )}>
                            <p className="text-[11px] text-muted-foreground">Now</p>
                            <p
                              className={cn(
                                "text-sm font-semibold tabular-nums",
                                supply.sickDaysLeft <= 3 ? "text-red-600 dark:text-red-400" : supply.sickDaysLeft <= 7 ? "text-amber-700 dark:text-amber-300" : "",
                              )}
                              data-testid={`text-sick-days-${supply.id}`}
                            >
                              {supply.sickDaysLeft > 365 ? "365+" : supply.sickDaysLeft}d
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    <Link href="/supplies">
                      <Button variant="outline" className="mt-1 h-11 w-full rounded-xl" data-testid="button-view-supplies">
                        All supplies
                        <ChevronRight className="ml-auto h-4 w-4" />
                      </Button>
                    </Link>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}

        <Card className="overflow-hidden rounded-[1.35rem] border-red-500/25 shadow-none">
          <Collapsible className="group">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3.5 text-left">
              <div className="flex min-w-0 items-center gap-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
                <span className="text-sm font-semibold">When to get help</span>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-2 border-t border-border/50 px-4 pb-4 pt-3">
            {[
              { text: "Can't keep fluids down for more than 2 hours", severity: "high" },
              { text: "Moderate or large ketones not coming down", severity: "high" },
              { text: `Glucose stays above ${bgUnits === "mmol/L" ? "16.7 mmol/L" : "300 mg/dL"} after corrections`, severity: "high" },
              { text: "Confusion, drowsiness, or hard to stay awake", severity: "critical" },
              { text: "Rapid or laboured breathing", severity: "critical" },
              { text: "Chest pain or severe abdominal pain", severity: "critical" },
              { text: "Fruity smell on breath", severity: "high" },
              { text: "Unwell 48+ hours with no improvement", severity: "medium" },
              ...(isPumpUser ? [{ text: "Pump site failure with rising glucose and ketones", severity: "high" as const }] : []),
            ].map((item, idx) => (
              <div
                key={idx}
                className={cn(
                  "rounded-xl px-3 py-2.5 text-sm leading-snug",
                  item.severity === "critical"
                    ? "border border-red-500/30 bg-red-500/10 font-medium"
                    : item.severity === "high"
                      ? "border border-red-500/20 bg-red-500/[0.06]"
                      : "border border-amber-500/20 bg-amber-500/[0.06]",
                )}
                data-testid={`escalation-item-${idx}`}
              >
                {item.text}
              </div>
            ))}
            <Link href="/help-now">
              <Button variant="outline" className="mt-1 h-11 w-full rounded-xl" data-testid="button-help-now-sick">
                Help now
                <ChevronRight className="ml-auto h-4 w-4" />
              </Button>
            </Link>
            <p className="text-center text-sm text-muted-foreground">
              {getRegionEmergencyFooter(localeProfile)}
            </p>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        <Card className={cn(
          "overflow-hidden rounded-[1.35rem] shadow-none",
          severity === "severe"
            ? "border-red-500/30 bg-red-500/[0.06]"
            : severity === "moderate"
              ? "border-orange-500/30 bg-orange-500/[0.06]"
              : "border-amber-500/30 bg-amber-500/[0.06]",
        )}>
          <CardContent className="flex items-center justify-between gap-3 p-3.5">
            <div className="min-w-0">
              <p className="text-sm font-semibold capitalize">{severity} sick day</p>
              <p className="text-sm text-muted-foreground">{duration.label}</p>
            </div>
            <Button variant="outline" className="h-10 shrink-0 rounded-xl" onClick={handleDeactivateSickDay} data-testid="button-end-sick-day-active">
              Feeling better
            </Button>
          </CardContent>
        </Card>

          </>
        ) : null}

        <SickDayDisclaimerFooter />

        <div className="flex justify-center">
          <Link href="/">
            <Button variant="ghost" data-testid="link-back-dashboard-sick">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <>
    <PageShell variant="narrow" density="compact" className={cn(!results && "pb-24")}>
      <div id="sickday-page-top" tabIndex={-1} className="sr-only outline-none" aria-hidden />
      <PageHeader
        leading={<PageBackButton />}
        title="Sick day"
        actions={
          <div data-testid="link-sick-day-coach-wrap">
            <ScenarioCoachLink topic="sick-day" />
          </div>
        }
      />

      <div className="space-y-4">
        {!results ? (
          <>
          <Card className="overflow-hidden rounded-[1.35rem] border-amber-500/20 bg-gradient-to-b from-amber-500/[0.07] via-card to-card shadow-none dark:border-amber-400/15 dark:from-amber-950/40">
            <CardHeader className="space-y-0 px-4 pb-3 pt-4 sm:px-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-200">
                  <Thermometer className="h-5 w-5" aria-hidden />
                </span>
                <CardTitle className="font-display text-lg font-semibold tracking-tight">Your readings</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 border-t border-amber-500/10 px-4 pb-4 pt-4 sm:px-5">
              <SickDayReadingsFields
                severity={severity}
                onSeverityChange={setSeverity}
                bgLevel={bgLevel}
                onBgLevelChange={readingsCgm.onBgChange}
                ketoneLevel={ketoneLevel}
                onKetoneLevelChange={setKetoneLevel}
                bgUnits={bgUnits}
                cgm={sickDayCgmProps}
              />
              <SickDayTddField tdd={tdd} hasTdd={hasConfiguredTdd(settings)} />
              <Button
                onClick={handleCalculate}
                className="hidden h-12 w-full rounded-xl font-semibold sm:flex"
                data-testid="button-calculate"
              >
                <Activity className="mr-2 h-4 w-4" aria-hidden />
                Get plan
              </Button>
            </CardContent>
          </Card>

          <SickDayDisclaimerFooter />
          </>
        ) : (
          <>
          <Card className={cn(
            "overflow-hidden rounded-[1.35rem] shadow-none",
            isSickDayActive ? "border-amber-500/30 bg-amber-500/[0.06]" : "border-border/50",
          )}>
            <CardContent className="p-3.5">
              {isSickDayActive ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Sick day on</p>
                    <p className="text-sm capitalize text-muted-foreground">{severity}</p>
                  </div>
                  <Button
                    variant="outline"
                    className="h-10 shrink-0 rounded-xl"
                    onClick={handleDeactivateSickDay}
                    data-testid="button-deactivate-sick-day"
                  >
                    <Power className="mr-2 h-4 w-4" />
                    End
                  </Button>
                </div>
              ) : (
                <Button className="h-12 w-full rounded-xl font-semibold" onClick={handleActivateSickDay} data-testid="button-activate-sick-day">
                  <Power className="mr-2 h-4 w-4" />
                  Start sick day
                </Button>
              )}
            </CardContent>
          </Card>
          <SickDayResultsPanel
            results={results}
            verdict={verdict}
            bgLevel={bgLevel}
            bgUnits={bgUnits}
            severity={severity}
            ketoneLevel={ketoneLevel}
            isPumpUser={isPumpUser}
          />

          <SickDayUpdateReadingsCollapsible
            open={updateReadingsOpen}
            onOpenChange={setUpdateReadingsOpen}
            severity={severity}
            onSeverityChange={setSeverity}
            bgLevel={bgLevel}
            onBgLevelChange={readingsCgm.onBgChange}
            ketoneLevel={ketoneLevel}
            onKetoneLevelChange={setKetoneLevel}
            bgUnits={bgUnits}
            onCalculate={handleCalculate}
            idPrefix="standalone"
            cgm={sickDayCgmProps}
          />

          <SickDayDisclaimerFooter />
          </>
        )}

      </div>
    </PageShell>

    {!results ? (
      <div
        className="fixed bottom-[var(--bottom-nav-height,0px)] left-0 right-0 z-40 border-t border-border/80 bg-background/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/85 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:hidden"
        data-testid="sickday-sticky-calculate"
      >
        <Button
          onClick={handleCalculate}
          className="mx-auto flex h-11 w-full max-w-lg rounded-xl font-semibold"
          data-testid="button-calculate-sticky"
        >
          <Activity className="mr-2 h-4 w-4" aria-hidden />
          Get plan
        </Button>
      </div>
    ) : null}
    </>
  );
}
