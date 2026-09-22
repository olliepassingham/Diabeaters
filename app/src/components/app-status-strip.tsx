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
  Maximize2,
  Pause,
  X,
  Expand,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  storage,
  type ScenarioState,
  type ActiveExerciseSession,
  type ExercisePhase,
  DIABEATER_SCENARIO_STATE_CHANGED_EVENT,
  DIABEATER_POST_EXERCISE_NUDGE_CHANGED_EVENT,
  DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT,
} from "@/lib/storage";
import { cn } from "@/lib/utils";
import { formatExerciseElapsedShort } from "@/components/exercise-active-session-extras";
import { getWorkoutElapsedMs, isExercisePaused } from "@/lib/exercise-session-timing";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  getPostExerciseTipPanel,
  inferPostExerciseLoadTier,
  insulinDeliveryForPostExerciseTips,
  type PostExerciseActionKind,
} from "@/lib/post-exercise-nudge";
import {
  OFFLINE_BANNER_BASE,
  offlineBannerQueuedSuffix,
  readOfflineQueuedCount,
} from "@/lib/offline-messaging";
import {
  buildStatusBarModel,
  isTravelPackingIncomplete,
  type StatusBarExpandSection,
  type StatusBarSegment,
  type StatusBarSegmentKind,
} from "@/lib/status-bar-model";
import {
  shouldAutoEndTravelMode,
  timezoneChangeFromHours,
} from "@/lib/travel-insulin-clock";

