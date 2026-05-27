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
import { storage, UserSettings, ScenarioState, BedtimeLog, DIABEATER_PROFILE_CHANGED_EVENT, type UserProfile } from "@/lib/storage";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { InfoTooltip, DIABETES_TERMS } from "@/components/info-tooltip";
import { FieldLabelWithInfo, InlineInfoHint } from "@/components/ui/field-label-with-info";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { ScenarioCoachLink } from "@/components/ai-coach/ScenarioCoachLink";
import { MedicalNumericOutputDisclaimer } from "@/components/medical-numeric-output-disclaimer";
import { MedicalSourcesLink } from "@/components/medical-sources-link";
import { computeSimpleCorrectionDose } from "@/lib/correction-dose";
import { upsertScenario } from "@/lib/scenarios-supabase";
import {
  buildBedtimePersonalizedCopy,
  formatBedtimeBgDisplay,
  hoursSinceSelectPhrase,
} from "@/lib/bedtime-readiness";
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
  headline: string;
  bgGlance: { display: string; trendLabel: string; rangeLabel: string };
  guidance: string[];
  /** Single-line summary (e.g. for logs / screen readers). */
  message: string;
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

/** Short display of usual basal clock(s) from settings (MDI). */
function formatBasalClockSummary(settings: UserSettings | null | undefined): string | null {
  if (!settings?.basalInjectionTime?.trim()) return null;
  const t1 = settings.basalInjectionTime.trim();
  const n = settings.longActingInjectionsPerDay ?? 0;
  const t2 = settings.basalInjectionTime2?.trim();
  if (n >= 2 && t2) return `${t1} and ${t2}`;
  return t1;
}

const BEDTIME_SECTION_INFO = {
  glucose:
    "Your reading and whether it is stable, rising, or falling. We use both for overnight risk — not for dosing.",
  foodInsulin:
    "How long since you ate and took rapid insulin helps estimate food still digesting and insulin still working overnight.",
  sleep: "If bed is still a while away, we may suggest rechecking closer to sleep — glucose can change.",
  extras: "Optional switches that shape your summary. They are only saved if you tap Save check.",
  exercise: "Workouts can raise hypo risk for many hours overnight.",
  alcohol: "Alcohol can delay lows — we weigh this more heavily than hypos alone.",
  recentHypos:
    "A hypo in roughly the last 24 hours. On its own this usually means caution, not needs attention, unless glucose is low or falling too.",
} as const;

