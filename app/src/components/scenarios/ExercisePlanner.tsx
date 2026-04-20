import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useSearch } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MedicalSourcesLink } from "@/components/medical-sources-link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dumbbell,
  AlertCircle,
  Thermometer,
  Clock,
  X,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  Pencil,
  Utensils,
  Calculator,
  Minus,
  TrendingDown,
  TrendingUp,
  Play,
} from "lucide-react";
import { storage, type UserProfile, type ExerciseIntensity, type ExerciseBgTrend, type ExerciseType } from "@/lib/storage";
import {
  calculateExercisePlan,
  type ExercisePlanResult,
  type LastInsulinTiming,
  type ExercisePlanContext,
} from "@/lib/exercise-plan";
import {
  activeSessionMatchesPlannerQuery,
  adviserMealExerciseHref,
  bgForPlannerFromActiveSession,
  trendForPlannerFromActiveSession,
  normalizePlannerExerciseTypeQueryParam,
  resultTabForExercisePhase,
} from "@/lib/exercise-planner-href";
import { getExerciseReadinessVerdict, type ExerciseReadinessResult } from "@/lib/exercise-readiness";
import {
  comparePlannedBolusToPreview,
  getExerciseMealBolusPreview,
  parseOptionalBolusUnits,
  plannedBolusCompareMessage,
  type MealDoseResult,
} from "@/lib/meal-dose";
import { FieldLabelWithInfo, InlineInfoHint } from "@/components/ui/field-label-with-info";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { buildExercisePersonalizationLines } from "@/lib/exercise-personalization";

type MealTypeForBolus = "snack" | "breakfast" | "lunch" | "dinner";

const ALLOWED_EXERCISE_TYPES = new Set([
  "cardio",
  "strength",
  "hiit",
  "yoga",
  "walking",
  "court",
  "field",
  "swimming",
]);

const exerciseLabelsMap: Record<string, string> = {
  cardio: "Cardio",
  strength: "Strength",
  hiit: "HIIT",
  yoga: "Yoga/Pilates",
  walking: "Walking",
  court: "Court & racket sports",
  field: "Field & team sports",
  swimming: "Swimming",
};

function formatSessionStartingLabel(sessionTimingFromNow: string): string {
  const m = parseInt(sessionTimingFromNow, 10);
  if (Number.isNaN(m)) return "starting soon";
  if (m < 60) return `starts in ${m} min`;
  if (m === 60) return "starts in 1 h";
  if (m === 90) return "starts in 1.5 h";
  if (m === 120) return "starts in 2 h";
  if (m === 180) return "starts in 3 h";
  return `starts in ${Math.round(m / 60)} h`;
}

