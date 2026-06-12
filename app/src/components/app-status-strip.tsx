import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import type { LucideIcon } from "lucide-react";
import {
  Plane,
  Thermometer,
  WifiOff,
  Power,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Syringe,
  Play,
  Info,
  CircleCheck,
  Moon,
  Activity,
  Lightbulb,
  Cookie,
  Droplets,
  Sparkles,
  Shield,
  MoreHorizontal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  storage,
  type ScenarioState,
  type ActiveExerciseSession,
  type ExerciseBgTrend,
  type ExercisePhase,
  DIABEATER_SCENARIO_STATE_CHANGED_EVENT,
  DIABEATER_PROFILE_CHANGED_EVENT,
  DIABEATER_POST_EXERCISE_NUDGE_CHANGED_EVENT,
  type UserProfile,
} from "@/lib/storage";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { cn } from "@/lib/utils";
import { computeExerciseHypoSuggestion, resolveExerciseBgForHypo } from "@/lib/exercise-hypo-auto";
import { ExerciseFuelPlanSummary, ExerciseHypoTreatmentHint, ExerciseWorkoutProgressBar, formatExerciseElapsedShort } from "@/components/exercise-active-session-extras";
import { useToast } from "@/hooks/use-toast";
import { calculateExercisePlan, getRecoveryInsulinHeadline, type ExercisePlanResult, type LastInsulinTiming } from "@/lib/exercise-plan";
import {
  getExerciseReadinessVerdict,
  getReadinessToneClasses,
  getExerciseCarbPlanHintLine,
  getExerciseFuelPlanLines,
  type ExerciseReadinessResult,
} from "@/lib/exercise-readiness";
import { cancelExerciseReminders, scheduleExerciseActiveReminders } from "@/lib/exercise-reminders";
import { syncSickDayDeactivatedToCloud } from "@/lib/scenarios-supabase";
import { cancelSickDayMedReminder } from "@/lib/sick-day-med-reminders";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EXERCISE_TYPE_OPTIONS } from "@/lib/exercise-catalog";
import {
  formatLastExerciseSummaryLine,
  getPostExerciseEducationalCopy,
  getPostExercisePersonalizedTipBullets,
  inferPostExerciseLoadTier,
  insulinDeliveryForPostExerciseTips,
} from "@/lib/post-exercise-nudge";
import { tripStyleLabel } from "@/lib/travel-active-guidance";
import {
  OFFLINE_BANNER_BASE,
  offlineBannerQueuedSuffix,
  readOfflineQueuedCount,
} from "@/lib/offline-messaging";

function exercisePhaseLabel(phase: ExercisePhase): string {
  if (phase === "active") return "during";
  return phase;
}

