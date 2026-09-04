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
  Moon,
  Activity,
  Cookie,
  MoreHorizontal,
  Maximize2,
  Pause,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  storage,
  type ScenarioState,
  type ActiveExerciseSession,
  type ExerciseBgTrend,
  type ExercisePhase,
  DIABEATER_SCENARIO_STATE_CHANGED_EVENT,
  DIABEATER_PROFILE_CHANGED_EVENT,
  DIABEATER_POST_EXERCISE_NUDGE_CHANGED_EVENT,
  DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT,
  type UserProfile,
} from "@/lib/storage";
import { cn } from "@/lib/utils";
import { formatExerciseElapsedShort } from "@/components/exercise-active-session-extras";
import { getWorkoutElapsedMs, isExercisePaused } from "@/lib/exercise-session-timing";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { calculateExercisePlan, type LastInsulinTiming } from "@/lib/exercise-plan";
import {
  getExerciseReadinessVerdict,
  getReadinessToneClasses,
} from "@/lib/exercise-readiness";
import { useExerciseSessionActions } from "@/hooks/use-exercise-session-actions";
import { EXERCISE_GUIDE_HREF, requestOpenExerciseMode } from "@/lib/exercise-mode-deep-link";
import { CgmLiveBgChip } from "@/components/cgm-live-bg-chip";
import { isCgmPrefillActive } from "@/lib/cgm/preferences";
import { useBgPrefill } from "@/hooks/use-bg-prefill";
import { useLinkedPatient } from "@/hooks/use-linked-patient";
import { useSupporterLiveBg } from "@/hooks/use-supporter-live-bg";
import { syncSickDayDeactivatedToCloud } from "@/lib/scenarios-supabase";
import { cancelSickDayMedReminder } from "@/lib/sick-day-med-reminders";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getPostExerciseTipPanel,
  inferPostExerciseLoadTier,
  insulinDeliveryForPostExerciseTips,
  type PostExerciseActionKind,
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