function exercisePhaseLabel(phase: ExercisePhase): string {
  if (phase === "active") return "during";
  return phase;
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

function postExerciseTipPresentation(kind: PostExerciseActionKind): { Icon: LucideIcon; iconWrap: string } {
  if (kind === "overnight") {
    return { Icon: Moon, iconWrap: "bg-violet-500/18 text-violet-800 dark:text-violet-100" };
  }
  if (kind === "carbs" || kind === "trend") {
    return { Icon: Cookie, iconWrap: "bg-amber-500/18 text-amber-900 dark:text-amber-100" };
  }
  if (kind === "insulin") {
    return { Icon: Syringe, iconWrap: "bg-sky-500/16 text-sky-900 dark:text-sky-100" };
  }
  return { Icon: Activity, iconWrap: "bg-emerald-500/18 text-emerald-900 dark:text-emerald-100" };
}

function segmentIcon(kind: StatusBarSegmentKind): LucideIcon {
  if (kind === "travel") return Plane;
  if (kind === "sick") return Thermometer;
  if (kind === "exercise" || kind === "post_exercise") return Dumbbell;
  if (kind === "pump") return Syringe;
  if (kind === "offline") return WifiOff;
  return Activity;
}

function segmentTone(kind: StatusBarSegmentKind): string {
  if (kind === "travel") return "text-sky-800 dark:text-sky-200";
  if (kind === "sick") return "text-amber-900 dark:text-amber-200";
  if (kind === "exercise" || kind === "post_exercise") return "text-emerald-900 dark:text-emerald-200";
  if (kind === "pump") return "text-red-800 dark:text-red-200";
  if (kind === "offline") return "text-muted-foreground";
  return "text-foreground";
}

/**
 * Ultrahuman-style LIVE status bar under the top bar.
 * One glanceable row: LIVE · BG · active tools · expand.
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
  const [expanded, setExpanded] = useState(false);
  const [postExerciseOpen, setPostExerciseOpen] = useState(false);
  const exerciseAutoFinishKey = useRef<string | null>(null);
  const travelAutoEndKey = useRef<string | null>(null);

  const [offlineQueuedCount, setOfflineQueuedCount] = useState(() => readOfflineQueuedCount());
  const [packingIncomplete, setPackingIncomplete] = useState(() =>
    isTravelPackingIncomplete(storage.getTravelPackingList()),
  );

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
      setPackingIncomplete(isTravelPackingIncomplete(storage.getTravelPackingList()));
    }, 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    const onScenario = () => {
      setSc(storage.getScenarioState());
      setPackingIncomplete(isTravelPackingIncomplete(storage.getTravelPackingList()));
    };
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

  // Travel homebound auto-end (TravelBanner is unmounted).
  useEffect(() => {
    if (!sc.travelModeActive || !sc.travelEndDate) {
      travelAutoEndKey.current = null;
      return;
    }
    const end = new Date(sc.travelEndDate);
    if (Number.isNaN(end.getTime())) return;
    const tzHours = Math.abs(sc.travelTimezoneShift ?? 0);
    const today = new Date();
    if (!shouldAutoEndTravelMode(today, end, tzHours)) return;
    const key = `auto-end:${sc.travelEndDate}:${tzHours}`;
    if (travelAutoEndKey.current === key) return;
    travelAutoEndKey.current = key;
    storage.deactivateTravelMode();
    try {
      localStorage.removeItem("diabeater_travel_session");
    } catch {
      // ignore
    }
    setSc(storage.getScenarioState());
    toast({
      title: "Travel Mode Ended",
      description:
        tzHours > 0 ? "Back on home insulin time. Welcome home!" : "Welcome back! Your trip has concluded.",
    });
  }, [sc.travelModeActive, sc.travelEndDate, sc.travelTimezoneShift, toast]);

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

  const isExerciseScenarioPage = pathname === "/scenarios/exercise";
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

  const tzHours = Math.abs(sc.travelTimezoneShift ?? 0);
  const tzChange =
    sc.travelTimezoneDirection && sc.travelTimezoneDirection !== "none"
      ? timezoneChangeFromHours(tzHours)
      : ("none" as const);

  const statusModel = useMemo(
    () =>
      buildStatusBarModel({
        showCgm: showCgmLiveChip,
        online,
        offlineQueuedCount,
        travelModeActive: sc.travelModeActive,
        travelDestination: sc.travelDestination,
        travelStartDate: sc.travelStartDate,
        travelEndDate: sc.travelEndDate,
        timezoneHours: tzHours,
        timezoneChange: tzChange,
        packingIncomplete,
        sickDayActive: sc.sickDayActive,
        sickDaySeverity: sc.sickDaySeverity,
        pumpFailureActive: Boolean(sc.pumpFailureActive),
        exerciseActive: Boolean(ex),
        exercisePhaseLabel: ex ? exercisePhaseLabel(ex.phase) : undefined,
        exerciseTimerLabel: exercisePhaseTimerLabel,
        postExerciseEducational: !ex && showPostExerciseEducational && !postExerciseDismissed,
        postExerciseSnoozed: !ex && postExerciseSnoozed,
      }),
    [
      showCgmLiveChip,
      online,
      offlineQueuedCount,
      sc.travelModeActive,
      sc.travelDestination,
      sc.travelStartDate,
      sc.travelEndDate,
      sc.sickDayActive,
      sc.sickDaySeverity,
      sc.pumpFailureActive,
      tzHours,
      tzChange,
      packingIncomplete,
      ex,
      exercisePhaseTimerLabel,
      showPostExerciseEducational,
      postExerciseDismissed,
      postExerciseSnoozed,
    ],
  );

  const toolSegments = statusModel.segments.filter((s) => s.kind !== "bg");

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

  const handleEndForSection = (section: StatusBarExpandSection) => {
    if (section.id === "travel") handleEndTravel();
    else if (section.id === "sick") handleEndSick();
    else if (section.id === "exercise") handleEndExercise();
    else if (section.id === "pump") handleEndPumpFailure();
  };

  if (inSupporterSession) {
    if (!showCgmLiveChip && online) return null;
    return (
      <div className="relative z-40 -mt-1 mb-0 space-y-1 sm:space-y-1.5" data-testid="app-status-strip">
        {showCgmLiveChip ? (
          <CgmLiveBgChip
            prefill={supporterBgPrefill?.fromCgm ? supporterBgPrefill : null}
            loading={supporterBgLoading}
            onRefresh={refreshSupporterBg}
            onOpen={() => setLocation("/carer-view/glucose")}
            openLabel="Open live glucose"
            rangeStatus={supporterBgRow?.range_status ?? null}
          />
        ) : null}
        {!online ? (
          <div
            className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/55 px-3 py-2 text-sm text-muted-foreground backdrop-blur"
            role="status"
            aria-live="polite"
          >
            <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 text-xs leading-snug sm:text-sm" data-testid="offline-banner-message">
              {OFFLINE_BANNER_BASE}
            </span>
          </div>
        ) : null}
      </div>
    );
  }

  if (!statusModel.visible) return null;

  const cgmPrefill = bgPrefill?.fromCgm ? bgPrefill : null;
  const showLiveDot = showCgmLiveChip;

  const renderSegment = (seg: StatusBarSegment) => {
    if (seg.kind === "bg") return null;
    const Icon = segmentIcon(seg.kind);
    const content = (
      <>
        <Icon className={cn("h-3.5 w-3.5 shrink-0", segmentTone(seg.kind))} aria-hidden />
        {seg.label ? (
          <span className={cn("truncate text-xs font-semibold capitalize", segmentTone(seg.kind))}>{seg.label}</span>
        ) : null}
      </>
    );
    const className = cn(
      "inline-flex max-w-[7.5rem] items-center gap-1 rounded-md px-1 py-0.5 sm:max-w-[10rem]",
      seg.promoted ? "bg-background/40" : "opacity-80",
    );
    if (seg.href) {
      return (
        <Link
          key={seg.kind}
          href={seg.href}
          className={className}
          data-testid={seg.testId}
          aria-label={seg.label ?? seg.kind}
        >
          {content}
        </Link>
      );
    }
    return (
      <span key={seg.kind} className={className} data-testid={seg.testId}>
        {content}
      </span>
    );
  };

  const postExercisePanel = (() => {
    if (ex || (!showPostExerciseEducational && !postExerciseSnoozed)) return null;
    if (postExerciseDismissed && !postExerciseSnoozed) return null;
    const last = storage.getLastExerciseSummary();
    const tier = inferPostExerciseLoadTier(last);
    const delivery = insulinDeliveryForPostExerciseTips(storage.getProfile());
    return getPostExerciseTipPanel(tier, last, delivery);
  })();

  return (
    <div className="relative z-40 -mt-1 mb-0 space-y-1.5" data-testid="app-status-strip">
      <div
        className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/70 px-2.5 py-1.5 backdrop-blur [padding-left:max(0.65rem,env(safe-area-inset-left))] [padding-right:max(0.65rem,env(safe-area-inset-right))] sm:px-3 sm:py-2"
        data-testid="status-live-bar"
        role="status"
        aria-live="polite"
      >
        {showLiveDot ? (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-200"
            data-testid="status-live-indicator"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
            Live
          </span>
        ) : null}

        {showCgmLiveChip ? (
          <div className="min-w-0 shrink" data-testid="status-segment-bg">
            <CgmLiveBgChip
              embedded
              prefill={cgmPrefill}
              loading={bgPrefillLoading}
              onOpen={() => setLocation("/tools/cgm-live")}
              openLabel="Open glucose trends"
              className="min-w-0"
            />
          </div>
        ) : null}

        {toolSegments.length > 0 ? (
          <>
            {showCgmLiveChip || showLiveDot ? (
              <span className="h-4 w-px shrink-0 bg-border/70" aria-hidden />
            ) : null}
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
              {toolSegments.map((seg, i) => (
                <span key={seg.kind} className="inline-flex items-center gap-1.5">
                  {i > 0 ? <span className="h-3 w-px shrink-0 bg-border/50" aria-hidden /> : null}
                  {renderSegment(seg)}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="min-w-0 flex-1" />
        )}

        <Popover open={expanded} onOpenChange={setExpanded}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-8 shrink-0 px-0"
              aria-label={expanded ? "Collapse status details" : "Expand status details"}
              aria-expanded={expanded}
              data-testid="status-live-expand"
            >
              <Expand className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-[min(20rem,calc(100vw-1.5rem))] space-y-2 p-2"
            data-testid="status-live-expand-panel"
          >
            {statusModel.expandSections.map((section) => (
              <div
                key={section.id}
                className="rounded-xl border border-border/50 bg-muted/20 p-2.5"
                data-testid={`status-expand-${section.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{section.title}</p>
                    {section.subtitle ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{section.subtitle}</p>
                    ) : null}
                    {section.id === "offline" && offlineQueuedCount > 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground" data-testid="offline-queued-count">
                        {offlineBannerQueuedSuffix(offlineQueuedCount)}
                      </p>
                    ) : null}
                    {section.id === "offline" ? (
                      <p className="mt-1 text-xs text-muted-foreground" data-testid="offline-banner-message">
                        {OFFLINE_BANNER_BASE}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {section.href ? (
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      data-testid={
                        section.id === "travel"
                          ? "status-travel-view"
                          : section.id === "sick"
                            ? "status-sick-view"
                            : section.id === "exercise"
                              ? "status-exercise-open"
                              : section.id === "pump"
                                ? "status-pumpfailure-view"
                                : undefined
                      }
                    >
                      <Link href={section.href} onClick={() => setExpanded(false)}>
                        Open <ChevronRight className="ml-0.5 h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </Button>
                  ) : null}
                  {section.id === "exercise" && ex && !isExerciseScenarioPage ? (
                    <>
                      {ex.phase === "active" ? (
                        exercisePaused ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2"
                            onClick={handleResumeWorkoutFromActive}
                            aria-label="Resume workout"
                            data-testid="status-exercise-resume"
                          >
                            <Play className="h-3.5 w-3.5" aria-hidden />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2"
                            onClick={handlePauseWorkoutFromActive}
                            aria-label="Pause workout"
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
                          className="h-8 px-2"
                          onClick={() => {
                            requestOpenExerciseMode();
                            setExpanded(false);
                          }}
                          aria-label="Exercise mode"
                          data-testid="status-exercise-mode"
                        >
                          <Maximize2 className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      ) : null}
                      <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                        <Link href={EXERCISE_GUIDE_HREF} onClick={() => setExpanded(false)}>
                          Guide
                        </Link>
                      </Button>
                    </>
                  ) : null}
                  {section.id === "post_exercise" && showPostExerciseEducational ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      aria-expanded={postExerciseOpen}
                      onClick={() => setPostExerciseOpen((o) => !o)}
                      data-testid="status-post-exercise-toggle"
                    >
                      {postExerciseOpen ? (
                        <ChevronUp className="mr-1 h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <ChevronDown className="mr-1 h-3.5 w-3.5" aria-hidden />
                      )}
                      Tips
                    </Button>
                  ) : null}
                  {section.id === "post_exercise" && showPostExerciseEducational ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 px-0"
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
                  ) : null}
                  {section.id === "post_exercise" && postExerciseSnoozed ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => {
                        storage.clearPostExerciseNudgeSnooze();
                        setPostExerciseRev((n) => n + 1);
                        toast({ title: "Reminders on", description: "Post-exercise tips are visible again." });
                      }}
                      data-testid="status-post-exercise-resume-snooze"
                    >
                      Resume
                    </Button>
                  ) : null}
                  {section.canEnd ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => {
                        handleEndForSection(section);
                        setExpanded(false);
                      }}
                      data-testid={
                        section.id === "travel"
                          ? "status-travel-end"
                          : section.id === "sick"
                            ? "status-sick-end"
                            : section.id === "exercise"
                              ? "status-exercise-end"
                              : section.id === "pump"
                                ? "status-pumpfailure-end"
                                : undefined
                      }
                    >
                      <Power className="mr-1 h-3.5 w-3.5" aria-hidden />
                      End
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}

            {sc.travelModeActive ? (
              <div className="px-1" data-testid="status-travel-compact">
                <p className="text-[11px] text-muted-foreground">
                  Travel stays quiet on calm days — expand for plan, packing, and end trip.
                </p>
              </div>
            ) : null}
          </PopoverContent>
        </Popover>
      </div>

      {postExerciseOpen && postExercisePanel && showPostExerciseEducational ? (
        <div
          className="overflow-hidden rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.07] via-background/95 to-violet-500/[0.06] shadow-sm dark:from-emerald-500/10 dark:to-violet-500/10"
          role="region"
          aria-label="Post-exercise tips"
          data-testid="status-post-exercise-nudge"
        >
          <div className="max-h-[min(42dvh,calc(100dvh-18rem-env(safe-area-inset-bottom,0px)))] space-y-2.5 overflow-y-auto overscroll-contain px-3.5 py-3 [-webkit-overflow-scrolling:touch] touch-pan-y sm:px-4 sm:py-3.5">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold leading-snug tracking-tight text-foreground">
                {postExercisePanel.headline}
              </p>
              {postExercisePanel.sessionLine ? (
                <p
                  className="mt-0.5 truncate text-xs text-muted-foreground"
                  data-testid="status-post-exercise-summary"
                >
                  After {postExercisePanel.sessionLine}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              {postExercisePanel.actions.map((tip, i) => {
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
    </div>
  );
}
