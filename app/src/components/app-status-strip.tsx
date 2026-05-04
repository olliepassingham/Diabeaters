import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { storage, type ScenarioState, type ActiveExerciseSession, type ExerciseBgTrend, type ExercisePhase } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { calculateExercisePlan, getRecoveryInsulinHeadline, type ExercisePlanResult, type LastInsulinTiming } from "@/lib/exercise-plan";
import {
  getExerciseReadinessVerdict,
  getReadinessToneClasses,
  getExerciseCarbPlanHintLine,
  type ExerciseReadinessResult,
} from "@/lib/exercise-readiness";
import { cancelExerciseReminders, scheduleExerciseActiveReminders } from "@/lib/exercise-reminders";
import { syncSickDayDeactivatedToCloud } from "@/lib/scenarios-supabase";
import { cancelSickDayMedReminder } from "@/lib/sick-day-med-reminders";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  formatLastExerciseSummaryLine,
  getPostExercisePersonalizedTipBullets,
  inferPostExerciseLoadTier,
  insulinDeliveryForPostExerciseTips,
} from "@/lib/post-exercise-nudge";

function exercisePhaseLabel(phase: ExercisePhase): string {
  if (phase === "active") return "during";
  return phase;
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

function formatElapsedShort(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Compact status strip shown under the top bar.
 * One row per active context so actions are unambiguous on phones.
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
  const [postExerciseOpen, setPostExerciseOpen] = useState(false);
  const [exerciseExpanded, setExerciseExpanded] = useState(false);
  const [exerciseBgInput, setExerciseBgInput] = useState<string>("");
  const lastExPhaseKey = useRef<string>("");
  const exerciseAutoFinishKey = useRef<string | null>(null);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setSc(storage.getScenarioState());
      setEx(storage.getActiveExercise());
    }, 1000);
    return () => window.clearInterval(tick);
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
    setExerciseExpanded(true);
    toast({
      title: "Recovery phase",
      description: "Your planned workout time has ended — you are now in the recovery window.",
    });
  }, [ex, toast]);

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
  const show =
    sc.sickDayActive || sc.travelModeActive || Boolean(ex) || inPostExerciseWindow || sc.pumpFailureActive || !online;
  if (!show) return null;

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
    toast({ title: "Sick Day Mode Deactivated", description: "Glad you're feeling better!" });
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
    setExerciseExpanded(true);
    toast({
      title: "Workout in progress",
      description: "You are in During — the top bar can show session tips when you open Check.",
    });
  };

  const handleFinishWorkoutFromActive = () => {
    const s = storage.getActiveExercise();
    if (!s || s.phase !== "active") return;
    void cancelExerciseReminders(s.id);
    storage.finishExercisePhase();
    setEx(storage.getActiveExercise());
    setExerciseExpanded(true);
    toast({
      title: "Recovery phase",
      description: "Post-workout window — delayed lows are still possible. Use Check for quick tips.",
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

  const bgUnits = storage.getProfile?.()?.bgUnits || "mg/dL";
  const isPump = storage.getProfile?.()?.insulinDeliveryMethod === "pump";
  const exercisePhaseTimerLabel =
    ex?.phase === "active" && ex.exerciseStartedAt
      ? (() => {
          const started = new Date(ex.exerciseStartedAt).getTime();
          if (!Number.isFinite(started)) return null;
          return formatElapsedShort(Date.now() - started);
        })()
      : ex?.phase === "recovery" && ex.exerciseEndedAt
        ? (() => {
            const ended = new Date(ex.exerciseEndedAt).getTime();
            if (!Number.isFinite(ended)) return null;
            return formatElapsedShort(Date.now() - ended);
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

  const preCarbHintLine = useMemo(() => {
    if (ex?.phase !== "pre" || !exercisePlan || !readiness?.verdict) return null;
    return getExerciseCarbPlanHintLine(exercisePlan, readiness.verdict.verdict, { phase: "pre" });
  }, [ex?.phase, exercisePlan, readiness?.verdict]);

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

  return (
    <div className="relative z-40 -mt-2 mb-2 space-y-2" data-testid="app-status-strip">
      {!online ? (
        <div className={rowClass}>
          <Badge className={cn("chip border border-border/60 bg-muted/50 text-muted-foreground", "max-w-full")} variant="secondary">
            <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Offline
          </Badge>
        </div>
      ) : null}

      {sc.sickDayActive ? (
        <div className={rowClass}>
          <Badge className={cn("chip border", sickTone)} variant="secondary">
            <Thermometer className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Sick Day{sc.sickDaySeverity ? ` · ${sc.sickDaySeverity}` : ""}
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

      {sc.travelModeActive ? (
        <div className={rowClass}>
          <Badge className="chip border border-blue-500/25 bg-blue-500/15 text-blue-900 dark:text-blue-200" variant="secondary">
            <Plane className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Travel{sc.travelDestination ? ` · ${sc.travelDestination}` : ""}
            {travelDays != null && travelDays >= 0 ? ` · ${travelDays}d` : ""}
          </Badge>
          <div className="flex items-center gap-2">
            <Link href="/scenarios?tab=travel">
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
        <div className="space-y-2" data-testid="status-exercise">
          <div className={rowClass}>
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
            {!isExerciseScenarioPage ? (
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
                    {ex.durationMinutes} min · {ex.intensity} · {ex.exerciseType}
                    {ex.phase === "recovery" && recoveryMinutesLeft != null
                      ? ` · ~${recoveryMinutesLeft} min left in recovery window`
                      : null}
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="shrink-0 rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="About this quick check"
                    >
                      <Info className="h-4 w-4" aria-hidden />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[min(18rem,calc(100vw-2rem))] text-sm leading-snug">
                    Short summary only — always follow your care team for targets and doses. For meal timing, pump temp-basal
                    ideas, and longer recovery text, open <span className="font-medium">Scenarios → Exercise</span>.
                  </TooltipContent>
                </Tooltip>
              </div>

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
                            storage.updateActiveExercise({ preRapidInsulin2h: ex.preRapidInsulin2h === o.id ? undefined : o.id });
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
                <div className="space-y-2 pt-1">
                  {(() => {
                    const v = readiness.verdict;
                    const isCaution = v.verdict === "caution";
                    const isHighCaution = isCaution && v.title.toLowerCase().includes("high");
                    const mergedCarbCaution = isCaution && !isHighCaution && duringCarbBallpark(exercisePlan.during);
                    const showFuelLineAbove = !mergedCarbCaution;
                    return (
                      <>
                        <div className={cn("rounded-2xl border px-3 py-3 space-y-1.5 bg-background/75", getReadinessToneClasses(v.verdict))}>
                          <p className="text-base font-semibold leading-tight text-foreground">{v.title}</p>
                          <p className="text-sm leading-snug text-foreground/90">
                            {duringQuickStatusBody(v, exercisePlan.during, Boolean(mergedCarbCaution))}
                          </p>
                        </div>

                        {showFuelLineAbove ? (
                          <p className="text-xs text-muted-foreground leading-snug">
                            {exercisePlan.during.needsCarbs && exercisePlan.during.carbsNeeded > 0
                              ? `Fuel: ~${exercisePlan.during.carbsNeeded}g if BG falls · ${exercisePlan.during.carbFrequency}.`
                              : "Fuel: keep fast carbs within reach."}
                          </p>
                        ) : null}
                        {exercisePlan.during.checkBg ? (
                          <p className="text-xs text-muted-foreground leading-snug">
                            Long session: one glucose check around halfway is plenty.
                          </p>
                        ) : null}
                      </>
                    );
                  })()}
                </div>
              ) : null}

              {ex.phase === "recovery" && exercisePlan && readiness?.verdict ? (
                <div className="space-y-2 pt-1">
                  <div
                    className={cn(
                      "rounded-2xl border px-3 py-3 space-y-1.5 bg-background/75",
                      getReadinessToneClasses(readiness.verdict.verdict),
                    )}
                  >
                    <p className="text-base font-semibold leading-tight text-foreground">{readiness.verdict.title}</p>
                    <p className="text-sm leading-snug text-foreground/90">{readiness.verdict.detail}</p>
                  </div>

                  {recoveryInsulinLine ? <p className="text-xs text-muted-foreground leading-snug">{recoveryInsulinLine}</p> : null}
                  <p className="text-xs text-muted-foreground leading-snug">
                    Recovery window (~{exercisePlan.recovery.monitorHours}): delayed lows still happen — keep snacks and your hypo plan close.
                  </p>
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
                    <p className="text-base font-semibold leading-tight text-foreground">{readiness.verdict.title}</p>
                    <p className="text-sm leading-snug text-foreground/90">{readiness.verdict.detail}</p>
                    {(() => {
                      const needsCarbPrompt = !ex.preChecklist.carbsConsidered;
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

              {preCarbHintLine && ex.phase !== "pre" ? (
                <p className="text-sm text-foreground/90 leading-snug">{preCarbHintLine}</p>
              ) : null}

              {/* Info tooltip moved up next to the section label to save space. */}
            </div>
          ) : null}
        </div>
      ) : null}

      {!ex && inPostExerciseWindow && showPostExerciseEducational ? (
        <div className="space-y-2" data-testid="status-post-exercise-nudge">
          {(() => {
            const last = storage.getLastExerciseSummary();
            const tier = inferPostExerciseLoadTier(last);
            const summaryLine = formatLastExerciseSummaryLine(last);
            const delivery = insulinDeliveryForPostExerciseTips(storage.getProfile());
            const tipBullets = getPostExercisePersonalizedTipBullets(tier, last, delivery);
            return (
              <>
                <div className={rowClass} data-testid="status-post-exercise-header-row">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Badge
                      className="chip max-w-full shrink border border-emerald-500/25 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                      variant="secondary"
                    >
                      <Dumbbell className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="truncate">Post‑exercise · 24h</span>
                    </Badge>
                  </div>
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
                </div>
                {postExerciseOpen ? (
                  <div className="rounded-2xl border border-border/60 bg-muted/15 px-3 py-3 space-y-3 dark:bg-muted/10">
                    {summaryLine ? (
                      <p className="text-sm font-medium text-foreground" data-testid="status-post-exercise-summary">
                        Last session: {summaryLine}
                      </p>
                    ) : null}
                    <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground leading-relaxed">
                      {tipBullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Educational only — follow your diabetes team&apos;s written plan first.
                    </p>
                  </div>
                ) : null}
              </>
            );
          })()}
        </div>
      ) : null}

      {!ex && inPostExerciseWindow && !showPostExerciseEducational ? (
        <div className={rowClass} data-testid="status-post-exercise-snoozed">
          <Badge
            className="chip border border-emerald-500/20 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300"
            variant="secondary"
          >
            <Dumbbell className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Post‑exercise · reminders off
          </Badge>
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
            data-testid="status-post-exercise-resume"
          >
            Resume
          </Button>
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

