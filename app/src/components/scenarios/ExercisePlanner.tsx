import { useState, useEffect } from "react";
import { Link, useSearch } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dumbbell,
  AlertCircle,
  Thermometer,
  Clock,
  X,
  ArrowRight,
  Apple,
  Repeat,
  ChevronDown,
  Utensils,
} from "lucide-react";
import { storage, type UserProfile, type ExerciseRoutine } from "@/lib/storage";
import {
  calculateExercisePlan,
  type ExercisePlanResult,
  type ExerciseNutritionContext,
  type LastInsulinTiming,
  type ExercisePlanContext,
} from "@/lib/exercise-plan";
import { useToast } from "@/hooks/use-toast";

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
    if (type && ALLOWED_EXERCISE_TYPES.has(type)) setExerciseType(type);
    if (duration && /^\d{1,3}$/.test(duration)) {
      const d = parseInt(duration, 10);
      if (d >= 1 && d <= 300) setExerciseDuration(duration);
    }
    if (intensity === "light" || intensity === "moderate" || intensity === "intense") {
      setExerciseIntensity(intensity);
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
                <CardTitle className="text-h3 flex items-center gap-2 text-foreground">
                  <Dumbbell className="h-6 w-6 text-primary" />
                  Your workout plan
                </CardTitle>
                <CardDescription className="mt-1">{exerciseResult.summary}</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setExerciseResult(null)} data-testid="button-clear-exercise-result">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-2 bg-primary/5 rounded-lg">
                <p className="text-2xl font-bold text-primary">{exerciseResult.duration}</p>
                <p className="text-tiny text-muted-foreground">minutes</p>
              </div>
              <div className="p-2 bg-primary/5 rounded-lg">
                <p className="text-2xl font-bold text-primary capitalize">{exerciseResult.intensity}</p>
                <p className="text-tiny text-muted-foreground">intensity</p>
              </div>
              <div className="p-2 bg-primary/5 rounded-lg">
                <p className="text-2xl font-bold text-primary">{exerciseResult.pre.bolusReduction}</p>
                <p className="text-tiny text-muted-foreground">reduce bolus</p>
              </div>
            </div>

            <div className="space-y-4">
              <PhaseBlock title="Before" kicker={exerciseResult.pre.timing} tone="blue">
                {exerciseResult.pre.contextualNotes && exerciseResult.pre.contextualNotes.length > 0 && (
                  <div className="space-y-2 rounded-lg border border-blue-200/80 bg-blue-100/40 p-3 dark:border-blue-800/60 dark:bg-blue-950/30">
                    {exerciseResult.pre.contextualNotes.map((note, i) => (
                      <TipRow key={`ctx-${i}`}>
                        <span>{note}</span>
                      </TipRow>
                    ))}
                  </div>
                )}
                <div className="space-y-2">
                  <TipRow>
                    <strong>Target BG:</strong> {exerciseResult.pre.targetBg} {bgUnits} before you start
                  </TipRow>
                  {exerciseResult.pre.carbsIfLow > 0 && (
                    <TipRow>
                      <strong>If BG is below {exerciseResult.pre.lowThreshold}:</strong> eat {exerciseResult.pre.carbsIfLow}g carbs first
                    </TipRow>
                  )}
                  <TipRow>
                    <strong>Reduce meal bolus</strong> by {exerciseResult.pre.bolusReduction} if eating before
                  </TipRow>
                </div>
                <p className="text-tiny text-blue-600 dark:text-blue-400 flex items-center gap-1 pt-2 border-t border-blue-200 dark:border-blue-700">
                  <Apple className="h-3 w-3" />
                  Snack ideas: {exerciseResult.pre.snackIdeas.join(", ")}
                </p>
                {profile.insulinDeliveryMethod === "pump" && exerciseResult.pumpTips.pre.length > 0 && (
                  <PumpTipBlock tips={exerciseResult.pumpTips.pre} data-testid="pump-tip-before" />
                )}
              </PhaseBlock>

              <PhaseBlock title="During your workout" kicker="In session" tone="amber">
                {exerciseResult.during.needsCarbs && (
                  <div className="p-3 bg-card rounded-lg text-center mb-3 border border-amber-200/60 dark:border-amber-800/50">
                    <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">{exerciseResult.during.carbsNeeded}g</p>
                    <p className="text-tiny text-amber-600 dark:text-amber-400">fast-acting carbs to have ready</p>
                  </div>
                )}
                <div className="space-y-2">
                  {exerciseResult.during.tips.map((tip, i) => (
                    <TipRow key={i}>{tip}</TipRow>
                  ))}
                </div>
                {exerciseResult.during.checkBg && (
                  <p className="text-tiny text-amber-600 dark:text-amber-400 flex items-center gap-1 pt-2 border-t border-amber-200 dark:border-amber-700">
                    <Clock className="h-3 w-3" />
                    Check BG at the halfway mark
                  </p>
                )}
                {profile.insulinDeliveryMethod === "pump" && exerciseResult.pumpTips.during.length > 0 && (
                  <PumpTipBlock tips={exerciseResult.pumpTips.during} data-testid="pump-tip-during" />
                )}
              </PhaseBlock>

              <PhaseBlock title="After" kicker={exerciseResult.post.timing} tone="green">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="p-3 bg-card rounded-lg text-center border border-green-200/60 dark:border-green-800/50">
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">{exerciseResult.post.carbs}g</p>
                    <p className="text-tiny text-green-600 dark:text-green-400">carbs for recovery</p>
                  </div>
                  <div className="p-3 bg-card rounded-lg text-center border border-green-200/60 dark:border-green-800/50">
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">{exerciseResult.post.protein}</p>
                    <p className="text-tiny text-green-600 dark:text-green-400">protein for muscles</p>
                  </div>
                </div>
                <TipRow>
                  <strong>Reduce recovery meal bolus</strong> by {exerciseResult.post.bolusReduction}
                </TipRow>
                <p className="text-tiny text-green-600 dark:text-green-400 flex items-center gap-1 pt-2 border-t border-green-200 dark:border-green-700">
                  <Apple className="h-3 w-3" />
                  Good options: {exerciseResult.post.snackIdeas.join(", ")}
                </p>
                {profile.insulinDeliveryMethod === "pump" && exerciseResult.pumpTips.post.length > 0 && (
                  <PumpTipBlock tips={exerciseResult.pumpTips.post} data-testid="pump-tip-after" />
                )}
              </PhaseBlock>

              <PhaseBlock title={`Next ${exerciseResult.recovery.monitorHours} hours`} kicker="Recovery" tone="purple">
                <div className="space-y-2">
                  {exerciseResult.recovery.tips.map((tip, i) => (
                    <TipRow key={i}>{tip}</TipRow>
                  ))}
                </div>
                <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded text-tiny text-purple-700 dark:text-purple-300 mt-2">
                  <strong>Why delayed lows happen:</strong> Your muscles keep absorbing glucose for hours after exercise to replenish their stores.
                </div>
                {profile.insulinDeliveryMethod === "pump" && exerciseResult.pumpTips.recovery.length > 0 && (
                  <PumpTipBlock tips={exerciseResult.pumpTips.recovery} data-testid="pump-tip-recovery" />
                )}
              </PhaseBlock>
            </div>

            <p className="text-tiny text-muted-foreground">
              Not medical advice. Individual responses to exercise vary — track your patterns with your care team.
            </p>
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

const toneMap = {
  blue: "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30",
  amber: "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30",
  green: "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30",
  purple: "border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30",
};

const kickerMap = {
  blue: "text-blue-600 dark:text-blue-400",
  amber: "text-amber-600 dark:text-amber-400",
  green: "text-green-600 dark:text-green-400",
  purple: "text-purple-600 dark:text-purple-400",
};

function PhaseBlock({
  title,
  kicker,
  tone,
  children,
}: {
  title: string;
  kicker: string;
  tone: keyof typeof toneMap;
  children: React.ReactNode;
}) {
  return (
    <section className={`p-4 rounded-xl border space-y-3 ${toneMap[tone]}`}>
      <div>
        <p className={`text-tiny font-medium uppercase ${kickerMap[tone]}`}>{kicker}</p>
        <h4 className="text-h3 font-semibold text-foreground mt-0.5">{title}</h4>
      </div>
      {children}
    </section>
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
