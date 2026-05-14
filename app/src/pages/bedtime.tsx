import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Moon, Utensils, Syringe, Activity, Wine, CheckCircle2, AlertCircle, AlertTriangle, Info, Sparkles, Calculator, Plane, Thermometer, ArrowRight, Clock, ChevronDown, ChevronUp, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { storage, UserSettings, ScenarioState, BedtimeLog } from "@/lib/storage";
import { InfoTooltip, DIABETES_TERMS } from "@/components/info-tooltip";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { ScenarioToolHeroCard } from "@/components/scenarios/scenario-tool-hero-card";
import { ScenarioCoachLink } from "@/components/ai-coach/ScenarioCoachLink";
import { MedicalNumericOutputDisclaimer } from "@/components/medical-numeric-output-disclaimer";
import { MedicalSourcesLink } from "@/components/medical-sources-link";
import { computeSimpleCorrectionDose } from "@/lib/correction-dose";
import { upsertScenario } from "@/lib/scenarios-supabase";
import {
  getMdiBedtimePostExerciseLine,
  getPumpBedtimePostExerciseLine,
  inferPostExerciseLoadTier,
} from "@/lib/post-exercise-nudge";

type ReadinessLevel = "steady" | "monitor" | "alert";

type BedtimeBgTrend = "rising" | "steady" | "falling" | "not_sure";

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
  /** Single-line summary (e.g. for logs / screen readers). */
  message: string;
  /** Short scannable lines under the verdict. */
  messageBullets: string[];
  tips: string[];
  factors: { label: string; status: "good" | "caution" | "concern"; note: string; detail?: string }[];
  correction: CorrectionSuggestion | null;
  snack: { grams: number; reason: string } | null;
}

const BEDTIME_ALARM_NOTIFICATION_ID_KEY = "diabeater_bedtime_alarm_notification_id";
const BEDTIME_ALARM_NOTIFICATION_AT_KEY = "diabeater_bedtime_alarm_notification_at";

function readBedtimeAlarm(): { id: number; at: Date } | null {
  try {
    const idRaw = localStorage.getItem(BEDTIME_ALARM_NOTIFICATION_ID_KEY);
    const atRaw = localStorage.getItem(BEDTIME_ALARM_NOTIFICATION_AT_KEY);
    if (!idRaw || !atRaw) return null;
    const id = Number(idRaw);
    const at = new Date(atRaw);
    if (!Number.isFinite(id) || Number.isNaN(at.getTime())) return null;
    if (at.getTime() <= Date.now()) return null;
    return { id, at };
  } catch {
    return null;
  }
}

function writeBedtimeAlarm(alarm: { id: number; at: Date }): void {
  try {
    localStorage.setItem(BEDTIME_ALARM_NOTIFICATION_ID_KEY, String(alarm.id));
    localStorage.setItem(BEDTIME_ALARM_NOTIFICATION_AT_KEY, alarm.at.toISOString());
  } catch {
    // ignore
  }
}

function clearBedtimeAlarm(): void {
  try {
    localStorage.removeItem(BEDTIME_ALARM_NOTIFICATION_ID_KEY);
    localStorage.removeItem(BEDTIME_ALARM_NOTIFICATION_AT_KEY);
  } catch {
    // ignore
  }
}

/** Home-clock hour from settings "HH:mm" (same source as travel MDI). Returns null if invalid. */
function parseBasalInjectionHour(basalTime: string | undefined): number | null {
  if (!basalTime || !/^\d{1,2}:\d{2}$/.test(basalTime.trim())) return null;
  const [h, m] = basalTime.trim().split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h;
}

/**
 * MDI only: "morning" = long-acting usually given well before sleep (approx. 05:00–14:59);
 * "evening" = closer to overnight (15:00–04:59). Used for educational readiness only, not dose math.
 */
function mdiBasalBedtimeBucket(basalTime: string | undefined): "morning" | "evening" | null {
  const hour = parseBasalInjectionHour(basalTime);
  if (hour === null) return null;
  if (hour >= 5 && hour < 15) return "morning";
  return "evening";
}

/** MDI: combines both basal clock times when user takes two long-acting injections per day. */
function mdiBasalBedtimeBucketFromSettings(settings: UserSettings | null | undefined): "morning" | "evening" | null {
  if (!settings) return null;
  const n = settings.longActingInjectionsPerDay ?? 0;
  const t1 = settings.basalInjectionTime;
  const t2 = settings.basalInjectionTime2;
  if (n >= 2 && t2?.trim()) {
    const b1 = mdiBasalBedtimeBucket(t1);
    const b2 = mdiBasalBedtimeBucket(t2);
    if (b1 === "evening" || b2 === "evening") return "evening";
    if (b1 === "morning" && b2 === "morning") return "morning";
    return b2 ?? b1;
  }
  return mdiBasalBedtimeBucket(t1);
}

/** Phrases aligned with the bedtime "Hours since …" select values. */
function hoursSinceSelectPhrase(raw: string): string {
  switch (raw) {
    case "0.5":
      return "less than an hour";
    case "1":
      return "about 1 hour";
    case "2":
      return "about 2 hours";
    case "3":
      return "about 3 hours";
    case "4":
      return "four or more hours";
    default:
      return "a while";
  }
}

/** Short display of usual basal clock(s) from settings (MDI). */
function formatBasalClockSummary(settings: UserSettings | null | undefined): string | null {
  if (!settings?.basalInjectionTime?.trim()) return null;
  const t1 = settings.basalInjectionTime.trim();
  const n = settings.longActingInjectionsPerDay ?? 0;
  const t2 = settings.basalInjectionTime2?.trim();
  if (n >= 2 && t2) return `${t1} and ${t2}`;
  return t1;
}

