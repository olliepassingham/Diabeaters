import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "wouter";
import {
  Dumbbell, Play, Square, ChevronDown, ChevronUp,
  Check, AlertTriangle, TrendingDown, TrendingUp,
  Minus, Droplet, Zap, Calculator, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  storage,
  ActiveExerciseSession,
  ExercisePhase,
  ExerciseType,
  ExerciseIntensity,
  ExerciseOutcome,
  type ExerciseBgTrend,
  DIABEATER_PROFILE_CHANGED_EVENT,
  DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT,
} from "@/lib/storage";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { usesClosedLoop } from "@/lib/closed-loop";
import { exerciseChecklistBasalLabel } from "@/lib/exercise-closed-loop";
import { getExerciseGuidanceForReading } from "@/lib/exercise-reading-guidance";
import {
  calculateExercisePlan,
  getRecoveryInsulinHeadline,
  getRecoveryEducationBulletsFromPlan,
  type ExercisePlanContext,
  type ExercisePlanResult,
} from "@/lib/exercise-plan";
import {
  getExerciseReadinessVerdict,
  getReadinessToneClasses,
  getExerciseFuelPlanLines,
} from "@/lib/exercise-readiness";
import {
  bgForPlannerFromActiveSession,
  buildExerciseScenarioPlannerHrefFromSession,
  trendForPlannerFromActiveSession,
} from "@/lib/exercise-planner-href";
import { cancelExerciseReminders, scheduleExerciseActiveReminders } from "@/lib/exercise-reminders";
import { cn } from "@/lib/utils";
import { CgmPrefillButton } from "@/components/cgm-prefill-button";
import { useBgPrefill } from "@/hooks/use-bg-prefill";
import { cgmTrendForExercise } from "@/lib/cgm/apply-cgm-trend";
import { getCgmEmptyHint } from "@/lib/cgm/cgm-empty-hint";
import { isCgmPrefillActive } from "@/lib/cgm/preferences";
import type { BgPrefillResult } from "@/lib/cgm/prefill";
import { MedicalSourcesLink } from "@/components/medical-sources-link";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { BgTrendThreeButtons } from "@/components/bg-trend-three-buttons";
import { useToast } from "@/hooks/use-toast";
import { ExerciseFuelPlanSummary, ExerciseHypoTreatmentHint, ExerciseWorkoutProgressBar } from "@/components/exercise-active-session-extras";
import { computeExerciseHypoSuggestion, resolveExerciseBgForHypo } from "@/lib/exercise-hypo-auto";

