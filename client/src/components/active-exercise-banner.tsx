import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { 
  Dumbbell, Play, Square, Heart, ChevronDown, ChevronUp, 
  Check, Clock, AlertTriangle, TrendingDown, TrendingUp, 
  Minus, Droplet, Zap, Shield, Calculator
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  storage, ActiveExerciseSession, ExercisePhase, ExerciseType, 
  ExerciseIntensity, ExerciseOutcome 
} from "@/lib/storage";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const EXERCISE_LABELS: Record<ExerciseType, string> = {
  cardio: "Cardio", strength: "Strength", hiit: "HIIT",
  yoga: "Yoga", walking: "Walking", sports: "Sports", swimming: "Swimming",
};

const INTENSITY_COLORS: Record<ExerciseIntensity, string> = {
  light: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  moderate: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  intense: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
};

const PHASE_COLORS: Record<ExercisePhase, string> = {
  pre: "border-blue-300 dark:border-blue-700 bg-blue-50/80 dark:bg-blue-950/40",
  active: "border-green-300 dark:border-green-700 bg-green-50/80 dark:bg-green-950/40",
  recovery: "border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-950/40",
};

const PHASE_LABELS: Record<ExercisePhase, string> = {
  pre: "Preparing", active: "In Progress", recovery: "Recovery",
};

const PHASE_BADGE_STYLES: Record<ExercisePhase, string> = {
  pre: "bg-blue-600 text-white dark:bg-blue-500",
  active: "bg-green-600 text-white dark:bg-green-500",
  recovery: "bg-amber-600 text-white dark:bg-amber-500",
};

interface ExerciseTypeConfig {
  preTips: (isPump: boolean, durationMinutes: number) => string[];
  checklistLabels: { bg: string; carbs: string; basal: string };
  midCheckMessage: string;
  midCheckTiming: number;
  recoveryMessage: string;
  delayedWarning: string | null;
  activeReminder: string | null;
}

