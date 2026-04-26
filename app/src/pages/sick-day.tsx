import { useMemo, useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Activity, Info, Plane, ChevronRight, ChevronDown, Power, Check, Clock, ShieldAlert, Heart, Package, Syringe, Droplets, AlertTriangle, ArrowLeft, Thermometer, TrendingUp, TrendingDown, Trash2, Pill } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
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
} from "@/lib/storage";
import { parseRatioToGramsPerUnit, formatRatioForDisplay } from "@/lib/ratio-utils";
import { FaceLogoWatermark } from "@/components/face-logo";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { InfoTooltip, DIABETES_TERMS } from "@/components/info-tooltip";
import {
  upsertScenario,
  fetchScenarioStateForUser,
  syncSickDayDeactivatedToCloud,
  repairSickDayCloudIfLocalInactive,
} from "@/lib/scenarios-supabase";
import { invokeNotifyScenarioStarted } from "@/lib/invoke-notify-scenario-started";
import { NOTIFY_EDGE_FAILURE_TITLE, notifyEdgeFailureDescription } from "@/lib/notify-toast-messages";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MedicalNumericOutputDisclaimer } from "@/components/medical-numeric-output-disclaimer";
import { MedicalSourcesLink } from "@/components/medical-sources-link";
import { cancelSickDayMedReminder, scheduleSickDayMedReminder } from "@/lib/sick-day-med-reminders";
import { createSickDayMedInAppNotification } from "@/lib/sick-day-med-inapp";
import {
  mergeMedicationDoseLogs,
  medicationDoseLogToScenarioRows,
  parseMedicationDoseLogFromScenario,
} from "@/lib/sick-day-dose-log";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  
  // Round to whole units for pen dosing.
  correctionDose = Math.round(correctionDose);
  baseCorrectionDose = Math.round(baseCorrectionDose);

  // Build explanation
  const correctionExplanation = baseCorrectionDose > 0 
    ? `Base: ${baseCorrectionDose}u × ${severityModifier} (safety) × ${bgZoneModifier} (BG zone) = ${correctionDose}u`
    : "No correction needed - blood glucose is within target";

  // === RATIO AND OTHER ADJUSTMENTS ===
  
  const sickDayProfile = storage.getProfile();
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
        ketoneWarning = "EMERGENCY: Moderate ketones with high glucose or severe illness. Go to A&E or call 999 if you cannot reach your diabetes team.";
        ketoneWarningBrief = "Emergency: go to A&E or call 999 if you cannot reach your team.";
      }
      break;
    case "large":
      ketoneGuidance = "Large ketones are a medical emergency. You are at high risk of DKA (diabetic ketoacidosis). Do NOT wait - seek emergency medical care immediately.";
      ketoneGuidanceBrief = "Medical emergency—seek care now.";
      ketoneActionRequired = "emergency";
      ketoneWarning = "EMERGENCY: Large ketones detected. Go to A&E immediately or call 999. This is a medical emergency.";
      ketoneWarningBrief = "Go to A&E or call 999 now.";
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
  const [activeModeTab, setActiveModeTab] = useState<"now" | "checklist" | "log">(() => {
    if (typeof window === "undefined") return "now";
    const hash = window.location.hash;
    if (hash === "#sickday-checklist") return "checklist";
    if (hash === "#sickday-log") return "log";
    return "now";
  });
  const [nowTick, setNowTick] = useState(() => Date.now());

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

  const verdict = useMemo(() => {
    if (!results) return null;
    const urgent = results.ketoneActionRequired === "urgent" || results.ketoneActionRequired === "emergency";
    const caution = results.ketoneActionRequired === "monitor" || severity === "severe";
    const label = urgent ? "Needs attention" : caution ? "Caution" : "Ready";
    const tone = urgent ? "critical" : caution ? "caution" : "ok";
    const title = urgent
      ? "Act now"
      : caution
        ? "Proceed carefully"
        : "You’re in a safer zone";
    const message = urgent
      ? "Follow the urgent steps below and contact your diabetes team / urgent care."
      : caution
        ? "Monitor more often and follow the checklist to avoid complications."
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
          ? "Paracetamol"
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
      title: "Sick Day Mode Activated",
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

    // After updating from the Update tab, bring the user back to "Now" to see the latest correction.
    setActiveModeTab("now");
    scrollToId("sickday-now-recommendations");
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
      <PageShell variant="standard">
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
              {verdict ? (
                <Badge
                  variant="secondary"
                  className={
                    verdict.tone === "critical"
                      ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                      : verdict.tone === "caution"
                        ? "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300"
                        : "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                  }
                >
                  {verdict.label}
                </Badge>
              ) : null}
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

        <div className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3 shadow-sm ring-1 ring-border/40" data-testid="sickday-status-strip">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Sick Day Mode status</p>
              <p className="text-xs text-muted-foreground">
                Started{" "}
                {sickDayActivatedAt
                  ? new Date(sickDayActivatedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "recently"}{" "}
                · {duration.label}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {nextCheckCountdown ? (
                <Badge
                  variant="secondary"
                  className={nextCheckCountdown.overdue ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300" : ""}
                  data-testid="badge-next-check"
                >
                  <Clock className="h-3 w-3 mr-1" />
                  {nextCheckCountdown.overdue ? "Check due" : "Next check in"} {nextCheckCountdown.label}
                </Badge>
              ) : null}

              <Badge variant="secondary" className="capitalize" data-testid="badge-ketones-strip">
                Ketones: {ketoneLevel || "—"}
              </Badge>

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
            </div>
          </div>
        </div>

        <Tabs value={activeModeTab} onValueChange={(v) => setActiveModeTab(v as "now" | "checklist" | "log")} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="now" className="text-xs sm:text-sm" data-testid="tab-sickday-now">Now</TabsTrigger>
              <TabsTrigger value="checklist" className="text-xs sm:text-sm" data-testid="tab-sickday-checklist">Reminders</TabsTrigger>
            <TabsTrigger value="log" className="text-xs sm:text-sm" data-testid="tab-sickday-update">Update</TabsTrigger>
          </TabsList>

          <TabsContent value="now" className="mt-4 space-y-4 animate-fade-in-up" data-testid="tabcontent-sickday-now">
            <Card id="sickday-now-recommendations">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base">Current Recommendations</CardTitle>
                    <CardDescription>
                      {lastCheckAtIso
                        ? `Latest check: ${new Date(lastCheckAtIso).toLocaleString("en-GB", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : "Update your readings to get the latest correction estimate"}
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setActiveModeTab("log");
                      scrollToId("sickday-log");
                    }}
                    data-testid="button-now-update-reading"
                  >
                    Update reading
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {results?.ketoneActionRequired === "emergency" && (
                    <div className="p-4 bg-red-600 dark:bg-red-700 rounded-lg border-2 border-red-700 dark:border-red-500">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-6 w-6 text-white flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-base text-white">Emergency — get medical help now</p>
                          <p className="text-sm text-red-100 mt-1">{results.ketoneWarningBrief || results.ketoneWarning}</p>
                        </div>
                      </div>
                    </div>
                  )}

                {results?.ketoneActionRequired === "urgent" && (
                    <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm text-red-900 dark:text-red-100">Urgent — contact your diabetes team</p>
                          <p className="text-sm text-red-800 dark:text-red-200 mt-1">{results.ketoneWarningBrief || results.ketoneWarning}</p>
                        </div>
                      </div>
                    </div>
                  )}

                {results ? (
                  <>
                    <div className="p-4 bg-primary/5 rounded-lg space-y-2">
                      <div className="flex items-baseline justify-between gap-3 flex-wrap">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm text-muted-foreground">Suggested correction</span>
                          <span className="text-2xl font-semibold" data-testid="text-active-correction-dose">
                            {results.correctionDose} units
                          </span>
                        </div>
                      </div>

                      <Collapsible className="group">
                        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium text-muted-foreground py-1">
                          Educational estimate only
                          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-2">
                          <MedicalNumericOutputDisclaimer compact />
                        </CollapsibleContent>
                      </Collapsible>

                      <Collapsible className="group">
                        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium text-muted-foreground py-1">
                          How this was calculated
                          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="text-xs text-muted-foreground pt-1">
                          <p>{results.correctionExplanation}</p>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>

                    {results.stackingWarning && (
                    <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm text-orange-900 dark:text-orange-100">Spacing corrections</p>
                          <p className="text-sm text-orange-800 dark:text-orange-200">{results.stackingWarningBrief || results.stackingWarning}</p>
                        </div>
                      </div>
                    </div>
                  )}

                    <Collapsible className="border rounded-lg px-3 py-2">
                      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 text-sm font-medium py-2 hover:opacity-90">
                        <span className="flex items-center gap-2 text-left">
                          Adjusted mealtime ratios
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            x{results.ratioMultiplier}
                          </span>
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-3 pb-3 pt-1">
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
                      </CollapsibleContent>
                    </Collapsible>
                  </>
                ) : (
                  <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground" data-testid="sickday-now-no-results">
                    Add your current blood glucose, ketones, and how unwell you feel to see a suggested correction and updated guidance.
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
              <CardHeader className="pb-2">
                <Collapsible className="group">
                  <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left py-2">
                    <div className="min-w-0">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <ShieldAlert className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        Sick day rules
                      </CardTitle>
                      <CardDescription>Tap to expand</CardDescription>
                    </div>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-3 pt-2">
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
                      <p className="text-xs text-muted-foreground">
                        {results.monitoringBrief || results.monitoringFrequency}
                      </p>
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
                      <p className="text-xs text-muted-foreground">{results.hydrationBrief || results.hydrationNote}</p>
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
                  </CollapsibleContent>
                </Collapsible>
              </CardHeader>
            </Card>
          </TabsContent>

          <TabsContent value="checklist" className="mt-4 space-y-4 animate-fade-in-up" data-testid="tabcontent-sickday-checklist">
            <Card className="rounded-2xl border-border/60 shadow-sm ring-1 ring-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Reminders</CardTitle>
                <CardDescription>Track recurring actions during sick days (meds, checks, key tasks).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Card className="border-border/60" data-testid="card-sickday-med-reminders">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Pill className="h-4 w-4 text-primary" />
                      Medication reminders
                    </CardTitle>
                    <CardDescription>
                      Set when you took the medicine — the next reminder is that time plus your repeat interval. You can
                      change the time when you tap Taken.
                    </CardDescription>
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
                            <SelectItem value="paracetamol">Paracetamol</SelectItem>
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
                      <p className="text-xs text-muted-foreground">
                        First reminder is this time plus the interval above. You can edit it later with Taken on an active
                        reminder.
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
                      <p className="text-xs text-muted-foreground">No active reminders yet.</p>
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
                                <Thermometer className="h-4 w-4 shrink-0 mt-0.5 text-orange-600" aria-hidden />
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
            <Card id="sickday-log" data-testid="card-log-check">
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

            {/* Mobile-only sticky action bar for long forms */}
            <div className="md:hidden fixed bottom-[var(--keyboard-inset-bottom,0px)] left-0 right-0 z-40 border-t bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
              <div className="mx-auto w-full max-w-screen-md px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <Button
                  onClick={() => {
                    scrollToId("sickday-log");
                    handleLogJournalEntry();
                  }}
                  className="w-full"
                  disabled={!journalBg.trim() || !journalKetone}
                  data-testid="button-log-journal-entry-sticky"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Log Entry
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {activeModeTab === "now" ? (
          <>
        {impactedSupplies.length > 0 && (
          <Card className="border-orange-200 dark:border-orange-800">
            <CardHeader className="pb-2">
              <Collapsible className="group">
                <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left py-2">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Package className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      Adjusted supply forecast
                      <span className="text-xs bg-orange-100/70 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full">
                        {impactedSupplies.length} item{impactedSupplies.length === 1 ? "" : "s"}
                      </span>
                    </CardTitle>
                    <CardDescription>Tap to expand</CardDescription>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-3 pt-2">
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
                </CollapsibleContent>
              </Collapsible>
            </CardHeader>
          </Card>
        )}

        <Card className="border-red-300 dark:border-red-800">
          <CardHeader className="pb-2">
            <Collapsible className="group">
              <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left py-2">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    When to seek urgent help
                  </CardTitle>
                  <CardDescription>Tap to expand</CardDescription>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-2 pt-2">
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
              <Link href="/help-now">
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
              </CollapsibleContent>
            </Collapsible>
          </CardHeader>
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
                <div className="pt-2">
                  <MedicalSourcesLink anchor="sickday" compact />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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

          </>
        ) : null}

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
    <PageShell variant="standard">
      <Card className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 border-orange-100 dark:border-orange-900">
        <CardHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <PageBackButton />
            <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900">
              <Activity className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <CardTitle className="text-xl">
              Sick Day{" "}
              <span className="text-sm font-normal text-muted-foreground">
                — Calculate insulin adjustments when you're feeling unwell
              </span>
            </CardTitle>
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
                  Educational estimates only. Contact your healthcare team if you are unwell, especially with high glucose, ketones, or worsening symptoms.
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
                      From your <Link href="/settings/ratios" className="text-primary hover:underline" data-testid="link-insulin-settings">Insulin & Ratios</Link>
                    </p>
                  </>
                ) : (
                  <>
                    <div className="p-3 rounded-md bg-muted border border-dashed">
                      <p className="text-sm text-muted-foreground">
                        TDD not configured. Please set your Total Daily Dose in{" "}
                        <Link href="/settings/ratios" className="text-primary hover:underline font-medium" data-testid="link-settings-insulin">
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
          <Card className={isSickDayActive ? "border-orange-500/50 bg-orange-50/30 dark:bg-orange-950/20" : "border-primary/50"}>
            <CardContent className="p-4">
              {isSickDayActive ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                    <Check className="h-5 w-5 text-orange-600 shrink-0" />
                    <div className="flex-1 min-w-0">
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
                    When you feel better, deactivate to clear dashboard status.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Button className="w-full" onClick={handleActivateSickDay} data-testid="button-activate-sick-day">
                    <Power className="h-4 w-4 mr-2" />
                    Activate Sick Day Mode
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Shows sick day status on your dashboard and adjusted ratios.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
          {verdict ? (
            <Card className="rounded-2xl border-border/60 shadow-sm ring-1 ring-border/40" data-testid="card-sickday-verdict">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <CardTitle className="text-lg">{verdict.title}</CardTitle>
                    <CardDescription>{verdict.message}</CardDescription>
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      verdict.tone === "critical"
                        ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                        : verdict.tone === "caution"
                          ? "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300"
                          : "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                    }
                  >
                    {verdict.label}
                  </Badge>
                </div>
              </CardHeader>
            </Card>
          ) : null}
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
              <CardDescription>Key numbers first; open sections below if you want detail.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {results.ketoneActionRequired === "emergency" && (
                <div className="p-4 bg-red-600 dark:bg-red-700 rounded-lg border-2 border-red-700 dark:border-red-500">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-6 w-6 text-white flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-base text-white">Emergency — get medical help now</p>
                      <p className="text-sm text-red-100 mt-1">{results.ketoneWarningBrief || results.ketoneWarning}</p>
                      <p className="text-sm text-white mt-2 font-medium">{results.ketoneGuidanceBrief || results.ketoneGuidance}</p>
                      <Collapsible className="group mt-3 border-t border-white/25 pt-2">
                        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left text-sm text-white/95 py-1 hover:underline">
                          Read full guidance
                          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-2 text-sm text-red-50 pt-2">
                          <p>{results.ketoneWarning}</p>
                          <p>{results.ketoneGuidance}</p>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </div>
                </div>
              )}

              {results.ketoneActionRequired === "urgent" && (
                <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-red-900 dark:text-red-100">Urgent — contact your diabetes team</p>
                      <p className="text-sm text-red-800 dark:text-red-200 mt-1">{results.ketoneWarningBrief || results.ketoneWarning}</p>
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">{results.ketoneGuidanceBrief || results.ketoneGuidance}</p>
                      <Collapsible className="group mt-2 border-t border-red-200/80 dark:border-red-800/80 pt-2">
                        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium text-red-900 dark:text-red-100 py-1">
                          Read full guidance
                          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-2 text-xs text-red-800 dark:text-red-200 pt-1">
                          <p>{results.ketoneWarning}</p>
                          <p>{results.ketoneGuidance}</p>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </div>
                </div>
              )}

              {results.ketoneActionRequired === "monitor" && results.ketoneGuidance && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-amber-900 dark:text-amber-100">Ketones — keep monitoring</p>
                      {results.ketoneWarning && (
                        <p className="text-sm text-amber-900 dark:text-amber-100 mt-1">{results.ketoneWarningBrief || results.ketoneWarning}</p>
                      )}
                      <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">{results.ketoneGuidanceBrief || results.ketoneGuidance}</p>
                      <Collapsible className="group mt-2 border-t border-amber-200 dark:border-amber-800 pt-2">
                        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium text-amber-900 dark:text-amber-100 py-1">
                          Read full guidance
                          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-2 text-xs text-amber-800 dark:text-amber-200 pt-1">
                          {results.ketoneWarning && <p>{results.ketoneWarning}</p>}
                          <p>{results.ketoneGuidance}</p>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </div>
                </div>
              )}

              {results.ketoneActionRequired === "none" && results.ketoneGuidance && (
                <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-green-900 dark:text-green-100 font-medium">Ketones</p>
                      <p className="text-sm text-green-800 dark:text-green-200 mt-0.5">{results.ketoneGuidanceBrief || results.ketoneGuidance}</p>
                      {(results.ketoneGuidanceBrief && results.ketoneGuidance !== results.ketoneGuidanceBrief) && (
                        <Collapsible className="group mt-2 border-t border-green-200 dark:border-green-800 pt-2">
                          <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium text-green-900 dark:text-green-100 py-1">
                            More detail
                            <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                          </CollapsibleTrigger>
                          <CollapsibleContent className="text-xs text-green-800 dark:text-green-200 pt-1">
                            <p>{results.ketoneGuidance}</p>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {results.correctionDose > 0 && (
                <div className="p-4 bg-primary/5 rounded-lg space-y-2">
                  <MedicalNumericOutputDisclaimer compact className="mb-3" />
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm text-muted-foreground">Suggested correction</span>
                    <span className="text-2xl font-semibold" data-testid="text-correction-dose">
                      {results.correctionDose} units
                    </span>
                  </div>
                  <Collapsible className="group">
                    <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium text-foreground py-1">
                      How we calculated this
                      <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="text-xs text-muted-foreground space-y-2 border-t border-primary/10 pt-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-2 bg-background rounded text-center">
                          <p className="text-[10px] uppercase tracking-wide opacity-70">Base</p>
                          <p className="font-semibold text-sm">{results.baseCorrectionDose}u</p>
                        </div>
                        <div className="p-2 bg-background rounded text-center">
                          <p className="text-[10px] uppercase tracking-wide opacity-70">Safety</p>
                          <p className="font-semibold text-sm">×{results.severityModifier}</p>
                        </div>
                        <div className="p-2 bg-background rounded text-center">
                          <p className="text-[10px] uppercase tracking-wide opacity-70">BG zone</p>
                          <p className="font-semibold text-sm">×{results.bgZoneModifier}</p>
                        </div>
                      </div>
                      <p className="text-[11px] italic">{results.correctionExplanation}</p>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}

              {results.stackingWarning && (
                <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-orange-900 dark:text-orange-100">Spacing corrections</p>
                      <p className="text-sm text-orange-800 dark:text-orange-200">{results.stackingWarningBrief || results.stackingWarning}</p>
                      {results.stackingWarningBrief && results.stackingWarning !== results.stackingWarningBrief && (
                        <Collapsible className="group mt-2 border-t border-orange-200 dark:border-orange-800 pt-2">
                          <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium text-orange-900 dark:text-orange-100 py-1">
                            Full wording
                            <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                          </CollapsibleTrigger>
                          <CollapsibleContent className="text-xs text-orange-800 dark:text-orange-200 pt-1">
                            <p>{results.stackingWarning}</p>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Mealtime ratios</h3>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">×{results.ratioMultiplier}</span>
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
                <Collapsible className="group">
                  <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left text-xs text-muted-foreground py-1">
                    Why ratios change
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="text-xs text-muted-foreground pt-1">
                    Higher units per 10g means more meal insulin to offset illness-related resistance (your team may adjust differently).
                  </CollapsibleContent>
                </Collapsible>
              </div>

              <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                <p className="text-sm font-medium">Basal, fluids, checks</p>
                <div className="flex gap-3 text-sm">
                  <Syringe className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-xs text-muted-foreground">{isPumpUser ? "Basal / pump" : "Long-acting"}</p>
                    <p className="text-foreground">{results.basalAdjustmentBrief || results.basalAdjustment}</p>
                    {isPumpUser && (
                      <p className="text-xs text-muted-foreground mt-0.5">Use temp basal if your team agrees—not a full profile rewrite.</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-3 text-sm">
                  <Droplets className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-xs text-muted-foreground">Fluids</p>
                    <p className="text-foreground">{results.hydrationBrief || results.hydrationNote}</p>
                  </div>
                </div>
                <div className="flex gap-3 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-xs text-muted-foreground">Checks</p>
                    <p className="text-foreground">{results.monitoringBrief || results.monitoringFrequency}</p>
                  </div>
                </div>
                <Collapsible>
                  <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium py-1">
                    Full wording for basal, fluids, and monitoring
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 text-xs text-muted-foreground border-t pt-2 mt-1">
                    <p>{results.basalAdjustment}</p>
                    <p>{results.hydrationNote}</p>
                    <p>{results.monitoringFrequency}</p>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {isPumpUser && (
                <Collapsible className="group rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20" data-testid="pump-tip-sick-day">
                  <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left text-sm font-medium text-indigo-900 dark:text-indigo-100">
                    Pump tips
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3 pb-3 space-y-2 text-sm text-indigo-800 dark:text-indigo-200">
                    <p>Change infusion set and site if glucose stays high after two corrections.</p>
                    <p>Use your pump calculator; mind IOB.</p>
                    {(ketoneLevel === "moderate" || ketoneLevel === "large") && (
                      <p className="font-medium">Moderate/large ketones: pens may be safer than pump—ask your team.</p>
                    )}
                    <p>If you suspect pump failure, use backup pens and contact your supplier.</p>
                  </CollapsibleContent>
                </Collapsible>
              )}

              <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                <p className="font-medium">Quick reminders</p>
                <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                  <li>Do not skip basal insulin</li>
                  <li>Recheck ketones if BG stays above {bgUnits === "mmol/L" ? "13.9 mmol/L" : "250 mg/dL"}</li>
                  <li>Moderate/large ketones or worsening symptoms: get medical help</li>
                </ul>
              </div>
            </CardContent>
          </Card>
          </>
        )}

      </div>
    </PageShell>
  );
}