export default function Bedtime() {
  const [currentBg, setCurrentBg] = useState("");
  const [bgUnits, setBgUnits] = useState<"mmol/L" | "mg/dL">("mmol/L");
  const [bgTrend, setBgTrend] = useState<BedtimeBgTrend>("not_sure");
  const [hoursSinceFood, setHoursSinceFood] = useState("");
  const [mealCarbs, setMealCarbs] = useState("");
  const [hoursSinceInsulin, setHoursSinceInsulin] = useState("");
  const [hoursUntilSleep, setHoursUntilSleep] = useState("");
  const [exercisedToday, setExercisedToday] = useState(false);
  const [lastExerciseLabel, setLastExerciseLabel] = useState<string | null>(null);
  const [hadAlcohol, setHadAlcohol] = useState(false);
  const [recentHypos, setRecentHypos] = useState(false);
  const [result, setResult] = useState<ReadinessResult | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [scenarioState, setScenarioState] = useState<ScenarioState>({ travelModeActive: false, sickDayActive: false });
  const [profile, setProfile] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [aboutCheckOpen, setAboutCheckOpen] = useState(false);
  const [bedtimeLogs, setBedtimeLogs] = useState<BedtimeLog[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [alarmPlanned, setAlarmPlanned] = useState(false);
  const [alarmDialogOpen, setAlarmDialogOpen] = useState(false);
  const [alarmPreset, setAlarmPreset] = useState<"2h" | "3h" | "custom">("3h");
  const [alarmCustomTime, setAlarmCustomTime] = useState("02:30");
  const [alarmNotification, setAlarmNotification] = useState<{ id: number; at: Date } | null>(() => readBedtimeAlarm());
  const [quickCheckOpen, setQuickCheckOpen] = useState(true);
  const [tipsOpen, setTipsOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const settings = storage.getSettings();
    setUserSettings(settings);
    const profile = storage.getProfile();
    if (profile?.bgUnits) {
      setBgUnits(profile.bgUnits as "mmol/L" | "mg/dL");
    }
    setProfile(storage.getProfile());
    setScenarioState(storage.getScenarioState());
    setBedtimeLogs(storage.getBedtimeLogs());
    // Auto-nudge based on recent exercise sessions (within last 24h).
    const did = storage.didExerciseRecently(24);
    setExercisedToday(did);
    const last = storage.getLastExerciseSummary();
    if (did && last) {
      setLastExerciseLabel(`${last.exerciseName} · ${last.intensity} · ${last.durationMinutes} min`);
    } else {
      setLastExerciseLabel(null);
    }
  }, []);

  useEffect(() => {
    setAlarmNotification(readBedtimeAlarm());
  }, []);

  const isPumpUser = profile?.insulinDeliveryMethod === "pump";

  const getTargetRange = () => {
    if (userSettings?.targetBgLow && userSettings?.targetBgHigh) {
      return { low: userSettings.targetBgLow, high: userSettings.targetBgHigh };
    }
    return bgUnits === "mmol/L" ? { low: 5.0, high: 8.0 } : { low: 90, high: 144 };
  };

  const calculateCorrectionDose = (bgMmol: number, targetHighMmol: number, insulinHours: number): CorrectionSuggestion | null => {
    const correctionFactor = userSettings?.correctionFactor;
    if (!correctionFactor || correctionFactor <= 0) return null;

    const bgInUserUnits = bgUnits === "mg/dL" ? Math.round(bgMmol * 18) : Math.round(bgMmol * 10) / 10;
    const targetInUserUnits = bgUnits === "mg/dL" ? Math.round(targetHighMmol * 18) : Math.round(targetHighMmol * 10) / 10;

    const simple = computeSimpleCorrectionDose({
      currentBg: bgInUserUnits,
      targetBg: targetInUserUnits,
      correctionFactor,
      bgUnits,
    });
    if (simple.status !== "dose") return null;

    const fullDose = simple.fullDoseRounded;

    const hasIOB = insulinHours < 4;
    let iobReduction = 0;
    if (insulinHours < 1) iobReduction = 0.6;
    else if (insulinHours < 2) iobReduction = 0.4;
    else if (insulinHours < 3) iobReduction = 0.2;
    else if (insulinHours < 4) iobReduction = 0.1;

    const bedtimeReduction = 0.5;
    const effectiveDose = fullDose * bedtimeReduction * (1 - iobReduction);
    const suggestedDose = Math.round(effectiveDose);

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
      correctionFactor,
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
    const foodSelected = hoursSinceFood.trim() !== "";
    const foodHours = foodSelected ? parseFloat(hoursSinceFood) : NaN;
    const foodPhrase = foodSelected ? hoursSinceSelectPhrase(hoursSinceFood) : null;
    const insulinSelected = hoursSinceInsulin.trim() !== "";
    const insulinHoursForIOB = insulinSelected ? parseFloat(hoursSinceInsulin) : 999;
    const bolusPhrase = insulinSelected ? hoursSinceSelectPhrase(hoursSinceInsulin) : null;
    const sleepHours = hoursUntilSleep ? parseFloat(hoursUntilSleep) : null;
    const carbs = mealCarbs ? parseFloat(mealCarbs) : null;
    
    if (isNaN(bg)) return;

    const bgMmol = bgUnits === "mg/dL" ? bg / 18 : bg;
    const targetRange = getTargetRange();
    const targetLowMmol = bgUnits === "mg/dL" ? targetRange.low / 18 : targetRange.low;
    const targetHighMmol = bgUnits === "mg/dL" ? targetRange.high / 18 : targetRange.high;

    const factors: ReadinessResult["factors"] = [];
    let concernCount = 0;
    let cautionCount = 0;

    if (bgMmol < targetLowMmol - 1) {
      factors.push({
        label: "Blood glucose",
        status: "concern",
        note: "Below target",
        detail: "Consider a small snack before sleep if your plan allows.",
      });
      concernCount++;
    } else if (bgMmol < targetLowMmol) {
      factors.push({
        label: "Blood glucose",
        status: "caution",
        note: "On the lower side of target",
        detail: "Worth keeping hypo treatment within reach overnight.",
      });
      cautionCount++;
    } else if (bgMmol > targetHighMmol + 3) {
      factors.push({
        label: "Blood glucose",
        status: "caution",
        note: "Higher than ideal",
        detail: "A bedtime correction may help — follow your care team's guidance.",
      });
      cautionCount++;
    } else if (bgMmol > targetHighMmol) {
      factors.push({ label: "Blood glucose", status: "caution", note: "Slightly above target" });
      cautionCount++;
    } else {
      factors.push({ label: "Blood glucose", status: "good", note: "In a comfortable range" });
    }

    if (bgTrend === "falling") {
      factors.push({
        label: "Trend",
        status: "caution",
        note: "Falling",
        detail: "Can mean a higher risk of dropping overnight.",
      });
      cautionCount++;
    } else if (bgTrend === "rising") {
      factors.push({
        label: "Trend",
        status: "good",
        note: "Rising",
        detail: "Worth rechecking before you fully settle.",
      });
    } else if (bgTrend === "not_sure") {
      factors.push({
        label: "Trend",
        status: "good",
        note: "Trend not set",
        detail: "Tap Stable, Rising, or Falling if you know your BG direction.",
      });
    } else {
      factors.push({ label: "Trend", status: "good", note: "Stable" });
    }

    if (foodSelected && Number.isFinite(foodHours)) {
      if (foodHours < 2) {
        factors.push({
          label: "Last food",
          status: "caution",
          note: `About ${foodPhrase} since eating`,
          detail: "Digestion can still be lifting glucose.",
        });
        cautionCount++;
      } else if (foodHours < 3) {
        factors.push({
          label: "Last food",
          status: "good",
          note: `About ${foodPhrase} since eating`,
          detail: "Much of the carb effect has usually passed unless the meal was very large or fatty.",
        });
      } else {
        factors.push({
          label: "Last food",
          status: "good",
          note: `About ${foodPhrase} since eating`,
          detail: "Most meals are well through absorption by now.",
        });
      }
    } else {
      factors.push({
        label: "Last food",
        status: "good",
        note: "Food timing not entered",
        detail: "Next time, pick hours since food so we can estimate what's still digesting.",
      });
    }

    if (carbs != null && Number.isFinite(carbs) && carbs > 0) {
      const carbRounded = Math.round(carbs);
      if (foodSelected && Number.isFinite(foodHours) && foodHours < 2 && carbs >= 40) {
        factors.push({
          label: "Meal carbs",
          status: "caution",
          note: `About ${carbRounded}g carbs, soon after eating`,
          detail: "A recheck before sleep is sensible while absorption finishes.",
        });
        cautionCount++;
      } else if (foodSelected && Number.isFinite(foodHours) && foodHours < 2) {
        factors.push({
          label: "Meal carbs",
          status: "caution",
          note: `About ${carbRounded}g carbs, food only ${foodPhrase} ago`,
          detail: "Watch for a late rise if insulin coverage was light.",
        });
        cautionCount++;
      } else {
        factors.push({
          label: "Meal carbs",
          status: "good",
          note: `About ${carbRounded}g carbs`,
          detail: foodPhrase
            ? `Last food about ${foodPhrase} ago.`
            : "Add hours since food for a tighter read on what's still digesting.",
        });
      }
    }

    if (insulinSelected && Number.isFinite(insulinHoursForIOB)) {
      if (insulinHoursForIOB < 2) {
        factors.push({
          label: "Mealtime insulin",
          status: "caution",
          note: `About ${bolusPhrase} since last mealtime dose`,
          detail: "Rapid-acting can still be bringing glucose down.",
        });
        cautionCount++;
      } else if (insulinHoursForIOB < 4) {
        factors.push({
          label: "Mealtime insulin",
          status: "good",
          note: `About ${bolusPhrase} since last mealtime dose`,
          detail: "A tail of insulin may still be active.",
        });
      } else {
        factors.push({
          label: "Mealtime insulin",
          status: "good",
          note: `About ${bolusPhrase} since last mealtime dose`,
          detail: "Little routine bolus insulin is usually left now.",
        });
      }
    } else {
      factors.push({
        label: "Mealtime insulin",
        status: "good",
        note: "Mealtime insulin timing not entered",
        detail: "Next time, pick hours since dose so active insulin is reflected here.",
      });
    }

    if (exercisedToday) {
      factors.push({
        label: "Exercise today",
        status: "caution",
        note: "You exercised today",
        detail: "Hypo risk can stay higher overnight.",
      });
      cautionCount++;
    }

    if (hadAlcohol) {
      factors.push({
        label: "Alcohol",
        status: "concern",
        note: "Alcohol tonight or recently",
        detail: "Can cause delayed lows — consider an overnight check.",
      });
      concernCount++;
    }

    if (recentHypos) {
      factors.push({
        label: "Recent hypos",
        status: "concern",
        note: "Hypos recently",
        detail: "Higher overnight risk — alarm and snack may help if your plan allows.",
      });
      concernCount++;
    }

    if (sleepHours !== null) {
      if (sleepHours <= 0.25) {
        factors.push({ label: "Time to sleep", status: "good", note: "Heading to bed now" });
      } else if (sleepHours <= 1) {
        factors.push({ label: "Time to sleep", status: "good", note: "Bedtime soon", detail: "Good moment for this check." });
      } else if (sleepHours <= 2) {
        factors.push({
          label: "Time to sleep",
          status: "caution",
          note: "More than ~1 hour until bed",
          detail: "Glucose may change — recheck closer to sleep.",
        });
        cautionCount++;
      } else {
        factors.push({
          label: "Time to sleep",
          status: "caution",
          note: "Still a while until bed",
          detail: "Consider running this check again nearer bedtime.",
        });
        cautionCount++;
      }
    }

    if (scenarioState.sickDayActive) {
      const severity = scenarioState.sickDaySeverity || "moderate";
      factors.push({
        label: "Sick day",
        status: severity === "severe" ? "concern" : "caution",
        note: "Sick day mode on",
        detail: "Illness affects overnight glucose — plan extra checks.",
      });
      if (severity === "severe") concernCount++;
      else cautionCount++;
    }

    if (scenarioState.travelModeActive) {
      const hasTimezoneShift = scenarioState.travelTimezoneShift && Math.abs(scenarioState.travelTimezoneShift) >= 2;
      factors.push({
        label: "Travel mode",
        status: "caution",
        note: "Travel mode on",
        detail: hasTimezoneShift
          ? "A big timezone shift can change overnight patterns."
          : "Routine changes can nudge overnight levels.",
      });
      cautionCount++;
    }

    const mdiBasalForBed = !isPumpUser ? mdiBasalBedtimeBucketFromSettings(userSettings) : null;
    const basalClockSummary = !isPumpUser ? formatBasalClockSummary(userSettings) : null;

    if (isPumpUser) {
      factors.push({
        label: "Basal delivery",
        status: "good",
        note: "Pump basal in the background",
        detail: "Tonight still depends on boluses, food timing, temp basals, and activity.",
      });
    } else if (basalClockSummary) {
      const basalHeadline = `Usual long-acting around ${basalClockSummary} (home clock)`;
      if (mdiBasalForBed === "morning") {
        factors.push({
          label: "Long-acting timing",
          status: "caution",
          note: basalHeadline,
          detail:
            "Earlier in the day than a bedtime anchor for many people — overnight drift can differ; trends and snacks still matter.",
        });
        cautionCount++;
      } else if (mdiBasalForBed === "evening") {
        factors.push({
          label: "Long-acting timing",
          status: "good",
          note: basalHeadline,
          detail: "Closer to sleep for many on MDI — often steadier overnight; food, boluses, and illness still count.",
        });
      } else {
        factors.push({ label: "Long-acting timing", status: "good", note: basalHeadline });
      }
    } else {
      factors.push({
        label: "Long-acting timing",
        status: "good",
        note: "Long-acting time not in settings",
        detail: "Add it under Personal & usage so we can relate tonight to your usual basal.",
      });
    }

    let level: ReadinessLevel;
    let title: string;
    let message: string;
    let messageBullets: string[] = [];
    const tips: string[] = [];

    if (concernCount >= 2 || (concernCount >= 1 && cautionCount >= 2)) {
      level = "alert";
      title = "Set an Alarm Tonight";
      message = "There are a few things that could affect your overnight glucose. Setting an alarm to check would be wise.";
      messageBullets = [
        "Several stressors could affect you overnight.",
        "Plan a glucose check in the small hours if you can.",
        "Keep hypo treatment within reach.",
      ];
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
      const monitorBits: string[] = [];
      if (foodSelected && Number.isFinite(foodHours) && foodHours < 3 && foodPhrase) {
        monitorBits.push(`last food only ${foodPhrase} ago`);
      }
      if (carbs != null && Number.isFinite(carbs) && carbs >= 45) {
        monitorBits.push(`~${Math.round(carbs)}g carbs noted`);
      }
      if (insulinSelected && insulinHoursForIOB < 3 && bolusPhrase) {
        monitorBits.push(`mealtime insulin only ${bolusPhrase} ago`);
      }
      messageBullets = ["Mostly manageable — a couple of flags are still worth noticing."];
      if (monitorBits.length > 0) {
        messageBullets.push(`From your inputs: ${monitorBits.join(" · ")}.`);
      }
      messageBullets.push("Food digesting and insulin tails can still move numbers before morning.");
      message = messageBullets.join(" ");
      if (foodSelected && Number.isFinite(foodHours) && foodHours < 2) tips.push("Your glucose may rise as food digests");
      if (insulinSelected && insulinHoursForIOB < 2) tips.push("Check again before you actually fall asleep");
      if (exercisedToday) tips.push("Keep a snack nearby just in case");
      if (sleepHours !== null && sleepHours > 1.5) tips.push("You've got time - recheck before you head to bed");
      tips.push("If you wake in the night, do a quick check");
    } else {
      level = "steady";
      title = "Looking Good for Sleep";
      const steadyParts: string[] = [];
      if (foodSelected && foodPhrase) steadyParts.push(`last food ~${foodPhrase} ago`);
      if (insulinSelected && bolusPhrase) steadyParts.push(`mealtime insulin ~${bolusPhrase} ago`);
      if (!isPumpUser && basalClockSummary) steadyParts.push(`usual long-acting ~${basalClockSummary} (home clock)`);
      messageBullets = ["Your glucose looks in a comfortable range for sleep."];
      if (steadyParts.length > 0) {
        messageBullets.push(`You shared: ${steadyParts.join(" · ")}.`);
      } else {
        messageBullets.push("Adding food and mealtime-insulin timing next time will mirror your routine more closely.");
      }
      messageBullets.push("From these inputs alone, nothing screams overnight trouble — still follow your care plan if you feel off.");
      message = messageBullets.join(" ");
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

    if (mdiBasalForBed === "morning") {
      tips.push("Morning long-acting: some people drift up later at night — your team's plan still applies.");
      tips.push("Occasional overnight checks can help you learn your pattern.");
    } else if (mdiBasalForBed === "evening") {
      tips.push("Evening long-acting often supports steadier overnight levels for many on MDI.");
      tips.push("Still watch for hypos after exercise or alcohol.");
    }

    const correction = calculateCorrectionDose(bgMmol, targetHighMmol, insulinHoursForIOB);

    const snack: ReadinessResult["snack"] =
      bgMmol < targetLowMmol || bgTrend === "falling" || recentHypos
        ? {
            grams: bgMmol < targetLowMmol ? 10 : 5,
            reason:
              bgMmol < targetLowMmol
                ? "Below or near your target range"
                : recentHypos
                  ? "Recent hypos increase overnight risk"
                  : "Falling trend can drop overnight",
          }
        : null;

    setResult({ level, title, message, messageBullets, tips, factors, correction, snack });
    setSaved(false);
    setDetailsOpen(false);
    setAlarmPlanned(false);
    setQuickCheckOpen(false);
    setTipsOpen(false);

    // Bring the verdict/status card into view after calculating.
    try {
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
        });
      }
    } catch {
      // no-op (non-browser env)
    }

    const bedtimeReady = level === "steady";
    void upsertScenario({
      scenarioKey: "bedtime",
      title: "Bedtime",
      label: bedtimeReady ? "Bedtime: Ready" : "Bedtime: Needs attention",
      state: {
        bedtime_ready: bedtimeReady,
        readiness_level: level,
        checked_at: new Date().toISOString(),
        inputs_summary: {
          bg: bgUnits === "mg/dL" ? Math.round(bgMmol * 18) : Math.round(bgMmol * 10) / 10,
          bg_units: bgUnits,
          trend: bgTrend,
          recent_hypos: recentHypos,
          exercised_today: exercisedToday,
          had_alcohol: hadAlcohol,
          hours_since_food: Number.isFinite(foodHours) ? foodHours : null,
          meal_carbs: carbs != null && Number.isFinite(carbs) ? carbs : null,
          hours_since_insulin: insulinSelected && Number.isFinite(insulinHoursForIOB) ? insulinHoursForIOB : null,
          hours_until_sleep: sleepHours != null && Number.isFinite(sleepHours) ? sleepHours : null,
          mdi_basal_bedtime_bucket: mdiBasalForBed,
          basal_injection_time: !isPumpUser ? userSettings?.basalInjectionTime ?? null : null,
          basal_injection_time_2: !isPumpUser ? userSettings?.basalInjectionTime2 ?? null : null,
        },
      },
    });
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

  const verdictLabel = (level: ReadinessLevel) =>
    level === "steady" ? "Ready" : level === "monitor" ? "Caution" : "Needs attention";

  const handleSaveCheck = () => {
    if (!result || saved) return;
    const log: BedtimeLog = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      currentBg: parseFloat(currentBg),
      bgUnits,
      readinessLevel: result.level,
      hoursSinceFood: hoursSinceFood ? parseFloat(hoursSinceFood) : null,
      hoursSinceInsulin: hoursSinceInsulin ? parseFloat(hoursSinceInsulin) : null,
      hoursUntilSleep: hoursUntilSleep ? parseFloat(hoursUntilSleep) : null,
      bgTrend: bgTrend === "not_sure" ? undefined : bgTrend,
      mealCarbs: mealCarbs ? parseFloat(mealCarbs) : null,
      recentHypos,
      alarmPlanned,
      exercisedToday,
      hadAlcohol,
      sickDayActive: scenarioState.sickDayActive,
      travelModeActive: scenarioState.travelModeActive,
      correctionGiven: result.correction ? result.correction.suggestedDose : null,
      notes: "",
    };
    storage.saveBedtimeLog(log);
    setBedtimeLogs(storage.getBedtimeLogs());
    setSaved(true);
    toast({ title: "Bedtime check saved", description: "Your check has been logged." });
  };

  const getRecentLogs = () => {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    return bedtimeLogs
      .filter((log) => new Date(log.date) >= fourteenDaysAgo)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const getPatternInsight = () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentWeek = bedtimeLogs.filter((log) => new Date(log.date) >= sevenDaysAgo);
    if (recentWeek.length < 3) return null;
    const counts = { steady: 0, monitor: 0, alert: 0 };
    recentWeek.forEach((log) => { counts[log.readinessLevel]++; });
    const parts: string[] = [];
    if (counts.steady > 0) parts.push(`${counts.steady} steady night${counts.steady !== 1 ? "s" : ""}`);
    if (counts.monitor > 0) parts.push(`${counts.monitor} monitor night${counts.monitor !== 1 ? "s" : ""}`);
    if (counts.alert > 0) parts.push(`${counts.alert} alert night${counts.alert !== 1 ? "s" : ""}`);
    return `You've had ${parts.join(" and ")} in the last week`;
  };

  const getLevelBadge = (level: ReadinessLevel) => {
    switch (level) {
      case "steady":
        return <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">{level}</Badge>;
      case "monitor":
        return <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">{level}</Badge>;
      case "alert":
        return <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">{level}</Badge>;
    }
  };

  const formatLogDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const recentLogs = getRecentLogs();
  const patternInsight = getPatternInsight();

  const scheduleBedtimeAlarm = async (at: Date) => {
    if (!Capacitor.isNativePlatform()) {
      toast({
        title: "Not available here",
        description: "Overnight alarms can only be set from the installed app on your phone.",
      });
      return;
    }

    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== "granted") {
      toast({
        title: "Notifications not enabled",
        description: "Enable notifications to get an overnight reminder.",
        variant: "destructive",
      });
      return;
    }

    const id = Math.floor(Date.now() % 2_000_000_000);
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: "Overnight check",
          body: "Time to check your glucose.",
          schedule: { at },
          extra: { kind: "bedtime_overnight_check" },
        },
      ],
    });

    const next = { id, at };
    writeBedtimeAlarm(next);
    setAlarmNotification(next);
    setAlarmPlanned(true);
    toast({ title: "Alarm set", description: "We’ll remind you to do an overnight check." });
  };

  const cancelBedtimeAlarm = async () => {
    const existing = alarmNotification ?? readBedtimeAlarm();
    if (!existing) {
      setAlarmPlanned(false);
      return;
    }

    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.cancel({ notifications: [{ id: existing.id }] });
      } catch {
        // ignore
      }
    }

    clearBedtimeAlarm();
    setAlarmNotification(null);
    setAlarmPlanned(false);
    toast({ title: "Alarm removed", description: "No overnight reminder is scheduled." });
  };

  const confirmBedtimeAlarm = async () => {
    const now = new Date();

    if (alarmPreset === "2h" || alarmPreset === "3h") {
      const hours = alarmPreset === "2h" ? 2 : 3;
      await scheduleBedtimeAlarm(new Date(now.getTime() + hours * 60 * 60 * 1000));
      setAlarmDialogOpen(false);
      return;
    }

    const t = alarmCustomTime.trim();
    if (!/^\d{2}:\d{2}$/.test(t)) {
      toast({ title: "Choose a time", description: "Please enter a time like 02:30.", variant: "destructive" });
      return;
    }

    const [hh, mm] = t.split(":").map(Number);
    if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
      toast({ title: "Invalid time", description: "Please choose a valid time.", variant: "destructive" });
      return;
    }

    const at = new Date(now);
    at.setHours(hh, mm, 0, 0);
    if (at.getTime() <= now.getTime() + 60_000) {
      at.setDate(at.getDate() + 1);
    }

    await scheduleBedtimeAlarm(at);
    setAlarmDialogOpen(false);
  };

  return (
    <PageShell variant="standard" className="space-y-7">
      <PageHeader
        leading={<PageBackButton />}
        title="Bedtime"
        description="A quick check to reduce overnight surprises. Not medical advice."
        actions={<ScenarioCoachLink topic="bedtime" />}
      />
      {(scenarioState.sickDayActive || scenarioState.travelModeActive) && (
        <div className="flex flex-wrap gap-2" data-testid="container-active-scenarios">
          {scenarioState.sickDayActive && (
            <Link href="/scenarios?tab=sick-day">
              <Badge variant="secondary" className="cursor-pointer" data-testid="badge-sick-day-active">
                <Thermometer className="h-3 w-3 mr-1" />
                Sick day active ({scenarioState.sickDaySeverity || "moderate"})
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

      {result && (
        <ScenarioToolHeroCard
          data-testid="card-bedtime-result-hero"
          className={`${getLevelColors(result.level).bg} ${getLevelColors(result.level).border} border shadow-sm`}
          classNames={{ content: "space-y-4 px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6" }}
          body={
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5">
                    {result.level === "steady" ? (
                      <CheckCircle2 className={`h-7 w-7 ${getLevelColors(result.level).icon}`} />
                    ) : result.level === "monitor" ? (
                      <AlertCircle className={`h-7 w-7 ${getLevelColors(result.level).icon}`} />
                    ) : (
                      <AlertTriangle className={`h-7 w-7 ${getLevelColors(result.level).icon}`} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2
                        className={`font-display text-xl font-semibold tracking-tight ${getLevelColors(result.level).title}`}
                        data-testid="text-bedtime-verdict"
                      >
                        {verdictLabel(result.level)}
                      </h2>
                      <Badge variant="secondary" className="text-xs">
                        {result.title}
                      </Badge>
                    </div>
                    <ul
                      className="mt-2 list-none space-y-2 pl-0 text-sm text-muted-foreground"
                      aria-label="Bedtime summary"
                    >
                      {(result.messageBullets.length > 0 ? result.messageBullets : [result.message]).map((line, i) => (
                        <li key={i} className="flex gap-2.5 leading-relaxed">
                          <span
                            className="mt-2 h-1 w-1 shrink-0 rounded-full bg-current opacity-40"
                            aria-hidden
                          />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {result.snack && (
                <div className="rounded-lg border border-border/60 bg-background/60 px-3 py-2">
                  <p className="text-sm">
                    <span className="font-medium">Snack idea:</span> {result.snack.grams}g fast carbs{" "}
                    <span className="text-muted-foreground">({result.snack.reason})</span>
                  </p>
                </div>
              )}
            </>
          }
        />
      )}

      {result ? (
        <div className="-mt-2">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between"
            onClick={() => setDetailsOpen((v) => !v)}
            data-testid="button-open-details-top"
          >
            <span>{detailsOpen ? "Hide details" : "Show details"}</span>
            {detailsOpen ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
          </Button>
        </div>
      ) : null}

      {result ? (
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <CollapsibleContent>
            <Card className="border-border/60 shadow-sm" data-testid="card-bedtime-factors">
              <CardContent className="p-5 md:p-6 space-y-3">
                <h3 className="font-semibold text-foreground">Factors</h3>
                <div className="grid gap-3 sm:grid-cols-2" data-testid="container-bedtime-factors">
                  {result.factors.map((factor, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-3"
                      data-testid={`card-factor-${i}`}
                    >
                      <div className="mt-0.5 shrink-0">{getStatusIcon(factor.status)}</div>
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-medium text-foreground" data-testid={`text-factor-label-${i}`}>
                          {factor.label}
                        </p>
                        <p className="text-sm leading-relaxed text-foreground/90" data-testid={`text-factor-note-${i}`}>
                          {factor.note}
                        </p>
                        {factor.detail ? (
                          <p
                            className="text-xs leading-relaxed text-muted-foreground"
                            data-testid={`text-factor-detail-${i}`}
                          >
                            {factor.detail}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      <Collapsible open={quickCheckOpen} onOpenChange={setQuickCheckOpen}>
        <Card
          className={cn(
            "overflow-hidden rounded-2xl border-indigo-500/20 shadow-md ring-1 ring-indigo-500/10 dark:ring-indigo-400/10",
            "bg-gradient-to-br from-indigo-500/[0.08] via-card to-violet-600/[0.06] dark:from-indigo-950/50 dark:via-card dark:to-violet-950/25",
          )}
          data-testid="card-bedtime-inputs"
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full text-left transition-colors hover:bg-muted/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label={quickCheckOpen ? "Collapse quick check" : "Expand quick check"}
              data-testid="button-bedtime-quick-check-toggle"
            >
              <div className="flex items-start gap-3 px-4 pb-3 pt-4 sm:px-5 sm:pb-4 sm:pt-5">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-700 shadow-inner shadow-indigo-950/10 dark:bg-indigo-400/10 dark:text-indigo-100"
                  aria-hidden
                >
                  <Moon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-indigo-700/90 dark:text-indigo-300/90">
                    Wind down
                  </span>
                  <span className="mt-0.5 block text-lg font-semibold tracking-tight text-foreground sm:text-xl">Quick check</span>
                  {!quickCheckOpen ? (
                    <span className="mt-1.5 block text-sm leading-relaxed text-muted-foreground">
                      {currentBg.trim() ? `Tap to edit • BG ${currentBg} ${bgUnits}` : "Tap to edit your inputs"}
                    </span>
                  ) : null}
                </div>
                <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/60 text-muted-foreground dark:bg-background/40">
                  {quickCheckOpen ? <ChevronUp className="h-5 w-5" aria-hidden /> : <ChevronDown className="h-5 w-5" aria-hidden />}
                </span>
              </div>
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="space-y-5 border-t border-border/50 bg-background/45 px-4 pb-5 pt-4 backdrop-blur-[2px] dark:bg-background/30 sm:px-5 sm:pb-6 sm:pt-5">
              <section
                className="space-y-4 rounded-2xl border border-indigo-500/15 bg-indigo-500/[0.04] p-4 dark:bg-indigo-950/20"
                aria-labelledby="bedtime-section-glucose"
              >
                <h3 id="bedtime-section-glucose" className="text-[11px] font-semibold uppercase tracking-wider text-indigo-800 dark:text-indigo-200">
                  Glucose now
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="current-bg" className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-background/80 text-indigo-600 dark:text-indigo-300">
                        <Activity className="h-3.5 w-3.5" aria-hidden />
                      </span>
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
                        className="h-11 flex-1 border-border/70 bg-background/80 text-base shadow-sm dark:bg-background/60"
                        data-testid="input-bedtime-bg"
                      />
                      <span className="flex items-center rounded-lg border border-border/60 bg-muted/30 px-3 text-sm font-medium text-muted-foreground">
                        {bgUnits}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label id="label-bedtime-bg-direction" className="text-sm font-medium text-foreground">
                      BG direction <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <div
                      className="flex gap-1 rounded-xl border border-border/60 bg-muted/35 p-1 dark:bg-muted/25"
                      role="group"
                      aria-labelledby="label-bedtime-bg-direction"
                    >
                      <Button
                        type="button"
                        variant={bgTrend === "steady" ? "default" : "ghost"}
                        size="sm"
                        className={cn(
                          "min-h-10 flex-1 rounded-lg shadow-none",
                          bgTrend === "steady" ? "bg-indigo-600 text-white hover:bg-indigo-600 dark:bg-indigo-500" : "text-muted-foreground hover:bg-background/80",
                        )}
                        onClick={() => setBgTrend((prev) => (prev === "steady" ? "not_sure" : "steady"))}
                        data-testid="button-bedtime-bg-trend-stable"
                      >
                        <Minus className="h-3.5 w-3.5 mr-1.5 shrink-0" aria-hidden />
                        Stable
                      </Button>
                      <Button
                        type="button"
                        variant={bgTrend === "rising" ? "default" : "ghost"}
                        size="sm"
                        className={cn(
                          "min-h-10 flex-1 rounded-lg shadow-none",
                          bgTrend === "rising" ? "bg-indigo-600 text-white hover:bg-indigo-600 dark:bg-indigo-500" : "text-muted-foreground hover:bg-background/80",
                        )}
                        onClick={() => setBgTrend((prev) => (prev === "rising" ? "not_sure" : "rising"))}
                        data-testid="button-bedtime-bg-trend-rising"
                      >
                        <TrendingUp className="h-3.5 w-3.5 mr-1.5 shrink-0" aria-hidden />
                        Rising
                      </Button>
                      <Button
                        type="button"
                        variant={bgTrend === "falling" ? "default" : "ghost"}
                        size="sm"
                        className={cn(
                          "min-h-10 flex-1 rounded-lg shadow-none",
                          bgTrend === "falling" ? "bg-indigo-600 text-white hover:bg-indigo-600 dark:bg-indigo-500" : "text-muted-foreground hover:bg-background/80",
                        )}
                        onClick={() => setBgTrend((prev) => (prev === "falling" ? "not_sure" : "falling"))}
                        data-testid="button-bedtime-bg-trend-falling"
                      >
                        <TrendingDown className="h-3.5 w-3.5 mr-1.5 shrink-0" aria-hidden />
                        Falling
                      </Button>
                    </div>
                  </div>
                </div>
              </section>

              <section
                className="space-y-4 rounded-2xl border border-amber-500/12 bg-amber-500/[0.03] p-4 dark:bg-amber-950/10"
                aria-labelledby="bedtime-section-fuel"
              >
                <h3 id="bedtime-section-fuel" className="text-[11px] font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-100/90">
                  Food & insulin
                </h3>
                <p className="text-xs text-muted-foreground leading-snug">
                  Pick the closest options — the bedtime summary uses them to describe digestion and active mealtime insulin in your own words.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="hours-food" className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-background/80 text-amber-700 dark:text-amber-300">
                        <Utensils className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      Hours since last food
                    </Label>
                    <Select value={hoursSinceFood} onValueChange={setHoursSinceFood}>
                      <SelectTrigger id="hours-food" className="h-11 bg-background/80 dark:bg-background/60" data-testid="select-hours-food">
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
                    <Label htmlFor="meal-carbs" className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-background/80 text-amber-700 dark:text-amber-300">
                        <Utensils className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      Meal carbs (optional)
                    </Label>
                    <Input
                      id="meal-carbs"
                      type="number"
                      inputMode="numeric"
                      placeholder="e.g., 45"
                      value={mealCarbs}
                      onChange={(e) => setMealCarbs(e.target.value)}
                      className="h-11 border-border/70 bg-background/80 dark:bg-background/60"
                      data-testid="input-meal-carbs"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="hours-insulin" className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-background/80 text-amber-700 dark:text-amber-300">
                        <Syringe className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      Hours since last mealtime dose
                      <InfoTooltip {...DIABETES_TERMS.bolus} />
                    </Label>
                    <Select value={hoursSinceInsulin} onValueChange={setHoursSinceInsulin}>
                      <SelectTrigger id="hours-insulin" className="h-11 bg-background/80 dark:bg-background/60" data-testid="select-hours-insulin">
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
                </div>
              </section>

              <section
                className="space-y-3 rounded-2xl border border-violet-500/15 bg-violet-500/[0.04] p-4 dark:bg-violet-950/20"
                aria-labelledby="bedtime-section-sleep"
              >
                <h3 id="bedtime-section-sleep" className="text-[11px] font-semibold uppercase tracking-wider text-violet-900 dark:text-violet-100/90">
                  Tonight
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="hours-sleep" className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-background/80 text-violet-700 dark:text-violet-300">
                      <Clock className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    How long until you plan to sleep?
                  </Label>
                  <Select value={hoursUntilSleep} onValueChange={setHoursUntilSleep}>
                    <SelectTrigger id="hours-sleep" className="h-11 bg-background/80 dark:bg-background/60" data-testid="select-hours-sleep">
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
              </section>

              <section
                className="overflow-hidden rounded-2xl border border-border/60 bg-muted/15 dark:bg-muted/10"
                aria-label="Extra context"
              >
                <div className="border-b border-border/50 bg-muted/25 px-4 py-2.5 dark:bg-muted/15">
                  <p className="text-xs font-medium text-muted-foreground">Anything else affecting tonight?</p>
                </div>
                <div className="divide-y divide-border/50">
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <Label htmlFor="exercised" className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
                      <Activity className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                      Exercised today?
                    </Label>
                    <Switch id="exercised" checked={exercisedToday} onCheckedChange={setExercisedToday} data-testid="switch-exercised" />
                  </div>
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <Label htmlFor="alcohol" className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
                      <Wine className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                      Had alcohol?
                    </Label>
                    <Switch id="alcohol" checked={hadAlcohol} onCheckedChange={setHadAlcohol} data-testid="switch-alcohol" />
                  </div>
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <Label htmlFor="recent-hypos" className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" aria-hidden />
                      Any recent hypos?
                    </Label>
                    <Switch id="recent-hypos" checked={recentHypos} onCheckedChange={setRecentHypos} data-testid="switch-recent-hypos" />
                  </div>
                </div>
              </section>

              <Button
                onClick={calculateReadiness}
                disabled={!canCalculate}
                className={cn(
                  "h-12 w-full rounded-2xl text-base font-semibold shadow-md transition-all",
                  "bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500",
                  "disabled:from-muted disabled:to-muted disabled:text-muted-foreground disabled:shadow-none",
                )}
                data-testid="button-check-bedtime"
              >
                <Moon className="mr-2 h-4 w-4" aria-hidden />
                Check bedtime
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {result && (
        <Card className="border-border/60 shadow-sm" data-testid="card-bedtime-result">
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Badge
                  variant={result.level === "steady" ? "outline" : result.level === "monitor" ? "secondary" : "destructive"}
                  className="text-xs"
                >
                  {verdictLabel(result.level)}
                </Badge>
                <span className="text-sm text-muted-foreground">{result.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/tools/hypo-help">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Info className="h-4 w-4" />
                    Hypo help
                  </Button>
                </Link>
              </div>
            </div>

            {(result.level !== "steady" || result.snack) && (
              <div className="grid gap-2">
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => {
                    if (alarmNotification) {
                      void cancelBedtimeAlarm();
                      return;
                    }
                    setAlarmDialogOpen(true);
                  }}
                  data-testid="button-plan-alarm"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {alarmNotification ? "Cancel overnight alarm" : "Set an overnight alarm"}
                </Button>
              </div>
            )}

            <Dialog open={alarmDialogOpen} onOpenChange={setAlarmDialogOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Overnight reminder</DialogTitle>
                  <DialogDescription>Set a Diabeaters notification to remind you to do an overnight glucose check.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>When should we remind you?</Label>
                    <Select value={alarmPreset} onValueChange={(v) => setAlarmPreset(v as "2h" | "3h" | "custom")}>
                      <SelectTrigger className="min-h-11">
                        <SelectValue placeholder="Choose a time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2h">In 2 hours</SelectItem>
                        <SelectItem value="3h">In 3 hours</SelectItem>
                        <SelectItem value="custom">Pick a time (e.g. 02:30)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {alarmPreset === "custom" ? (
                    <div className="space-y-2">
                      <Label htmlFor="bedtime-alarm-time">Time</Label>
                      <Input
                        id="bedtime-alarm-time"
                        type="time"
                        value={alarmCustomTime}
                        onChange={(e) => setAlarmCustomTime(e.target.value)}
                        className="min-h-11"
                      />
                      <p className="text-xs text-muted-foreground">If the time has already passed, we’ll schedule it for tomorrow.</p>
                    </div>
                  ) : null}
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setAlarmDialogOpen(false)} className="min-h-11">
                    Cancel
                  </Button>
                  <Button type="button" onClick={() => void confirmBedtimeAlarm()} className="min-h-11">
                    Set reminder
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {result.correction && (
              <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20" data-testid="card-correction-suggestion">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    <h4 className="font-medium text-sm">Bedtime Correction Suggestion</h4>
                  </div>

                  <MedicalNumericOutputDisclaimer compact />

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
                    {exercisedToday ? (
                      <p data-testid="text-pump-post-exercise">
                        {(() => {
                          const last = storage.getLastExerciseSummary();
                          const tier =
                            last && storage.didExerciseRecently(24)
                              ? inferPostExerciseLoadTier(last)
                              : "moderate";
                          const suffix = lastExerciseLabel ? ` (${lastExerciseLabel})` : "";
                          return getPumpBedtimePostExerciseLine(tier, suffix);
                        })()}
                      </p>
                    ) : null}
                    {hadAlcohol && (
                      <p>Alcohol can cause delayed lows. Consider reducing basal by 10-20% overnight and setting an alarm.</p>
                    )}
                    <p>If your BG is trending down, a small temporary basal reduction (80-90%) may help prevent an overnight low.</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {!isPumpUser && result && (result.level === "monitor" || result.level === "alert") && exercisedToday && (
              <Card
                className="border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/15"
                data-testid="card-mdi-post-exercise"
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Syringe className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <h4 className="font-medium text-sm">After exercise (MDI)</h4>
                  </div>
                  <p className="text-sm text-indigo-800 dark:text-indigo-200">
                    {(() => {
                      const last = storage.getLastExerciseSummary();
                      const tier =
                        last && storage.didExerciseRecently(24) ? inferPostExerciseLoadTier(last) : "moderate";
                      return getMdiBedtimePostExerciseLine(tier);
                    })()}
                  </p>
                </CardContent>
              </Card>
            )}

            {result.tips.length > 0 && (
              <Collapsible open={tipsOpen} onOpenChange={setTipsOpen}>
                <div className="space-y-2" data-testid="container-bedtime-tips">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="w-full rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-left hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
                      aria-label={tipsOpen ? "Hide tips for tonight" : "Show tips for tonight"}
                      data-testid="button-toggle-bedtime-tips"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium text-sm text-foreground">Tips for tonight</span>
                          <span className="text-xs text-muted-foreground">({result.tips.length})</span>
                        </div>
                        {tipsOpen ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                        )}
                      </div>
                    </button>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <ul className="space-y-2">
                      {result.tips.map((tip, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm"
                          data-testid={`text-tip-${i}`}
                        >
                          <span className="mt-0.5 text-muted-foreground">•</span>
                          <span className="min-w-0">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )}

            <div className="grid gap-2">
              <Button
                onClick={handleSaveCheck}
                disabled={saved}
                className="w-full"
                data-testid="button-save-bedtime-check"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {saved ? "Saved" : "Save check"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Collapsible open={aboutCheckOpen} onOpenChange={setAboutCheckOpen}>
        <Card className="border-border/60 shadow-sm" data-testid="card-bedtime-disclaimer">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full flex items-center justify-between gap-2 p-4 h-auto font-normal hover:bg-muted/50"
              data-testid="button-toggle-bedtime-about"
            >
              <div className="flex items-center gap-2 text-left min-w-0">
                <Info className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium text-foreground">About this check</span>
              </div>
              {aboutCheckOpen ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-5 space-y-2 text-sm text-muted-foreground">
              <p>
                This tool looks at common factors that affect overnight glucose stability. It is designed to help you build
                awareness and confidence, not to replace your own judgement or medical advice.
              </p>
              <p>Everyone&apos;s diabetes is different. Over time, you&apos;ll learn which factors matter most for your own steady nights.</p>
              <p className="text-xs italic" data-testid="text-bedtime-disclaimer">
                [Not medical advice. Always follow your healthcare team&apos;s guidance for overnight management.]
              </p>
              <MedicalSourcesLink anchor="insulin" compact />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
        <Card data-testid="card-bedtime-history">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full flex items-center justify-between gap-2 p-4"
              data-testid="button-toggle-bedtime-history"
            >
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4" />
                <span className="font-medium">Recent Bedtime Checks</span>
                {recentLogs.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{recentLogs.length}</Badge>
                )}
              </div>
              {historyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-3">
              {patternInsight && (
                <div className="flex items-start gap-2 p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg" data-testid="text-pattern-insight">
                  <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-indigo-700 dark:text-indigo-300">{patternInsight}</p>
                </div>
              )}

              {recentLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-bedtime-logs">
                  No bedtime checks saved yet. Run a check and save it to start tracking patterns.
                </p>
              ) : (
                <div className="space-y-2">
                  {recentLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between gap-2 p-3 bg-muted/50 rounded-lg"
                      data-testid={`card-bedtime-log-${log.id}`}
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm text-muted-foreground" data-testid={`text-log-date-${log.id}`}>
                          {formatLogDate(log.date)}
                        </span>
                        <span className="text-sm font-medium" data-testid={`text-log-bg-${log.id}`}>
                          {log.currentBg} {log.bgUnits}
                        </span>
                        {getLevelBadge(log.readinessLevel)}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {log.exercisedToday && (
                          <Badge variant="outline" className="text-xs" data-testid={`badge-log-exercise-${log.id}`}>
                            <Activity className="h-3 w-3 mr-1" />
                            Exercise
                          </Badge>
                        )}
                        {log.hadAlcohol && (
                          <Badge variant="outline" className="text-xs" data-testid={`badge-log-alcohol-${log.id}`}>
                            <Wine className="h-3 w-3 mr-1" />
                            Alcohol
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </PageShell>
  );
}