export function ExercisePlanner() {
  const search = useSearch();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [scenarioState, setScenarioState] = useState(() => storage.getScenarioState());

  const [exerciseType, setExerciseType] = useState("cardio");
  const [exerciseDuration, setExerciseDuration] = useState("");
  const [exerciseIntensity, setExerciseIntensity] = useState("moderate");
  const [sessionTimingFromNow, setSessionTimingFromNow] = useState("60");

  const [exerciseResult, setExerciseResult] = useState<ExercisePlanResult | null>(null);
  const [approxCarbs, setApproxCarbs] = useState("");
  const [lastInsulinTiming, setLastInsulinTiming] = useState<LastInsulinTiming | "">("");
  const [currentBgInput, setCurrentBgInput] = useState("");
  const [exerciseBgTrend, setExerciseBgTrend] = useState<ExerciseBgTrend>("not_sure");
  const [mealTypeForBolus, setMealTypeForBolus] = useState<MealTypeForBolus>("snack");
  const [mealBolusPreview, setMealBolusPreview] = useState<MealDoseResult | null>(null);
  const [mealBolusNoRatios, setMealBolusNoRatios] = useState(false);
  const [plannedBolusUnitsInput, setPlannedBolusUnitsInput] = useState("");
  const [lastBolusUnitsInput, setLastBolusUnitsInput] = useState("");
  const [resultTab, setResultTab] = useState("before");
  /** When false and a plan exists, planner form is collapsed to a summary row. */
  const [plannerInputsOpen, setPlannerInputsOpen] = useState(true);

  const exerciseResultCardRef = useRef<HTMLDivElement>(null);
  const plannerCardRef = useRef<HTMLDivElement>(null);

  const bgUnits = profile.bgUnits || "mmol/L";

  useEffect(() => {
    if (lastInsulinTiming === "" || lastInsulinTiming === "none") {
      setLastBolusUnitsInput("");
    }
  }, [lastInsulinTiming]);

  useEffect(() => {
    const p = storage.getProfile();
    if (p) setProfile(p);
    setScenarioState(storage.getScenarioState());
  }, []);

  useEffect(() => {
    const q = search.startsWith("?") ? search.slice(1) : search;
    const params = new URLSearchParams(q);
    const type = params.get("type");
    const duration = params.get("duration");
    const intensity = params.get("intensity");
    const sync = params.get("sync");
    const phaseParam = params.get("phase");
    const routineId = params.get("routineId");

    const normalizedType = normalizePlannerExerciseTypeQueryParam(type);
    if (normalizedType && ALLOWED_EXERCISE_TYPES.has(normalizedType)) setExerciseType(normalizedType);
    if (duration && /^\d{1,3}$/.test(duration)) {
      const d = parseInt(duration, 10);
      if (d >= 1 && d <= 300) setExerciseDuration(duration);
    }
    if (intensity === "light" || intensity === "moderate" || intensity === "intense") {
      setExerciseIntensity(intensity);
    }

    const tab = resultTabForExercisePhase(phaseParam);
    if (tab) setResultTab(tab);

    if (sync === "active" && type && duration && intensity) {
      const active = storage.getActiveExercise();
      if (
        active &&
        activeSessionMatchesPlannerQuery(active, type, duration, intensity, routineId)
      ) {
        const bg = bgForPlannerFromActiveSession(active);
        if (bg != null) {
          setCurrentBgInput(String(bg));
        }
        const trend = trendForPlannerFromActiveSession(active);
        if (trend) {
          setExerciseBgTrend(trend);
        }
      }
    }
  }, [search]);

  const handleQuickExercisePlan = () => {
    const duration = parseInt(exerciseDuration, 10);
    if (!exerciseDuration || Number.isNaN(duration) || duration < 1) return;
    const freshSettings = storage.getSettings();
    const minutesUntilStart = parseInt(sessionTimingFromNow, 10);
    const ctx: ExercisePlanContext = {
      exerciseType,
      durationMinutes: duration,
      intensity: exerciseIntensity as "light" | "moderate" | "intense",
      minutesUntilStart: Number.isNaN(minutesUntilStart) ? 60 : minutesUntilStart,
      bgUnits,
      hourOfDay: new Date().getHours(),
    };
    if (lastInsulinTiming) ctx.lastInsulinTiming = lastInsulinTiming;
    const carbsParsed = parseInt(approxCarbs, 10);
    if (approxCarbs.trim() !== "" && !Number.isNaN(carbsParsed) && carbsParsed >= 0) {
      ctx.approximateCarbsGrams = carbsParsed;
    }
    const bgParsed = parseFloat(currentBgInput.replace(",", "."));
    if (currentBgInput.trim() !== "" && !Number.isNaN(bgParsed)) {
      ctx.currentBg = bgParsed;
    }
    if (exerciseBgTrend !== "not_sure") {
      ctx.bgTrend = exerciseBgTrend;
    }
    const result = calculateExercisePlan(ctx, freshSettings);
    setExerciseResult(result);
    setResultTab("before");

    const carbN = parseInt(approxCarbs, 10);
    if (approxCarbs.trim() !== "" && !Number.isNaN(carbN) && carbN > 0) {
      const preview = getExerciseMealBolusPreview(carbN, mealTypeForBolus, freshSettings, bgUnits, ctx.minutesUntilStart);
      if (preview.error === "no_ratios") {
        setMealBolusPreview(null);
        setMealBolusNoRatios(true);
      } else {
        setMealBolusPreview(preview);
        setMealBolusNoRatios(false);
      }
    } else {
      setMealBolusPreview(null);
      setMealBolusNoRatios(false);
    }
    const message = `${exerciseIntensity} ${exerciseType} for ${exerciseDuration} minutes`;
    const plannedParsed = parseOptionalBolusUnits(plannedBolusUnitsInput);
    const lastParsed = parseOptionalBolusUnits(lastBolusUnitsInput);
    const ctxLog = {
      lastInsulin: lastInsulinTiming || undefined,
      carbs: ctx.approximateCarbsGrams,
      bg: ctx.currentBg,
      bgTrend: ctx.bgTrend,
      minutesUntilStart: ctx.minutesUntilStart,
      mealTypeForBolus,
      plannedBolusUnits: plannedParsed ?? undefined,
      lastBolusUnits: lastParsed ?? undefined,
    };
    try {
      storage.addActivityLog({
        activityType: "exercise_planning",
        activityDetails: `${message} | ${JSON.stringify(ctxLog)}`,
        recommendation: result.summary,
      });
    } catch {
      /* ignore */
    }
    setPlannerInputsOpen(false);
  };

  const handleEditPlannedSession = () => {
    setPlannerInputsOpen(true);
    requestAnimationFrame(() => {
      plannerCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleStartExerciseMode = () => {
    try {
      const existing = storage.getActiveExercise?.();
      if (existing) {
        toast({
          title: "Exercise already active",
          description: `You have "${existing.exerciseName}" in progress. Finish it first.`,
          variant: "destructive",
        });
        return;
      }

      const duration = parseInt(exerciseDuration, 10);
      if (!exerciseDuration || Number.isNaN(duration) || duration < 1) return;

      const exerciseName = `${exerciseLabelsMap[exerciseType] || "Exercise"} · ${exerciseIntensity} · ${duration} min`;
      storage.startExerciseSession({
        exerciseName,
        exerciseType: exerciseType as ExerciseType,
        intensity: exerciseIntensity as ExerciseIntensity,
        durationMinutes: duration,
      });

      // Update local state so any downstream "sync=active" flows stay aligned.
      setScenarioState(storage.getScenarioState());
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast({
        title: "Exercise mode started",
        description: `${exerciseName} — use the banner for BG, readiness, and tips.`,
      });
    } catch {
      toast({
        title: "Something went wrong",
        description: "Could not start exercise mode.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (!exerciseResult) return;
    const id = requestAnimationFrame(() => {
      exerciseResultCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, [exerciseResult]);

  const minutesUntilStartParsed = parseInt(sessionTimingFromNow, 10);
  const minutesUntilStart = Number.isNaN(minutesUntilStartParsed) ? 60 : Math.max(0, minutesUntilStartParsed);
  const hoursUntilStart = Math.max(1, Math.ceil(minutesUntilStart / 60));

  const mealBolusPreviewPersonalized =
    mealBolusPreview &&
    mealBolusPreview.exerciseContext === "before" &&
    typeof mealBolusPreview.exerciseReduction === "number" &&
    mealBolusPreview.standardDose !== undefined;

  const plannedBolusCompare =
    mealBolusPreviewPersonalized && mealBolusPreview
      ? comparePlannedBolusToPreview(plannedBolusUnitsInput, mealBolusPreview.dose)
      : null;
  const lastBolusUnitsParsed = parseOptionalBolusUnits(lastBolusUnitsInput);

  const adviserHref = (timing: "before" | "after" | "during") =>
    adviserMealExerciseHref(timing, hoursUntilStart);

  const plannerSummaryLine = `${exerciseLabelsMap[exerciseType] ?? exerciseType} · ${exerciseDuration || "—"} min · ${exerciseIntensity} · ${formatSessionStartingLabel(sessionTimingFromNow)}`;

  const verdictForResult = (): ExerciseReadinessResult =>
    getExerciseReadinessVerdict({
      exercisePlanResult: exerciseResult,
      currentBgInput,
      bgUnits,
      sickDayActive: scenarioState.sickDayActive,
      sickDaySeverity: scenarioState.sickDaySeverity,
      exerciseType,
      intensity: exerciseIntensity as ExerciseIntensity,
      phase: "pre",
      bgTrend: exerciseBgTrend,
    });

  const bgTrendLabel = (t: ExerciseBgTrend): string | null => {
    if (t === "not_sure") return null;
    if (t === "flat") return "Stable";
    if (t === "rising") return "Rising";
    return "Falling";
  };

  const plannerCompactExtras = (() => {
    const parts: string[] = [];
    if (currentBgInput.trim() !== "") {
      const t = bgTrendLabel(exerciseBgTrend);
      parts.push(t ? `BG ${currentBgInput} ${bgUnits} (${t})` : `BG ${currentBgInput} ${bgUnits}`);
    }
    const c = parseInt(approxCarbs, 10);
    if (approxCarbs.trim() !== "" && !Number.isNaN(c) && c > 0) {
      parts.push(`~${c}g carbs`);
    }
    return parts.length ? parts.join(" · ") : null;
  })();

  const exercisePersonalizationLines = useMemo(() => {
    if (!exerciseResult) return [];
    const duration = parseInt(exerciseDuration, 10);
    if (!exerciseDuration || Number.isNaN(duration) || duration < 1) return [];

    let outcomes: ReturnType<typeof storage.getExerciseOutcomes> = [];
    let hypos: ReturnType<typeof storage.getHypoTreatments> = [];
    let logs: ReturnType<typeof storage.getActivityLogs> = [];
    try {
      outcomes = storage.getExerciseOutcomes();
    } catch {
      outcomes = [];
    }
    try {
      hypos = storage.getHypoTreatments();
    } catch {
      hypos = [];
    }
    try {
      logs = storage.getActivityLogs();
    } catch {
      logs = [];
    }

    return buildExercisePersonalizationLines({
      exerciseType,
      intensity: exerciseIntensity as ExerciseIntensity,
      durationMinutes: duration,
      outcomes,
      hypoTreatments: hypos,
      activityLogs: logs,
    });
  }, [exerciseResult, exerciseType, exerciseIntensity, exerciseDuration]);

  return (
    <div className="space-y-4">
      {scenarioState.sickDayActive && (
        <div className="p-3 rounded-lg border" data-testid="exercise-warning-sick-day">
          {scenarioState.sickDaySeverity === "severe" ? (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <p className="text-small text-red-800 dark:text-red-200">
                <strong>Exercise is generally not recommended during severe illness.</strong> Focus on rest and monitoring.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 p-3 rounded-lg">
              <Thermometer className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-small text-amber-800 dark:text-amber-200">
                <strong>Exercise during illness:</strong> Take extra care when exercising while unwell. Consider lighter activities and monitor closely.
              </p>
            </div>
          )}
        </div>
      )}

      <Card ref={plannerCardRef} className="rounded-xl shadow-sm border-border/80">
        {exerciseResult && !plannerInputsOpen ? (
          <CardContent className="py-3 px-4" data-testid="planner-inputs-summary">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <Dumbbell className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-xs font-medium text-muted-foreground">Planned session</p>
                  <p className="text-sm text-foreground leading-snug">{plannerSummaryLine}</p>
                  {plannerCompactExtras ? (
                    <p className="text-xs text-muted-foreground leading-snug">{plannerCompactExtras}</p>
                  ) : null}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-9 shrink-0"
                onClick={handleEditPlannedSession}
                data-testid="button-edit-planned-session"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          </CardContent>
        ) : (
          <>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-h3 flex items-center gap-2 text-foreground">
                    <Dumbbell className="h-6 w-6 text-primary" />
                    Exercise planner
                  </CardTitle>
                  <CardDescription>
                    Set your session, then open Food &amp; insulin if you want carb or bolus estimates.
                  </CardDescription>
                </div>
                <PageInfoDialog title="How this planner works" description="What you see and what is optional">
                  <InfoSection title="Your plan">
                    <p>
                      After you tap Plan my workout, you get phase-by-phase tips (prep, during, after, and next hours). Not
                      medical advice — confirm changes with your care team.
                    </p>
                  </InfoSection>
                  <InfoSection title="Food &amp; insulin (optional)">
                    <p>
                      Expand that section to add BG, carbs, meal type, and optional bolus fields for a preview aligned with
                      the Meal Adviser logic. Skip it if you only want general workout guidance.
                    </p>
                  </InfoSection>
                </PageInfoDialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="exercise-type">Type of exercise</Label>
              <Select value={exerciseType} onValueChange={setExerciseType}>
                <SelectTrigger id="exercise-type" data-testid="select-exercise-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cardio">Cardio (running, cycling)</SelectItem>
                  <SelectItem value="strength">Strength training</SelectItem>
                  <SelectItem value="hiit">HIIT</SelectItem>
                  <SelectItem value="yoga">Yoga / stretching</SelectItem>
                  <SelectItem value="walking">Walking</SelectItem>
                  <SelectItem value="court">Court & racket (e.g. tennis)</SelectItem>
                  <SelectItem value="field">Field & team (e.g. football)</SelectItem>
                  <SelectItem value="swimming">Swimming</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exercise-duration">Duration</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="exercise-duration"
                  type="number"
                  placeholder="e.g., 45"
                  value={exerciseDuration}
                  onChange={(e) => setExerciseDuration(e.target.value)}
                  data-testid="input-exercise-duration"
                />
                <span className="text-small text-muted-foreground">mins</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="exercise-intensity">Intensity</Label>
              <Select value={exerciseIntensity} onValueChange={setExerciseIntensity}>
                <SelectTrigger id="exercise-intensity" data-testid="select-exercise-intensity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="intense">Intense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exercise-timing">Starting in…</Label>
              <Select value={sessionTimingFromNow} onValueChange={setSessionTimingFromNow}>
                <SelectTrigger id="exercise-timing" data-testid="select-exercise-timing">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                  <SelectItem value="180">3 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Collapsible defaultOpen={false} className="group rounded-xl border border-border/60 bg-muted/20 dark:bg-muted/10">
            <div className="flex items-center gap-0.5">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-3 text-left font-medium text-foreground outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                  data-testid="collapsible-food-insulin-trigger"
                >
                  <Utensils className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  Food &amp; insulin
                  <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                </button>
              </CollapsibleTrigger>
              <InlineInfoHint
                ariaLabel="What this section covers"
                className="shrink-0"
                content="BG, carbs, meal type for ratios, optional planned bolus units, then recent rapid-acting insulin — enough for preview and tips."
              />
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Expand or collapse Food and insulin"
                >
                  <ChevronDown
                    className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180"
                    aria-hidden
                  />
                </button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="space-y-4 border-t border-border/60 px-3 pb-4 pt-3">
              <div className="flex items-center gap-2">
                <InlineInfoHint
                  ariaLabel="Tips for filling this section"
                  content="Start with BG and carbs if you can — skip anything you do not know yet."
                />
                <span className="text-tiny text-muted-foreground">Quick tips</span>
              </div>

              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="current-bg">Current BG ({bgUnits})</Label>
                    <Input
                      id="current-bg"
                      type="text"
                      inputMode="decimal"
                      placeholder="For readiness"
                      value={currentBgInput}
                      onChange={(e) => setCurrentBgInput(e.target.value)}
                      data-testid="input-current-bg-exercise"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label id="label-exercise-bg-direction" className="text-foreground">
                      BG direction <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <div
                      className="flex flex-wrap gap-2"
                      role="group"
                      aria-labelledby="label-exercise-bg-direction"
                    >
                      <Button
                        type="button"
                        variant={exerciseBgTrend === "flat" ? "default" : "outline"}
                        size="sm"
                        className="min-h-10 flex-1 sm:min-w-0 sm:flex-1"
                        onClick={() => setExerciseBgTrend((prev) => (prev === "flat" ? "not_sure" : "flat"))}
                        data-testid="button-exercise-bg-trend-stable"
                      >
                        <Minus className="h-3.5 w-3.5 mr-1.5 shrink-0" aria-hidden />
                        Stable
                      </Button>
                      <Button
                        type="button"
                        variant={exerciseBgTrend === "rising" ? "default" : "outline"}
                        size="sm"
                        className="min-h-10 flex-1 sm:min-w-0 sm:flex-1"
                        onClick={() => setExerciseBgTrend((prev) => (prev === "rising" ? "not_sure" : "rising"))}
                        data-testid="button-exercise-bg-trend-rising"
                      >
                        <TrendingUp className="h-3.5 w-3.5 mr-1.5 shrink-0" aria-hidden />
                        Rising
                      </Button>
                      <Button
                        type="button"
                        variant={exerciseBgTrend === "falling" ? "default" : "outline"}
                        size="sm"
                        className="min-h-10 flex-1 sm:min-w-0 sm:flex-1"
                        onClick={() => setExerciseBgTrend((prev) => (prev === "falling" ? "not_sure" : "falling"))}
                        data-testid="button-exercise-bg-trend-falling"
                      >
                        <TrendingDown className="h-3.5 w-3.5 mr-1.5 shrink-0" aria-hidden />
                        Falling
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="approx-carbs">Carbs you will eat or already had (g)</Label>
                  <Input
                    id="approx-carbs"
                    type="number"
                    min={0}
                    placeholder="e.g. 30 — needed for bolus preview"
                    value={approxCarbs}
                    onChange={(e) => setApproxCarbs(e.target.value)}
                    data-testid="input-approx-carbs"
                  />
                </div>
              </div>

              {(() => {
                const c = parseInt(approxCarbs, 10);
                const showMealType = approxCarbs.trim() !== "" && !Number.isNaN(c) && c > 0;
                return showMealType ? (
                  <div className="space-y-2">
                    <FieldLabelWithInfo
                      htmlFor="meal-type-bolus"
                      info="Uses your saved insulin:carb ratio for that meal."
                    >
                      Which meal is this for?
                    </FieldLabelWithInfo>
                    <Select
                      value={mealTypeForBolus}
                      onValueChange={(v) => setMealTypeForBolus(v as MealTypeForBolus)}
                    >
                      <SelectTrigger id="meal-type-bolus" data-testid="select-meal-type-bolus">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="snack">Snack</SelectItem>
                        <SelectItem value="breakfast">Breakfast</SelectItem>
                        <SelectItem value="lunch">Lunch</SelectItem>
                        <SelectItem value="dinner">Dinner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null;
              })()}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabelWithInfo
                    htmlFor="planned-bolus-units"
                    info="If you already know how many units you plan for this food, enter it — results compare to the carb-based estimate (does not replace your care team's plan)."
                  >
                    Planned bolus for this food (units, optional)
                  </FieldLabelWithInfo>
                  <Input
                    id="planned-bolus-units"
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 4 — compared to preview after you plan"
                    value={plannedBolusUnitsInput}
                    onChange={(e) => setPlannedBolusUnitsInput(e.target.value)}
                    data-testid="input-planned-bolus-units"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabelWithInfo
                    htmlFor="last-insulin"
                    info="Meal bolus or correction — whichever was most recent. Not basal insulin."
                  >
                    Last rapid-acting insulin (meal or correction)
                  </FieldLabelWithInfo>
                  <Select
                    value={lastInsulinTiming || "unset"}
                    onValueChange={(v) => setLastInsulinTiming(v === "unset" ? "" : (v as LastInsulinTiming))}
                  >
                    <SelectTrigger id="last-insulin" data-testid="select-last-insulin">
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset">Skip</SelectItem>
                      <SelectItem value="none">No recent bolus / not sure</SelectItem>
                      <SelectItem value="lt_1h">Under 1 hour ago</SelectItem>
                      <SelectItem value="h1_2">1–2 hours ago</SelectItem>
                      <SelectItem value="h2_4">2–4 hours ago</SelectItem>
                      <SelectItem value="gt_4h">More than 4 hours ago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(lastInsulinTiming === "lt_1h" ||
                lastInsulinTiming === "h1_2" ||
                lastInsulinTiming === "h2_4" ||
                lastInsulinTiming === "gt_4h") && (
                <div className="space-y-2">
                  <FieldLabelWithInfo
                    htmlFor="last-bolus-units"
                    info="Optional — how many units were in that bolus. Shown for context only; the time you chose above still drives general insulin-on-board tips."
                  >
                    Last rapid bolus amount (units, optional)
                  </FieldLabelWithInfo>
                  <Input
                    id="last-bolus-units"
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 6 — meal or correction"
                    value={lastBolusUnitsInput}
                    onChange={(e) => setLastBolusUnitsInput(e.target.value)}
                    data-testid="input-last-bolus-units"
                  />
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          <Button
            onClick={handleQuickExercisePlan}
            disabled={!exerciseDuration}
            className="w-full min-h-11"
            data-testid="button-get-exercise-advice"
          >
            Plan my workout
          </Button>
            </CardContent>
          </>
        )}
      </Card>

      {exerciseResult && (
        <Card ref={exerciseResultCardRef} className="rounded-xl shadow-sm border-border/80" data-testid="card-exercise-result">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-h3 flex items-center gap-2 text-foreground">Your workout plan</CardTitle>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <CardDescription className="text-muted-foreground">
                    {exerciseResult.duration} min · {exerciseResult.intensity} · {exerciseResult.exerciseType}
                  </CardDescription>
                  <InlineInfoHint
                    ariaLabel="Full session summary"
                    content={exerciseResult.summary}
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setExerciseResult(null);
                  setMealBolusPreview(null);
                  setMealBolusNoRatios(false);
                  setPlannerInputsOpen(true);
                }}
                data-testid="button-clear-exercise-result"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {(() => {
              const v = verdictForResult();
              const trendTag = bgTrendLabel(exerciseBgTrend);
              const tone =
                v.verdict === "ready"
                  ? "border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-800/50 dark:bg-emerald-950/25"
                  : v.verdict === "not_recommended"
                    ? "border-red-200/80 bg-red-50/60 dark:border-red-800/50 dark:bg-red-950/25"
                    : "border-amber-200/80 bg-amber-50/60 dark:border-amber-800/50 dark:bg-amber-950/25";

              return (
                <div className={`rounded-xl border p-4 ${tone}`} data-testid="exercise-verdict">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <Dumbbell className="h-5 w-5 text-primary shrink-0" />
                        <p className="text-sm font-semibold text-foreground">{v.title}</p>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{v.detail}</p>
                      <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground">
                        <span className="rounded-full bg-background/70 px-2 py-1 border border-border/60">
                          {exerciseResult.duration} min
                        </span>
                        <span className="rounded-full bg-background/70 px-2 py-1 border border-border/60 capitalize">
                          {exerciseResult.intensity}
                        </span>
                        {mealBolusPreviewPersonalized && mealBolusPreview ? (
                          <span className="rounded-full bg-background/70 px-2 py-1 border border-border/60">
                            ~{mealBolusPreview.dose}u bolus (−{mealBolusPreview.exerciseReduction}%)
                          </span>
                        ) : (
                          <span className="rounded-full bg-background/70 px-2 py-1 border border-border/60">
                            Bolus guide {exerciseResult.pre.bolusReduction}
                          </span>
                        )}
                        {currentBgInput.trim() !== "" ? (
                          <span className="rounded-full bg-background/70 px-2 py-1 border border-border/60">
                            BG {currentBgInput} {bgUnits}
                            {trendTag ? ` · ${trendTag}` : ""}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-stretch sm:justify-end sm:shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        className="min-h-11 w-full justify-center sm:w-auto"
                        onClick={handleStartExerciseMode}
                        data-testid="button-exercise-start-mode"
                      >
                        <Play className="h-4 w-4 sm:mr-2" />
                        <span className="sm:hidden">Start mode</span>
                        <span className="hidden sm:inline">Start exercise mode</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-11 w-full justify-center px-3 text-xs sm:w-auto sm:px-3 sm:text-sm"
                        asChild
                        data-testid="button-exercise-open-adviser"
                      >
                        <Link href={adviserHref("before")} aria-label="Open insulin calculator" className="inline-flex items-center justify-center gap-1.5">
                          <Calculator className="h-4 w-4 shrink-0" aria-hidden />
                          <span className="sm:hidden">Calculator</span>
                          <span className="hidden sm:inline">Insulin calculator</span>
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {exercisePersonalizationLines.length > 0 ? (
              <div className="rounded-xl border border-border/60 bg-muted/15 px-3 py-3 space-y-2" data-testid="exercise-personalization">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                  <p className="text-sm font-medium text-foreground">Your history</p>
                </div>
                <ul className="space-y-2">
                  {exercisePersonalizationLines.map((line) => (
                    <li key={line.id} className="text-sm text-muted-foreground leading-snug">
                      {line.text}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <Tabs value={resultTab} onValueChange={setResultTab} className="w-full" data-testid="exercise-result-tabs">
              <p className="text-xs text-muted-foreground mb-2">Jump to a phase.</p>
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-1 h-auto p-1 bg-muted/40">
                <TabsTrigger value="before" className="text-xs py-2 px-2" data-testid="tab-exercise-before">
                  Prep
                </TabsTrigger>
                <TabsTrigger value="during" className="text-xs py-2 px-2" data-testid="tab-exercise-during">
                  During
                </TabsTrigger>
                <TabsTrigger value="after" className="text-xs py-2 px-2" data-testid="tab-exercise-after">
                  After
                </TabsTrigger>
                <TabsTrigger value="recovery" className="text-xs py-2 px-2" data-testid="tab-exercise-recovery">
                  Next hours
                </TabsTrigger>
              </TabsList>

              <TabsContent value="before" className="mt-4 space-y-3">
                {exerciseResult.pre.contextualNotes && exerciseResult.pre.contextualNotes.length > 0 && (
                  <details
                    className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2"
                    data-testid="exercise-context-notes"
                  >
                    <summary className="cursor-pointer select-none text-sm font-medium text-foreground py-1">
                      More tips ({exerciseResult.pre.contextualNotes.length})
                    </summary>
                    <div className="space-y-2 pt-2 pb-1">
                      {exerciseResult.pre.contextualNotes.map((note, i) => (
                        <TipRow key={`ctx-${i}`}>{note}</TipRow>
                      ))}
                    </div>
                  </details>
                )}

                {mealBolusNoRatios && parseInt(approxCarbs, 10) > 0 && !Number.isNaN(parseInt(approxCarbs, 10)) && (
                  <div
                    className="rounded-xl border border-amber-200/80 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-3 text-sm text-foreground"
                    data-testid="exercise-meal-bolus-no-ratios"
                  >
                    <p className="font-medium">Add carb ratios to see a bolus preview</p>
                    <p className="text-tiny text-muted-foreground mt-1">
                      Enter your insulin:carb ratios (or TDD) in settings so we can estimate units from the carbs you
                      entered.
                    </p>
                    <Button variant="outline" size="sm" className="mt-2 min-h-9" asChild>
                      <Link href="/ratios">Open ratio settings</Link>
                    </Button>
                  </div>
                )}

                {mealBolusPreviewPersonalized && mealBolusPreview && (
                  <div
                    className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-3 space-y-3"
                    data-testid="exercise-meal-bolus-preview"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">Meal bolus preview</p>
                      <InlineInfoHint
                        ariaLabel="About this bolus preview"
                        content="Educational only — same time-to-exercise logic as the insulin calculator. Confirm with your care team."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-lg bg-background/80 border border-border/60 p-2">
                        <p className="text-tiny text-muted-foreground">Usual for {mealBolusPreview.carbs}g</p>
                        <p className="text-lg font-bold text-foreground">{mealBolusPreview.standardDose}u</p>
                      </div>
                      <div className="rounded-lg bg-background/80 border border-border/60 p-2">
                        <p className="text-tiny text-muted-foreground">
                          Suggested (−{mealBolusPreview.exerciseReduction}%, ~{hoursUntilStart}h to start)
                        </p>
                        <p className="text-lg font-bold text-foreground">{mealBolusPreview.dose}u</p>
                      </div>
                    </div>
                    {plannedBolusCompare ? (
                      <div
                        className={cn(
                          "rounded-lg border px-3 py-2 space-y-1",
                          plannedBolusCompare.kind === "large"
                            ? "border-amber-200/90 bg-amber-50/50 dark:border-amber-800/60 dark:bg-amber-950/25"
                            : "border-border/60 bg-background/60",
                        )}
                        data-testid="exercise-planned-bolus-compare"
                      >
                        <p className="text-sm text-foreground">
                          <span className="font-medium">Your planned bolus:</span> {plannedBolusCompare.userUnits}u ·{" "}
                          <span className="font-medium">Carb-based preview:</span> {plannedBolusCompare.previewDose}u (Δ{" "}
                          {plannedBolusCompare.deltaAbs.toFixed(1)}u)
                        </p>
                        <p
                          className={cn(
                            "text-tiny",
                            plannedBolusCompare.kind === "large"
                              ? "text-amber-900 dark:text-amber-100/90"
                              : "text-muted-foreground",
                          )}
                        >
                          {plannedBolusCompareMessage(plannedBolusCompare)}
                        </p>
                      </div>
                    ) : null}
                    {(lastBolusUnitsParsed !== null ||
                      mealBolusPreview.roundingAdvice ||
                      (mealBolusPreview.tips && mealBolusPreview.tips.length > 0)) && (
                      <details className="rounded-lg border border-border/60 bg-background/50 px-3 py-2">
                        <summary className="cursor-pointer select-none text-sm font-medium text-foreground">
                          Rounding and extra detail
                        </summary>
                        <div className="space-y-2 pt-2 text-tiny text-muted-foreground">
                          {lastBolusUnitsParsed !== null ? (
                            <p data-testid="exercise-last-bolus-note">
                              You noted {lastBolusUnitsParsed}u for your most recent rapid bolus — context only; timing
                              above still drives IOB tips.
                            </p>
                          ) : null}
                          {mealBolusPreview.roundingAdvice ? <p>{mealBolusPreview.roundingAdvice}</p> : null}
                          {mealBolusPreview.tips && mealBolusPreview.tips.length > 0 ? (
                            <ul className="list-disc pl-4 space-y-1">
                              {mealBolusPreview.tips.map((t, i) => (
                                <li key={i}>{t}</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      </details>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">BG and fuel</p>
                    {mealBolusPreviewPersonalized && mealBolusPreview ? (
                      <InlineInfoHint
                        ariaLabel="How general workout bolus bands relate to your preview"
                        content={`General intensity band from this workout plan: ${exerciseResult.pre.bolusReduction} — your team may use different rules; the preview above uses time-to-exercise like the calculator.`}
                      />
                    ) : null}
                  </div>
                  <TipRow>
                    <strong>Target BG:</strong> {exerciseResult.pre.targetBg} {bgUnits}
                  </TipRow>
                  {exerciseResult.pre.carbsIfLow > 0 && (
                    <TipRow>
                      <strong>If below {exerciseResult.pre.lowThreshold}:</strong> eat {exerciseResult.pre.carbsIfLow}g fast
                      carbs first
                    </TipRow>
                  )}
                  {!mealBolusPreviewPersonalized || !mealBolusPreview ? (
                    <TipRow>
                      <strong>Meal bolus:</strong> reduce by {exerciseResult.pre.bolusReduction} if eating before
                    </TipRow>
                  ) : null}
                </div>

                <details className="rounded-xl border border-border/60 bg-card px-3 py-2">
                  <summary className="cursor-pointer select-none text-sm font-medium text-foreground py-1">Snack ideas</summary>
                  <p className="text-sm text-foreground pt-2 pb-1">{exerciseResult.pre.snackIdeas.join(", ")}</p>
                </details>

                {profile.insulinDeliveryMethod === "pump" && exerciseResult.pumpTips.pre.length > 0 && (
                  <details className="rounded-xl border border-border/60 bg-muted/10 px-3 py-3">
                    <summary className="cursor-pointer select-none text-sm font-medium text-foreground">Pump tips</summary>
                    <div className="mt-3">
                      <PumpTipBlock tips={exerciseResult.pumpTips.pre} data-testid="pump-tip-before" />
                    </div>
                  </details>
                )}
              </TabsContent>

              <TabsContent value="during" className="mt-4 space-y-3">
                {exerciseResult.during.needsCarbs && (
                  <div className="rounded-xl border border-border/60 bg-card px-3 py-3 text-center" data-testid="exercise-during-carbs">
                    <p className="text-3xl font-bold text-foreground">{exerciseResult.during.carbsNeeded}g</p>
                    <p className="text-xs text-muted-foreground">fast-acting carbs to have ready</p>
                  </div>
                )}

                <div className="space-y-2">
                  {exerciseResult.during.tips.slice(0, 3).map((tip, i) => (
                    <TipRow key={i}>{tip}</TipRow>
                  ))}
                </div>
                {exerciseResult.during.tips.length > 3 ? (
                  <details className="rounded-xl border border-border/60 bg-muted/10 px-3 py-2">
                    <summary className="cursor-pointer select-none text-sm font-medium text-foreground">
                      More during tips ({exerciseResult.during.tips.length - 3})
                    </summary>
                    <div className="space-y-2 pt-2">
                      {exerciseResult.during.tips.slice(3).map((tip, i) => (
                        <TipRow key={`more-during-${i}`}>{tip}</TipRow>
                      ))}
                    </div>
                  </details>
                ) : null}

                {exerciseResult.during.checkBg && (
                  <div className="rounded-xl border border-border/60 bg-muted/10 px-3 py-3 flex items-center gap-2" data-testid="exercise-during-check">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-foreground">Check BG at the halfway mark</p>
                  </div>
                )}

                {profile.insulinDeliveryMethod === "pump" && exerciseResult.pumpTips.during.length > 0 && (
                  <details className="rounded-xl border border-border/60 bg-muted/10 px-3 py-3">
                    <summary className="cursor-pointer select-none text-sm font-medium text-foreground">Pump tips</summary>
                    <div className="mt-3">
                      <PumpTipBlock tips={exerciseResult.pumpTips.during} data-testid="pump-tip-during" />
                    </div>
                  </details>
                )}
              </TabsContent>

              <TabsContent value="after" className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border/60 bg-card p-3 text-center" data-testid="exercise-after-carbs">
                    <p className="text-2xl font-bold text-foreground">{exerciseResult.post.carbs}g</p>
                    <p className="text-xs text-muted-foreground">carbs</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-card p-3 text-center" data-testid="exercise-after-protein">
                    <p className="text-2xl font-bold text-foreground">{exerciseResult.post.protein}</p>
                    <p className="text-xs text-muted-foreground">protein</p>
                  </div>
                </div>

                <TipRow>
                  <strong>Recovery meal bolus:</strong> reduce by {exerciseResult.post.bolusReduction}
                </TipRow>

                <details className="rounded-xl border border-border/60 bg-card px-3 py-2">
                  <summary className="cursor-pointer select-none text-sm font-medium text-foreground py-1">
                    Good options
                  </summary>
                  <p className="text-sm text-foreground pt-2 pb-1">{exerciseResult.post.snackIdeas.join(", ")}</p>
                </details>

                {profile.insulinDeliveryMethod === "pump" && exerciseResult.pumpTips.post.length > 0 && (
                  <details className="rounded-xl border border-border/60 bg-muted/10 px-3 py-3">
                    <summary className="cursor-pointer select-none text-sm font-medium text-foreground">Pump tips</summary>
                    <div className="mt-3">
                      <PumpTipBlock tips={exerciseResult.pumpTips.post} data-testid="pump-tip-after" />
                    </div>
                  </details>
                )}
              </TabsContent>

              <TabsContent value="recovery" className="mt-4 space-y-3">
                <div className="rounded-xl border border-border/60 bg-muted/10 px-3 py-3" data-testid="exercise-recovery-header">
                  <p className="text-sm font-medium text-foreground">Next {exerciseResult.recovery.monitorHours} hours</p>
                  <p className="text-xs text-muted-foreground">Recovery & delayed low awareness</p>
                </div>

                <div className="space-y-2">
                  {exerciseResult.recovery.tips.slice(0, 3).map((tip, i) => (
                    <TipRow key={i}>{tip}</TipRow>
                  ))}
                </div>
                {exerciseResult.recovery.tips.length > 3 ? (
                  <details className="rounded-xl border border-border/60 bg-muted/10 px-3 py-2">
                    <summary className="cursor-pointer select-none text-sm font-medium text-foreground">
                      More recovery tips ({exerciseResult.recovery.tips.length - 3})
                    </summary>
                    <div className="space-y-2 pt-2">
                      {exerciseResult.recovery.tips.slice(3).map((tip, i) => (
                        <TipRow key={`more-rec-${i}`}>{tip}</TipRow>
                      ))}
                    </div>
                  </details>
                ) : null}

                <details className="rounded-xl border border-border/60 bg-muted/10 px-3 py-3">
                  <summary className="cursor-pointer select-none text-sm font-medium text-foreground">
                    Why delayed lows happen
                  </summary>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Your muscles can keep absorbing glucose for hours after exercise to replenish their stores.
                  </p>
                </details>

                {profile.insulinDeliveryMethod === "pump" && exerciseResult.pumpTips.recovery.length > 0 && (
                  <details className="rounded-xl border border-border/60 bg-muted/10 px-3 py-3">
                    <summary className="cursor-pointer select-none text-sm font-medium text-foreground">Pump tips</summary>
                    <div className="mt-3">
                      <PumpTipBlock tips={exerciseResult.pumpTips.recovery} data-testid="pump-tip-recovery" />
                    </div>
                  </details>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-tiny text-muted-foreground">Educational only — not medical advice.</p>
              <MedicalSourcesLink anchor="exercise" compact />
              <Button
                variant="ghost"
                size="sm"
                className="min-h-11"
                onClick={() => {
                  setPlannerInputsOpen(true);
                  requestAnimationFrame(() =>
                    plannerCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
                  );
                }}
                data-testid="button-exercise-back-to-planner"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Adjust inputs
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TipRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <ArrowRight className="h-3.5 w-3.5 mt-0.5 shrink-0 opacity-70" />
      <p className="text-small text-foreground">{children}</p>
    </div>
  );
}

function PumpTipBlock({ tips, "data-testid": testId }: { tips: string[]; "data-testid"?: string }) {
  return (
    <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border border-indigo-200 dark:border-indigo-800 mt-3" data-testid={testId}>
      <p className="text-tiny font-medium text-indigo-600 dark:text-indigo-400 uppercase mb-2">Pump users</p>
      {tips.map((tip, i) => (
        <div key={i} className="flex items-start gap-2">
          <ArrowRight className="h-3.5 w-3.5 text-indigo-500 mt-0.5 shrink-0" />
          <p className="text-small text-indigo-800 dark:text-indigo-200">{tip}</p>
        </div>
      ))}
    </div>
  );
}