function exerciseTypeDisplayLabel(type: string): string {
  return EXERCISE_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

function exerciseExtraInfoDialogTitle(phase: ExercisePhase): string {
  if (phase === "pre") return "Before you start — more detail";
  if (phase === "active") return "During workout — more detail";
  return "Recovery — more detail";
}

function lastInsulinFromStripAnswer(pre: ActiveExerciseSession["preRapidInsulin2h"]): LastInsulinTiming | undefined {
  if (pre === "yes") return "h1_2";
  if (pre === "no") return "none";
  return undefined;
}

function duringCarbBallpark(during: ExercisePlanResult["during"]): string | null {
  if (!during.needsCarbs || during.carbsNeeded <= 0) return null;
  return `Ballpark ~${during.carbsNeeded}g quick carbs if BG drops (${during.carbFrequency}) — confirm with your team.`;
}

/**
 * @param carbLineMergedAbove when true, the carb ballpark is folded into this copy (separate fuel line hidden).
 */
function duringQuickStatusBody(
  v: ExerciseReadinessResult,
  during: ExercisePlanResult["during"],
  carbLineMergedAbove: boolean,
): string {
  if (v.verdict === "not_recommended") {
    return v.detail.length > 130 ? `${v.detail.slice(0, 127)}…` : v.detail;
  }
  const ballpark = duringCarbBallpark(during);
  const genericReady = "You look in range to start";
  if (v.detail && !v.detail.startsWith(genericReady)) {
    if (v.verdict === "caution" && carbLineMergedAbove && ballpark) {
      return `${v.detail} ${ballpark}`;
    }
    if (ballpark && v.verdict === "ready") {
      return `${v.detail} ${ballpark}`;
    }
    return v.detail;
  }
  if (v.verdict === "caution") {
    if (v.title.toLowerCase().includes("high")) {
      return "BG is high — follow your team’s correction and ketone plan before you push intensity harder.";
    }
    if (v.title.toLowerCase().includes("insulin")) {
      if (carbLineMergedAbove && ballpark) {
        return `Insulin may still be active — treat lows early with your usual plan. ${ballpark}`;
      }
      const tail = ballpark ?? "Keep fast-acting carbs on you.";
      return `Insulin may still be active — treat lows early. ${tail}`;
    }
    if (carbLineMergedAbove && ballpark) {
      return `If BG is sliding, ease off a bit and treat lows your usual way. ${ballpark}`;
    }
    const tail = ballpark ?? "Keep fast-acting carbs within reach.";
    return `If BG is sliding, ease off a bit and treat lows your usual way. ${tail}`;
  }
  return "Keep fast carbs within reach. Re-check if you push harder or feel off.";
}

function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

function daysRemaining(endIsoOrDate: string | undefined): number | null {
  if (!endIsoOrDate) return null;
  const end = new Date(endIsoOrDate);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** Icon + tint for post-exercise tip rows (copy-aware, educational only). */
function postExerciseTipPresentation(text: string, index: number): { Icon: LucideIcon; iconWrap: string } {
  const lower = text.toLowerCase();
  if (/bedtime|overnight|\bat night\b|toward bed/.test(lower)) {
    return {
      Icon: Moon,
      iconWrap: "bg-violet-500/18 text-violet-800 shadow-sm shadow-violet-950/10 dark:text-violet-100",
    };
  }
  if (/\bcarb|hypo|fast carb|lows?\b|snack|glucose is/.test(lower)) {
    return {
      Icon: Cookie,
      iconWrap: "bg-amber-500/18 text-amber-900 shadow-sm shadow-amber-950/10 dark:text-amber-100",
    };
  }
  if (/\biob\b|bolus|insulin|pump|injection|correction|stacking|doses?\b/.test(lower)) {
    return {
      Icon: Syringe,
      iconWrap: "bg-sky-500/16 text-sky-900 shadow-sm shadow-sky-950/10 dark:text-sky-100",
    };
  }
  if (/hydra|water|refuel/.test(lower)) {
    return {
      Icon: Droplets,
      iconWrap: "bg-cyan-500/15 text-cyan-900 shadow-sm shadow-cyan-950/10 dark:text-cyan-100",
    };
  }
  if (/\btrain|workout|session|muscle|cardio|hiit|burst|endurance|sensitivity|dip\b/.test(lower)) {
    return {
      Icon: Activity,
      iconWrap: "bg-emerald-500/18 text-emerald-900 shadow-sm shadow-emerald-950/10 dark:text-emerald-100",
    };
  }
  if (index === 0) {
    return {
      Icon: Sparkles,
      iconWrap: "bg-emerald-500/18 text-emerald-900 shadow-sm shadow-emerald-950/10 dark:text-emerald-100",
    };
  }
  return {
    Icon: Lightbulb,
    iconWrap: "bg-muted/80 text-muted-foreground shadow-sm",
  };
}

/**
 * Compact status strip shown under the top bar.
 * Travel + exercise (or travel + post-exercise 24h nudge) share one row when both apply.
 */
export function AppStatusStrip() {
  const { toast } = useToast();
  const online = useOnline();
  const [sc, setSc] = useState<ScenarioState>(() => storage.getScenarioState());
  const [ex, setEx] = useState<ActiveExerciseSession | null>(() => storage.getActiveExercise());
  const [pathname] = useLocation();
  /** Bumps when post-exercise snooze/resume changes so we re-read localStorage. */
  const [postExerciseRev, setPostExerciseRev] = useState(0);
  const inPostExerciseWindow = useMemo(() => {
    void postExerciseRev;
    return storage.didExerciseRecently(24);
  }, [postExerciseRev, ex]);
  const showPostExerciseEducational = useMemo(() => {
    void postExerciseRev;
    return storage.shouldShowPostExerciseEducationalNudges();
  }, [postExerciseRev, ex]);
  const postExerciseSnoozed = useMemo(() => {
    void postExerciseRev;
    return inPostExerciseWindow && storage.arePostExerciseNudgesSnoozed();
  }, [postExerciseRev, inPostExerciseWindow]);
  const postExerciseDismissed = useMemo(() => {
    void postExerciseRev;
    return (
      inPostExerciseWindow &&
      !showPostExerciseEducational &&
      !postExerciseSnoozed &&
      storage.isPostExerciseNudgeDismissedForCurrentSession()
    );
  }, [postExerciseRev, inPostExerciseWindow, showPostExerciseEducational, postExerciseSnoozed]);
  const [postExerciseOpen, setPostExerciseOpen] = useState(false);
  const [exerciseExpanded, setExerciseExpanded] = useState(false);
  const [exerciseDetailOpen, setExerciseDetailOpen] = useState(false);
  const [exerciseBgInput, setExerciseBgInput] = useState<string>("");
  const [stripClock, setStripClock] = useState(() => Date.now());
  const lastExPhaseKey = useRef<string>("");
  const exerciseAutoFinishKey = useRef<string | null>(null);

  const [stripProfile, setStripProfile] = useState<UserProfile | null>(() => storage.getProfile());
  const [offlineQueuedCount, setOfflineQueuedCount] = useState(() => readOfflineQueuedCount());

  useEffect(() => {
    const onProfile = () => setStripProfile(storage.getProfile());
    window.addEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
    return () => window.removeEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
  }, []);

  useEffect(() => {
    const updateQueued = () => setOfflineQueuedCount(readOfflineQueuedCount());
    updateQueued();
    window.addEventListener("diabeater:offline-queue-changed", updateQueued as EventListener);
    window.addEventListener("storage", updateQueued);
    return () => {
      window.removeEventListener("diabeater:offline-queue-changed", updateQueued as EventListener);
      window.removeEventListener("storage", updateQueued);
    };
  }, []);

  useEffect(() => {
    const onPostExerciseNudge = () => setPostExerciseRev((n) => n + 1);
    window.addEventListener(DIABEATER_POST_EXERCISE_NUDGE_CHANGED_EVENT, onPostExerciseNudge);
    return () => window.removeEventListener(DIABEATER_POST_EXERCISE_NUDGE_CHANGED_EVENT, onPostExerciseNudge);
  }, []);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setStripClock(Date.now());
      setSc(storage.getScenarioState());
      setEx(storage.getActiveExercise());
    }, 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    const onScenario = () => setSc(storage.getScenarioState());
    window.addEventListener(DIABEATER_SCENARIO_STATE_CHANGED_EVENT, onScenario);
    return () => window.removeEventListener(DIABEATER_SCENARIO_STATE_CHANGED_EVENT, onScenario);
  }, []);

  useEffect(() => {
    if (ex) setPostExerciseOpen(false);
  }, [ex]);

  /** Combined travel + exercise strip has no "Check" toggle — keep the expanded panel closed. */
  useEffect(() => {
    if (sc.travelModeActive && ex) {
      setExerciseExpanded(false);
    }
  }, [sc.travelModeActive, ex?.id]);

  useEffect(() => {
    if (!ex) {
      exerciseAutoFinishKey.current = null;
      return;
    }
    if (ex.phase === "pre") exerciseAutoFinishKey.current = null;
  }, [ex]);

  useEffect(() => {
    if (!ex || ex.phase !== "active" || !ex.exerciseStartedAt) return;
    const started = new Date(ex.exerciseStartedAt).getTime();
    if (!Number.isFinite(started)) return;
    const endsAt = started + Math.max(1, ex.durationMinutes) * 60_000;
    if (Date.now() < endsAt) return;
    const key = `auto-finish:${ex.id}`;
    if (exerciseAutoFinishKey.current === key) return;
    exerciseAutoFinishKey.current = key;
    void cancelExerciseReminders(ex.id);
    storage.finishExercisePhase();
    setEx(storage.getActiveExercise());
    if (!sc.travelModeActive) {
      setExerciseExpanded(true);
    }
    toast({
      title: "Recovery phase",
      description: "Your planned workout time has ended — you are now in the recovery window.",
    });
  }, [ex, toast, sc.travelModeActive]);

  useEffect(() => {
    if (!ex) {
      setExerciseExpanded(false);
      setExerciseBgInput("");
      lastExPhaseKey.current = "";
      return;
    }
    const key = `${ex.id}-${ex.phase}`;
    if (key !== lastExPhaseKey.current) {
      lastExPhaseKey.current = key;
      const v =
        ex.phase === "pre"
          ? ex.preBg
          : ex.phase === "active"
            ? ex.midBg ?? ex.preBg
            : ex.recoveryBg ?? ex.midBg ?? ex.preBg;
      setExerciseBgInput(typeof v === "number" && Number.isFinite(v) ? String(v) : "");
    }
  }, [ex]);

  const travelDays = useMemo(() => daysRemaining(sc.travelEndDate), [sc.travelEndDate]);
  const travelStyleBadge = tripStyleLabel(sc.travelTripStyle);
  const show =
    sc.sickDayActive || sc.travelModeActive || Boolean(ex) || inPostExerciseWindow || sc.pumpFailureActive || !online;

  const isExerciseScenarioPage = pathname === "/scenarios/exercise";

  const sickTone =
    sc.sickDaySeverity === "severe"
      ? "bg-red-500/15 text-red-700 dark:bg-red-500/15 dark:text-red-200 border-red-500/25"
      : sc.sickDaySeverity === "moderate"
        ? "bg-orange-500/15 text-orange-800 dark:bg-orange-500/15 dark:text-orange-200 border-orange-500/25"
        : "bg-amber-500/15 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200 border-amber-500/25";

  const handleEndSick = () => {
    const pre = storage.getScenarioState();
    const startedAt = pre.sickDayActivatedAt ?? null;
    for (const m of storage.getSickDayMedicationLog()) {
      void cancelSickDayMedReminder(m.id);
    }
    storage.deactivateSickDay();
    try {
      localStorage.removeItem("diabeater_sick_day_session");
    } catch {
      // ignore
    }
    void syncSickDayDeactivatedToCloud({ startedAt });
    toast({ title: "Sick day mode deactivated", description: "Glad you're feeling better!" });
  };

  const handleEndTravel = () => {
    storage.deactivateTravelMode();
    try {
      localStorage.removeItem("diabeater_travel_session");
    } catch {
      // ignore
    }
    toast({ title: "Travel Mode Ended", description: "Welcome back home!" });
  };

  const handleEndExercise = () => {
    storage.endExerciseSession();
    setEx(null);
    toast({ title: "Exercise ended", description: "Session cleared." });
  };

  const handleStartWorkoutFromPre = () => {
    const s = storage.getActiveExercise();
    if (!s || s.phase !== "pre") return;
    const raw = exerciseBgInput.trim().replace(",", ".");
    if (raw !== "") {
      const n = parseFloat(raw);
      if (Number.isNaN(n) || !Number.isFinite(n)) {
        toast({
          title: "Check your BG",
          description: "Enter a number, or clear the field to start without a reading.",
          variant: "destructive",
        });
        return;
      }
      storage.updateActiveExercise({
        preBg: n,
        preBgAt: new Date().toISOString(),
        preChecklist: { ...s.preChecklist, bgChecked: true },
      });
    } else {
      storage.updateActiveExercise({ preBgSkipped: true });
    }
    storage.startExercisePhase();
    const updated = storage.getActiveExercise();
    if (updated) void scheduleExerciseActiveReminders(updated);
    setEx(storage.getActiveExercise());
    if (!sc.travelModeActive) {
      setExerciseExpanded(true);
    }
    toast({
      title: "Workout in progress",
      description: sc.travelModeActive
        ? "You are in During — open Guides → Exercise for the full quick check."
        : "You are in During — the top bar can show session tips when you open Check.",
    });
  };

  const handleFinishWorkoutFromActive = () => {
    const s = storage.getActiveExercise();
    if (!s || s.phase !== "active") return;
    void cancelExerciseReminders(s.id);
    storage.finishExercisePhase();
    setEx(storage.getActiveExercise());
    if (!sc.travelModeActive) {
      setExerciseExpanded(true);
    }
    toast({
      title: "Recovery phase",
      description: sc.travelModeActive
        ? "Post-workout window — open Guides → Exercise for recovery tips, or use your travel dashboard."
        : "Post-workout window — delayed lows are still possible. Use Check for quick tips.",
    });
  };

  const handleEndPumpFailure = () => {
    try {
      storage.endPumpFailureMode();
    } catch {
      // ignore
    }
    toast({ title: "Pump failure mode ended", description: "Session cleared." });
  };

  const rowClass =
    "flex items-center justify-between gap-2 rounded-2xl border border-border/60 bg-background/55 px-3 py-2 backdrop-blur [padding-left:max(0.75rem,env(safe-area-inset-left))] [padding-right:max(0.75rem,env(safe-area-inset-right))]";
  const btnClass = "h-7 px-2 text-xs";

  const bgUnits = stripProfile?.bgUnits || "mg/dL";
  const isPump = isPumpDeliveryMethod(stripProfile?.insulinDeliveryMethod);
  const exercisePhaseTimerLabel =
    ex?.phase === "active" && ex.exerciseStartedAt
      ? (() => {
          const started = new Date(ex.exerciseStartedAt).getTime();
          if (!Number.isFinite(started)) return null;
          return formatExerciseElapsedShort(Date.now() - started);
        })()
      : ex?.phase === "recovery" && ex.exerciseEndedAt
        ? (() => {
            const ended = new Date(ex.exerciseEndedAt).getTime();
            if (!Number.isFinite(ended)) return null;
            return formatExerciseElapsedShort(Date.now() - ended);
          })()
        : null;

  const exercisePlan = useMemo(() => {
    if (!ex) return null;
    const raw = exerciseBgInput.trim().replace(",", ".");
    const n = parseFloat(raw);
    const currentBg = Number.isFinite(n) ? n : undefined;
    const trend: ExerciseBgTrend | undefined =
      ex.phase === "pre"
        ? ex.preTrend
        : ex.phase === "active"
          ? (ex.midTrend ?? ex.preTrend)
          : (ex.recoveryTrend ?? ex.midTrend ?? ex.preTrend);
    return calculateExercisePlan({
      exerciseType: ex.exerciseType,
      durationMinutes: ex.durationMinutes,
      intensity: ex.intensity,
      minutesUntilStart: 0,
      bgUnits,
      currentBg,
      bgTrend: trend ?? undefined,
      lastInsulinTiming: lastInsulinFromStripAnswer(ex.preRapidInsulin2h),
      hourOfDay: new Date().getHours(),
      ...(ex.preEnvironments?.length ? { environments: [...ex.preEnvironments] } : {}),
    });
  }, [bgUnits, ex, exerciseBgInput]);

  const trendForReadiness: ExerciseBgTrend | null = useMemo(() => {
    if (!ex) return null;
    if (ex.phase === "pre") return ex.preTrend ?? null;
    if (ex.phase === "active") return ex.midTrend ?? ex.preTrend ?? null;
    return ex.recoveryTrend ?? ex.midTrend ?? ex.preTrend ?? null;
  }, [ex]);

  const readiness = useMemo(() => {
    if (!ex || !exercisePlan) return null;
    const raw = exerciseBgInput.trim().replace(",", ".");
    const n = parseFloat(raw);
    const bg = Number.isFinite(n) ? n : null;
    const v = getExerciseReadinessVerdict({
      exercisePlanResult: exercisePlan,
      currentBg: bg,
      bgUnits,
      sickDayActive: sc.sickDayActive,
      sickDaySeverity: sc.sickDaySeverity,
      exerciseType: ex.exerciseType,
      intensity: ex.intensity,
      bgTrend: trendForReadiness,
      phase: ex.phase,
      preRapidInsulin2h: ex.preRapidInsulin2h ?? null,
    });
    return { verdict: v, plan: exercisePlan, bg };
  }, [bgUnits, ex, exerciseBgInput, exercisePlan, sc.sickDayActive, sc.sickDaySeverity, trendForReadiness]);

  const preFuelPlanLines = useMemo(() => {
    if (ex?.phase !== "pre" || !exercisePlan || !readiness?.verdict) return [];
    if (readiness.bg == null) return [];
    return getExerciseFuelPlanLines(exercisePlan, readiness.verdict.verdict, stripProfile, {
      phase: "pre",
      exerciseType: ex.exerciseType,
      currentBg: readiness.bg,
      bgUnits,
      intensity: ex.intensity,
    });
  }, [bgUnits, ex?.exerciseType, ex?.intensity, ex?.phase, exercisePlan, readiness?.bg, readiness?.verdict, stripProfile]);

  const activeFuelPlanLines = useMemo(() => {
    if (ex?.phase !== "active" || !exercisePlan || !readiness?.verdict) return [];
    if (readiness.bg == null) return [];
    return getExerciseFuelPlanLines(exercisePlan, readiness.verdict.verdict, stripProfile, {
      phase: "active",
      exerciseType: ex.exerciseType,
      intensity: ex.intensity,
    });
  }, [ex?.exerciseType, ex?.intensity, ex?.phase, exercisePlan, readiness?.bg, readiness?.verdict, stripProfile]);

  const recoveryFuelPlanLines = useMemo(() => {
    if (ex?.phase !== "recovery" || !exercisePlan || !readiness?.verdict) return [];
    if (readiness.bg == null) return [];
    return getExerciseFuelPlanLines(exercisePlan, readiness.verdict.verdict, stripProfile, {
      phase: "recovery",
      exerciseType: ex.exerciseType,
    });
  }, [ex?.exerciseType, ex?.phase, exercisePlan, readiness?.bg, readiness?.verdict, stripProfile]);

  const recoveryInsulinLine = useMemo(() => {
    if (!exercisePlan || ex?.phase !== "recovery") return null;
    return getRecoveryInsulinHeadline(exercisePlan, Boolean(isPump), new Date().getHours() >= 17);
  }, [ex?.phase, exercisePlan, isPump]);

  const recoveryMinutesLeft = useMemo(() => {
    if (!ex?.recoveryEndsAt) return null;
    const t = new Date(ex.recoveryEndsAt).getTime() - Date.now();
    if (!Number.isFinite(t)) return null;
    return Math.max(0, Math.round(t / 60_000));
  }, [ex?.recoveryEndsAt, ex]);

  const exerciseExtraInfoLines = useMemo(() => {
    if (!ex || !exercisePlan) return [];
    const lines: string[] = [];

    if (ex.phase === "recovery") {
      if (recoveryInsulinLine) lines.push(recoveryInsulinLine);
      lines.push(
        `Recovery window (~${exercisePlan.recovery.monitorHours}): delayed lows can still happen — keep snacks and your hypo plan close.`,
      );
      if (recoveryMinutesLeft != null) {
        lines.push(`About ${recoveryMinutesLeft} minutes left in your recovery window.`);
      }
    }

    if (ex.phase === "active") {
      lines.push(
        exercisePlan.during.needsCarbs && exercisePlan.during.carbsNeeded > 0
          ? `Fuel: ~${exercisePlan.during.carbsNeeded}g if BG falls · ${exercisePlan.during.carbFrequency}.`
          : "Fuel: keep fast carbs within reach.",
      );
      if (exercisePlan.during.checkBg) {
        lines.push("Long session: one glucose check around halfway is plenty.");
      }
    }

    if (preFuelPlanLines.length > 0) {
      for (const line of preFuelPlanLines) {
        lines.push(`${line.label}: ${line.text}`);
      }
    } else if (ex.phase === "pre" && readiness?.verdict) {
      const hint = getExerciseCarbPlanHintLine(exercisePlan, readiness.verdict.verdict, {
        phase: "pre",
        exerciseType: ex.exerciseType,
        profile: stripProfile,
        currentBg: readiness.bg,
        bgUnits,
        intensity: ex.intensity,
      });
      if (hint) lines.push(hint);
    }

    return lines;
  }, [ex, exercisePlan, preFuelPlanLines, readiness?.verdict, recoveryInsulinLine, recoveryMinutesLeft, stripProfile]);

  const exerciseHypoStrip = useMemo(() => {
    if (!ex) return null;
    const u = (bgUnits === "mmol/L" ? "mmol/L" : "mg/dL") as "mmol/L" | "mg/dL";
    const bg = resolveExerciseBgForHypo(ex, exerciseBgInput);
    if (bg == null) return null;
    return computeExerciseHypoSuggestion(bg, storage.getSettings(), u, storage.getProfile() ?? {});
  }, [ex, exerciseBgInput, bgUnits]);

  const onExerciseBgInputChange = (value: string) => {
    setExerciseBgInput(value);
    if (!ex) return;
    const raw = value.trim().replace(",", ".");
    if (raw === "") {
      if (ex.phase === "pre") storage.updateActiveExercise({ preBg: undefined, preBgAt: undefined });
      else if (ex.phase === "active") storage.updateActiveExercise({ midBg: undefined, midBgAt: undefined });
      else storage.updateActiveExercise({ recoveryBg: undefined, recoveryBgAt: undefined });
      setEx(storage.getActiveExercise());
      return;
    }
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) return;
    const now = new Date().toISOString();
    if (ex.phase === "pre") storage.updateActiveExercise({ preBg: n, preBgAt: now });
    else if (ex.phase === "active") storage.updateActiveExercise({ midBg: n, midBgAt: now, midCheckDone: true });
    else storage.updateActiveExercise({ recoveryBg: n, recoveryBgAt: now });
    setEx(storage.getActiveExercise());
  };

  const onExerciseTrendPick = (t: "flat" | "rising" | "falling") => {
    if (!ex) return;
    const current =
      ex.phase === "pre" ? ex.preTrend : ex.phase === "active" ? ex.midTrend : ex.recoveryTrend;
    const next: ExerciseBgTrend | undefined = current === t ? undefined : t;
    if (ex.phase === "pre") storage.updateActiveExercise({ preTrend: next });
    else if (ex.phase === "active") storage.updateActiveExercise({ midTrend: next });
    else storage.updateActiveExercise({ recoveryTrend: next });
    setEx(storage.getActiveExercise());
  };

  const trendButtonSelected = (t: "flat" | "rising" | "falling") => {
    if (!ex) return false;
    const current =
      ex.phase === "pre" ? ex.preTrend : ex.phase === "active" ? ex.midTrend : ex.recoveryTrend;
    return current === t;
  };

  if (!show) return null;

  return (
    <div className="relative z-40 -mt-2 mb-2 space-y-1.5 sm:space-y-2" data-testid="app-status-strip">
      {!online ? (
        <div className={rowClass} role="status" aria-live="polite">
          <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground">
            <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 text-xs leading-snug sm:text-sm" data-testid="offline-banner-message">
              {OFFLINE_BANNER_BASE}
            </span>
          </div>
          {offlineQueuedCount > 0 ? (
            <span
              className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
              data-testid="offline-queued-count"
            >
              {offlineBannerQueuedSuffix(offlineQueuedCount)}
            </span>
          ) : null}
        </div>
      ) : null}

      {sc.sickDayActive ? (
        <div className={rowClass}>
          <Badge className={cn("chip border", sickTone)} variant="secondary">
            <Thermometer className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Sick day{sc.sickDaySeverity ? ` · ${sc.sickDaySeverity}` : ""}
          </Badge>
          <div className="flex items-center gap-2">
            <Link href="/scenarios/sick-day#sickday-checklist">
              <Button size="sm" variant="outline" className={btnClass} data-testid="status-sick-view">
                View <ChevronRight className="h-3.5 w-3.5 ml-1" aria-hidden />
              </Button>
            </Link>
            <Button size="sm" variant="outline" className={btnClass} onClick={handleEndSick} data-testid="status-sick-end">
              <Power className="h-3.5 w-3.5 mr-1" aria-hidden />
              End
            </Button>
          </div>
        </div>
      ) : null}

      {sc.travelModeActive && !ex && (!inPostExerciseWindow || postExerciseDismissed) ? (
        <div className={rowClass}>
          <Badge className="chip border border-blue-500/25 bg-blue-500/15 text-blue-900 dark:text-blue-200" variant="secondary">
            <Plane className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Travel{sc.travelDestination ? ` · ${sc.travelDestination}` : ""}
            {travelStyleBadge ? ` · ${travelStyleBadge}` : ""}
            {travelDays != null && travelDays >= 0 ? ` · ${travelDays}d` : ""}
          </Badge>
          <div className="flex items-center gap-2">
            <Link href="/scenarios/travel">
              <Button size="sm" variant="outline" className={btnClass} data-testid="status-travel-view">
                View <ChevronRight className="h-3.5 w-3.5 ml-1" aria-hidden />
              </Button>
            </Link>
            <Button size="sm" variant="outline" className={btnClass} onClick={handleEndTravel} data-testid="status-travel-end">
              <Power className="h-3.5 w-3.5 mr-1" aria-hidden />
              End
            </Button>
          </div>
        </div>
      ) : null}

      {ex ? (
        <div className="space-y-1.5 sm:space-y-2" data-testid="status-exercise">
          <div className={cn(rowClass, sc.travelModeActive && "gap-y-1.5 py-1.5 sm:py-2")} data-testid={sc.travelModeActive ? "status-travel-exercise-combined" : undefined}>
            {sc.travelModeActive ? (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="flex shrink-0 items-center" aria-hidden>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/25 text-blue-900 ring-2 ring-background dark:text-blue-100">
                    <Plane className="h-3.5 w-3.5" />
                  </span>
                  <span className="-ml-2 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/25 text-emerald-900 ring-2 ring-background dark:text-emerald-100">
                    <Dumbbell className="h-3.5 w-3.5" />
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold leading-tight text-foreground">
                    <span className="text-blue-900 dark:text-blue-100">{sc.travelDestination ?? "Travel"}</span>
                    <span className="font-normal text-muted-foreground"> · </span>
                    <span className="text-emerald-900 dark:text-emerald-100 capitalize">
                      {exercisePhaseLabel(ex.phase)}
                    </span>
                    {exercisePhaseTimerLabel ? (
                      <span className="font-medium tabular-nums text-muted-foreground"> · {exercisePhaseTimerLabel}</span>
                    ) : null}
                  </p>
                  {(travelStyleBadge || (travelDays != null && travelDays >= 0)) && (
                    <p className="hidden truncate text-[10px] leading-snug text-muted-foreground sm:block">
                      {travelStyleBadge ? `${travelStyleBadge}` : ""}
                      {travelStyleBadge && travelDays != null && travelDays >= 0 ? " · " : ""}
                      {travelDays != null && travelDays >= 0 ? `${travelDays}d in trip` : ""}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <Badge
                className={cn(
                  "chip border border-emerald-500/25 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200",
                  readiness?.verdict ? getReadinessToneClasses(readiness.verdict.verdict) : null,
                )}
                variant="secondary"
              >
                <Dumbbell className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Exercise · {exercisePhaseLabel(ex.phase)}
              </Badge>
            )}
            {!isExerciseScenarioPage ? (
              sc.travelModeActive ? (
                <div className="flex shrink-0 items-center gap-1">
                  <Link href="/scenarios/travel">
                    <Button size="sm" variant="outline" className={cn(btnClass, "max-sm:px-2")} data-testid="status-travel-view">
                      View <ChevronRight className="h-3.5 w-3.5 max-sm:hidden sm:ml-0.5" aria-hidden />
                    </Button>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn(btnClass, "w-8 px-0")}
                        aria-label="Travel and exercise options"
                        data-testid="status-travel-exercise-more"
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[min(18rem,calc(100vw-2rem))]">
                      <DropdownMenuItem
                        onClick={handleEndTravel}
                        className="cursor-pointer"
                        data-testid="status-travel-end"
                      >
                        <Plane className="mr-2 h-3.5 w-3.5 opacity-70" aria-hidden />
                        End travel mode
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleEndExercise}
                        className="cursor-pointer"
                        data-testid="status-exercise-end"
                      >
                        <Power className="mr-2 h-3.5 w-3.5 opacity-70" aria-hidden />
                        End exercise session
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : (
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className={btnClass}
                    onClick={() => setExerciseExpanded((v) => !v)}
                    data-testid="status-exercise-check"
                  >
                    {exerciseExpanded ? "Hide" : "Check"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={btnClass}
                    onClick={handleEndExercise}
                    data-testid="status-exercise-end"
                  >
                    <Power className="h-3.5 w-3.5 mr-1" aria-hidden />
                    End
                  </Button>
                </div>
              )
            ) : sc.travelModeActive ? (
              <div className="flex shrink-0 items-center gap-1">
                <Link href="/scenarios/travel">
                  <Button size="sm" variant="outline" className={cn(btnClass, "max-sm:px-2")} data-testid="status-travel-view">
                    View <ChevronRight className="h-3.5 w-3.5 max-sm:hidden sm:ml-0.5" aria-hidden />
                  </Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={cn(btnClass, "w-8 px-0")}
                      aria-label="Travel and exercise options"
                      data-testid="status-travel-exercise-more"
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[min(18rem,calc(100vw-2rem))]">
                    <DropdownMenuItem onClick={handleEndTravel} className="cursor-pointer" data-testid="status-travel-end">
                      <Plane className="mr-2 h-3.5 w-3.5 opacity-70" aria-hidden />
                      End travel mode
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleEndExercise} className="cursor-pointer" data-testid="status-exercise-end">
                      <Power className="mr-2 h-3.5 w-3.5 opacity-70" aria-hidden />
                      End exercise session
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : null}
          </div>

          {exerciseExpanded && !isExerciseScenarioPage ? (
            <div
              className={cn(
                "rounded-2xl border border-border/60 bg-background/55 px-3 py-3 backdrop-blur space-y-2",
                readiness?.verdict ? getReadinessToneClasses(readiness.verdict.verdict) : null,
              )}
              data-testid="status-exercise-expanded"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{ex.exerciseName}</p>
                  <p className="text-xs text-muted-foreground">
                    {ex.durationMinutes} min · {ex.intensity} · {exerciseTypeDisplayLabel(ex.exerciseType)}
                  </p>
                </div>
                {ex.phase === "pre" ? (
                  <Button
                    size="sm"
                    variant="default"
                    className={cn("h-8 shrink-0 px-2.5 text-xs sm:text-sm", "whitespace-nowrap")}
                    onClick={handleStartWorkoutFromPre}
                    data-testid="status-exercise-start"
                  >
                    <Play className="h-3.5 w-3.5 mr-1 shrink-0" aria-hidden />
                    Start workout
                  </Button>
                ) : ex.phase === "active" ? (
                  <Button
                    size="sm"
                    variant="default"
                    className={cn("h-8 shrink-0 px-2.5 text-xs sm:text-sm", "whitespace-nowrap")}
                    onClick={handleFinishWorkoutFromActive}
                    data-testid="status-exercise-finish-active"
                  >
                    <CircleCheck className="h-3.5 w-3.5 mr-1 shrink-0" aria-hidden />
                    Workout done
                  </Button>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-foreground/90">
                  {ex.phase === "pre" ? "Before you start" : ex.phase === "active" ? "During" : "Recovery"}
                </p>
                {exercisePhaseTimerLabel ? (
                  <span
                    className="text-xs tabular-nums text-muted-foreground"
                    data-testid={ex.phase === "active" ? "status-exercise-elapsed" : "status-exercise-recovery-elapsed"}
                    title={ex.phase === "active" ? "Workout elapsed" : "Time since workout ended"}
                  >
                    {exercisePhaseTimerLabel}
                  </span>
                ) : null}
              </div>

              {ex.phase === "active" && ex.exerciseStartedAt ? (
                <ExerciseWorkoutProgressBar
                  phase={ex.phase}
                  exerciseStartedAt={ex.exerciseStartedAt}
                  durationMinutes={ex.durationMinutes}
                  nowMs={stripClock}
                  compact
                />
              ) : null}

              {exerciseHypoStrip ? <ExerciseHypoTreatmentHint suggestion={exerciseHypoStrip} /> : null}

              {ex.phase === "pre" ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Current BG</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      inputMode="decimal"
                      placeholder={bgUnits === "mmol/L" ? "e.g. 7.2" : "e.g. 130"}
                      value={exerciseBgInput}
                      onChange={(e) => onExerciseBgInputChange(e.target.value)}
                      className="h-9 min-w-[10rem] flex-1"
                      data-testid="status-exercise-bg"
                    />
                    <div className="flex flex-wrap gap-2">
                      {(["flat", "rising", "falling"] as const).map((t) => (
                        <Button
                          key={t}
                          type="button"
                          size="sm"
                          variant={trendButtonSelected(t) ? "default" : "outline"}
                          className={btnClass}
                          onClick={() => onExerciseTrendPick(t)}
                          data-testid={`status-exercise-trend-${t}`}
                        >
                          {t}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">BG now</p>
                    <p className="text-xs font-medium text-muted-foreground">Trend</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      inputMode="decimal"
                      placeholder={bgUnits === "mmol/L" ? "e.g. 7.2" : "e.g. 130"}
                      value={exerciseBgInput}
                      onChange={(e) => onExerciseBgInputChange(e.target.value)}
                      className="h-9 min-w-[10rem] flex-1"
                      data-testid="status-exercise-bg"
                    />
                    <div className="flex flex-wrap gap-2">
                      {(["flat", "rising", "falling"] as const).map((t) => (
                        <Button
                          key={t}
                          type="button"
                          size="sm"
                          variant={trendButtonSelected(t) ? "default" : "outline"}
                          className={btnClass}
                          onClick={() => onExerciseTrendPick(t)}
                          data-testid={`status-exercise-trend-${t}`}
                        >
                          {t}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {ex.phase === "pre" ? (
                <>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Rapid-acting insulin in the last 2 hours?</p>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          { id: "yes" as const, label: "Yes" },
                          { id: "no" as const, label: "No" },
                        ] as const
                      ).map((o) => (
                        <Button
                          key={o.id}
                          type="button"
                          size="sm"
                          variant={ex.preRapidInsulin2h === o.id ? "default" : "outline"}
                          className={btnClass}
                          onClick={() => {
                            const togglingOff = ex.preRapidInsulin2h === o.id;
                            const next = togglingOff ? undefined : o.id;
                            const patch: Parameters<typeof storage.updateActiveExercise>[0] = {
                              preRapidInsulin2h: next,
                            };
                            if (o.id === "no" && next === "no") {
                              patch.preChecklist = { ...ex.preChecklist, basalAdjusted: true };
                            }
                            storage.updateActiveExercise(patch);
                            setEx(storage.getActiveExercise());
                          }}
                          data-testid={`status-exercise-rapid-insulin-${o.id}`}
                        >
                          {o.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={ex.preChecklist.carbsConsidered ? "default" : "outline"}
                      className={btnClass}
                      onClick={() => {
                        storage.updateActiveExercise({
                          preChecklist: { ...ex.preChecklist, carbsConsidered: !ex.preChecklist.carbsConsidered },
                        });
                        setEx(storage.getActiveExercise());
                      }}
                    >
                      Carbs planned
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={ex.preChecklist.basalAdjusted ? "default" : "outline"}
                      className={btnClass}
                      onClick={() => {
                        storage.updateActiveExercise({
                          preChecklist: { ...ex.preChecklist, basalAdjusted: !ex.preChecklist.basalAdjusted },
                        });
                        setEx(storage.getActiveExercise());
                      }}
                    >
                      Insulin considered
                    </Button>
                  </div>
                </>
              ) : null}

              {ex.phase === "active" && exercisePlan && readiness?.verdict ? (
                <div className="pt-1">
                  {(() => {
                    const v = readiness.verdict;
                    const isCaution = v.verdict === "caution";
                    const isHighCaution = isCaution && v.title.toLowerCase().includes("high");
                    const mergedCarbCaution = isCaution && !isHighCaution && duringCarbBallpark(exercisePlan.during);
                    return (
                      <div
                        className={cn(
                          "rounded-2xl border px-3 py-3 space-y-1.5 bg-background/75",
                          getReadinessToneClasses(v.verdict),
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-base font-semibold leading-tight text-foreground">{v.title}</p>
                          {exerciseExtraInfoLines.length > 0 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 -mr-1 -mt-0.5 text-muted-foreground hover:text-foreground"
                              onClick={() => setExerciseDetailOpen(true)}
                              aria-label="More exercise guidance"
                              data-testid="status-exercise-more-info"
                            >
                              <Info className="h-4 w-4" aria-hidden />
                            </Button>
                          ) : null}
                        </div>
                        <p className="text-sm leading-snug text-foreground/90">
                          {duringQuickStatusBody(v, exercisePlan.during, Boolean(mergedCarbCaution))}
                        </p>
                        {activeFuelPlanLines.length > 0 ? (
                          <ExerciseFuelPlanSummary lines={activeFuelPlanLines} variant="active" className="mt-2" />
                        ) : null}
                      </div>
                    );
                  })()}
                </div>
              ) : null}

              {ex.phase === "recovery" && exercisePlan && readiness?.verdict ? (
                <div className="pt-1">
                  <div
                    className={cn(
                      "rounded-2xl border px-3 py-3 space-y-1.5 bg-background/75",
                      getReadinessToneClasses(readiness.verdict.verdict),
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-base font-semibold leading-tight text-foreground">{readiness.verdict.title}</p>
                      {exerciseExtraInfoLines.length > 0 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 -mr-1 -mt-0.5 text-muted-foreground hover:text-foreground"
                          onClick={() => setExerciseDetailOpen(true)}
                          aria-label="More recovery guidance"
                          data-testid="status-exercise-more-info"
                        >
                          <Info className="h-4 w-4" aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                    <p className="text-sm leading-snug text-foreground/90">{readiness.verdict.detail}</p>
                    {recoveryFuelPlanLines.length > 0 ? (
                      <ExerciseFuelPlanSummary lines={recoveryFuelPlanLines} variant="recovery" className="mt-2" />
                    ) : null}
                  </div>
                </div>
              ) : null}

              {ex.phase === "pre" && readiness?.verdict ? (
                <div className="pt-1">
                  <div
                    className={cn(
                      "rounded-2xl border px-3 py-3 space-y-1.5 bg-background/75",
                      getReadinessToneClasses(readiness.verdict.verdict),
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-base font-semibold leading-tight text-foreground">{readiness.verdict.title}</p>
                      {exerciseExtraInfoLines.length > 0 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 -mr-1 -mt-0.5 text-muted-foreground hover:text-foreground"
                          onClick={() => setExerciseDetailOpen(true)}
                          aria-label="More pre-workout guidance"
                          data-testid="status-exercise-more-info"
                        >
                          <Info className="h-4 w-4" aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                    <p className="text-sm leading-snug text-foreground/90">{readiness.verdict.detail}</p>
                    {preFuelPlanLines.length > 0 ? (
                      <ExerciseFuelPlanSummary lines={preFuelPlanLines} variant="pre" className="mt-2" />
                    ) : null}
                    {(() => {
                      const needsCarbPrompt = !ex.preChecklist.carbsConsidered && preFuelPlanLines.length === 0;
                      const needsInsulinPrompt = !ex.preChecklist.basalAdjusted;
                      const show = needsCarbPrompt || needsInsulinPrompt;
                      if (!show) return null;
                      return (
                        <div className="pt-2 border-t border-border/50 space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">Before you start</p>
                          <ul className="space-y-1 text-xs text-muted-foreground">
                            {needsCarbPrompt ? <li>Have fast carbs within reach.</li> : null}
                            {needsInsulinPrompt ? (
                              <li>Consider insulin on board / recent bolus before you push intensity.</li>
                            ) : null}
                          </ul>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {ex && exerciseExpanded && !isExerciseScenarioPage ? (
        <Dialog open={exerciseDetailOpen} onOpenChange={setExerciseDetailOpen}>
          <DialogContent className="max-w-md" data-testid="dialog-exercise-extra-info">
            <DialogHeader>
              <DialogTitle>{exerciseExtraInfoDialogTitle(ex.phase)}</DialogTitle>
              <DialogDescription>
                Optional reading — your care team knows your targets and doses best.
              </DialogDescription>
            </DialogHeader>
            <ul className="space-y-2 text-sm leading-snug text-foreground/90">
              {exerciseExtraInfoLines.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/70" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground leading-snug pt-1">
              For meal timing, pump temp-basal ideas, and longer recovery guidance, open{" "}
              <Link href="/scenarios/exercise" className="font-medium text-foreground underline-offset-2 hover:underline">
                Guides → Exercise
              </Link>
              .
            </p>
          </DialogContent>
        </Dialog>
      ) : null}

      {!ex && inPostExerciseWindow && showPostExerciseEducational ? (
        <div className="space-y-2" data-testid="status-post-exercise-nudge">
          {(() => {
            const last = storage.getLastExerciseSummary();
            const tier = inferPostExerciseLoadTier(last);
            const summaryLine = formatLastExerciseSummaryLine(last);
            const delivery = insulinDeliveryForPostExerciseTips(storage.getProfile());
            const tipBullets = getPostExercisePersonalizedTipBullets(tier, last, delivery);
            const edu = getPostExerciseEducationalCopy(tier);
            return (
              <>
                <div
                  className={cn(rowClass, sc.travelModeActive && "gap-y-1.5 py-1.5 sm:py-2")}
                  data-testid={
                    sc.travelModeActive ? "status-travel-post-exercise-combined" : "status-post-exercise-header-row"
                  }
                >
                  {sc.travelModeActive ? (
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="flex shrink-0 items-center" aria-hidden>
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/25 text-blue-900 ring-2 ring-background dark:text-blue-100">
                          <Plane className="h-3.5 w-3.5" />
                        </span>
                        <span className="-ml-2 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/25 text-emerald-900 ring-2 ring-background dark:text-emerald-100">
                          <Dumbbell className="h-3.5 w-3.5" />
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold leading-tight text-foreground">
                          <span className="text-blue-900 dark:text-blue-100">{sc.travelDestination ?? "Travel"}</span>
                          <span className="font-normal text-muted-foreground"> · </span>
                          <span className="text-emerald-900 dark:text-emerald-100">Post-exercise · 24h</span>
                        </p>
                        {(travelStyleBadge || (travelDays != null && travelDays >= 0)) && (
                          <p className="hidden truncate text-[10px] leading-snug text-muted-foreground sm:block">
                            {travelStyleBadge ? `${travelStyleBadge}` : ""}
                            {travelStyleBadge && travelDays != null && travelDays >= 0 ? " · " : ""}
                            {travelDays != null && travelDays >= 0 ? `${travelDays}d in trip` : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <Badge
                        className="chip max-w-full shrink border border-emerald-500/25 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                        variant="secondary"
                      >
                        <Dumbbell className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="truncate">Post‑exercise · 24h</span>
                      </Badge>
                    </div>
                  )}
                  <div className="flex shrink-0 items-center gap-1">
                    {sc.travelModeActive ? (
                      <>
                        <Link href="/scenarios/travel">
                          <Button size="sm" variant="outline" className={cn(btnClass, "max-sm:px-2")} data-testid="status-travel-view">
                            View <ChevronRight className="h-3.5 w-3.5 max-sm:hidden sm:ml-0.5" aria-hidden />
                          </Button>
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className={cn(btnClass, "w-8 px-0")}
                              aria-label="Travel options"
                              data-testid="status-travel-post-exercise-more"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[min(18rem,calc(100vw-2rem))]">
                            <DropdownMenuItem
                              onClick={handleEndTravel}
                              className="cursor-pointer"
                              data-testid="status-travel-end"
                            >
                              <Plane className="mr-2 h-3.5 w-3.5 opacity-70" aria-hidden />
                              End travel mode
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={cn(btnClass, "shrink-0")}
                      aria-expanded={postExerciseOpen}
                      onClick={() => setPostExerciseOpen((o) => !o)}
                      data-testid="status-post-exercise-toggle"
                    >
                      {postExerciseOpen ? (
                        <ChevronUp className="h-3.5 w-3.5 mr-1" aria-hidden />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 mr-1" aria-hidden />
                      )}
                      Tips
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className={cn(btnClass, "w-8 shrink-0 px-0")}
                      aria-label="Dismiss post-exercise tips"
                      onClick={() => {
                        storage.dismissPostExerciseNudgesForCurrentSession();
                        setPostExerciseOpen(false);
                        setPostExerciseRev((n) => n + 1);
                        toast({
                          title: "Tips hidden",
                          description: "Post-exercise bar dismissed until your next workout.",
                        });
                      }}
                      data-testid="status-post-exercise-dismiss"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </div>
                {postExerciseOpen ? (
                  <div
                    className="overflow-hidden rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.07] via-background/95 to-violet-500/[0.06] shadow-sm dark:from-emerald-500/10 dark:to-violet-500/10"
                    role="region"
                    aria-label="Post-exercise tips"
                  >
                    <div className="space-y-3 px-3.5 pb-3.5 pt-3.5 sm:px-4 sm:pb-4 sm:pt-4">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-800/90 dark:text-emerald-200/90">
                        {edu.stripHint}
                      </p>
                      {summaryLine ? (
                        <div
                          className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/55 px-3 py-2.5 backdrop-blur-sm dark:bg-background/35"
                          data-testid="status-post-exercise-summary"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-800 dark:text-emerald-100">
                            <Dumbbell className="h-5 w-5" aria-hidden />
                          </div>
                          <div className="min-w-0 pt-0.5">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Last session</p>
                            <p className="text-base font-semibold leading-snug text-foreground">{summaryLine}</p>
                          </div>
                        </div>
                      ) : null}
                      <div className="space-y-2">
                        {tipBullets.map((b, i) => {
                          const { Icon, iconWrap } = postExerciseTipPresentation(b, i);
                          return (
                            <div
                              key={`${i}-${b.slice(0, 48)}`}
                              className="flex gap-3 rounded-xl border border-border/45 bg-background/50 px-3 py-2.5 backdrop-blur-sm dark:bg-background/30"
                              data-testid={`status-post-exercise-tip-${i}`}
                            >
                              <div
                                className={cn(
                                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-black/5 dark:ring-white/10",
                                  iconWrap,
                                )}
                              >
                                <Icon className="h-[18px] w-[18px]" aria-hidden />
                              </div>
                              <p className="min-w-0 pt-1 text-sm leading-snug text-foreground/90">{b}</p>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex gap-2 rounded-lg border border-dashed border-border/60 bg-muted/20 px-2.5 py-2 dark:bg-muted/10">
                        <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        <p className="text-[11px] leading-snug text-muted-foreground">
                          Educational only — follow your diabetes team&apos;s written plan first.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            );
          })()}
        </div>
      ) : null}

      {!ex && inPostExerciseWindow && postExerciseSnoozed ? (
        <div
          className={cn(rowClass, sc.travelModeActive && "gap-y-1.5 py-1.5 sm:py-2")}
          data-testid={sc.travelModeActive ? "status-travel-post-exercise-snoozed-combined" : "status-post-exercise-snoozed"}
        >
          {sc.travelModeActive ? (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="flex shrink-0 items-center" aria-hidden>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/25 text-blue-900 ring-2 ring-background dark:text-blue-100">
                  <Plane className="h-3.5 w-3.5" />
                </span>
                <span className="-ml-2 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/25 text-emerald-900 ring-2 ring-background dark:text-emerald-100">
                  <Dumbbell className="h-3.5 w-3.5" />
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold leading-tight text-foreground">
                  <span className="text-blue-900 dark:text-blue-100">{sc.travelDestination ?? "Travel"}</span>
                  <span className="font-normal text-muted-foreground"> · </span>
                  <span className="text-emerald-900 dark:text-emerald-100">Post-exercise · reminders off</span>
                </p>
                {(travelStyleBadge || (travelDays != null && travelDays >= 0)) && (
                  <p className="hidden truncate text-[10px] leading-snug text-muted-foreground sm:block">
                    {travelStyleBadge ? `${travelStyleBadge}` : ""}
                    {travelStyleBadge && travelDays != null && travelDays >= 0 ? " · " : ""}
                    {travelDays != null && travelDays >= 0 ? `${travelDays}d in trip` : ""}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <Badge
              className="chip border border-emerald-500/20 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300"
              variant="secondary"
            >
              <Dumbbell className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Post‑exercise · reminders off
            </Badge>
          )}
          <div className="flex shrink-0 items-center gap-1">
            {sc.travelModeActive ? (
              <>
                <Link href="/scenarios/travel">
                  <Button size="sm" variant="outline" className={cn(btnClass, "max-sm:px-2")} data-testid="status-travel-view">
                    View <ChevronRight className="h-3.5 w-3.5 max-sm:hidden sm:ml-0.5" aria-hidden />
                  </Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={cn(btnClass, "w-8 px-0")}
                      aria-label="Travel options"
                      data-testid="status-travel-post-exercise-snoozed-more"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[min(18rem,calc(100vw-2rem))]">
                    <DropdownMenuItem onClick={handleEndTravel} className="cursor-pointer" data-testid="status-travel-end">
                      <Plane className="mr-2 h-3.5 w-3.5 opacity-70" aria-hidden />
                      End travel mode
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={btnClass}
              onClick={() => {
                storage.clearPostExerciseNudgeSnooze();
                setPostExerciseRev((n) => n + 1);
                toast({ title: "Reminders on", description: "Post-exercise tips are visible again." });
              }}
              data-testid="status-post-exercise-resume-snooze"
            >
              Resume
            </Button>
          </div>
        </div>
      ) : null}

      {sc.pumpFailureActive ? (
        <div className={rowClass}>
          <Badge className="chip border border-red-500/25 bg-red-500/15 text-red-900 dark:text-red-200" variant="secondary">
            <Syringe className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Pump failure
          </Badge>
          <div className="flex items-center gap-2">
            <Link href="/scenarios/pump-failure">
              <Button size="sm" variant="outline" className={btnClass} data-testid="status-pumpfailure-view">
                View <ChevronRight className="h-3.5 w-3.5 ml-1" aria-hidden />
              </Button>
            </Link>
            <Button size="sm" variant="outline" className={btnClass} onClick={handleEndPumpFailure} data-testid="status-pumpfailure-end">
              <Power className="h-3.5 w-3.5 mr-1" aria-hidden />
              End
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