const EXERCISE_TYPE_CONFIG: Record<ExerciseType, ExerciseTypeConfig> = {
  cardio: {
    preTips: (isPump, dur) => {
      const tips: string[] = [];
      tips.push("Cardio typically causes a sustained BG drop — have fast-acting carbs ready");
      if (isPump) tips.push("Consider reducing basal rate by 50% starting 60-90 min before");
      else tips.push("Long-acting insulin increases hypo risk during sustained cardio");
      if (dur >= 60) tips.push("For sessions over 60 min, take 15-30g carbs every 30-45 min");
      tips.push("Keep hypo treatment within easy reach");
      return tips;
    },
    checklistLabels: { bg: "Checked blood glucose", carbs: "Fast-acting carbs ready", basal: "Reduced basal rate" },
    midCheckMessage: "Halfway through — feeling shaky or lightheaded? Cardio can cause steady BG drops.",
    midCheckTiming: 0.5,
    recoveryMessage: "BG may continue to drop for several hours after cardio",
    delayedWarning: "Sustained cardio can cause delayed hypos, especially overnight",
    activeReminder: "Sip water regularly and watch for early hypo signs",
  },
  strength: {
    preTips: (isPump, _dur) => {
      const tips: string[] = [];
      tips.push("Strength training often causes BG to rise during exercise, then drop after");
      tips.push("The adrenaline response to heavy lifting can temporarily raise BG");
      if (isPump) tips.push("You may not need to reduce basal for strength — monitor the pattern");
      else tips.push("Be aware of delayed BG drops 1-2 hours after strength work");
      tips.push("Keep hypo treatment nearby for the post-workout window");
      return tips;
    },
    checklistLabels: { bg: "Checked blood glucose", carbs: "Post-workout snack planned", basal: "Reviewed basal rate" },
    midCheckMessage: "How's your BG? Strength training can cause a temporary rise — that's normal.",
    midCheckTiming: 0.5,
    recoveryMessage: "BG may drop in the hours after strength training as muscles refuel",
    delayedWarning: "Heavy lifting can cause delayed hypos as muscles replenish glycogen",
    activeReminder: "A BG rise during lifting is normal — it usually comes down after",
  },
  hiit: {
    preTips: (isPump, _dur) => {
      const tips: string[] = [];
      tips.push("HIIT causes a BG rollercoaster — expect a spike during, then a crash after");
      tips.push("The intense intervals trigger adrenaline which raises BG temporarily");
      if (isPump) tips.push("Consider a small basal reduction — but watch for the post-HIIT drop");
      else tips.push("The post-HIIT BG drop can be significant — plan a snack for afterwards");
      tips.push("Have fast-acting carbs and water at arm's reach");
      return tips;
    },
    checklistLabels: { bg: "Checked blood glucose", carbs: "Recovery carbs ready", basal: "Adjusted basal for HIIT" },
    midCheckMessage: "Quick check — HIIT can mask hypo symptoms with adrenaline. How are you feeling?",
    midCheckTiming: 0.4,
    recoveryMessage: "Post-HIIT BG crashes can be sharp — monitor closely for the next few hours",
    delayedWarning: "HIIT has one of the highest risks of delayed hypos — stay alert tonight",
    activeReminder: "Adrenaline may mask hypo symptoms — pause if anything feels off",
  },
  yoga: {
    preTips: (isPump, _dur) => {
      const tips: string[] = [];
      tips.push("Yoga has a gentle BG impact — relaxation can actually help insulin sensitivity");
      if (isPump) tips.push("Basal adjustment usually isn't needed for yoga");
      tips.push("Stay hydrated and listen to your body during poses");
      tips.push("Keep glucose tablets nearby just in case");
      return tips;
    },
    checklistLabels: { bg: "Checked blood glucose", carbs: "Light snack if needed", basal: "Reviewed basal rate" },
    midCheckMessage: "Gentle check-in — how are you feeling? Take a moment to tune into your body.",
    midCheckTiming: 0.6,
    recoveryMessage: "Yoga's effect on BG is usually mild — a short recovery window is fine",
    delayedWarning: null,
    activeReminder: null,
  },
  walking: {
    preTips: (_isPump, dur) => {
      const tips: string[] = [];
      tips.push("Walking has a mild, steady BG-lowering effect — great for after meals");
      if (dur >= 60) tips.push("For longer walks, bring a small snack and your glucose tablets");
      tips.push("Enjoy your walk — keep glucose tablets in your pocket");
      return tips;
    },
    checklistLabels: { bg: "Checked blood glucose", carbs: "Snack packed for the walk", basal: "Reviewed basal rate" },
    midCheckMessage: "How are you doing? Feeling good to keep going?",
    midCheckTiming: 0.6,
    recoveryMessage: "A short recovery window after walking — BG usually settles quickly",
    delayedWarning: null,
    activeReminder: null,
  },
  swimming: {
    preTips: (isPump, _dur) => {
      const tips: string[] = [];
      tips.push("Hypo symptoms are harder to spot in water — check BG before getting in");
      tips.push("Keep fast-acting glucose at the poolside, not in the changing room");
      if (isPump) tips.push("If disconnecting your pump, note how long you'll be without basal");
      else tips.push("Water exercise can increase insulin absorption — watch for faster drops");
      tips.push("Get out of the water immediately if you feel any hypo symptoms");
      return tips;
    },
    checklistLabels: { bg: "Checked blood glucose", carbs: "Glucose at poolside", basal: "Pump plan sorted" },
    midCheckMessage: "Time for a poolside check — get out of the water and test your BG if you can.",
    midCheckTiming: 0.4,
    recoveryMessage: "Swimming can cause delayed BG drops — keep snacks handy after your swim",
    delayedWarning: "Cold water swimming especially can cause delayed hypos for hours afterwards",
    activeReminder: "If anything feels off, get out of the water first — then check BG",
  },
  sports: {
    preTips: (isPump, _dur) => {
      const tips: string[] = [];
      tips.push("Team sports have unpredictable intensity — BG can swing either way");
      tips.push("Adrenaline from competition can temporarily raise BG");
      if (isPump) tips.push("Consider a moderate basal reduction — but the adrenaline may offset it");
      else tips.push("Keep glucose and snacks on the sideline, easily accessible");
      tips.push("Tell a teammate or coach where your hypo treatment is");
      return tips;
    },
    checklistLabels: { bg: "Checked blood glucose", carbs: "Glucose on the sideline", basal: "Adjusted basal rate" },
    midCheckMessage: "Half-time check — how's your energy? Competition adrenaline can mask low BG signs.",
    midCheckTiming: 0.5,
    recoveryMessage: "Post-match BG drops are common once the adrenaline wears off",
    delayedWarning: "Competitive sports can cause delayed hypos as adrenaline fades — stay alert",
    activeReminder: "Let someone nearby know where your hypo treatment is",
  },
};

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "0 min";
  const totalMin = Math.ceil(ms / 60000);
  if (totalMin >= 60) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${totalMin} min`;
}

function getPreExerciseTips(session: ActiveExerciseSession, isPump: boolean): string[] {
  const config = EXERCISE_TYPE_CONFIG[session.exerciseType];
  return config.preTips(isPump, session.durationMinutes);
}

function getTypeConfig(type: ExerciseType): ExerciseTypeConfig {
  return EXERCISE_TYPE_CONFIG[type];
}

export function ActiveExerciseBanner() {
  const [session, setSession] = useState<ActiveExerciseSession | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [recoveryRemaining, setRecoveryRemaining] = useState(0);
  const [showMidCheck, setShowMidCheck] = useState(false);
  const [showOutcomeDialog, setShowOutcomeDialog] = useState(false);
  const [endingSession, setEndingSession] = useState<ActiveExerciseSession | null>(null);
  const [isPump, setIsPump] = useState(false);
  const [patterns, setPatterns] = useState<ReturnType<typeof storage.getExercisePatterns> | null>(null);

  const loadSession = useCallback(() => {
    const s = storage.getActiveExercise();
    setSession(s);
    if (s) {
      setPatterns(storage.getExercisePatterns(s.exerciseType, s.intensity));
      const profile = storage.getProfile();
      setIsPump(profile?.insulinDeliveryMethod === "pump");
    }
  }, []);

  useEffect(() => {
    loadSession();
    const interval = setInterval(loadSession, 2000);
    return () => clearInterval(interval);
  }, [loadSession]);

  useEffect(() => {
    if (!session) return;
    const tick = () => {
      const now = Date.now();
      if (session.phase === "active" && session.exerciseStartedAt) {
        const start = new Date(session.exerciseStartedAt).getTime();
        const elapsedMs = now - start;
        setElapsed(elapsedMs);

        const typeConfig = getTypeConfig(session.exerciseType);
        const checkTimingMs = session.durationMinutes * 60 * 1000 * typeConfig.midCheckTiming;
        if (!session.midCheckDone && elapsedMs >= checkTimingMs) {
          setShowMidCheck(true);
        }

        const durationMs = session.durationMinutes * 60 * 1000;
        if (elapsedMs >= durationMs) {
          storage.finishExercisePhase();
          loadSession();
        }
      } else if (session.phase === "recovery" && session.recoveryEndsAt) {
        const end = new Date(session.recoveryEndsAt).getTime();
        setRecoveryRemaining(Math.max(0, end - now));
        if (now >= end) {
          const s = storage.endExerciseSession();
          if (s) {
            setEndingSession(s);
            setShowOutcomeDialog(true);
          }
          setSession(null);
        }
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [session]);

  const handleStartExercise = () => {
    storage.startExercisePhase();
    loadSession();
    setExpanded(true);
  };

  const handleFinishExercise = () => {
    storage.finishExercisePhase();
    loadSession();
    setExpanded(true);
  };

  const handleEndSession = () => {
    const s = storage.endExerciseSession();
    if (s) {
      setEndingSession(s);
      setShowOutcomeDialog(true);
    }
    setSession(null);
  };

  const handleSkipRecovery = () => {
    const s = storage.endExerciseSession();
    if (s) {
      setEndingSession(s);
      setShowOutcomeDialog(true);
    }
    setSession(null);
  };

  const handleChecklistToggle = (key: "bgChecked" | "carbsConsidered" | "basalAdjusted") => {
    if (!session) return;
    const updated = {
      ...session,
      preChecklist: { ...session.preChecklist, [key]: !session.preChecklist[key] },
    };
    storage.updateActiveExercise({ preChecklist: updated.preChecklist });
    setSession(updated);
  };

  const handleDismissMidCheck = () => {
    storage.updateActiveExercise({ midCheckDone: true });
    setShowMidCheck(false);
    loadSession();
  };

  const handleCancelSession = () => {
    storage.endExerciseSession();
    setSession(null);
  };

  if (!session && !showOutcomeDialog) return null;

  const tips = session ? getPreExerciseTips(session, isPump) : [];
  const typeConfig = session ? getTypeConfig(session.exerciseType) : null;
  const progressPercent = session?.phase === "active" && session.exerciseStartedAt
    ? Math.min(100, (elapsed / (session.durationMinutes * 60 * 1000)) * 100)
    : 0;
  const isEvening = new Date().getHours() >= 18;

  return (
    <>
      {session && (
        <div className={`border-b-2 transition-colors ${PHASE_COLORS[session.phase]}`} data-testid="banner-active-exercise">
          <div className="px-4 py-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-between gap-2"
              data-testid="button-toggle-exercise-banner"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1.5 rounded-md bg-background/60">
                  <Dumbbell className="h-4 w-4 text-foreground" />
                </div>
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <span className="font-medium text-sm truncate">{session.exerciseName}</span>
                  <Badge className={`text-[10px] px-1.5 py-0 ${PHASE_BADGE_STYLES[session.phase]}`}>
                    {PHASE_LABELS[session.phase]}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {session.phase === "active" && (
                  <span className="text-sm font-mono font-medium tabular-nums" data-testid="text-exercise-timer">
                    {formatElapsed(elapsed)}
                  </span>
                )}
                {session.phase === "recovery" && (
                  <span className="text-xs text-muted-foreground" data-testid="text-recovery-remaining">
                    {formatRemaining(recoveryRemaining)} left
                  </span>
                )}
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </button>

            {session.phase === "active" && (
              <div className="mt-1.5 h-1 rounded-full bg-background/40 overflow-hidden">
                <div
                  className="h-full bg-green-500 dark:bg-green-400 rounded-full transition-all duration-1000"
                  style={{ width: `${progressPercent}%` }}
                  data-testid="progress-exercise"
                />
              </div>
            )}

            {expanded && (
              <div className="mt-3 space-y-3 pb-1 animate-fade-in-up">
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  <span>{EXERCISE_LABELS[session.exerciseType]}</span>
                  <span>·</span>
                  <span>{session.durationMinutes} min</span>
                  <span>·</span>
                  <Badge variant="outline" className={`text-[10px] ${INTENSITY_COLORS[session.intensity]}`}>
                    {session.intensity}
                  </Badge>
                </div>

                {patterns && patterns.totalSessions > 0 && (
                  <div className="flex items-start gap-2 p-2 rounded-md bg-background/50 text-xs" data-testid="text-exercise-pattern">
                    {patterns.droppedCount > patterns.stableCount ? (
                      <TrendingDown className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    ) : patterns.roseCount > patterns.stableCount ? (
                      <TrendingUp className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                    ) : (
                      <Minus className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-medium">{patterns.avgPattern}</p>
                      <p className="text-muted-foreground mt-0.5">
                        Based on {patterns.totalSessions} session{patterns.totalSessions !== 1 ? "s" : ""}
                        {patterns.hypoCount > 0 && ` · ${patterns.hypoCount} hypo${patterns.hypoCount !== 1 ? "s" : ""} recorded`}
                      </p>
                    </div>
                  </div>
                )}

                {session.phase === "pre" && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5" />
                      Pre-exercise checklist
                    </p>
                    <div className="space-y-1.5">
                      <button
                        onClick={() => handleChecklistToggle("bgChecked")}
                        className="w-full flex items-center gap-2 text-xs p-1.5 rounded hover-elevate text-left"
                        data-testid="button-checklist-bg"
                      >
                        <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                          session.preChecklist.bgChecked 
                            ? "bg-green-600 border-green-600 text-white" 
                            : "border-muted-foreground/40"
                        }`}>
                          {session.preChecklist.bgChecked && <Check className="h-3 w-3" />}
                        </div>
                        <span>{typeConfig?.checklistLabels.bg ?? "Checked blood glucose"}</span>
                      </button>
                      <button
                        onClick={() => handleChecklistToggle("carbsConsidered")}
                        className="w-full flex items-center gap-2 text-xs p-1.5 rounded hover-elevate text-left"
                        data-testid="button-checklist-carbs"
                      >
                        <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                          session.preChecklist.carbsConsidered 
                            ? "bg-green-600 border-green-600 text-white" 
                            : "border-muted-foreground/40"
                        }`}>
                          {session.preChecklist.carbsConsidered && <Check className="h-3 w-3" />}
                        </div>
                        <span>{typeConfig?.checklistLabels.carbs ?? "Considered carb loading"}</span>
                      </button>
                      {isPump && (
                        <button
                          onClick={() => handleChecklistToggle("basalAdjusted")}
                          className="w-full flex items-center gap-2 text-xs p-1.5 rounded hover-elevate text-left"
                          data-testid="button-checklist-basal"
                        >
                          <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                            session.preChecklist.basalAdjusted 
                              ? "bg-green-600 border-green-600 text-white" 
                              : "border-muted-foreground/40"
                          }`}>
                            {session.preChecklist.basalAdjusted && <Check className="h-3 w-3" />}
                          </div>
                          <span>{typeConfig?.checklistLabels.basal ?? "Adjusted basal rate"}</span>
                        </button>
                      )}
                    </div>

                    {tips.length > 0 && (
                      <div className="space-y-1 mt-2">
                        {tips.slice(0, 3).map((tip, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <Droplet className="h-3 w-3 shrink-0 mt-0.5 text-blue-500" />
                            <span>{tip}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <Button size="sm" onClick={handleStartExercise} data-testid="button-start-exercise">
                        <Play className="h-3.5 w-3.5 mr-1.5" />
                        Start Exercise
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleCancelSession} data-testid="button-cancel-exercise-session">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {session.phase === "active" && (
                  <div className="space-y-2">
                    {showMidCheck && (
                      <Card className="border-amber-300 dark:border-amber-700">
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium">Mid-exercise check</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {typeConfig?.midCheckMessage ?? "How are you feeling? Any signs of low blood sugar?"}
                              </p>
                              <div className="flex gap-2 mt-2 flex-wrap">
                                <Button size="sm" variant="outline" onClick={handleDismissMidCheck} data-testid="button-midcheck-ok">
                                  Feeling fine
                                </Button>
                                <Link href="/help-now">
                                  <Button size="sm" variant="destructive" data-testid="button-midcheck-hypo">
                                    <Zap className="h-3 w-3 mr-1" />
                                    Help Now
                                  </Button>
                                </Link>
                                <Link href="/adviser?tab=tools">
                                  <Button size="sm" variant="outline" data-testid="button-midcheck-hypo-calc">
                                    <Calculator className="h-3 w-3 mr-1" />
                                    Hypo Calc
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {typeConfig?.activeReminder && (
                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <Droplet className="h-3 w-3 shrink-0 mt-0.5 text-blue-500" />
                        <span>{typeConfig.activeReminder}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      <Button size="sm" onClick={handleFinishExercise} data-testid="button-finish-exercise">
                        <Square className="h-3.5 w-3.5 mr-1.5" />
                        Finish Exercise
                      </Button>
                      <Link href="/help-now">
                        <Button size="sm" variant="destructive" data-testid="button-hypo-during-exercise">
                          <Zap className="h-3.5 w-3.5 mr-1.5" />
                          Help Now
                        </Button>
                      </Link>
                      <Link href="/adviser?tab=tools">
                        <Button size="sm" variant="outline" data-testid="button-hypo-calc-during-exercise">
                          <Calculator className="h-3.5 w-3.5 mr-1.5" />
                          Hypo Calc
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}

                {session.phase === "recovery" && (
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 shrink-0 mt-0.5" />
                        <span>
                          {typeConfig?.recoveryMessage ?? "Recovery window active"} — {formatRemaining(recoveryRemaining)} remaining
                        </span>
                      </div>
                      {typeConfig?.delayedWarning && (session.intensity === "intense" || session.intensity === "moderate") && (
                        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5 text-amber-500" />
                          <span>{typeConfig.delayedWarning}</span>
                        </div>
                      )}
                      {isEvening && (
                        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <Heart className="h-3 w-3 shrink-0 mt-0.5 text-indigo-500" />
                          <span>Evening exercise — consider a bedtime snack to prevent overnight lows</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Button size="sm" onClick={handleEndSession} data-testid="button-end-recovery">
                        <Check className="h-3.5 w-3.5 mr-1.5" />
                        End Recovery
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleSkipRecovery} data-testid="button-skip-recovery">
                        Skip
                      </Button>
                      <Link href="/help-now">
                        <Button size="sm" variant="destructive" data-testid="button-hypo-recovery">
                          <Zap className="h-3.5 w-3.5 mr-1" />
                          Help Now
                        </Button>
                      </Link>
                      <Link href="/adviser?tab=tools">
                        <Button size="sm" variant="ghost" data-testid="button-hypo-calc-recovery">
                          <Calculator className="h-3.5 w-3.5 mr-1" />
                          Hypo Calc
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pt-0.5">
                  <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                  <span>Not medical advice — always follow your care team's guidance</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ExerciseOutcomeDialog
        open={showOutcomeDialog}
        session={endingSession}
        onClose={() => {
          setShowOutcomeDialog(false);
          setEndingSession(null);
        }}
      />
    </>
  );
}

function ExerciseOutcomeDialog({ 
  open, session, onClose 
}: { 
  open: boolean; 
  session: ActiveExerciseSession | null; 
  onClose: () => void;
}) {
  const [bgResponse, setBgResponse] = useState<ExerciseOutcome["bgResponse"]>();
  const [bgSeverity, setBgSeverity] = useState<ExerciseOutcome["bgSeverity"]>();
  const [feltHypo, setFeltHypo] = useState(false);
  const [notes, setNotes] = useState("");

  const handleSave = () => {
    if (!session) { onClose(); return; }
    storage.addExerciseOutcome({
      exerciseType: session.exerciseType,
      intensity: session.intensity,
      durationMinutes: session.durationMinutes,
      exerciseName: session.exerciseName,
      bgResponse,
      bgSeverity,
      feltHypo,
      notes: notes || undefined,
    });
    resetAndClose();
  };

  const handleSkip = () => {
    resetAndClose();
  };

  const resetAndClose = () => {
    setBgResponse(undefined);
    setBgSeverity(undefined);
    setFeltHypo(false);
    setNotes("");
    onClose();
  };

  if (!session) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleSkip(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5" />
            How did it go?
          </DialogTitle>
          <DialogDescription>
            Quick feedback on {session.exerciseName} helps build your exercise patterns. This is optional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-sm">How did your BG respond?</Label>
            <div className="flex gap-2 flex-wrap">
              {([
                { value: "dropped" as const, label: "Dropped", icon: TrendingDown, color: "text-amber-600" },
                { value: "stable" as const, label: "Stayed stable", icon: Minus, color: "text-green-600" },
                { value: "rose" as const, label: "Rose", icon: TrendingUp, color: "text-red-500" },
              ]).map(opt => (
                <Button
                  key={opt.value}
                  type="button"
                  size="sm"
                  variant={bgResponse === opt.value ? "default" : "outline"}
                  className={`toggle-elevate ${bgResponse === opt.value ? "toggle-elevated" : ""}`}
                  onClick={() => setBgResponse(bgResponse === opt.value ? undefined : opt.value)}
                  data-testid={`button-bg-${opt.value}`}
                >
                  <opt.icon className="h-3.5 w-3.5 mr-1" />
                  {opt.label}
                </Button>
              ))}
            </div>

            {bgResponse && bgResponse !== "stable" && (
              <div className="flex gap-2 ml-1">
                <Button
                  type="button"
                  size="sm"
                  variant={bgSeverity === "a_little" ? "default" : "outline"}
                  className={`toggle-elevate ${bgSeverity === "a_little" ? "toggle-elevated" : ""}`}
                  onClick={() => setBgSeverity("a_little")}
                  data-testid="button-severity-little"
                >
                  A little
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={bgSeverity === "a_lot" ? "default" : "outline"}
                  className={`toggle-elevate ${bgSeverity === "a_lot" ? "toggle-elevated" : ""}`}
                  onClick={() => setBgSeverity("a_lot")}
                  data-testid="button-severity-lot"
                >
                  A lot
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Did you experience a hypo?</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={feltHypo ? "default" : "outline"}
                className={`toggle-elevate ${feltHypo ? "toggle-elevated" : ""}`}
                onClick={() => setFeltHypo(true)}
                data-testid="button-hypo-yes"
              >
                Yes
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!feltHypo ? "default" : "outline"}
                className={`toggle-elevate ${!feltHypo ? "toggle-elevated" : ""}`}
                onClick={() => setFeltHypo(false)}
                data-testid="button-hypo-no"
              >
                No
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="outcome-notes" className="text-sm">Notes (optional)</Label>
            <Textarea
              id="outcome-notes"
              placeholder="e.g., Ate a banana before, felt good throughout..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none"
              rows={2}
              data-testid="input-outcome-notes"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleSkip} data-testid="button-skip-outcome">
            Skip
          </Button>
          <Button onClick={handleSave} data-testid="button-save-outcome">
            Save Feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