function BedtimeSectionTitle({ id, title, info }: { id: string; title: string; info: string }) {
  return (
    <div className="flex items-center gap-0.5">
      <h3 id={id} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <InlineInfoHint ariaLabel={`More about ${title}`} content={<p className="text-sm leading-snug">{info}</p>} className="h-7 w-7" />
    </div>
  );
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
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
  const [extrasOpen, setExtrasOpen] = useState(false);
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
    const onProfile = () => setProfile(storage.getProfile());
    window.addEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
    return () => window.removeEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
  }, []);

  useEffect(() => {
    setAlarmNotification(readBedtimeAlarm());
  }, []);

  const isPumpUser = isPumpDeliveryMethod(profile?.insulinDeliveryMethod);

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
        note: "You reported a recent hypo",
        detail: "Raises overnight caution. A snack is only suggested if glucose is low, falling, or combined with exercise or alcohol.",
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
    if (concernCount >= 2 || (concernCount >= 1 && cautionCount >= 2)) {
      level = "alert";
    } else if (cautionCount >= 2 || concernCount >= 1) {
      level = "monitor";
    } else {
      level = "steady";
    }

    const concernLabels = factors.filter((f) => f.status === "concern").map((f) => f.label);
    const cautionLabels = factors.filter((f) => f.status === "caution").map((f) => f.label);

    const personalized = buildBedtimePersonalizedCopy({
      level,
      bgDisplay: formatBedtimeBgDisplay(bgMmol, bgUnits),
      bgMmol,
      targetLowMmol,
      targetHighMmol,
      bgTrend,
      recentHypos,
      exercisedToday,
      hadAlcohol,
      foodPhrase,
      foodHours: foodSelected && Number.isFinite(foodHours) ? foodHours : null,
      foodSelected,
      bolusPhrase,
      insulinHours: insulinSelected && Number.isFinite(insulinHoursForIOB) ? insulinHoursForIOB : null,
      insulinSelected,
      carbs: carbs != null && Number.isFinite(carbs) ? carbs : null,
      sleepHours: sleepHours != null && Number.isFinite(sleepHours) ? sleepHours : null,
      concernCount,
      cautionCount,
      concernLabels,
      cautionLabels,
      isPumpUser,
      sickDayActive: scenarioState.sickDayActive,
      sickDaySeverity: scenarioState.sickDaySeverity,
      travelModeActive: scenarioState.travelModeActive,
      travelTimezoneShift: scenarioState.travelTimezoneShift,
      mdiBasalForBed,
      basalClockSummary: basalClockSummary,
    });

    const tips = [...personalized.tips];

    if (scenarioState.sickDayActive) {
      tips.push("When unwell, set an alarm to check ketones and glucose overnight");
      if (scenarioState.sickDaySeverity === "severe") {
        tips.push("With severe illness, consider checking every 2–3 hours overnight");
      }
    }

    if (scenarioState.travelModeActive) {
      const hasTimezoneShift = scenarioState.travelTimezoneShift && Math.abs(scenarioState.travelTimezoneShift) >= 2;
      if (hasTimezoneShift) {
        tips.push("Your body clock may still be adjusting — overnight patterns could differ from normal");
      }
      tips.push("Keep your hypo kit easily accessible in an unfamiliar room");
      if (scenarioState.travelTripStyle === "active") {
        tips.push("Big travel days can skew sleep and morning glucose — a quick bedtime check still helps");
      }
    }

    if (mdiBasalForBed === "morning") {
      tips.push("Morning long-acting: some people drift up later at night — your team's plan still applies.");
    } else if (mdiBasalForBed === "evening") {
      tips.push("Still watch for hypos after exercise or alcohol, even with evening long-acting.");
    }

    if (level === "alert" && hadAlcohol && isPumpUser) {
      tips.push("Check your pump's IOB display before deciding on a correction");
    }
    if (level === "alert" && exercisedToday && isPumpUser) {
      tips.push("Consider a temporary basal at 80–90% overnight after exercise if your team uses that approach");
    }

    const correction = calculateCorrectionDose(bgMmol, targetHighMmol, insulinHoursForIOB);
    const messageBullets = personalized.messageBullets;
    const message = messageBullets.join(" ");

    setResult({
      level,
      title: personalized.title,
      headline: personalized.headline,
      bgGlance: personalized.bgGlance,
      guidance: personalized.guidance,
      message,
      messageBullets,
      tips,
      factors,
      correction,
      snack: personalized.snack,
    });
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
          surface: "from-emerald-500/[0.12] via-card to-card dark:from-emerald-500/[0.08]",
          border: "border-emerald-500/25 dark:border-emerald-500/20",
          iconWrap: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
          icon: "text-emerald-600 dark:text-emerald-400",
          title: "text-emerald-800 dark:text-emerald-200",
          chip: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border-emerald-500/20",
        };
      case "monitor":
        return {
          surface: "from-amber-500/[0.12] via-card to-card dark:from-amber-500/[0.08]",
          border: "border-amber-500/25 dark:border-amber-500/20",
          iconWrap: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
          icon: "text-amber-600 dark:text-amber-400",
          title: "text-amber-900 dark:text-amber-100",
          chip: "bg-amber-500/10 text-amber-900 dark:text-amber-100 border-amber-500/20",
        };
      case "alert":
        return {
          surface: "from-red-500/[0.14] via-card to-card dark:from-red-500/[0.1]",
          border: "border-red-500/30 dark:border-red-500/25",
          iconWrap: "bg-red-500/15 text-red-700 dark:text-red-300",
          icon: "text-red-600 dark:text-red-400",
          title: "text-red-800 dark:text-red-200",
          chip: "bg-red-500/10 text-red-800 dark:text-red-200 border-red-500/20",
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
    <PageShell variant="standard" density="compact" className="space-y-4 max-sm:space-y-3">
      <PageHeader
        leading={<PageBackButton />}
        title="Bedtime"
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

      {result && (() => {
        const colors = getLevelColors(result.level);
        const VerdictIcon =
          result.level === "steady" ? CheckCircle2 : result.level === "monitor" ? AlertCircle : AlertTriangle;
        return (
          <Card
            data-testid="card-bedtime-result-hero"
            className={cn(
              "overflow-hidden rounded-2xl border shadow-md ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
              "bg-gradient-to-b",
              colors.surface,
              colors.border,
            )}
          >
            <CardContent className="space-y-0 p-0">
              <div className="flex items-start gap-4 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
                <div
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-inner",
                    colors.iconWrap,
                  )}
                >
                  <VerdictIcon className={cn("h-6 w-6", colors.icon)} aria-hidden />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Tonight&apos;s check
                  </p>
                  <h2
                    className={cn("font-display text-2xl font-semibold tracking-tight", colors.title)}
                    data-testid="text-bedtime-verdict"
                  >
                    {verdictLabel(result.level)}
                  </h2>
                  <p className="text-sm leading-relaxed text-foreground/85">{result.headline}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-y border-border/50 bg-background/40 px-5 py-3 backdrop-blur-sm dark:bg-background/25 sm:px-6">
                <Badge variant="secondary" className={cn("rounded-lg px-2.5 py-1 font-semibold tabular-nums", colors.chip)}>
                  {result.bgGlance.display}
                </Badge>
                <Badge variant="outline" className="rounded-lg border-border/60 bg-background/50 px-2.5 py-1 text-xs">
                  {result.bgGlance.trendLabel}
                </Badge>
                <Badge variant="outline" className="rounded-lg border-border/60 bg-background/50 px-2.5 py-1 text-xs">
                  {result.bgGlance.rangeLabel}
                </Badge>
              </div>

              <div className="space-y-3 px-5 py-4 sm:px-6 sm:py-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">What to do</p>
                <ol className="space-y-2.5" aria-label="Bedtime guidance">
                  {result.guidance.map((line, i) => (
                    <li key={line} className="flex gap-3 text-sm leading-relaxed text-foreground/90">
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                          colors.iconWrap,
                        )}
                        aria-hidden
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 pt-0.5">{line}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {result.snack ? (
                <div className="mx-5 mb-5 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3 sm:mx-6 sm:mb-6">
                  <p className="text-sm font-medium text-foreground">Optional snack</p>
                  <p className="mt-0.5 text-sm text-foreground/90">
                    <span className="font-semibold tabular-nums">{result.snack.grams}g</span> fast carbs
                    <span className="text-muted-foreground"> — {result.snack.reason}</span>
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })()}

      {result ? (
        <div className="-mt-1">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full justify-between rounded-xl border-border/60 bg-card/80"
            onClick={() => setDetailsOpen((v) => !v)}
            data-testid="button-open-details-top"
          >
            <span>{detailsOpen ? "Hide factor breakdown" : "Why we said this"}</span>
            {detailsOpen ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
          </Button>
        </div>
      ) : null}

      {result ? (
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <CollapsibleContent>
            <Card className="rounded-2xl border-border/60 shadow-sm" data-testid="card-bedtime-factors">
              <CardContent className="space-y-4 p-5 md:p-6">
                <h3 className="font-semibold text-foreground">Why we said this</h3>
                <div className="grid gap-3 sm:grid-cols-2" data-testid="container-bedtime-factors">
                  {result.factors.map((factor, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-xl border border-border/50 bg-card/80 px-3 py-3 shadow-sm"
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
              <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-100"
                  aria-hidden
                >
                  <Moon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-base font-semibold tracking-tight text-foreground">Quick check</span>
                  {!quickCheckOpen ? (
                    <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                      {currentBg.trim() ? `BG ${currentBg} ${bgUnits}` : "Tap to fill in"}
                    </span>
                  ) : null}
                </div>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/60 text-muted-foreground">
                  {quickCheckOpen ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
                </span>
              </div>
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="space-y-3 border-t border-border/50 bg-background/45 px-4 pb-4 pt-3 dark:bg-background/30 sm:px-5">
              <section className="space-y-2" aria-labelledby="bedtime-section-glucose">
                <BedtimeSectionTitle id="bedtime-section-glucose" title="Glucose now" info={BEDTIME_SECTION_INFO.glucose} />
                <div className="space-y-2">
                  <Label htmlFor="current-bg" className="sr-only">
                    Current blood glucose
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="current-bg"
                      type="number"
                      step="0.1"
                      placeholder={bgUnits === "mmol/L" ? "e.g. 7.2" : "e.g. 130"}
                      value={currentBg}
                      onChange={(e) => setCurrentBg(e.target.value)}
                      className="h-10 flex-1 text-base"
                      data-testid="input-bedtime-bg"
                    />
                    <span className="flex h-10 items-center rounded-md border border-border/60 bg-muted/30 px-2.5 text-sm font-medium text-muted-foreground">
                      {bgUnits}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span id="label-bedtime-bg-direction" className="text-sm font-medium text-foreground">
                      Direction
                    </span>
                    <div
                      className="flex gap-1 rounded-lg border border-border/60 bg-muted/30 p-0.5"
                      role="group"
                      aria-labelledby="label-bedtime-bg-direction"
                    >
                      <Button
                        type="button"
                        variant={bgTrend === "steady" ? "default" : "ghost"}
                        size="sm"
                        className={cn(
                          "h-9 min-h-0 flex-1 rounded-md px-1 text-xs shadow-none sm:text-sm",
                          bgTrend === "steady" ? "bg-indigo-600 text-white hover:bg-indigo-600 dark:bg-indigo-500" : "text-muted-foreground",
                        )}
                        onClick={() => setBgTrend((prev) => (prev === "steady" ? "not_sure" : "steady"))}
                        data-testid="button-bedtime-bg-trend-stable"
                      >
                        <Minus className="mr-1 h-3.5 w-3.5 shrink-0" aria-hidden />
                        Stable
                      </Button>
                      <Button
                        type="button"
                        variant={bgTrend === "rising" ? "default" : "ghost"}
                        size="sm"
                        className={cn(
                          "h-9 min-h-0 flex-1 rounded-md px-1 text-xs shadow-none sm:text-sm",
                          bgTrend === "rising" ? "bg-indigo-600 text-white hover:bg-indigo-600 dark:bg-indigo-500" : "text-muted-foreground",
                        )}
                        onClick={() => setBgTrend((prev) => (prev === "rising" ? "not_sure" : "rising"))}
                        data-testid="button-bedtime-bg-trend-rising"
                      >
                        <TrendingUp className="mr-1 h-3.5 w-3.5 shrink-0" aria-hidden />
                        Rising
                      </Button>
                      <Button
                        type="button"
                        variant={bgTrend === "falling" ? "default" : "ghost"}
                        size="sm"
                        className={cn(
                          "h-9 min-h-0 flex-1 rounded-md px-1 text-xs shadow-none sm:text-sm",
                          bgTrend === "falling" ? "bg-indigo-600 text-white hover:bg-indigo-600 dark:bg-indigo-500" : "text-muted-foreground",
                        )}
                        onClick={() => setBgTrend((prev) => (prev === "falling" ? "not_sure" : "falling"))}
                        data-testid="button-bedtime-bg-trend-falling"
                      >
                        <TrendingDown className="mr-1 h-3.5 w-3.5 shrink-0" aria-hidden />
                        Falling
                      </Button>
                    </div>
                  </div>
                </div>
              </section>

              <div className="border-t border-border/40" />

              <section className="space-y-2" aria-labelledby="bedtime-section-fuel">
                <BedtimeSectionTitle id="bedtime-section-fuel" title="Food & insulin" info={BEDTIME_SECTION_INFO.foodInsulin} />
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <Label htmlFor="hours-food" className="text-sm font-medium">
                      Since food
                    </Label>
                    <Select value={hoursSinceFood} onValueChange={setHoursSinceFood}>
                      <SelectTrigger id="hours-food" className="h-10" data-testid="select-hours-food">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0.5">&lt;1 hr</SelectItem>
                        <SelectItem value="1">1 hr</SelectItem>
                        <SelectItem value="2">2 hr</SelectItem>
                        <SelectItem value="3">3 hr</SelectItem>
                        <SelectItem value="4">4+ hr</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="meal-carbs" className="text-sm font-medium">
                      Carbs (g)
                    </Label>
                    <Input
                      id="meal-carbs"
                      type="number"
                      inputMode="numeric"
                      placeholder="opt."
                      value={mealCarbs}
                      onChange={(e) => setMealCarbs(e.target.value)}
                      className="h-10"
                      data-testid="input-meal-carbs"
                    />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <FieldLabelWithInfo htmlFor="hours-insulin" info={<p className="text-sm leading-snug">{DIABETES_TERMS.bolus.explanation}</p>}>
                      Since bolus
                    </FieldLabelWithInfo>
                    <Select value={hoursSinceInsulin} onValueChange={setHoursSinceInsulin}>
                      <SelectTrigger id="hours-insulin" className="h-10" data-testid="select-hours-insulin">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0.5">&lt;1 hr</SelectItem>
                        <SelectItem value="1">1 hr</SelectItem>
                        <SelectItem value="2">2 hr</SelectItem>
                        <SelectItem value="3">3 hr</SelectItem>
                        <SelectItem value="4">4+ hr</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              <div className="border-t border-border/40" />

              <section className="space-y-2" aria-labelledby="bedtime-section-sleep">
                <BedtimeSectionTitle id="bedtime-section-sleep" title="Tonight" info={BEDTIME_SECTION_INFO.sleep} />
                <div className="space-y-1.5">
                  <Label htmlFor="hours-sleep" className="text-sm font-medium">
                    Sleep in
                  </Label>
                  <Select value={hoursUntilSleep} onValueChange={setHoursUntilSleep}>
                    <SelectTrigger id="hours-sleep" className="h-10" data-testid="select-hours-sleep">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.25">Now</SelectItem>
                      <SelectItem value="0.5">~30 min</SelectItem>
                      <SelectItem value="1">~1 hr</SelectItem>
                      <SelectItem value="1.5">~1.5 hr</SelectItem>
                      <SelectItem value="2">~2 hr</SelectItem>
                      <SelectItem value="3">3+ hr</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </section>

              <Collapsible open={extrasOpen} onOpenChange={setExtrasOpen} className="group rounded-xl border border-border/50">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/30"
                    data-testid="button-bedtime-extras-toggle"
                  >
                    <span className="flex items-center gap-1">
                      Extras
                      <InlineInfoHint
                        ariaLabel="About extras"
                        content={<p className="text-sm leading-snug">{BEDTIME_SECTION_INFO.extras}</p>}
                        className="h-7 w-7"
                      />
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" aria-hidden />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="border-t border-border/50 divide-y divide-border/50">
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <Activity className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                      <Label htmlFor="exercised" className="cursor-pointer truncate text-sm font-medium">
                        Exercised today
                      </Label>
                      {lastExerciseLabel ? (
                        <Badge variant="outline" className="max-w-[6.5rem] shrink truncate text-[10px] font-normal">
                          {lastExerciseLabel}
                        </Badge>
                      ) : null}
                      <InlineInfoHint
                        ariaLabel="About exercise and bedtime"
                        content={<p className="text-sm leading-snug">{BEDTIME_SECTION_INFO.exercise}</p>}
                        className="h-7 w-7"
                      />
                    </div>
                    <Switch id="exercised" checked={exercisedToday} onCheckedChange={setExercisedToday} data-testid="switch-exercised" className="shrink-0" />
                  </div>
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <Wine className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                      <Label htmlFor="alcohol" className="cursor-pointer text-sm font-medium">
                        Had alcohol
                      </Label>
                      <InlineInfoHint
                        ariaLabel="About alcohol and bedtime"
                        content={<p className="text-sm leading-snug">{BEDTIME_SECTION_INFO.alcohol}</p>}
                        className="h-7 w-7"
                      />
                    </div>
                    <Switch id="alcohol" checked={hadAlcohol} onCheckedChange={setHadAlcohol} data-testid="switch-alcohol" className="shrink-0" />
                  </div>
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" aria-hidden />
                      <Label htmlFor="recent-hypos" className="cursor-pointer text-sm font-medium">
                        Recent hypos
                      </Label>
                      <InlineInfoHint
                        ariaLabel="About recent hypos"
                        content={<p className="text-sm leading-snug">{BEDTIME_SECTION_INFO.recentHypos}</p>}
                        className="h-7 w-7"
                      />
                    </div>
                    <Switch id="recent-hypos" checked={recentHypos} onCheckedChange={setRecentHypos} data-testid="switch-recent-hypos" className="shrink-0" />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Button
                onClick={calculateReadiness}
                disabled={!canCalculate}
                className={cn(
                  "h-11 w-full rounded-xl text-base font-semibold shadow-sm",
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
