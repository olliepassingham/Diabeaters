import { useState, useEffect, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Moon, Activity, Wine, AlertTriangle, Sparkles, Plane, Thermometer, ChevronDown, ChevronUp, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { BedtimeReminderPromptDialog } from "@/components/bedtime-reminder-prompt-dialog";
import { BedtimeOutcomeCheckinDialog } from "@/components/bedtime-outcome-checkin-dialog";
import { useAuth } from "@/lib/auth-context";
import { useLinkedPatient } from "@/hooks/use-linked-patient";
import { shouldOfferBedtimeReminderSecondChance } from "@/lib/bedtime-reminder-prompt";
import { findLogNeedingOutcome } from "@/lib/bedtime-outcome-prompt";
import { buildOutcomePatternTip, summarizeOutcomeAccuracy } from "@/lib/bedtime-outcome-insights";
import { rescheduleBedtimeReminders } from "@/lib/bedtime-reminders";
import {
  computeOvernightSummaryFromLocalHistory,
  overnightSummariesDiffer,
} from "@/lib/bedtime-overnight-analysis";
import { getCgmLocalHistory } from "@/lib/cgm/cgm-history-store";
import {
  storage,
  UserSettings,
  ScenarioState,
  BedtimeLog,
  type BedtimeActionSuggested,
  type BedtimeOvernightCgmSummary,
  DIABEATER_PROFILE_CHANGED_EVENT,
  DIABEATER_SETTINGS_CHANGED_EVENT,
  type UserProfile,
} from "@/lib/storage";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { InfoTooltip, DIABETES_TERMS } from "@/components/info-tooltip";
import { InlineInfoHint } from "@/components/ui/field-label-with-info";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
import { ScenarioCoachLink } from "@/components/ai-coach/ScenarioCoachLink";
import { BedtimeResultView, type BedtimeAction } from "@/components/scenarios/bedtime-result-view";
import { BedtimeLastNightCard } from "@/components/scenarios/bedtime-last-night-card";
import { MedicalSourcesLink } from "@/components/medical-sources-link";
import { calculateBedtimeCorrectionDose, type BedtimeCorrectionResult } from "@/lib/bedtime-correction-dose";
import { CgmPrefillButton } from "@/components/cgm-prefill-button";
import { useAutoCgmBgField } from "@/hooks/use-auto-cgm-bg-field";
import { cgmTrendForBedtime } from "@/lib/cgm/apply-cgm-trend";
import { useBedtimeLastNight } from "@/hooks/use-bedtime-last-night";
import { resolveUserTargetBgRange } from "@/lib/target-bg-range";
import { upsertScenario } from "@/lib/scenarios-supabase";
import {
  buildBedtimePersonalizedCopy,
  formatBedtimeBgDisplay,
  hoursSinceSelectPhrase,
  resolveBedtimeReadinessLevel,
  BEDTIME_OVERNIGHT_TREND_STORAGE_KEY,
  type OvernightUsualTrend,
} from "@/lib/bedtime-readiness";

type ReadinessLevel = "steady" | "monitor" | "alert";

type BedtimeBgTrend = "rising" | "steady" | "falling" | "not_sure";

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
  /** The single, coherent action for tonight — never both a correction and a snack. */
  action: BedtimeAction;
  bgAboveTarget: boolean;
}

/**
 * Turns the correction engine's result plus the (mutually-exclusive-by-construction) snack
 * suggestion into ONE coherent action to show the user. This is the only place that decides
 * what to render, so a correction, a "set your correction factor" prompt, and a snack can never
 * appear side by side and contradict each other.
 */
function resolveBedtimeAction(
  correction: BedtimeCorrectionResult,
  snack: { grams: number; reason: string } | null,
): BedtimeAction {
  if (correction.status === "dose") {
    const { status: _status, ...data } = correction;
    return { kind: "correction", data };
  }
  if (correction.status === "no_isf") {
    return { kind: "missing_isf" };
  }
  if (correction.status === "dose_too_small") {
    return {
      kind: "dose_too_small",
      currentBg: correction.currentBg,
      aimBg: correction.aimBg,
      bgUnits: correction.bgUnits,
      rawDose: correction.rawDose,
      note: correction.note,
    };
  }
  if (snack) {
    return { kind: "snack", grams: snack.grams, reason: snack.reason };
  }
  return { kind: "none" };
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
  overnightPattern:
    "Your usual pattern while asleep — we combine this with tonight's reading and, on MDI, when you take long-acting insulin.",
  extras: "Optional details. Meal carbs rarely change the recommendation — BG, trend, and timing matter most.",
  exercise: "Workouts can raise hypo risk for many hours overnight.",
  alcohol: "Alcohol can delay lows — we weigh this more heavily than hypos alone.",
  recentHypos:
    "A hypo in roughly the last 24 hours. On its own this usually means caution, not needs attention, unless glucose is low or falling too.",
  mealCarbs:
    "Optional. Only adds nuance when you ate recently and the meal was large — it does not change the correction dose.",
} as const;