function lastInsulinFromStripAnswer(pre: ActiveExerciseSession["preRapidInsulin2h"]): LastInsulinTiming | undefined {
  if (pre === "yes") return "h1_2";
  if (pre === "no") return "none";
  return undefined;
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

/** Icon + tint for compact post-exercise actions. */
function postExerciseTipPresentation(kind: PostExerciseActionKind): { Icon: LucideIcon; iconWrap: string } {
  if (kind === "overnight") {
    return {
      Icon: Moon,
      iconWrap: "bg-violet-500/18 text-violet-800 dark:text-violet-100",
    };
  }
  if (kind === "carbs" || kind === "trend") {
    return {
      Icon: Cookie,
      iconWrap: "bg-amber-500/18 text-amber-900 dark:text-amber-100",
    };
  }
  if (kind === "insulin") {
    return {
      Icon: Syringe,
      iconWrap: "bg-sky-500/16 text-sky-900 dark:text-sky-100",
    };
  }
  return {
    Icon: Activity,
    iconWrap: "bg-emerald-500/18 text-emerald-900 dark:text-emerald-100",
  };
}

/**
 * Compact status strip shown under the top bar.
 * Travel + exercise (or travel + post-exercise 24h nudge) share one row when both apply.
 */
export function AppStatusStrip() {
  const { toast } = useToast();
  const [pathname, setLocation] = useLocation();
  const exerciseSessionActions = useExerciseSessionActions();
  const { data: linkedPatient } = useLinkedPatient();
  const inSupporterSession = Boolean(linkedPatient);
  const supporterLiveGlucoseScope = linkedPatient?.scopes.live_glucose !== false;
  const { prefill: bgPrefill, loading: bgPrefillLoading, refresh: refreshBgPrefill } = useBgPrefill({
    pollIntervalMs: inSupporterSession ? undefined : 5 * 60_000,
  });
  const {
    prefill: supporterBgPrefill,
    row: supporterBgRow,
    loading: supporterBgLoading,
    refresh: refreshSupporterBg,
  } = useSupporterLiveBg(linkedPatient?.patientId ?? null, inSupporterSession && supporterLiveGlucoseScope);
  const cgmPrefillActive = isCgmPrefillActive();
  const showPatientCgmLiveChip =
    !inSupporterSession && cgmPrefillActive && (bgPrefillLoading || Boolean(bgPrefill?.fromCgm));
  const pathOnly = pathname.split("?")[0] ?? pathname;
  const onSupporterGlucosePage = pathOnly === "/carer-view/glucose";
  const showSupporterCgmLiveChip =
    inSupporterSession &&
    supporterLiveGlucoseScope &&
    !onSupporterGlucosePage &&
    Boolean(supporterBgPrefill?.fromCgm);
  const showCgmLiveChip = showPatientCgmLiveChip || showSupporterCgmLiveChip;

  useEffect(() => {
    if (!showCgmLiveChip) return;
    if (showSupporterCgmLiveChip) {
      void import("@/pages/carer-view/live-glucose");
    } else {
      void import("@/pages/tools/cgm-live");
    }
  }, [showCgmLiveChip, showSupporterCgmLiveChip]);

  const online = useOnline();
  const [sc, setSc] = useState<ScenarioState>(() => storage.getScenarioState());
  const [ex, setEx] = useState<ActiveExerciseSession | null>(() => storage.getActiveExercise());
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
  const [exerciseBgInput, setExerciseBgInput] = useState<string>("");
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
    const onExercise = () => setEx(storage.getActiveExercise());
    window.addEventListener(DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT, onExercise);
    return () => window.removeEventListener(DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT, onExercise);
  }, []);

  useEffect(() => {
    if (ex) setPostExerciseOpen(false);
  }, [ex]);

  useEffect(() => {
    if (!ex) {
      exerciseAutoFinishKey.current = null;
      return;
    }
    if (ex.phase === "pre") exerciseAutoFinishKey.current = null;
  }, [ex]);

  // Planned time elapsing doesn't mean the workout actually stopped — someone who said
  // "60 min" but is still going at 70 shouldn't be silently dropped into Recovery mid-session.
  // Nudge once instead, and let them confirm they're actually done via the toast action.
  useEffect(() => {
    if (!ex || ex.phase !== "active" || !ex.exerciseStartedAt || ex.pausedAt) return;
    const elapsed = getWorkoutElapsedMs(ex, Date.now());
    const total = Math.max(1, ex.durationMinutes) * 60_000;
    if (elapsed < total) return;
    const key = `time-up:${ex.id}`;
    if (exerciseAutoFinishKey.current === key) return;
    exerciseAutoFinishKey.current = key;
    const finishNow = () => {
      const current = storage.getActiveExercise();
      if (!current || current.phase !== "active") return;
      const updated = exerciseSessionActions.finishWorkout();
      setEx(updated);
    };
    toast({
      title: "Planned time is up",
      description: "Still going, or ready to wrap up? Tap Finish once you've actually stopped.",
      action: (
        <ToastAction altText="Finish workout" onClick={finishNow}>
          Finish
        </ToastAction>
      ),
    });
  }, [ex, toast, exerciseSessionActions]);

  useEffect(() => {
    if (!ex) {
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
    sc.sickDayActive ||
    sc.travelModeActive ||
    Boolean(ex) ||
    inPostExerciseWindow ||
    sc.pumpFailureActive ||
    !online ||
    showCgmLiveChip;

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
    exerciseSessionActions.endSession();
    setEx(null);
    toast({ title: "Exercise ended", description: "Session cleared." });
  };

  const handlePauseWorkoutFromActive = () => {
    const s = storage.getActiveExercise();
    if (!s || s.phase !== "active" || s.pausedAt) return;
    const updated = exerciseSessionActions.pauseWorkout();
    setEx(updated);
    toast({ title: "Workout paused", description: "Timer frozen — tap Resume when you start again." });
  };

  const handleResumeWorkoutFromActive = () => {
    const s = storage.getActiveExercise();
    if (!s || s.phase !== "active" || !s.pausedAt) return;
    const updated = exerciseSessionActions.resumeWorkout();
    setEx(updated);
    toast({ title: "Workout resumed", description: "Timer running again." });
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
  const btnClass = "h-8 px-2.5 text-xs";

  const bgUnits = stripProfile?.bgUnits || "mg/dL";
  const exercisePhaseTimerLabel =
    ex?.phase === "active" && ex.exerciseStartedAt
      ? formatExerciseElapsedShort(getWorkoutElapsedMs(ex, Date.now()))
      : ex?.phase === "recovery" && ex.exerciseEndedAt
        ? (() => {
            const ended = new Date(ex.exerciseEndedAt).getTime();
            if (!Number.isFinite(ended)) return null;
            return formatExerciseElapsedShort(Date.now() - ended);
          })()
        : null;
  const exercisePaused = isExercisePaused(ex);

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

  if (!show) return null;

  const showTravelCompact =
    sc.travelModeActive && !ex && (!inPostExerciseWindow || postExerciseDismissed);

  const travelTrailing = showTravelCompact ? (
    <div
      className="flex shrink-0 items-center gap-0.5 border-l border-border/45 pl-2"
      data-testid="status-travel-compact"
    >
      <Link
        href="/scenarios/travel"
        className="flex max-w-[9.5rem] items-center gap-1 rounded-md px-1 py-0.5 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring sm:max-w-[12rem]"
        data-testid="status-travel-view"
        aria-label={
          sc.travelDestination
            ? `Open travel for ${sc.travelDestination}`
            : "Open travel"
        }
      >
        <Plane className="h-3.5 w-3.5 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden />
        <span className="truncate text-xs font-semibold text-foreground">
          {sc.travelDestination?.trim() || "Travel"}
          {travelDays != null && travelDays >= 0 ? ` · ${travelDays}d` : ""}
        </span>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 w-8 shrink-0 px-0"
            aria-label="Travel options"
            data-testid="status-travel-more"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[min(16rem,calc(100vw-2rem))]">
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href="/scenarios/travel">
              <Plane className="mr-2 h-3.5 w-3.5 opacity-70" aria-hidden />
              Open travel
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleEndTravel}
            className="cursor-pointer"
            data-testid="status-travel-end"
          >
            <Power className="mr-2 h-3.5 w-3.5 opacity-70" aria-hidden />
            End travel mode
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ) : null;

  const cgmChip = showCgmLiveChip ? (
    <CgmLiveBgChip
      prefill={
        showSupporterCgmLiveChip
          ? supporterBgPrefill?.fromCgm
            ? supporterBgPrefill
            : null
          : bgPrefill?.fromCgm
            ? bgPrefill
            : null
      }
      loading={showSupporterCgmLiveChip ? supporterBgLoading : bgPrefillLoading}
      onRefresh={showSupporterCgmLiveChip ? refreshSupporterBg : refreshBgPrefill}
      onOpen={showSupporterCgmLiveChip ? () => setLocation("/carer-view/glucose") : () => setLocation("/tools/cgm-live")}
      openLabel={showSupporterCgmLiveChip ? "Open live glucose" : "Open glucose trends"}
      rangeStatus={showSupporterCgmLiveChip ? supporterBgRow?.range_status ?? null : null}
      trailing={!inSupporterSession ? travelTrailing : null}
    />
  ) : null;

  // Supporter mode: live BG bar only (same placement as user mode) — not this device's sick/travel/exercise.
  if (inSupporterSession) {
    if (!cgmChip && online) return null;
    return (
      <div className="relative z-40 -mt-1 mb-0 space-y-1 sm:space-y-1.5" data-testid="app-status-strip">
        {cgmChip}
        {!online ? (
          <div className={rowClass} role="status" aria-live="polite">
            <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground">
              <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 text-xs leading-snug sm:text-sm" data-testid="offline-banner-message">
                {OFFLINE_BANNER_BASE}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative z-40 -mt-1 mb-0 space-y-1 sm:space-y-1.5" data-testid="app-status-strip">
      {cgmChip}

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

      {showTravelCompact && !cgmChip ? (
        <div className={cn(rowClass, "py-1.5")} data-testid="status-travel-compact">
          <Link
            href="/scenarios/travel"
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            data-testid="status-travel-view"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-sky-800 dark:text-sky-200">
              <Plane className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="min-w-0 truncate text-sm font-semibold text-foreground">
              Travel
              {sc.travelDestination ? ` · ${sc.travelDestination}` : ""}
              {travelDays != null && travelDays >= 0 ? ` · ${travelDays}d` : ""}
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={cn(btnClass, "w-9 shrink-0 px-0")}
                aria-label="Travel options"
                data-testid="status-travel-more"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[min(16rem,calc(100vw-2rem))]">
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href="/scenarios/travel">
                  <Plane className="mr-2 h-3.5 w-3.5 opacity-70" aria-hidden />
                  Open travel
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleEndTravel}
                className="cursor-pointer"
                data-testid="status-travel-end"
              >
                <Power className="mr-2 h-3.5 w-3.5 opacity-70" aria-hidden />
                End travel mode
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                        className={cn(btnClass, "w-9 px-0")}
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
                      <DropdownMenuItem asChild className="cursor-pointer" data-testid="status-exercise-open">
                        <Link href={EXERCISE_GUIDE_HREF}>
                          <Dumbbell className="mr-2 h-3.5 w-3.5 opacity-70" aria-hidden />
                          Open Exercise guide
                        </Link>
                      </DropdownMenuItem>
                      {ex.phase === "active" ? (
                        <DropdownMenuItem
                          onClick={() => requestOpenExerciseMode()}
                          className="cursor-pointer"
                          data-testid="status-exercise-mode"
                        >
                          <Maximize2 className="mr-2 h-3.5 w-3.5 opacity-70" aria-hidden />
                          Exercise mode
                        </DropdownMenuItem>
                      ) : null}
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
                  <Link href={EXERCISE_GUIDE_HREF}>
                    <Button size="sm" variant="outline" className={btnClass} data-testid="status-exercise-open">
                      Open <ChevronRight className="h-3.5 w-3.5 ml-0.5" aria-hidden />
                    </Button>
                  </Link>
                  {ex.phase === "active" ? (
                    exercisePaused ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className={cn(btnClass, "px-2")}
                        onClick={handleResumeWorkoutFromActive}
                        aria-label="Resume workout"
                        title="Resume"
                        data-testid="status-exercise-resume"
                      >
                        <Play className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className={cn(btnClass, "px-2")}
                        onClick={handlePauseWorkoutFromActive}
                        aria-label="Pause workout"
                        title="Pause"
                        data-testid="status-exercise-pause"
                      >
                        <Pause className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    )
                  ) : null}
                  {ex.phase === "active" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn(btnClass, "px-2")}
                      onClick={() => requestOpenExerciseMode()}
                      aria-label="Exercise mode"
                      title="Exercise mode"
                      data-testid="status-exercise-mode"
                    >
                      <Maximize2 className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  ) : null}
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
                      className={cn(btnClass, "w-9 px-0")}
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
                    <DropdownMenuItem asChild className="cursor-pointer" data-testid="status-exercise-open">
                      <Link href={EXERCISE_GUIDE_HREF}>
                        <Dumbbell className="mr-2 h-3.5 w-3.5 opacity-70" aria-hidden />
                        Open Exercise guide
                      </Link>
                    </DropdownMenuItem>
                    {ex.phase === "active" ? (
                      <DropdownMenuItem
                        onClick={() => requestOpenExerciseMode()}
                        className="cursor-pointer"
                        data-testid="status-exercise-mode"
                      >
                        <Maximize2 className="mr-2 h-3.5 w-3.5 opacity-70" aria-hidden />
                        Exercise mode
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem onClick={handleEndExercise} className="cursor-pointer" data-testid="status-exercise-end">
                      <Power className="mr-2 h-3.5 w-3.5 opacity-70" aria-hidden />
                      End exercise session
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : null}
          </div>

        </div>
      ) : null}

      {!ex && inPostExerciseWindow && showPostExerciseEducational ? (
        <div className="space-y-2" data-testid="status-post-exercise-nudge">
          {(() => {
            const last = storage.getLastExerciseSummary();
            const tier = inferPostExerciseLoadTier(last);
            const delivery = insulinDeliveryForPostExerciseTips(storage.getProfile());
            const panel = getPostExerciseTipPanel(tier, last, delivery);
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
                              className={cn(btnClass, "w-9 px-0")}
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
                    <div className="max-h-[min(42dvh,calc(100dvh-18rem-env(safe-area-inset-bottom,0px)))] space-y-2.5 overflow-y-auto overscroll-contain px-3.5 py-3 [-webkit-overflow-scrolling:touch] touch-pan-y sm:px-4 sm:py-3.5">
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold leading-snug tracking-tight text-foreground">
                          {panel.headline}
                        </p>
                        {panel.sessionLine ? (
                          <p
                            className="mt-0.5 truncate text-xs text-muted-foreground"
                            data-testid="status-post-exercise-summary"
                          >
                            After {panel.sessionLine}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-1.5">
                        {panel.actions.map((tip, i) => {
                          const { Icon, iconWrap } = postExerciseTipPresentation(tip.kind);
                          return (
                            <div
                              key={tip.id}
                              className="flex items-start gap-2.5 rounded-xl border border-border/45 bg-background/50 px-2.5 py-2 dark:bg-background/30"
                              data-testid={`status-post-exercise-tip-${i}`}
                            >
                              <div
                                className={cn(
                                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                                  iconWrap,
                                )}
                              >
                                <Icon className="h-4 w-4" aria-hidden />
                              </div>
                              <div className="min-w-0 pt-0.5">
                                <p className="text-sm font-semibold leading-snug text-foreground">{tip.title}</p>
                                <p className="text-xs leading-snug text-muted-foreground">{tip.detail}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="px-0.5 text-[10px] leading-snug text-muted-foreground/90">
                        Educational only — follow your diabetes team&apos;s plan first.
                      </p>
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
                      className={cn(btnClass, "w-9 px-0")}
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

