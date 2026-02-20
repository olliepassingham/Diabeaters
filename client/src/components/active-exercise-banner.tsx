import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { 
  Dumbbell, Play, Square, Heart, ChevronDown, ChevronUp, 
  Check, Clock, AlertTriangle, TrendingDown, TrendingUp, 
  Minus, Droplet, Zap, Shield
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
  const tips: string[] = [];
  const { intensity, exerciseType } = session;

  if (intensity === "intense" || intensity === "moderate") {
    tips.push("Consider having 15-20g of fast-acting carbs if BG is below 7 mmol/L");
  }
  if (intensity === "intense") {
    tips.push("High intensity exercise may cause BG to rise initially, then drop later");
  }
  if (isPump && (intensity === "intense" || intensity === "moderate")) {
    tips.push("Consider reducing basal rate by 50% starting 60-90 minutes before exercise");
  }
  if (!isPump && (intensity === "intense" || intensity === "moderate")) {
    tips.push("If on long-acting insulin, be aware of increased hypo risk post-exercise");
  }
  if (exerciseType === "swimming") {
    tips.push("Keep fast-acting glucose at the poolside in case of a hypo");
  }
  if (session.durationMinutes >= 60) {
    tips.push("For sessions over 60 min, consider 15-30g carbs every 30-45 min");
  }
  tips.push("Keep hypo treatment within easy reach during exercise");
  return tips;
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

        const halfwayMs = session.durationMinutes * 60 * 1000 / 2;
        if (!session.midCheckDone && elapsedMs >= halfwayMs) {
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
                        <span>Checked blood glucose</span>
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
                        <span>Considered carb loading</span>
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
                          <span>Adjusted basal rate</span>
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
                              <p className="text-xs font-medium">Halfway check</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                How are you feeling? Any signs of low blood sugar?
                              </p>
                              <div className="flex gap-2 mt-2">
                                <Button size="sm" variant="outline" onClick={handleDismissMidCheck} data-testid="button-midcheck-ok">
                                  Feeling fine
                                </Button>
                                <Link href="/help-now">
                                  <Button size="sm" variant="destructive" data-testid="button-midcheck-hypo">
                                    <Zap className="h-3 w-3 mr-1" />
                                    Need help
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={handleFinishExercise} data-testid="button-finish-exercise">
                        <Square className="h-3.5 w-3.5 mr-1.5" />
                        Finish Exercise
                      </Button>
                      <Link href="/help-now">
                        <Button size="sm" variant="outline" data-testid="button-hypo-during-exercise">
                          <Zap className="h-3.5 w-3.5 mr-1.5" />
                          Hypo Help
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
                          Recovery window active — BG may continue to change for the next {formatRemaining(recoveryRemaining)}
                        </span>
                      </div>
                      {session.intensity === "intense" && (
                        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5 text-amber-500" />
                          <span>Intense exercise can cause delayed hypos for up to 24 hours</span>
                        </div>
                      )}
                      {isEvening && (
                        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <Heart className="h-3 w-3 shrink-0 mt-0.5 text-indigo-500" />
                          <span>Evening exercise — consider a bedtime snack to prevent overnight lows</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={handleEndSession} data-testid="button-end-recovery">
                        <Check className="h-3.5 w-3.5 mr-1.5" />
                        End Recovery
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleSkipRecovery} data-testid="button-skip-recovery">
                        Skip
                      </Button>
                      <Link href="/help-now">
                        <Button size="sm" variant="ghost" data-testid="button-hypo-recovery">
                          <Zap className="h-3.5 w-3.5 mr-1" />
                          Hypo
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