function BedtimeSectionTitle({ id, title, info }: { id: string; title: string; info: string }) {
  return (
    <div className="flex items-center gap-0.5">
      <h3 id={id} className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </h3>
      <InlineInfoHint ariaLabel={`More about ${title}`} content={<p className="text-sm leading-snug">{info}</p>} className="h-7 w-7" />
    </div>
  );
}

function bedtimeSegmentClass(active: boolean) {
  return cn(
    "h-9 min-h-0 flex-1 rounded-lg px-1 text-xs font-medium shadow-none transition-colors sm:text-sm",
    active
      ? "bg-background text-foreground shadow-sm ring-1 ring-border/60 dark:bg-background/90"
      : "text-muted-foreground hover:text-foreground",
  );
}

function BedtimeExtraToggle({
  id,
  icon,
  label,
  hint,
  detail,
  checked,
  onCheckedChange,
  testId,
}: {
  id: string;
  icon: ReactNode;
  label: string;
  hint: string;
  detail?: string | null;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  testId: string;
}) {
  return (
    <div className="flex items-start gap-3 px-3.5 py-3">
      <div className="mt-0.5 shrink-0" aria-hidden>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-0.5 pr-1">
          <Label htmlFor={id} className="cursor-pointer text-sm font-medium leading-snug text-foreground">
            {label}
          </Label>
          <InlineInfoHint
            ariaLabel={`About ${label.toLowerCase()}`}
            content={<p className="text-sm leading-snug">{hint}</p>}
            className="h-6 w-6 shrink-0"
          />
        </div>
        {detail ? (
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground" title={detail}>
            {detail}
          </p>
        ) : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        data-testid={testId}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}

export default function Bedtime() {
  const [currentBg, setCurrentBg] = useState("");
  const [bgUnits, setBgUnits] = useState<"mmol/L" | "mg/dL">("mmol/L");
  const [bgTrend, setBgTrend] = useState<BedtimeBgTrend>("not_sure");
  const bedtimeCgm = useAutoCgmBgField({
    bgValue: currentBg,
    onApplyBg: setCurrentBg,
    onApplyTrend: (trend) => {
      const mapped = cgmTrendForBedtime(trend);
      if (mapped) setBgTrend(mapped);
    },
    autoApplyKey: "bedtime",
  });
  const [hoursSinceFood, setHoursSinceFood] = useState("");
  const [mealCarbs, setMealCarbs] = useState("");
  const [hoursSinceInsulin, setHoursSinceInsulin] = useState("");
  const [hoursUntilSleep, setHoursUntilSleep] = useState("");
  const [overnightUsualTrend, setOvernightUsualTrend] = useState<OvernightUsualTrend>(() => {
    try {
      const saved = localStorage.getItem(BEDTIME_OVERNIGHT_TREND_STORAGE_KEY);
      if (saved === "rise" || saved === "steady" || saved === "fall" || saved === "not_sure") return saved;
    } catch {
      // ignore
    }
    return "not_sure";
  });
  const [exercisedToday, setExercisedToday] = useState(false);
  const [lastExerciseLabel, setLastExerciseLabel] = useState<string | null>(null);
  const [hadAlcohol, setHadAlcohol] = useState(false);
  const [recentHypos, setRecentHypos] = useState(false);
  const [result, setResult] = useState<ReadinessResult | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [scenarioState, setScenarioState] = useState<ScenarioState>({ travelModeActive: false, sickDayActive: false });
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [bedtimeLogs, setBedtimeLogs] = useState<BedtimeLog[]>([]);
  const [quickCheckOpen, setQuickCheckOpen] = useState(true);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: linkedPatient } = useLinkedPatient();
  const hasCarerLink = !!linkedPatient;
  const [secondChancePromptOpen, setSecondChancePromptOpen] = useState(false);
  const [outcomeCheckinLog, setOutcomeCheckinLog] = useState<BedtimeLog | null>(null);
  const [outcomeCheckinOpen, setOutcomeCheckinOpen] = useState(false);

  useEffect(() => {
    const settings = storage.getSettings();
    setUserSettings(settings);
    const profile = storage.getProfile();
    if (profile?.bgUnits) {
      setBgUnits(profile.bgUnits as "mmol/L" | "mg/dL");
    }
    setProfile(storage.getProfile());
    setScenarioState(storage.getScenarioState());
    const logs = storage.getBedtimeLogs();
    setBedtimeLogs(logs);
    // Auto-nudge based on recent exercise sessions (within last 24h).
    const did = storage.didExerciseRecently(24);
    setExercisedToday(did);
    const last = storage.getLastExerciseSummary();
    if (did && last) {
      setLastExerciseLabel(`${last.exerciseName} · ${last.intensity} · ${last.durationMinutes} min`);
    } else {
      setLastExerciseLabel(null);
    }
    // Next time they open this page after a check whose sleep window has passed, ask what happened.
    const needsOutcome = findLogNeedingOutcome(logs);
    if (needsOutcome) {
      setOutcomeCheckinLog(needsOutcome);
      setOutcomeCheckinOpen(true);
    }
  }, []);

  const refreshBedtimeLogs = () => {
    setBedtimeLogs(storage.getBedtimeLogs());
  };

  // Backfill overnight TIR onto recent logs from on-device CGM history (no network).
  useEffect(() => {
    const points = getCgmLocalHistory();
    if (points.length === 0) return;
    const { low, high } = resolveUserTargetBgRange(storage.getSettings(), bgUnits);
    let changed = false;
    for (const log of storage.getBedtimeLogs()) {
      const summary = computeOvernightSummaryFromLocalHistory(log, points, low, high, bgUnits);
      if (overnightSummariesDiffer(log.overnightCgmSummary, summary) && summary) {
        storage.updateBedtimeLog(log.id, { overnightCgmSummary: summary });
        changed = true;
      }
    }
    if (changed) setBedtimeLogs(storage.getBedtimeLogs());
  }, [bgUnits, userSettings]);

  useEffect(() => {
    const onProfile = () => setProfile(storage.getProfile());
    window.addEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
    return () => window.removeEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
  }, []);

  useEffect(() => {
    // Keep the correction factor (and target range) fresh if the user edits Settings → Ratios
    // without leaving this page — otherwise a just-saved ISF can be missed on the next check.
    const onSettings = () => setUserSettings(storage.getSettings());
    window.addEventListener(DIABEATER_SETTINGS_CHANGED_EVENT, onSettings);
    return () => window.removeEventListener(DIABEATER_SETTINGS_CHANGED_EVENT, onSettings);
  }, []);

  const isPumpUser = isPumpDeliveryMethod(profile?.insulinDeliveryMethod);

  const getTargetRange = () => resolveUserTargetBgRange(userSettings, bgUnits);

  const targetRange = getTargetRange();
  const {
    insight: lastNightInsight,
    status: lastNightStatus,
    message: lastNightMessage,
    reviewTarget: lastNightReview,
    refresh: refreshLastNight,
  } = useBedtimeLastNight(bedtimeLogs, bgUnits);

  // Keep history rows in sync when last-night review persists a fresh TIR snapshot.
  useEffect(() => {
    if (!lastNightInsight || !lastNightReview?.log) return;
    setBedtimeLogs(storage.getBedtimeLogs());
  }, [lastNightInsight?.stats.inRangePercent, lastNightInsight?.stats.readingCount, lastNightReview?.log?.id]);

  const persistBedtimeCheck = (
    level: ReadinessLevel,
    correctionDose: number | null,
    actionSuggested: BedtimeActionSuggested,
  ) => {
    const isFirstBedtimeCheck = storage.getBedtimeLogs().length === 0;
    const log: BedtimeLog = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      currentBg: parseFloat(currentBg),
      bgUnits,
      readinessLevel: level,
      hoursSinceFood: hoursSinceFood ? parseFloat(hoursSinceFood) : null,
      hoursSinceInsulin: hoursSinceInsulin ? parseFloat(hoursSinceInsulin) : null,
      hoursUntilSleep: hoursUntilSleep ? parseFloat(hoursUntilSleep) : null,
      bgTrend: bgTrend === "not_sure" ? undefined : bgTrend,
      mealCarbs: mealCarbs ? parseFloat(mealCarbs) : null,
      recentHypos,
      exercisedToday,
      hadAlcohol,
      sickDayActive: scenarioState.sickDayActive,
      travelModeActive: scenarioState.travelModeActive,
      correctionGiven: correctionDose,
      notes: "",
      actionSuggested,
    };
    storage.saveBedtimeLog(log);
    setBedtimeLogs(storage.getBedtimeLogs());
    void rescheduleBedtimeReminders({ hasCarerLink });
    toast({
      title: "Bedtime check logged",
      description: "Counted for your streak, activity history, and linked supporters.",
    });
    if (isFirstBedtimeCheck && user?.id && shouldOfferBedtimeReminderSecondChance(user.id)) {
      setSecondChancePromptOpen(true);
    }
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
      const aboveTarget = bgMmol > targetHighMmol;
      factors.push({
        label: "Trend",
        status: aboveTarget ? "caution" : "good",
        note: "Rising",
        detail: aboveTarget
          ? "Already above target and still rising — overnight levels may climb further."
          : "Worth rechecking before you fully settle.",
      });
      if (aboveTarget) cautionCount++;
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

    if (overnightUsualTrend !== "not_sure") {
      const overnightLabel =
        overnightUsualTrend === "rise"
          ? "Usually rise overnight"
          : overnightUsualTrend === "fall"
            ? "Usually fall overnight"
            : "Usually stay similar overnight";
      const overnightStatus =
        overnightUsualTrend === "rise" && bgMmol > targetHighMmol
          ? "caution"
          : overnightUsualTrend === "fall" && bgMmol < targetLowMmol + 1
            ? "caution"
            : "good";
      factors.push({
        label: "Your overnight pattern",
        status: overnightStatus,
        note: overnightLabel,
        detail:
          overnightUsualTrend === "rise"
            ? "We weigh this when judging whether tonight may drift higher."
            : overnightUsualTrend === "fall"
              ? "We weigh this when judging hypo risk overnight."
              : "Helps us judge whether tonight is likely to match your usual steady nights.",
      });
      if (overnightStatus === "caution") cautionCount++;
    }

    let level = resolveBedtimeReadinessLevel({
      concernCount,
      cautionCount,
      bgMmol,
      targetHighMmol,
      bgTrend,
      mdiBasalForBed,
      overnightUsualTrend,
      isPumpUser,
    });

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
      overnightUsualTrend,
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

    const correctionResult = calculateBedtimeCorrectionDose({
      bgMmol,
      targetLowMmol,
      targetHighMmol,
      correctionFactor: userSettings?.correctionFactor ?? 0,
      bgUnits,
      insulinHours: insulinHoursForIOB,
      bgTrend,
      overnightUsualTrend,
      exercisedToday,
      hadAlcohol,
      recentHypos,
      sickDayActive: scenarioState.sickDayActive,
    });
    const action = resolveBedtimeAction(correctionResult, personalized.snack);
    const actionSuggested: BedtimeActionSuggested =
      action.kind === "correction"
        ? "correction"
        : action.kind === "snack"
          ? "snack"
          : action.kind === "dose_too_small"
            ? "dose_too_small"
            : action.kind === "missing_isf"
              ? "missing_isf"
              : "none";

    // Educational only — reflects the user's own logged outcomes, never changes the dose above.
    const outcomeTip = buildOutcomePatternTip(bedtimeLogs, {
      exercisedToday,
      hadAlcohol,
      recentHypos,
      actionSuggested,
      bgTrend,
    });
    if (outcomeTip) {
      tips.push(outcomeTip);
    }

    const bgAboveTarget = bgMmol > targetHighMmol;
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
      action,
      bgAboveTarget,
    });
    try {
      localStorage.setItem(BEDTIME_OVERNIGHT_TREND_STORAGE_KEY, overnightUsualTrend);
    } catch {
      // ignore
    }
    persistBedtimeCheck(
      level,
      correctionResult.status === "dose" ? correctionResult.suggestedDose : null,
      actionSuggested,
    );
    setQuickCheckOpen(false);

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

  const canCalculate = currentBg && !isNaN(parseFloat(currentBg));

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
    let insight = `You've had ${parts.join(" and ")} in the last week`;
    const accuracy = summarizeOutcomeAccuracy(bedtimeLogs);
    if (accuracy) insight += `. ${accuracy}`;
    return insight;
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

  const overnightTirToneClass = (summary: BedtimeOvernightCgmSummary): string => {
    if (summary.hadLow) return "text-amber-700 dark:text-amber-400";
    if (summary.hadHigh) return "text-orange-700 dark:text-orange-400";
    return "text-emerald-700 dark:text-emerald-400";
  };

  const recentLogs = getRecentLogs();
  const patternInsight = getPatternInsight();

  return (
    <PageShell variant="narrow" density="compact" className="space-y-4 max-sm:space-y-3">
      <PageHeader
        leading={<PageBackButton />}
        title="Bedtime"
        actions={
          <>
            <ScenarioCoachLink topic="bedtime" />
            <PageInfoDialog title="About this check" description="Overnight glucose awareness — not medical advice">
              <InfoSection title="What this does">
                <p>
                  This tool looks at common factors that affect overnight glucose stability. It is designed to help you
                  build awareness and confidence, not to replace your own judgement or medical advice.
                </p>
              </InfoSection>
              <InfoSection title="Your patterns">
                <p>
                  Everyone&apos;s diabetes is different. Over time, you&apos;ll learn which factors matter most for your
                  own steady nights.
                </p>
              </InfoSection>
              {isPumpUser ? (
                <InfoSection title="Pump users">
                  <p>
                    Program boluses on your pump and check IOB before any correction. Any dose numbers are planning aids
                    only — follow your pump and care team.
                  </p>
                </InfoSection>
              ) : null}
              <InfoSection title="Not medical advice">
                <p className="text-xs italic" data-testid="text-bedtime-disclaimer">
                  Educational guidance only. Always follow your healthcare team&apos;s guidance for overnight management.
                </p>
                <MedicalSourcesLink anchor="insulin" compact />
              </InfoSection>
            </PageInfoDialog>
          </>
        }
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

      <BedtimeLastNightCard
        insight={lastNightInsight}
        status={lastNightStatus}
        message={lastNightMessage}
        usedCalendarFallback={lastNightReview?.source === "calendar_fallback"}
        units={bgUnits}
        targetLow={targetRange.low}
        targetHigh={targetRange.high}
        onRefresh={refreshLastNight}
      />

      {result ? (
        <BedtimeResultView
          result={result}
          isPumpUser={isPumpUser}
          hoursUntilSleep={hoursUntilSleep}
          exercisedToday={exercisedToday}
          hadAlcohol={hadAlcohol}
          lastExerciseLabel={lastExerciseLabel}
        />
      ) : null}

      <Collapsible open={quickCheckOpen} onOpenChange={setQuickCheckOpen}>
        <Card
          className="overflow-hidden rounded-[1.35rem] border-indigo-500/20 bg-gradient-to-b from-indigo-500/[0.07] via-card to-card shadow-none dark:border-indigo-400/15 dark:from-indigo-950/45 dark:via-card dark:to-card"
          data-testid="card-bedtime-inputs"
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full text-left transition-colors hover:bg-indigo-500/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-indigo-400/[0.04]"
              aria-label={quickCheckOpen ? "Collapse quick check" : "Expand quick check"}
              data-testid="button-bedtime-quick-check-toggle"
            >
              <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-slate-500/10 text-indigo-700 ring-1 ring-indigo-500/20 dark:from-indigo-400/20 dark:to-slate-400/10 dark:text-indigo-200 dark:ring-indigo-400/20"
                  aria-hidden
                >
                  <Moon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block font-display text-lg font-semibold tracking-tight text-foreground">
                    Quick check
                  </span>
                  {!quickCheckOpen ? (
                    <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                      {currentBg.trim() ? `${currentBg} ${bgUnits}` : "Glucose, trend & timing"}
                    </span>
                  ) : (
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      Overnight readiness in under a minute
                    </span>
                  )}
                </div>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/50 bg-background/70 text-muted-foreground backdrop-blur-sm">
                  {quickCheckOpen ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
                </span>
              </div>
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="space-y-4 border-t border-indigo-500/10 px-4 pb-5 pt-4 sm:px-5">
              <section className="space-y-3" aria-labelledby="bedtime-section-glucose">
                <BedtimeSectionTitle id="bedtime-section-glucose" title="Glucose now" info={BEDTIME_SECTION_INFO.glucose} />
                <div className="space-y-3 rounded-2xl border border-border/50 bg-background/70 p-3 shadow-sm backdrop-blur-sm dark:bg-background/40">
                  <div className="space-y-1.5">
                    <Label htmlFor="current-bg" className="sr-only">
                      Current blood glucose
                    </Label>
                    <div className="flex items-stretch gap-2">
                      <Input
                        id="current-bg"
                        type="number"
                        step="0.1"
                        placeholder={bgUnits === "mmol/L" ? "7.2" : "130"}
                        value={currentBg}
                        onChange={(e) => bedtimeCgm.onBgChange(e.target.value)}
                        className="h-12 flex-1 rounded-xl border-border/60 bg-background text-xl font-semibold tabular-nums tracking-tight shadow-none"
                        data-testid="input-bedtime-bg"
                      />
                      <span className="flex min-w-[4.5rem] items-center justify-center rounded-xl border border-border/60 bg-muted/40 px-3 text-sm font-semibold text-muted-foreground">
                        {bgUnits}
                      </span>
                    </div>
                    <CgmPrefillButton
                      prefill={bedtimeCgm.prefill}
                      loading={bedtimeCgm.loading}
                      bgUnits={bgUnits}
                      currentValue={currentBg}
                      onApply={bedtimeCgm.onBgChange}
                      onApplyTrend={(trend) => {
                        const mapped = cgmTrendForBedtime(trend);
                        if (mapped) setBgTrend(mapped);
                      }}
                      onRefresh={bedtimeCgm.refresh}
                      emptyHint={bedtimeCgm.emptyHint}
                      allowSync
                      testId="button-bedtime-cgm-prefill"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <span id="label-bedtime-bg-direction" className="text-xs font-medium text-muted-foreground">
                      Direction
                    </span>
                    <div
                      className="grid grid-cols-3 gap-1 rounded-xl bg-muted/45 p-1 dark:bg-muted/30"
                      role="group"
                      aria-labelledby="label-bedtime-bg-direction"
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(bedtimeSegmentClass(bgTrend === "steady"), "w-full")}
                        onClick={() => setBgTrend((prev) => (prev === "steady" ? "not_sure" : "steady"))}
                        data-testid="button-bedtime-bg-trend-stable"
                      >
                        <Minus className="mr-1 h-3.5 w-3.5 shrink-0" aria-hidden />
                        Stable
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(bedtimeSegmentClass(bgTrend === "rising"), "w-full")}
                        onClick={() => setBgTrend((prev) => (prev === "rising" ? "not_sure" : "rising"))}
                        data-testid="button-bedtime-bg-trend-rising"
                      >
                        <TrendingUp className="mr-1 h-3.5 w-3.5 shrink-0" aria-hidden />
                        Rising
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(bedtimeSegmentClass(bgTrend === "falling"), "w-full")}
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

              <section className="space-y-3" aria-labelledby="bedtime-section-fuel">
                <BedtimeSectionTitle id="bedtime-section-fuel" title="Food & insulin" info={BEDTIME_SECTION_INFO.foodInsulin} />
                <div className="grid grid-cols-1 gap-2.5 rounded-2xl border border-border/50 bg-background/70 p-3 shadow-sm backdrop-blur-sm dark:bg-background/40 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="hours-food" className="text-xs font-medium text-muted-foreground">
                      Since food
                    </Label>
                    <Select value={hoursSinceFood} onValueChange={setHoursSinceFood}>
                      <SelectTrigger id="hours-food" className="h-11 rounded-xl border-border/60 bg-background" data-testid="select-hours-food">
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
                    <div className="flex items-center gap-0.5">
                      <Label htmlFor="hours-insulin" className="text-xs font-medium text-muted-foreground">
                        Since bolus
                      </Label>
                      <InlineInfoHint
                        ariaLabel="About bolus"
                        content={<p className="text-sm leading-snug">{DIABETES_TERMS.bolus.explanation}</p>}
                        className="h-7 w-7"
                      />
                    </div>
                    <Select value={hoursSinceInsulin} onValueChange={setHoursSinceInsulin}>
                      <SelectTrigger id="hours-insulin" className="h-11 rounded-xl border-border/60 bg-background" data-testid="select-hours-insulin">
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

              <section className="space-y-3" aria-labelledby="bedtime-section-sleep">
                <BedtimeSectionTitle id="bedtime-section-sleep" title="Tonight" info={BEDTIME_SECTION_INFO.sleep} />
                <div className="space-y-3 rounded-2xl border border-border/50 bg-background/70 p-3 shadow-sm backdrop-blur-sm dark:bg-background/40">
                  <div className="space-y-1.5">
                    <Label htmlFor="hours-sleep" className="text-xs font-medium text-muted-foreground">
                      Sleep in
                    </Label>
                    <Select value={hoursUntilSleep} onValueChange={setHoursUntilSleep}>
                      <SelectTrigger id="hours-sleep" className="h-11 rounded-xl border-border/60 bg-background" data-testid="select-hours-sleep">
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
                  <div className="space-y-1.5">
                    <BedtimeSectionTitle
                      id="bedtime-section-overnight-pattern"
                      title="Usually overnight"
                      info={BEDTIME_SECTION_INFO.overnightPattern}
                    />
                    <div
                      className="grid grid-cols-2 gap-1 rounded-xl bg-muted/45 p-1 dark:bg-muted/30 sm:flex sm:gap-1"
                      role="group"
                      aria-labelledby="bedtime-section-overnight-pattern"
                    >
                      {(
                        [
                          { value: "rise" as const, label: "Rise" },
                          { value: "steady" as const, label: "Similar" },
                          { value: "fall" as const, label: "Fall" },
                          { value: "not_sure" as const, label: "Unsure" },
                        ] as const
                      ).map((opt) => (
                        <Button
                          key={opt.value}
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={cn(bedtimeSegmentClass(overnightUsualTrend === opt.value), "w-full sm:flex-1")}
                          onClick={() => setOvernightUsualTrend(opt.value)}
                          data-testid={`button-bedtime-overnight-${opt.value}`}
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <Collapsible open={extrasOpen} onOpenChange={setExtrasOpen} className="group overflow-hidden rounded-2xl border border-border/50 bg-background/50 dark:bg-background/30">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left text-sm font-medium hover:bg-muted/25"
                    data-testid="button-bedtime-extras-toggle"
                  >
                    <span className="flex min-w-0 items-center gap-1">
                      <span>Extras</span>
                      <InlineInfoHint
                        ariaLabel="About extras"
                        content={<p className="text-sm leading-snug">{BEDTIME_SECTION_INFO.extras}</p>}
                        className="h-6 w-6 shrink-0"
                      />
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" aria-hidden />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="border-t border-border/50">
                  <div className="divide-y divide-border/50">
                    <BedtimeExtraToggle
                      id="exercised"
                      icon={<Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                      label="Exercised today"
                      hint={BEDTIME_SECTION_INFO.exercise}
                      detail={lastExerciseLabel}
                      checked={exercisedToday}
                      onCheckedChange={setExercisedToday}
                      testId="switch-exercised"
                    />
                    <BedtimeExtraToggle
                      id="alcohol"
                      icon={<Wine className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
                      label="Had alcohol"
                      hint={BEDTIME_SECTION_INFO.alcohol}
                      checked={hadAlcohol}
                      onCheckedChange={setHadAlcohol}
                      testId="switch-alcohol"
                    />
                    <BedtimeExtraToggle
                      id="recent-hypos"
                      icon={<AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />}
                      label="Recent hypos"
                      hint={BEDTIME_SECTION_INFO.recentHypos}
                      checked={recentHypos}
                      onCheckedChange={setRecentHypos}
                      testId="switch-recent-hypos"
                    />
                  </div>
                  <div className="space-y-1.5 border-t border-border/40 px-3.5 py-3">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <Label htmlFor="meal-carbs" className="text-sm font-medium">
                        Meal carbs
                      </Label>
                      <span className="text-[11px] text-muted-foreground">optional</span>
                      <InlineInfoHint
                        ariaLabel="About meal carbs"
                        content={<p className="text-sm leading-snug">{BEDTIME_SECTION_INFO.mealCarbs}</p>}
                        className="h-6 w-6 shrink-0"
                      />
                    </div>
                    <div className="relative max-w-[10rem]">
                      <Input
                        id="meal-carbs"
                        type="number"
                        inputMode="numeric"
                        placeholder="45"
                        value={mealCarbs}
                        onChange={(e) => setMealCarbs(e.target.value)}
                        className="h-10 rounded-xl border-border/60 bg-background pr-8"
                        data-testid="input-meal-carbs"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        g
                      </span>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Button
                onClick={calculateReadiness}
                disabled={!canCalculate}
                className="h-12 w-full rounded-xl text-base font-semibold shadow-sm"
                data-testid="button-check-bedtime"
              >
                <Moon className="mr-2 h-4 w-4" aria-hidden />
                Check bedtime
              </Button>
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
                  No bedtime checks logged yet. Run a check to start tracking patterns.
                </p>
              ) : (
                <div className="space-y-2">
                  {recentLogs.map((log) => {
                    const tir = log.overnightCgmSummary;
                    return (
                      <div
                        key={log.id}
                        className="rounded-xl border border-border/50 bg-muted/40 px-3.5 py-3"
                        data-testid={`card-bedtime-log-${log.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <span
                              className="block text-xs font-medium text-muted-foreground"
                              data-testid={`text-log-date-${log.id}`}
                            >
                              {formatLogDate(log.date)}
                            </span>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className="text-sm font-semibold tabular-nums tracking-tight text-foreground"
                                data-testid={`text-log-bg-${log.id}`}
                              >
                                {log.currentBg} {log.bgUnits}
                              </span>
                              {getLevelBadge(log.readinessLevel)}
                            </div>
                            {(log.exercisedToday || log.hadAlcohol || log.outcome) && (
                              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                {log.exercisedToday && (
                                  <Badge
                                    variant="outline"
                                    className="border-border/60 bg-background/50 text-xs font-medium"
                                    data-testid={`badge-log-exercise-${log.id}`}
                                  >
                                    <Activity className="mr-1 h-3 w-3" aria-hidden />
                                    Exercise
                                  </Badge>
                                )}
                                {log.hadAlcohol && (
                                  <Badge
                                    variant="outline"
                                    className="border-border/60 bg-background/50 text-xs font-medium"
                                    data-testid={`badge-log-alcohol-${log.id}`}
                                  >
                                    <Wine className="mr-1 h-3 w-3" aria-hidden />
                                    Alcohol
                                  </Badge>
                                )}
                                {log.outcome && (
                                  <Badge
                                    variant="outline"
                                    className="border-border/60 bg-background/50 text-xs font-medium"
                                    data-testid={`badge-log-outcome-${log.id}`}
                                  >
                                    {log.outcome.overnightFeel === "went_low" ? (
                                      <TrendingDown className="mr-1 h-3 w-3" aria-hidden />
                                    ) : log.outcome.overnightFeel === "went_high" ? (
                                      <TrendingUp className="mr-1 h-3 w-3" aria-hidden />
                                    ) : (
                                      <Minus className="mr-1 h-3 w-3" aria-hidden />
                                    )}
                                    {log.outcome.overnightFeel === "went_low"
                                      ? "Went low"
                                      : log.outcome.overnightFeel === "went_high"
                                        ? "Went high"
                                        : log.outcome.overnightFeel === "steady"
                                          ? "Steady"
                                          : "Outcome logged"}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                          {tir ? (
                            <div
                              className="shrink-0 rounded-lg bg-background/70 px-2.5 py-1.5 text-right shadow-sm ring-1 ring-border/40"
                              aria-label={`${tir.inRangePercent}% in range overnight`}
                              data-testid={`text-log-tir-${log.id}`}
                            >
                              <span
                                className={cn(
                                  "block text-lg font-semibold tabular-nums tracking-tight leading-none",
                                  overnightTirToneClass(tir),
                                )}
                              >
                                {tir.inRangePercent}%
                              </span>
                              <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                in range
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
      <BedtimeReminderPromptDialog
        open={secondChancePromptOpen}
        onOpenChange={setSecondChancePromptOpen}
        variant="second_chance"
      />
      <BedtimeOutcomeCheckinDialog
        open={outcomeCheckinOpen}
        onOpenChange={setOutcomeCheckinOpen}
        log={outcomeCheckinLog}
        onSaved={refreshBedtimeLogs}
      />
    </PageShell>
  );
}