const EXERCISE_LABELS: Record<ExerciseType, string> = {
  cardio: "Cardio", strength: "Strength", hiit: "HIIT",
  yoga: "Yoga", walking: "Walking", court: "Court sports", field: "Field sports", swimming: "Swimming",
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
  court: {
    preTips: (isPump, _dur) => {
      const tips: string[] = [];
      tips.push("Court and racket sports are stop-start — BG can swing with bursts and between points");
      tips.push("Competition or tight games can raise BG briefly from adrenaline");
      if (isPump) tips.push("Basal changes are easy to overshoot — discuss a modest temp plan with your team");
      else tips.push("Keep fast glucose at the court side, not only in the clubhouse");
      tips.push("Hydrate on changeovers — dehydration skews how BG feels");
      return tips;
    },
    checklistLabels: { bg: "Checked blood glucose", carbs: "Glucose at court side", basal: "Reviewed basal plan" },
    midCheckMessage: "Changeover check — bursts can mask lows. How's your energy and focus?",
    midCheckTiming: 0.5,
    recoveryMessage: "After court sessions, delayed lows can show up once effort and adrenaline ease off",
    delayedWarning: "Interval-style court play can cause delayed hypos — keep snacks handy for hours after",
    activeReminder: "Between games, a quick BG check beats guessing if something feels off",
  },
  field: {
    preTips: (isPump, _dur) => {
      const tips: string[] = [];
      tips.push("Field and team sports have unpredictable intensity — BG can swing either way");
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
    delayedWarning: "Competitive field sports can cause delayed hypos as adrenaline fades — stay alert",
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

function computeBannerExercisePlan(session: ActiveExerciseSession, bgUnits: string): ExercisePlanResult | null {
  const bg = bgForPlannerFromActiveSession(session);
  const minutesUntilStart = session.phase === "pre" ? 60 : session.phase === "active" ? 30 : 0;
  try {
    const ctx: ExercisePlanContext = {
      exerciseType: session.exerciseType,
      durationMinutes: session.durationMinutes,
      intensity: session.intensity,
      minutesUntilStart,
      bgUnits,
      currentBg: bg ?? undefined,
      hourOfDay: new Date().getHours(),
    };
    if (session.preEnvironments?.length) ctx.environments = [...session.preEnvironments];
    return calculateExercisePlan(ctx, storage.getSettings());
  } catch {
    return null;
  }
}

function getRecoveryTypeContextLines(
  session: ActiveExerciseSession,
  typeConfig: ExerciseTypeConfig | null,
  isEvening: boolean,
): string[] {
  if (!typeConfig) return [];
  const out: string[] = [typeConfig.recoveryMessage];
  if (typeConfig.delayedWarning && (session.intensity === "intense" || session.intensity === "moderate")) {
    out.push(typeConfig.delayedWarning);
  }
  if (isEvening) {
    out.push(
      session.intensity === "intense"
        ? "Evening hard session — overnight delayed lows are more likely for some people; consider extra checks or a snack if your team agrees."
        : "Evening exercise — consider a bedtime snack to prevent overnight lows",
    );
  }
  return out;
}

function plannerHref(session: ActiveExerciseSession): string {
  return buildExerciseScenarioPlannerHrefFromSession(session, { syncActive: true });
}

function ExerciseReadingPrompt({
  bgUnits,
  title,
  description,
  onSave,
  onSkip,
  saveTestId,
  skipTestId,
  skipLabel = "Skip",
  bgPrefill,
  bgPrefillLoading,
  onRefreshBgPrefill,
}: {
  bgUnits: string;
  title: string;
  description?: string;
  onSave: (bg: number, trend: ExerciseBgTrend) => void;
  onSkip: () => void;
  saveTestId?: string;
  skipTestId?: string;
  skipLabel?: string;
  bgPrefill?: BgPrefillResult | null;
  bgPrefillLoading?: boolean;
  onRefreshBgPrefill?: () => void;
}) {
  const { toast } = useToast();
  const [raw, setRaw] = useState("");
  const [trend, setTrend] = useState<ExerciseBgTrend>("not_sure");

  const submit = () => {
    const bg = parseFloat(raw.replace(",", "."));
    if (raw.trim() === "" || Number.isNaN(bg)) {
      toast({
        title: "Enter a BG value",
        description: "Or tap Skip if you prefer not to log right now.",
        variant: "destructive",
      });
      return;
    }
    onSave(bg, trend);
    setRaw("");
    setTrend("not_sure");
  };

  return (
    <Card className="border-primary/25 bg-background/90 dark:bg-background/60">
      <CardContent className="p-3 space-y-2">
        <p className="text-xs font-medium text-foreground">{title}</p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">BG ({bgUnits})</Label>
            <Input
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              inputMode="decimal"
              className="h-9 text-sm"
              placeholder="e.g. 6.2"
              data-testid="input-exercise-reading-bg"
            />
            <CgmPrefillButton
              prefill={bgPrefill ?? null}
              loading={bgPrefillLoading}
              bgUnits={bgUnits}
              currentValue={raw}
              onApply={setRaw}
              onApplyTrend={(t) => {
                const mapped = cgmTrendForExercise(t);
                if (mapped) setTrend(mapped);
              }}
              onRefresh={onRefreshBgPrefill}
              emptyHint={isCgmPrefillActive() ? getCgmEmptyHint() : undefined}
              testId="button-exercise-cgm-prefill"
            />
          </div>
          <BgTrendThreeButtons
            label="Direction"
            labelClassName="text-[10px] uppercase tracking-wide text-muted-foreground font-normal"
            value={trend}
            onChange={(v) => setTrend(v as ExerciseBgTrend)}
            unsetValue="not_sure"
            groupTestId="select-exercise-reading-trend"
            buttonClassName="h-9 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" type="button" onClick={submit} data-testid={saveTestId}>
            Save reading
          </Button>
          <Button size="sm" type="button" variant="ghost" onClick={onSkip} data-testid={skipTestId}>
            Skip
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PlannerOpenButton({ session, compact }: { session: ActiveExerciseSession; compact?: boolean }) {
  const planner = plannerHref(session);
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(compact ? "h-8 min-h-8 shrink-0 px-2.5 text-xs" : "min-h-9")}
      asChild
      data-testid="button-full-exercise-planner"
    >
      <Link href={planner}>{compact ? "Full planner" : "Open full planner"}</Link>
    </Button>
  );
}

function ExerciseEducationDialog({
  open,
  onOpenChange,
  session,
  isPump,
  bgUnits,
  patterns,
  isEvening,
  onChecklistToggle,
  planResult,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  session: ActiveExerciseSession;
  isPump: boolean;
  bgUnits: string;
  patterns: ReturnType<typeof storage.getExercisePatterns> | null;
  isEvening: boolean;
  onChecklistToggle: (key: "bgChecked" | "carbsConsidered" | "basalAdjusted") => void;
  planResult: ExercisePlanResult | null;
}) {
  const typeConfig = getTypeConfig(session.exerciseType);
  const closedLoop = usesClosedLoop(storage.getSettings());
  const baseTips = getPreExerciseTips(session, isPump, closedLoop);
  const guidance =
    session.phase === "pre" && session.preBg != null
      ? getExerciseGuidanceForReading({
          bg: session.preBg,
          trend: session.preTrend,
          bgUnits,
          exerciseType: session.exerciseType,
          intensity: session.intensity,
          phase: "pre",
          isEvening,
        })
      : session.phase === "active" &&
          (session.midBg ?? session.preBg) != null
        ? getExerciseGuidanceForReading({
            bg: (session.midBg ?? session.preBg)!,
            trend:
              session.midBg != null ? (session.midTrend ?? session.preTrend) : session.preTrend,
            bgUnits,
            exerciseType: session.exerciseType,
            intensity: session.intensity,
            phase: "active",
            isEvening,
          })
        : session.phase === "recovery" && session.recoveryBg != null
          ? getExerciseGuidanceForReading({
              bg: session.recoveryBg,
              trend: session.recoveryTrend,
              bgUnits,
              exerciseType: session.exerciseType,
              intensity: session.intensity,
              phase: "recovery",
              isEvening,
            })
          : [];
  const recoveryPlanBullets =
    session.phase === "recovery" && planResult ? getRecoveryEducationBulletsFromPlan(planResult, isPump) : [];
  const recoveryContextLines =
    session.phase === "recovery" ? getRecoveryTypeContextLines(session, typeConfig, isEvening) : [];
  const tips = (() => {
    if (session.phase === "recovery") {
      const merged = [...guidance, ...recoveryPlanBullets, ...recoveryContextLines];
      const seen = new Set<string>();
      return merged.filter((line) => {
        const t = line.trim();
        if (!t || seen.has(t)) return false;
        seen.add(t);
        return true;
      });
    }
    return [...guidance, ...baseTips];
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto" data-testid="dialog-exercise-education">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {session.phase === "recovery" ? "Recovery guidance" : "Exercise tips"}
          </DialogTitle>
          <DialogDescription>
            {session.phase === "recovery"
              ? `${EXERCISE_LABELS[session.exerciseType]} — post-workout window; educational only; confirm with your care team.`
              : `${EXERCISE_LABELS[session.exerciseType]} — educational only; confirm with your care team.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {tips.length > 0 ? (
            <div className="space-y-2">
              {tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Droplet className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-500 dark:text-blue-400" />
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Log a BG reading in the banner for more tailored lines.</p>
          )}

          {session.phase === "pre" && (
            <div className="space-y-2 border-t pt-3">
              <p className="text-xs font-medium text-foreground">Optional checklist</p>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => onChecklistToggle("bgChecked")}
                  className="w-full flex items-center gap-2 text-xs p-1.5 rounded hover-elevate text-left"
                  data-testid="button-checklist-bg"
                >
                  <div
                    className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                      session.preChecklist.bgChecked
                        ? "bg-green-600 border-green-600 text-white"
                        : "border-muted-foreground/40"
                    }`}
                  >
                    {session.preChecklist.bgChecked && <Check className="h-3 w-3" />}
                  </div>
                  <span>{typeConfig.checklistLabels.bg}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChecklistToggle("carbsConsidered")}
                  className="w-full flex items-center gap-2 text-xs p-1.5 rounded hover-elevate text-left"
                  data-testid="button-checklist-carbs"
                >
                  <div
                    className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                      session.preChecklist.carbsConsidered
                        ? "bg-green-600 border-green-600 text-white"
                        : "border-muted-foreground/40"
                    }`}
                  >
                    {session.preChecklist.carbsConsidered && <Check className="h-3 w-3" />}
                  </div>
                  <span>{typeConfig.checklistLabels.carbs}</span>
                </button>
                {isPump && (
                  <button
                    type="button"
                    onClick={() => onChecklistToggle("basalAdjusted")}
                    className="w-full flex items-center gap-2 text-xs p-1.5 rounded hover-elevate text-left"
                    data-testid="button-checklist-basal"
                  >
                    <div
                      className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                        session.preChecklist.basalAdjusted
                          ? "bg-green-600 border-green-600 text-white"
                          : "border-muted-foreground/40"
                      }`}
                    >
                      {session.preChecklist.basalAdjusted && <Check className="h-3 w-3" />}
                    </div>
                    <span>{exerciseChecklistBasalLabel(closedLoop, typeConfig.checklistLabels.basal)}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {patterns && patterns.totalSessions > 0 && (
            <div className="flex items-start gap-2 p-2 rounded-md bg-muted/40 text-xs border-t" data-testid="text-exercise-pattern">
              {patterns.droppedCount > patterns.stableCount ? (
                <TrendingDown className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              ) : patterns.roseCount > patterns.stableCount ? (
                <TrendingUp className="h-3.5 w-3.5 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getPreExerciseTips(session: ActiveExerciseSession, isPump: boolean, closedLoop = false): string[] {
  const config = EXERCISE_TYPE_CONFIG[session.exerciseType] ?? EXERCISE_TYPE_CONFIG.cardio;
  const dur = Number.isFinite(session.durationMinutes) ? session.durationMinutes : 45;
  const tips = config.preTips(isPump, dur);
  if (!closedLoop || !isPump) return tips;
  const filtered = tips.filter((t) => !/basal|temp basal|suspend pump/i.test(t));
  if (filtered.length > 0) return filtered;
  return ["Check IOB and trend — let your loop adjust basal unless your team advises otherwise."];
}

function getTypeConfig(type: ExerciseType): ExerciseTypeConfig {
  return EXERCISE_TYPE_CONFIG[type] ?? EXERCISE_TYPE_CONFIG.cardio;
}

export function ActiveExerciseBanner() {
  const { toast } = useToast();
  const { prefill: bgPrefill, loading: bgPrefillLoading, refresh: refreshBgPrefill } = useBgPrefill();
  const cgmPrefillActive = isCgmPrefillActive();
  const [session, setSession] = useState<ActiveExerciseSession | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [preDraftBg, setPreDraftBg] = useState("");
  const [preDraftTrend, setPreDraftTrend] = useState<ExerciseBgTrend>("not_sure");
  const [elapsed, setElapsed] = useState(0);
  const [recoveryRemaining, setRecoveryRemaining] = useState(0);
  const [showMidCheck, setShowMidCheck] = useState(false);
  const [logBgOpen, setLogBgOpen] = useState(false);
  const [showOutcomeDialog, setShowOutcomeDialog] = useState(false);
  const [endingSession, setEndingSession] = useState<ActiveExerciseSession | null>(null);
  const [isPump, setIsPump] = useState(false);
  const [patterns, setPatterns] = useState<ReturnType<typeof storage.getExercisePatterns> | null>(null);
  const [bgUnits, setBgUnits] = useState("mmol/L");
  const [showExerciseTips, setShowExerciseTips] = useState(false);
  const [recoveryBgDialogOpen, setRecoveryBgDialogOpen] = useState(false);

  const { readinessResult, fuelPlanLines, exercisePlanResult } = useMemo(() => {
    if (!session) return { readinessResult: null, fuelPlanLines: [], exercisePlanResult: null };
    const scenarioState = storage.getScenarioState();
    const profile = storage.getProfile();
    let bg = bgForPlannerFromActiveSession(session);
    let trend = trendForPlannerFromActiveSession(session);
    if (session.phase === "pre" && bg == null) {
      const draft = preDraftBg.trim().replace(",", ".");
      if (draft !== "") {
        const n = parseFloat(draft);
        if (Number.isFinite(n)) bg = n;
      }
      if (preDraftTrend !== "not_sure") trend = preDraftTrend;
    }
    const planResult = computeBannerExercisePlan(session, bgUnits);
    if (!planResult) return { readinessResult: null, fuelPlanLines: [], exercisePlanResult: null };
    const readinessResult = getExerciseReadinessVerdict({
      exercisePlanResult: planResult,
      currentBg: bg,
      bgUnits,
      sickDayActive: scenarioState.sickDayActive,
      sickDaySeverity: scenarioState.sickDaySeverity,
      exerciseType: session.exerciseType,
      intensity: session.intensity,
      bgTrend: trend ?? null,
      phase: session.phase,
      preRapidInsulin2h: session.preRapidInsulin2h ?? null,
    });
    const fuelPlanLines =
      bg != null && (session.phase === "pre" || session.phase === "active" || session.phase === "recovery")
        ? getExerciseFuelPlanLines(planResult, readinessResult.verdict, profile, {
            phase: session.phase,
            exerciseType: session.exerciseType,
            currentBg: bg,
            bgUnits,
            intensity: session.intensity,
            trend: trend ?? null,
          })
        : [];
    return { readinessResult, fuelPlanLines, exercisePlanResult: planResult };
  }, [session, bgUnits, preDraftBg, preDraftTrend]);

  const loadSession = useCallback(() => {
    const profile = storage.getProfile();
    setBgUnits(profile?.bgUnits || "mmol/L");
    setIsPump(isPumpDeliveryMethod(profile?.insulinDeliveryMethod));
    const s = storage.getActiveExercise();
    setSession(s);
    if (s) {
      setPatterns(storage.getExercisePatterns(s.exerciseType, s.intensity));
    } else {
      setPatterns(null);
    }
  }, []);

  useEffect(() => {
    const onP = () => loadSession();
    window.addEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onP);
    window.addEventListener(DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT, onP);
    return () => {
      window.removeEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onP);
      window.removeEventListener(DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT, onP);
    };
  }, [loadSession]);

  useEffect(() => {
    loadSession();
    const interval = setInterval(loadSession, 2000);
    return () => clearInterval(interval);
  }, [loadSession]);

  useEffect(() => {
    if (session?.phase !== "active") setShowMidCheck(false);
  }, [session?.phase]);

  useEffect(() => {
    if (!session || session.phase !== "pre") return;
    if (session.preBg != null || session.preBgSkipped) return;
    setPreDraftBg("");
    setPreDraftTrend("not_sure");
  }, [session?.id, session?.phase, session?.preBg, session?.preBgSkipped]);

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

  const handleStartExercise = useCallback(() => {
    const s = storage.getActiveExercise();
    if (!s) return;
    if (s.phase === "pre") {
      const raw = preDraftBg.trim();
      if (raw !== "") {
        const bg = parseFloat(raw.replace(",", "."));
        if (Number.isNaN(bg)) {
          toast({
            title: "Enter a valid BG",
            description: "Or leave the field empty to start without a reading.",
            variant: "destructive",
          });
          return;
        }
        storage.updateActiveExercise({
          preBg: bg,
          preTrend: preDraftTrend,
          preBgAt: new Date().toISOString(),
          preChecklist: { ...s.preChecklist, bgChecked: true },
        });
      } else {
        storage.updateActiveExercise({ preBgSkipped: true });
      }
    }
    storage.startExercisePhase();
    const updated = storage.getActiveExercise();
    if (updated) void scheduleExerciseActiveReminders(updated);
    loadSession();
    setExpanded(true);
  }, [preDraftBg, preDraftTrend, loadSession, toast]);

  const handleFinishExercise = () => {
    storage.finishExercisePhase();
    loadSession();
    setExpanded(true);
  };

  const handleEndSession = () => {
    const existing = storage.getActiveExercise();
    if (existing) void cancelExerciseReminders(existing.id);
    const s = storage.endExerciseSession();
    if (s) {
      setEndingSession(s);
      setShowOutcomeDialog(true);
    }
    setSession(null);
  };

  const handleSkipRecovery = () => {
    const existing = storage.getActiveExercise();
    if (existing) void cancelExerciseReminders(existing.id);
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
    storage.updateActiveExercise({ midCheckDone: true, midBgSkipped: true });
    setShowMidCheck(false);
    loadSession();
  };

  const handleSaveMidReading = (bg: number, trend: ExerciseBgTrend) => {
    storage.updateActiveExercise({
      midBg: bg,
      midTrend: trend,
      midBgAt: new Date().toISOString(),
      midCheckDone: true,
      midBgSource: "manual",
    });
    setShowMidCheck(false);
    loadSession();
  };

  const handleSaveRecoveryReading = (bg: number, trend: ExerciseBgTrend) => {
    storage.updateActiveExercise({
      recoveryBg: bg,
      recoveryTrend: trend,
      recoveryBgAt: new Date().toISOString(),
    });
    setRecoveryBgDialogOpen(false);
    loadSession();
  };

  const handleSkipRecoveryReading = () => {
    storage.updateActiveExercise({ recoveryBgSkipped: true });
    setRecoveryBgDialogOpen(false);
    loadSession();
  };

  const handleCancelSession = () => {
    const existing = storage.getActiveExercise();
    if (existing) void cancelExerciseReminders(existing.id);
    storage.endExerciseSession({ abandon: true });
    setSession(null);
  };

  const isEvening = new Date().getHours() >= 18;

  const nowMsActive =
    session?.phase === "active" && session.exerciseStartedAt
      ? new Date(session.exerciseStartedAt).getTime() + elapsed
      : Date.now();

  const hypoSuggestionBanner = useMemo(() => {
    if (!session) return null;
    const settings = storage.getSettings();
    const profile = storage.getProfile();
    const draft = session.phase === "pre" ? preDraftBg : undefined;
    const bg = resolveExerciseBgForHypo(session, draft);
    if (bg == null) return null;
    const units = (profile?.bgUnits === "mg/dL" ? "mg/dL" : "mmol/L") as "mmol/L" | "mg/dL";
    const planResult = computeBannerExercisePlan(session, units);
    const trend = trendForPlannerFromActiveSession(session);
    const effectiveTrend =
      session.phase === "pre" && preDraftTrend !== "not_sure" ? preDraftTrend : trend;
    return computeExerciseHypoSuggestion(bg, settings, units, profile ?? {}, {
      trend: effectiveTrend,
      phase: session.phase,
      exerciseLowThreshold: planResult ? parseFloat(planResult.pre.lowThreshold) : undefined,
      carbsIfLow: planResult?.pre.carbsIfLow,
    });
  }, [session, preDraftBg, preDraftTrend]);

  const activeEffectiveBg = session?.phase === "active" ? session.midBg ?? session.preBg : null;
  const activeEffectiveTrend =
    session?.phase === "active"
      ? session.midBg != null
        ? session.midTrend ?? session.preTrend
        : session.preTrend
      : undefined;
  const activeGuidance =
    session && session.phase === "active" && activeEffectiveBg != null
      ? getExerciseGuidanceForReading({
          bg: activeEffectiveBg,
          trend: activeEffectiveTrend,
          bgUnits,
          exerciseType: session.exerciseType,
          intensity: session.intensity,
          phase: "active",
          isEvening,
        })
      : [];

  const typeConfig = session ? getTypeConfig(session.exerciseType) : null;
  const recoveryInsulinHeadline =
    session?.phase === "recovery" && exercisePlanResult
      ? getRecoveryInsulinHeadline(exercisePlanResult, isPump, isEvening)
      : null;

  if (!session && !showOutcomeDialog) return null;

  return (
    <>
      {session && (
        <div
          className={cn(
            "relative z-[40] shrink-0 border-b-2 transition-colors",
            PHASE_COLORS[session.phase],
            session.phase === "pre" && "rounded-b-xl shadow-md",
          )}
          data-testid="banner-active-exercise"
        >
          <div className={cn("px-3", session.phase === "pre" ? "py-1.5" : "py-2")}>
            {session.phase === "pre" ? (
              <div className="flex w-full items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="rounded-md bg-background/60 p-1">
                    <Dumbbell className="h-3.5 w-3.5 text-foreground" />
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="truncate text-xs font-medium sm:text-sm">{session.exerciseName}</span>
                    <Badge className={`px-1.5 py-0 text-[10px] ${PHASE_BADGE_STYLES[session.phase]}`}>
                      {PHASE_LABELS[session.phase]}
                    </Badge>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="flex w-full items-center justify-between gap-2"
                data-testid="button-toggle-exercise-banner"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <div className="rounded-md bg-background/60 p-1.5">
                    <Dumbbell className="h-4 w-4 text-foreground" />
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">{session.exerciseName}</span>
                    <Badge className={`px-1.5 py-0 text-[10px] ${PHASE_BADGE_STYLES[session.phase]}`}>
                      {PHASE_LABELS[session.phase]}
                    </Badge>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {session.phase === "active" && (
                    <span className="font-mono text-sm font-medium tabular-nums" data-testid="text-exercise-timer">
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
            )}

            {session.phase === "active" && session.exerciseStartedAt ? (
              <div className="mt-2 space-y-2">
                <ExerciseWorkoutProgressBar
                  phase={session.phase}
                  exerciseStartedAt={session.exerciseStartedAt}
                  durationMinutes={session.durationMinutes}
                  nowMs={nowMsActive}
                  compact
                />
                <ExerciseHypoTreatmentHint suggestion={hypoSuggestionBanner} />
              </div>
            ) : hypoSuggestionBanner ? (
              <div className="mt-2">
                <ExerciseHypoTreatmentHint suggestion={hypoSuggestionBanner} />
              </div>
            ) : null}

            {(session.phase === "pre" || expanded) && (
              <div
                className={cn(
                  session.phase === "pre" ? "space-y-2 pb-1 pt-2" : "mt-3 space-y-3 pb-1 animate-fade-in-up",
                )}
              >
                {session.phase !== "pre" ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{EXERCISE_LABELS[session.exerciseType]}</span>
                    <span>·</span>
                    <span>{session.durationMinutes} min</span>
                    <span>·</span>
                    <Badge variant="outline" className={`text-[10px] ${INTENSITY_COLORS[session.intensity]}`}>
                      {session.intensity}
                    </Badge>
                  </div>
                ) : null}

                {readinessResult && session.phase === "active" ? (
                  <div
                    className={`rounded-md border px-2.5 py-2 text-xs ${getReadinessToneClasses(readinessResult.verdict)}`}
                    data-testid="exercise-readiness-verdict"
                  >
                    <p className="font-semibold text-foreground">{readinessResult.title}</p>
                    <p className="mt-0.5 leading-snug text-muted-foreground">{readinessResult.detail}</p>
                    {fuelPlanLines.length > 0 ? (
                      <ExerciseFuelPlanSummary lines={fuelPlanLines} variant="active" className="mt-2" />
                    ) : null}
                  </div>
                ) : null}

                {readinessResult && session.phase === "recovery" ? (
                  <div
                    className={`rounded-md border px-2.5 py-2 text-xs ${getReadinessToneClasses(readinessResult.verdict)}`}
                    data-testid="exercise-readiness-verdict-recovery"
                  >
                    <p className="font-semibold text-foreground">{readinessResult.title}</p>
                    <p className="mt-0.5 leading-snug text-muted-foreground">{readinessResult.detail}</p>
                    {fuelPlanLines.length > 0 ? (
                      <ExerciseFuelPlanSummary lines={fuelPlanLines} variant="recovery" className="mt-2" />
                    ) : null}
                  </div>
                ) : null}

                {readinessResult && session.phase === "pre" && fuelPlanLines.length > 0 ? (
                  <ExerciseFuelPlanSummary lines={fuelPlanLines} variant="pre" />
                ) : null}

                {session.phase === "pre" && (
                  <div className="space-y-2">
                    {session.preBg == null && !session.preBgSkipped ? (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-foreground">Current BG (optional)</p>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                            BG ({bgUnits})
                          </Label>
                          <Input
                            value={preDraftBg}
                            onChange={(e) => setPreDraftBg(e.target.value)}
                            inputMode="decimal"
                            className="h-9 max-w-[11rem] text-sm"
                            placeholder="e.g. 6.2"
                            data-testid="input-pre-exercise-bg"
                          />
                          <CgmPrefillButton
                            prefill={bgPrefill}
                            loading={bgPrefillLoading}
                            bgUnits={bgUnits}
                            currentValue={preDraftBg}
                            onApply={setPreDraftBg}
                            onApplyTrend={(t) => {
                              const mapped = cgmTrendForExercise(t);
                              if (mapped) setPreDraftTrend(mapped);
                            }}
                            onRefresh={refreshBgPrefill}
                            emptyHint={cgmPrefillActive ? getCgmEmptyHint() : undefined}
                            testId="button-pre-exercise-cgm-prefill"
                          />
                        </div>
                        <BgTrendThreeButtons
                          label="Direction"
                          labelClassName="text-[10px] font-normal uppercase tracking-wide text-muted-foreground"
                          value={preDraftTrend}
                          onChange={(v) => setPreDraftTrend(v as ExerciseBgTrend)}
                          unsetValue="not_sure"
                          groupTestId="select-exercise-reading-trend"
                          buttonClassName="h-9 text-sm"
                        />
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <Button size="sm" onClick={handleStartExercise} data-testid="button-start-exercise">
                        <Play className="mr-1.5 h-3.5 w-3.5" />
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
                        <CardContent className="p-3 space-y-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium">Mid-exercise check</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {typeConfig?.midCheckMessage ?? "Quick check-in — how are you feeling?"}
                              </p>
                            </div>
                          </div>
                          <ExerciseReadingPrompt
                            bgUnits={bgUnits}
                            title="Log BG (optional)"
                            description="CGM trend or your best guess — refines tips for the rest of this session."
                            onSave={handleSaveMidReading}
                            onSkip={handleDismissMidCheck}
                            saveTestId="button-save-mid-reading"
                            skipTestId="button-skip-mid-reading"
                            skipLabel="Not now"
                            bgPrefill={bgPrefill}
                            bgPrefillLoading={bgPrefillLoading}
                            onRefreshBgPrefill={refreshBgPrefill}
                          />
                          <div className="flex gap-2 flex-wrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleDismissMidCheck}
                              data-testid="button-midcheck-not-now"
                            >
                              Not now
                            </Button>
                            <Link href="/help-now">
                              <Button size="sm" variant="destructive" data-testid="button-midcheck-help-now">
                                <Zap className="h-3 w-3 mr-1" />
                                Help Now
                              </Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {activeEffectiveBg != null ? (
                        <span
                          className="rounded-full border border-border/60 bg-background/60 px-2 py-1"
                          data-testid="text-active-bg-summary"
                        >
                          BG {activeEffectiveBg} {bgUnits}
                          {activeEffectiveTrend && activeEffectiveTrend !== "not_sure"
                            ? ` · ${activeEffectiveTrend}`
                            : ""}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Log BG to personalize tips.</span>
                      )}
                      {typeConfig?.activeReminder ? (
                        <span className="rounded-full border border-border/60 bg-background/60 px-2 py-1">
                          {typeConfig.activeReminder}
                        </span>
                      ) : null}
                    </div>

                    {activeGuidance.length > 0 ? (
                      <details className="rounded-lg border border-border/60 bg-background/40 px-3 py-2">
                        <summary className="cursor-pointer select-none text-xs font-medium text-foreground">
                          More tips ({activeGuidance.length})
                        </summary>
                        <div className="space-y-1 pt-2">
                          {activeGuidance.map((line, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                              <Droplet className="h-3 w-3 shrink-0 mt-0.5 text-amber-600 dark:text-amber-500" />
                              <span>{line}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}

                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (showMidCheck) return;
                            setLogBgOpen(true);
                          }}
                          disabled={showMidCheck}
                          data-testid="button-log-bg-active"
                        >
                          <Droplet className="h-3.5 w-3.5 mr-1.5" />
                          Log BG
                        </Button>
                        <Button size="sm" onClick={handleFinishExercise} data-testid="button-finish-exercise">
                          <Square className="h-3.5 w-3.5 mr-1.5" />
                          Finish Exercise
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href="/help-now">
                          <Button size="sm" variant="destructive" data-testid="button-help-now-active">
                            <Zap className="h-3.5 w-3.5 mr-1.5" />
                            Help Now
                          </Button>
                        </Link>
                        <Link href="/tools/hypo-help">
                          <Button size="sm" variant="outline" data-testid="button-hypo-calc-active">
                            <Calculator className="h-3.5 w-3.5 mr-1.5" />
                            Hypo Calc
                          </Button>
                        </Link>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 px-2 text-xs"
                          onClick={() => setShowExerciseTips(true)}
                          data-testid="button-exercise-tips-active"
                        >
                          <BookOpen className="mr-1 h-3 w-3 shrink-0" />
                          Tips
                        </Button>
                        <PlannerOpenButton session={session} compact />
                      </div>
                    </div>
                  </div>
                )}

                {session.phase === "recovery" && (
                  <div className="space-y-2">
                    {recoveryInsulinHeadline ? (
                      <p
                        className="text-xs leading-snug text-muted-foreground"
                        data-testid="text-recovery-insulin-headline"
                      >
                        {recoveryInsulinHeadline}
                      </p>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-1.5">
                      {session.recoveryBg == null && !session.recoveryBgSkipped ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0 px-2.5 text-xs"
                          onClick={() => setRecoveryBgDialogOpen(true)}
                          data-testid="button-log-recovery-bg"
                        >
                          Log post-workout BG
                        </Button>
                      ) : session.recoveryBg != null ? (
                        <span className="text-xs text-muted-foreground" data-testid="text-recovery-bg-logged">
                          Logged {session.recoveryBg} {bgUnits}
                          {session.recoveryTrend && session.recoveryTrend !== "not_sure"
                            ? ` · ${session.recoveryTrend}`
                            : ""}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Post-workout BG skipped</span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8 shrink-0 px-2.5 text-xs"
                        onClick={() => setShowExerciseTips(true)}
                        data-testid="button-exercise-tips-recovery"
                      >
                        <BookOpen className="mr-1 h-3 w-3 shrink-0" />
                        Recovery guide
                      </Button>
                      <PlannerOpenButton session={session} compact />
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
                      <Link href="/tools/hypo-help">
                        <Button size="sm" variant="ghost" data-testid="button-hypo-calc-recovery">
                          <Calculator className="h-3.5 w-3.5 mr-1" />
                          Hypo Calc
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}

                {session.phase !== "pre" ? (
                  <div className="flex items-center gap-1.5 pt-0.5 text-[10px] text-muted-foreground">
                    <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                    <span>Not medical advice — always follow your care team&apos;s guidance</span>
                  </div>
                ) : null}

                {session.phase !== "pre" ? <MedicalSourcesLink anchor="exercise" className="pt-1" compact /> : null}
              </div>
            )}
          </div>
        </div>
      )}

      {session && (
        <ExerciseEducationDialog
          open={showExerciseTips}
          onOpenChange={setShowExerciseTips}
          session={session}
          isPump={isPump}
          bgUnits={bgUnits}
          patterns={patterns}
          isEvening={isEvening}
          onChecklistToggle={handleChecklistToggle}
          planResult={exercisePlanResult}
        />
      )}

      {session?.phase === "active" ? (
        <Dialog open={logBgOpen} onOpenChange={setLogBgOpen}>
          <DialogContent className="max-w-md" data-testid="dialog-active-log-bg">
            <DialogHeader>
              <DialogTitle>Log BG</DialogTitle>
              <DialogDescription>
                Optional mid-exercise reading — helps tailor tips for the rest of this session.
              </DialogDescription>
            </DialogHeader>
            <ExerciseReadingPrompt
              bgUnits={bgUnits}
              title="Mid-exercise BG"
              description={undefined}
              onSave={handleSaveMidReading}
              onSkip={() => setLogBgOpen(false)}
              saveTestId="button-save-mid-reading-dialog"
              skipTestId="button-skip-mid-reading-dialog"
              skipLabel="Cancel"
              bgPrefill={bgPrefill}
              bgPrefillLoading={bgPrefillLoading}
              onRefreshBgPrefill={refreshBgPrefill}
            />
          </DialogContent>
        </Dialog>
      ) : null}

      {session?.phase === "recovery" ? (
        <Dialog open={recoveryBgDialogOpen} onOpenChange={setRecoveryBgDialogOpen}>
          <DialogContent className="max-w-md" data-testid="dialog-recovery-bg">
            <DialogHeader>
              <DialogTitle>Post-workout BG</DialogTitle>
              <DialogDescription>Optional reading — delayed lows are common after exercise; helps tailor recovery notes.</DialogDescription>
            </DialogHeader>
            <ExerciseReadingPrompt
              bgUnits={bgUnits}
              title="Recovery check-in"
              description={undefined}
              onSave={handleSaveRecoveryReading}
              onSkip={handleSkipRecoveryReading}
              saveTestId="button-save-recovery-reading"
              skipTestId="button-skip-recovery-reading"
              bgPrefill={bgPrefill}
              bgPrefillLoading={bgPrefillLoading}
              onRefreshBgPrefill={refreshBgPrefill}
            />
          </DialogContent>
        </Dialog>
      ) : null}

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
    const updated = storage.saveExerciseOutcomeFeedback(session.id, {
      bgResponse,
      bgSeverity,
      feltHypo,
      notes: notes || undefined,
    });
    if (!updated) {
      storage.addExerciseOutcome({
        sessionId: session.id,
        exerciseType: session.exerciseType,
        intensity: session.intensity,
        durationMinutes: session.durationMinutes,
        exerciseName: session.exerciseName,
        bgResponse,
        bgSeverity,
        feltHypo,
        notes: notes || undefined,
        duringTravel: storage.getScenarioState().travelModeActive ? true : undefined,
      });
    }
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
          {session.preBg != null && (
            <p className="text-sm text-muted-foreground" data-testid="text-outcome-pre-bg">
              Pre-exercise BG logged: {session.preBg}{" "}
              {storage.getProfile()?.bgUnits ?? "mmol/L"}
              {session.preTrend && session.preTrend !== "not_sure" ? ` (${session.preTrend})` : ""}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-sm">How did your BG respond?</Label>
            <div className="flex gap-2 flex-wrap">
              {([
                { value: "dropped" as const, label: "Dropped", icon: TrendingDown, color: "text-amber-600 dark:text-amber-400" },
                { value: "stable" as const, label: "Stayed stable", icon: Minus, color: "text-green-600 dark:text-green-400" },
                { value: "rose" as const, label: "Rose", icon: TrendingUp, color: "text-red-500 dark:text-red-400" },
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

        <DialogFooter className="gap-2 flex justify-end">
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
