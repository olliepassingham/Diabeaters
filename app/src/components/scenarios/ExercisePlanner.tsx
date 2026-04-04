import { useState, useEffect } from "react";
import { Link, useSearch } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Apple,
  Repeat,
  ChevronDown,
  Utensils,
  Calculator,
} from "lucide-react";
import { storage, type UserProfile, type ExerciseRoutine, type ExerciseIntensity } from "@/lib/storage";
import {
  calculateExercisePlan,
  type ExercisePlanResult,
  type ExerciseNutritionContext,
  type LastInsulinTiming,
  type ExercisePlanContext,
} from "@/lib/exercise-plan";
import {
  activeSessionMatchesPlannerQuery,
  adviserMealExerciseHref,
  bgForPlannerFromActiveSession,
  resultTabForExercisePhase,
} from "@/lib/exercise-planner-href";
import { useToast } from "@/hooks/use-toast";
import { getExerciseReadinessVerdict, type ExerciseReadinessResult } from "@/lib/exercise-readiness";

const ALLOWED_EXERCISE_TYPES = new Set([
  "cardio",
  "strength",
  "hiit",
  "yoga",
  "walking",
  "sports",
  "swimming",
]);

const exerciseLabelsMap: Record<string, string> = {
  cardio: "Cardio",
  strength: "Strength",
  hiit: "HIIT",
  yoga: "Yoga/Pilates",
  walking: "Walking",
  sports: "Team Sports",
  swimming: "Swimming",
};

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
  const [savedExerciseRoutines, setSavedExerciseRoutines] = useState<ExerciseRoutine[]>([]);

  const [nutritionContext, setNutritionContext] = useState<ExerciseNutritionContext | "">("");
  const [minutesSinceLastMeal, setMinutesSinceLastMeal] = useState("");
  const [minutesUntilNextMeal, setMinutesUntilNextMeal] = useState("");
  const [approxCarbs, setApproxCarbs] = useState("");
  const [lastInsulinTiming, setLastInsulinTiming] = useState<LastInsulinTiming | "">("");
  const [currentBgInput, setCurrentBgInput] = useState("");
  const [resultTab, setResultTab] = useState("before");

  const bgUnits = profile.bgUnits || "mmol/L";

  useEffect(() => {
    setSavedExerciseRoutines(storage.getExerciseRoutines());
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

    if (type && ALLOWED_EXERCISE_TYPES.has(type)) setExerciseType(type);
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
      }
    }
  }, [search]);

  const applyExerciseRoutine = (routine: ExerciseRoutine) => {
    const existing = storage.getActiveExercise();
    if (existing) {
      toast({
        title: "Exercise already active",
        description: `"${existing.exerciseName}" is in progress. Finish it first.`,
        variant: "destructive",
      });
      return;
    }
    setExerciseType(routine.exerciseType);
    setExerciseDuration(String(routine.durationMinutes));
    setExerciseIntensity(routine.intensity);
    storage.useExerciseRoutine(routine.id);
    storage.startExerciseSession({
      routineId: routine.id,
      exerciseName: routine.name,
      exerciseType: routine.exerciseType,
      intensity: routine.intensity,
      durationMinutes: routine.durationMinutes,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
    if (nutritionContext) ctx.nutritionContext = nutritionContext;
    if (lastInsulinTiming) ctx.lastInsulinTiming = lastInsulinTiming;
    const carbsParsed = parseInt(approxCarbs, 10);
    if (approxCarbs.trim() !== "" && !Number.isNaN(carbsParsed) && carbsParsed >= 0) {
      ctx.approximateCarbsGrams = carbsParsed;
    }
    const bgParsed = parseFloat(currentBgInput.replace(",", "."));
    if (currentBgInput.trim() !== "" && !Number.isNaN(bgParsed)) {
      ctx.currentBg = bgParsed;
    }
    if ((nutritionContext === "ate_recently" || nutritionContext === "snack_only") && minutesSinceLastMeal.trim() !== "") {
      const m = parseInt(minutesSinceLastMeal, 10);
      if (!Number.isNaN(m) && m >= 0) ctx.minutesSinceLastMeal = m;
    }
    if (nutritionContext === "about_to_eat" && minutesUntilNextMeal.trim() !== "") {
      const m = parseInt(minutesUntilNextMeal, 10);
      if (!Number.isNaN(m) && m >= 0) ctx.minutesUntilNextMeal = m;
    }

    const result = calculateExercisePlan(ctx, freshSettings);
    setExerciseResult(result);
    setResultTab("before");
    const message = `${exerciseIntensity} ${exerciseType} for ${exerciseDuration} minutes`;
    const ctxLog = {
      nutrition: nutritionContext || undefined,
      lastInsulin: lastInsulinTiming || undefined,
      carbs: ctx.approximateCarbsGrams,
      bg: ctx.currentBg,
      minutesSinceLastMeal: ctx.minutesSinceLastMeal,
      minutesUntilNextMeal: ctx.minutesUntilNextMeal,
      minutesUntilStart: ctx.minutesUntilStart,
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
  };

  const minutesUntilStartParsed = parseInt(sessionTimingFromNow, 10);
  const minutesUntilStart = Number.isNaN(minutesUntilStartParsed) ? 60 : Math.max(0, minutesUntilStartParsed);
  const hoursUntilStart = Math.max(1, Math.ceil(minutesUntilStart / 60));

  const adviserHref = (timing: "before" | "after" | "during") =>
    adviserMealExerciseHref(timing, hoursUntilStart);

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
    });

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

      <Card className="rounded-xl shadow-sm border-border/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-h3 flex items-center gap-2 text-foreground">
            <Dumbbell className="h-6 w-6 text-primary" />
            Exercise planner
          </CardTitle>
          <CardDescription>Plan your workout with before, during, and after recommendations</CardDescription>
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
                  <SelectItem value="sports">Team sports</SelectItem>
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

          <div className="bg-primary/5 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-primary mt-0.5" />
              <div className="text-small">
                <p className="font-medium text-foreground">Complete workout plan</p>
                <p className="text-muted-foreground">
                  Recommendations for what to eat before, during, and after your workout, plus adjusted insulin guidance.
                </p>
              </div>
            </div>
          </div>

          <Collapsible className="group rounded-xl border border-border/60 bg-muted/20 dark:bg-muted/10">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-3 text-left font-medium text-foreground outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                data-testid="collapsible-food-insulin-trigger"
              >
                <span className="flex items-center gap-2">
                  <Utensils className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  Food & insulin (optional)
                </span>
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
                  aria-hidden
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 border-t border-border/60 px-3 pb-4 pt-3">
              <div className="space-y-2">
                <Label htmlFor="nutrition-context">Food relative to this session</Label>
                <Select
                  value={nutritionContext || "unset"}
                  onValueChange={(v) => setNutritionContext(v === "unset" ? "" : (v as ExerciseNutritionContext))}
                >
                  <SelectTrigger id="nutrition-context" data-testid="select-nutrition-context">
                    <SelectValue placeholder="Choose if you can" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unset">Prefer not to say</SelectItem>
                    <SelectItem value="fasted">Fasted</SelectItem>
                    <SelectItem value="ate_recently">Ate recently</SelectItem>
                    <SelectItem value="about_to_eat">About to eat a meal</SelectItem>
                    <SelectItem value="snack_only">Snack only (small)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(nutritionContext === "ate_recently" || nutritionContext === "snack_only") && (
                <div className="space-y-2">
                  <Label htmlFor="minutes-since-meal">Minutes since that meal/snack</Label>
                  <Input
                    id="minutes-since-meal"
                    type="number"
                    min={0}
                    placeholder="e.g. 90"
                    value={minutesSinceLastMeal}
                    onChange={(e) => setMinutesSinceLastMeal(e.target.value)}
                    data-testid="input-minutes-since-meal"
                  />
                </div>
              )}

              {nutritionContext === "about_to_eat" && (
                <div className="space-y-2">
                  <Label htmlFor="minutes-until-meal">Minutes until your meal</Label>
                  <Input
                    id="minutes-until-meal"
                    type="number"
                    min={0}
                    placeholder="e.g. 45"
                    value={minutesUntilNextMeal}
                    onChange={(e) => setMinutesUntilNextMeal(e.target.value)}
                    data-testid="input-minutes-until-meal"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="approx-carbs">Approx. carbs (g) for last or next meal</Label>
                <Input
                  id="approx-carbs"
                  type="number"
                  min={0}
                  placeholder="Optional"
                  value={approxCarbs}
                  onChange={(e) => setApproxCarbs(e.target.value)}
                  data-testid="input-approx-carbs"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="last-insulin">Last meal or correction bolus</Label>
                <Select
                  value={lastInsulinTiming || "unset"}
                  onValueChange={(v) => setLastInsulinTiming(v === "unset" ? "" : (v as LastInsulinTiming))}
                >
                  <SelectTrigger id="last-insulin" data-testid="select-last-insulin">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unset">Prefer not to say</SelectItem>
                    <SelectItem value="none">None / not sure</SelectItem>
                    <SelectItem value="lt_1h">Under 1 hour ago</SelectItem>
                    <SelectItem value="h1_2">1–2 hours ago</SelectItem>
                    <SelectItem value="h2_4">2–4 hours ago</SelectItem>
                    <SelectItem value="gt_4h">More than 4 hours ago</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="current-bg">Current BG ({bgUnits})</Label>
                <Input
                  id="current-bg"
                  type="text"
                  inputMode="decimal"
                  placeholder="Optional"
                  value={currentBgInput}
                  onChange={(e) => setCurrentBgInput(e.target.value)}
                  data-testid="input-current-bg-exercise"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <p className="text-center text-tiny text-muted-foreground">
            Adding meal and bolus timing improves this plan.
          </p>
          <Button
            onClick={handleQuickExercisePlan}
            disabled={!exerciseDuration}
            className="w-full min-h-11"
            data-testid="button-get-exercise-advice"
          >
            Plan my workout
          </Button>
        </CardContent>
      </Card>

      {exerciseResult && (
        <Card className="rounded-xl shadow-sm border-border/80" data-testid="card-exercise-result">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-h3 flex items-center gap-2 text-foreground">Your workout plan</CardTitle>
                <CardDescription className="mt-1">{exerciseResult.summary}</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setExerciseResult(null)} data-testid="button-clear-exercise-result">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {(() => {
              const v = verdictForResult();
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
                      <p className="text-sm text-muted-foreground">{v.detail}</p>
                      <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground">
                        <span className="rounded-full bg-background/70 px-2 py-1 border border-border/60">
                          {exerciseResult.duration} min
                        </span>
                        <span className="rounded-full bg-background/70 px-2 py-1 border border-border/60 capitalize">
                          {exerciseResult.intensity}
                        </span>
                        <span className="rounded-full bg-background/70 px-2 py-1 border border-border/60">
                          Reduce bolus {exerciseResult.pre.bolusReduction}
                        </span>
                        {currentBgInput.trim() !== "" ? (
                          <span className="rounded-full bg-background/70 px-2 py-1 border border-border/60">
                            BG {currentBgInput} {bgUnits}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" size="sm" className="min-h-11" asChild data-testid="button-exercise-open-adviser">
                        <Link href={adviserHref("before")}>
                          <Calculator className="h-4 w-4 mr-2" />
                          Use in insulin calculator
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })()}

            <Tabs value={resultTab} onValueChange={setResultTab} className="w-full" data-testid="exercise-result-tabs">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="before" data-testid="tab-exercise-before">Before</TabsTrigger>
                <TabsTrigger value="during" data-testid="tab-exercise-during">During</TabsTrigger>
                <TabsTrigger value="after" data-testid="tab-exercise-after">After</TabsTrigger>
                <TabsTrigger value="recovery" data-testid="tab-exercise-recovery">Next</TabsTrigger>
              </TabsList>

              <TabsContent value="before" className="mt-4 space-y-3">
                {exerciseResult.pre.contextualNotes && exerciseResult.pre.contextualNotes.length > 0 && (
                  <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-3 space-y-2" data-testid="exercise-context-notes">
                    {exerciseResult.pre.contextualNotes.map((note, i) => (
                      <TipRow key={`ctx-${i}`}>{note}</TipRow>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <TipRow>
                    <strong>Target BG:</strong> {exerciseResult.pre.targetBg} {bgUnits}
                  </TipRow>
                  {exerciseResult.pre.carbsIfLow > 0 && (
                    <TipRow>
                      <strong>If below {exerciseResult.pre.lowThreshold}:</strong> eat {exerciseResult.pre.carbsIfLow}g fast carbs first
                    </TipRow>
                  )}
                  <TipRow>
                    <strong>Meal bolus:</strong> reduce by {exerciseResult.pre.bolusReduction} if eating before
                  </TipRow>
                </div>

                <div className="rounded-xl border border-border/60 bg-card px-3 py-3">
                  <p className="text-xs font-medium text-muted-foreground">Snack ideas</p>
                  <p className="text-sm text-foreground">{exerciseResult.pre.snackIdeas.join(", ")}</p>
                </div>

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
                  {exerciseResult.during.tips.map((tip, i) => (
                    <TipRow key={i}>{tip}</TipRow>
                  ))}
                </div>

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

                <div className="rounded-xl border border-border/60 bg-card px-3 py-3">
                  <p className="text-xs font-medium text-muted-foreground">Good options</p>
                  <p className="text-sm text-foreground">{exerciseResult.post.snackIdeas.join(", ")}</p>
                </div>

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
                  {exerciseResult.recovery.tips.map((tip, i) => (
                    <TipRow key={i}>{tip}</TipRow>
                  ))}
                </div>

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

            <div className="flex items-center justify-between gap-3">
              <p className="text-tiny text-muted-foreground">
                Not medical advice. Individual responses vary — track your patterns with your care team.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="min-h-11"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                data-testid="button-exercise-back-to-planner"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Adjust inputs
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-xl shadow-sm border-border/80" data-testid="card-saved-routines">
        <CardHeader className="pb-3">
          <CardTitle className="text-h3 flex items-center gap-2 text-foreground">
            <Dumbbell className="h-6 w-6 text-primary" />
            Exercise routines
          </CardTitle>
          <CardDescription>
            {savedExerciseRoutines.length > 0
              ? "Tap a routine to prefill the planner and start decision support mode"
              : "Save workouts in Routines so they appear here for one-tap planning"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {savedExerciseRoutines.length === 0 ? (
            <p className="text-small text-muted-foreground py-1">No saved exercise routines yet.</p>
          ) : (
            savedExerciseRoutines.slice(0, 5).map((routine, idx) => (
              <button
                key={routine.id}
                type="button"
                onClick={() => applyExerciseRoutine(routine)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 text-left border border-transparent hover:border-border/60 transition-colors"
                data-testid={`button-apply-routine-${idx}`}
              >
                <div className="flex items-center justify-center min-w-[2.5rem] h-10 rounded-md bg-primary/10">
                  <Dumbbell className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-small font-medium truncate text-foreground">{routine.name}</p>
                  <p className="text-tiny text-muted-foreground">
                    {exerciseLabelsMap[routine.exerciseType] || routine.exerciseType} · {routine.durationMinutes} min · {routine.intensity}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))
          )}
          <Button variant="outline" size="sm" className="w-full mt-1 min-h-11" asChild data-testid="link-manage-routines">
            <Link href="/routines?section=exercise">
              <Repeat className="h-3.5 w-3.5 mr-2 shrink-0" />
              Add or edit exercise routines
            </Link>
          </Button>
        </CardContent>
      </Card>
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
