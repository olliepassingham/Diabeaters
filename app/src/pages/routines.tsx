import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useLocation } from "wouter";
import { Repeat, Plus, Utensils, Coffee, Sun, Moon, Cookie, Clock, Syringe, Check, Trash2, Pencil, Star, TrendingUp, History, Tag, Dumbbell, Play, RotateCcw, BookmarkPlus } from "lucide-react";
import { storage, Routine, RoutineMealType, RoutineOutcome, UserSettings, ExerciseRoutine, ExerciseType, ExerciseIntensity, DIABEATER_EXERCISE_OUTCOMES_CHANGED_EVENT } from "@/lib/storage";
import { listRecentRepeatableExerciseSessions, type RecentRepeatableExerciseSession } from "@/lib/exercise-session-repeat";
import { buildExerciseScenarioRepeatHref } from "@/lib/exercise-planner-href";
import { format } from "date-fns";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
import { useToast } from "@/hooks/use-toast";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";

const MEAL_TYPES: { value: RoutineMealType; label: string; icon: typeof Utensils }[] = [
  { value: "breakfast", label: "Breakfast", icon: Coffee },
  { value: "lunch", label: "Lunch", icon: Sun },
  { value: "dinner", label: "Dinner", icon: Moon },
  { value: "snack", label: "Snack", icon: Cookie },
  { value: "other", label: "Other", icon: Utensils },
];

const OUTCOMES: { value: RoutineOutcome; label: string; color: string }[] = [
  { value: "great", label: "Great - stayed in range", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  { value: "good", label: "Good - minor drift", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
  { value: "okay", label: "Okay - needed correction", color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  { value: "not_ideal", label: "Not ideal - learning moment", color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
];

const TIMING_OPTIONS = [
  { value: "before", label: "Before eating" },
  { value: "with", label: "With the meal" },
  { value: "after", label: "After eating" },
];

function getMealIcon(type: RoutineMealType, className = "h-5 w-5") {
  const found = MEAL_TYPES.find(t => t.value === type);
  const Icon = found ? found.icon : Utensils;
  return <Icon className={className} aria-hidden />;
}

function getMealLabel(type: RoutineMealType) {
  const found = MEAL_TYPES.find(t => t.value === type);
  return found ? found.label : "Other";
}

function getOutcomeStyle(outcome: RoutineOutcome) {
  const found = OUTCOMES.find(o => o.value === outcome);
  return found ? found.color : "";
}

function getOutcomeLabel(outcome: RoutineOutcome) {
  const found = OUTCOMES.find(o => o.value === outcome);
  return found ? found.label.split(" - ")[0] : "Okay";
}

function formatRoutineInsulinLine(routine: Routine): string | null {
  if (!routine.insulinDose) return null;
  const dose = `${routine.insulinDose}u`;
  if (routine.insulinTiming === "before" && routine.timingMinutes) {
    return `${dose} · ${routine.timingMinutes}min before`;
  }
  if (routine.insulinTiming === "with") return `${dose} · with meal`;
  if (routine.insulinTiming === "after") return `${dose} · after meal`;
  return dose;
}

const EXERCISE_TYPES: { value: ExerciseType; label: string }[] = [
  { value: "cardio", label: "Cardio" },
  { value: "strength", label: "Strength" },
  { value: "hiit", label: "HIIT" },
  { value: "yoga", label: "Yoga" },
  { value: "walking", label: "Walking" },
  { value: "court", label: "Court & racket sports" },
  { value: "field", label: "Field & team sports" },
  { value: "swimming", label: "Swimming" },
];

const EXERCISE_INTENSITIES: { value: ExerciseIntensity; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "moderate", label: "Moderate" },
  { value: "intense", label: "Intense" },
];

function getIntensityStyle(intensity: ExerciseIntensity): string {
  switch (intensity) {
    case "light": return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
    case "moderate": return "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300";
    case "intense": return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
  }
}

export function RoutinesContent() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeSection, setActiveSection] = useState<"meals" | "exercise">(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("section") === "exercise" ? "exercise" : "meals";
  });
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [filterMealType, setFilterMealType] = useState<RoutineMealType | "all">("all");
  const [activeTab, setActiveTab] = useState("all");

  const [name, setName] = useState("");
  const [mealType, setMealType] = useState<RoutineMealType>("lunch");
  const [mealDescription, setMealDescription] = useState("");
  const [carbEstimate, setCarbEstimate] = useState("");
  const [insulinDose, setInsulinDose] = useState("");
  const [insulinTiming, setInsulinTiming] = useState<"before" | "with" | "after">("before");
  const [timingMinutes, setTimingMinutes] = useState("");
  const [context, setContext] = useState("");
  const [outcome, setOutcome] = useState<RoutineOutcome>("good");
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [tags, setTags] = useState("");

  const [exerciseRoutines, setExerciseRoutines] = useState<ExerciseRoutine[]>([]);
  const [isExerciseAddOpen, setIsExerciseAddOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<ExerciseRoutine | null>(null);
  const [exName, setExName] = useState("");
  const [exType, setExType] = useState<ExerciseType>("cardio");
  const [exIntensity, setExIntensity] = useState<ExerciseIntensity>("moderate");
  const [exDuration, setExDuration] = useState("");
  const [exNotes, setExNotes] = useState("");
  const [recentWorkouts, setRecentWorkouts] = useState<RecentRepeatableExerciseSession[]>([]);

  const loadRecentWorkouts = () => {
    setRecentWorkouts(listRecentRepeatableExerciseSessions({ outcomes: storage.getExerciseOutcomes(), limit: 5 }));
  };

  useEffect(() => {
    setRoutines(storage.getRoutines());
    setSettings(storage.getSettings());
    setExerciseRoutines(storage.getExerciseRoutines());
    loadRecentWorkouts();
  }, []);

  useEffect(() => {
    const onOutcomes = () => loadRecentWorkouts();
    window.addEventListener(DIABEATER_EXERCISE_OUTCOMES_CHANGED_EVENT, onOutcomes);
    return () => window.removeEventListener(DIABEATER_EXERCISE_OUTCOMES_CHANGED_EVENT, onOutcomes);
  }, []);

  const resetForm = () => {
    setName("");
    setMealType("lunch");
    setMealDescription("");
    setCarbEstimate("");
    setInsulinDose("");
    setInsulinTiming("before");
    setTimingMinutes("");
    setContext("");
    setOutcome("good");
    setOutcomeNotes("");
    setTags("");
    setEditingRoutine(null);
  };

  const openEditDialog = (routine: Routine) => {
    setEditingRoutine(routine);
    setName(routine.name);
    setMealType(routine.mealType);
    setMealDescription(routine.mealDescription);
    setCarbEstimate(routine.carbEstimate?.toString() || "");
    setInsulinDose(routine.insulinDose?.toString() || "");
    setInsulinTiming(routine.insulinTiming);
    setTimingMinutes(routine.timingMinutes?.toString() || "");
    setContext(routine.context || "");
    setOutcome(routine.outcome);
    setOutcomeNotes(routine.outcomeNotes || "");
    setTags(routine.tags.join(", "));
    setIsAddOpen(true);
  };

  const handleSave = () => {
    if (!name || !mealDescription) return;

    const routineData = {
      name,
      mealType,
      mealDescription,
      carbEstimate: carbEstimate ? parseFloat(carbEstimate) : undefined,
      insulinDose: insulinDose ? parseFloat(insulinDose) : undefined,
      insulinTiming,
      timingMinutes: timingMinutes ? parseInt(timingMinutes) : undefined,
      context: context || undefined,
      outcome,
      outcomeNotes: outcomeNotes || undefined,
      tags: tags.split(",").map(t => t.trim()).filter(Boolean),
    };

    if (editingRoutine) {
      storage.updateRoutine(editingRoutine.id, routineData);
    } else {
      storage.addRoutine(routineData);
    }

    setRoutines(storage.getRoutines());
    setIsAddOpen(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    storage.deleteRoutine(id);
    setRoutines(storage.getRoutines());
  };

  const handleUseRoutine = (id: string) => {
    storage.useRoutine(id);
    setRoutines(storage.getRoutines());
  };

  const resetExerciseForm = () => {
    setExName("");
    setExType("cardio");
    setExIntensity("moderate");
    setExDuration("");
    setExNotes("");
    setEditingExercise(null);
  };

  const openExerciseEditDialog = (routine: ExerciseRoutine) => {
    setEditingExercise(routine);
    setExName(routine.name);
    setExType(routine.exerciseType);
    setExIntensity(routine.intensity);
    setExDuration(routine.durationMinutes.toString());
    setExNotes(routine.notes || "");
    setIsExerciseAddOpen(true);
  };

  const handleExerciseSave = () => {
    if (!exName || !exDuration) return;

    const routineData = {
      name: exName,
      exerciseType: exType,
      intensity: exIntensity,
      durationMinutes: parseInt(exDuration),
      notes: exNotes || undefined,
    };

    if (editingExercise) {
      storage.updateExerciseRoutine(editingExercise.id, routineData);
    } else {
      storage.addExerciseRoutine(routineData);
    }

    setExerciseRoutines(storage.getExerciseRoutines());
    setIsExerciseAddOpen(false);
    resetExerciseForm();
  };

  const handleExerciseDelete = (id: string) => {
    storage.deleteExerciseRoutine(id);
    setExerciseRoutines(storage.getExerciseRoutines());
  };

  const handleUseExercise = (id: string) => {
    const existing = storage.getActiveExercise();
    if (existing) {
      toast({
        title: "Exercise already active",
        description: `"${existing.exerciseName}" is in progress. Finish it first.`,
        variant: "destructive",
      });
      return;
    }
    const routine = storage.getExerciseRoutines().find((r) => r.id === id);
    if (!routine) return;

    navigate(
      buildExerciseScenarioRepeatHref(
        {
          exerciseType: routine.exerciseType,
          durationMinutes: routine.durationMinutes,
          intensity: routine.intensity,
          exerciseName: routine.name,
          routineId: routine.id,
        },
        { from: "routines" },
      ),
    );
  };

  const handleSaveRecentAsRoutine = (session: RecentRepeatableExerciseSession) => {
    resetExerciseForm();
    setExName(
      session.exerciseName?.trim() ||
        `${EXERCISE_TYPES.find((t) => t.value === session.exerciseType)?.label ?? "Exercise"} routine`,
    );
    setExType(session.exerciseType);
    setExIntensity(session.intensity);
    setExDuration(String(session.durationMinutes));
    setIsExerciseAddOpen(true);
  };

  const filteredRoutines = filterMealType === "all" 
    ? routines 
    : routines.filter(r => r.mealType === filterMealType);

  const logHints = useMemo(() => {
    const cutoff30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const mealLogs = storage.getActivityLogs().filter(
      (l) => l.activityType === "meal_planning" && new Date(l.createdAt).getTime() >= cutoff30,
    );
    const mealCounts: Partial<Record<RoutineMealType, number>> = {};
    for (const l of mealLogs) {
      const m = l.activityDetails.match(/\bfor (breakfast|lunch|dinner|snack)\b/i);
      if (!m) continue;
      const mt = m[1].toLowerCase() as RoutineMealType;
      if (mt !== "breakfast" && mt !== "lunch" && mt !== "dinner" && mt !== "snack") continue;
      mealCounts[mt] = (mealCounts[mt] ?? 0) + 1;
    }
    let bestMeal: RoutineMealType | undefined;
    let bestMealN = 0;
    (["breakfast", "lunch", "dinner", "snack"] as const).forEach((k) => {
      const n = mealCounts[k] ?? 0;
      if (n > bestMealN) {
        bestMealN = n;
        bestMeal = k;
      }
    });

    const cutoff90 = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const outcomes = storage.getExerciseOutcomes().filter((o) => new Date(o.completedAt).getTime() >= cutoff90);
    const exMap = new Map<string, number>();
    for (const o of outcomes) {
      const k = `${o.exerciseType}\0${o.intensity}`;
      exMap.set(k, (exMap.get(k) ?? 0) + 1);
    }
    let bestEx: { type: ExerciseType; intensity: ExerciseIntensity; n: number } | undefined;
    for (const [k, n] of exMap) {
      const [type, intensity] = k.split("\0") as [ExerciseType, ExerciseIntensity];
      if (!bestEx || n > bestEx.n) bestEx = { type, intensity, n };
    }

    return {
      meal: bestMeal && bestMealN >= 2 ? { mealType: bestMeal, count: bestMealN } : null,
      exercise: bestEx && bestEx.n >= 3 ? bestEx : null,
    };
  }, []);

  const mostUsed = storage.getMostUsedRoutines(5);
  const recentlyUsed = storage.getRecentRoutines(5);

  const displayRoutines = activeTab === "all" 
    ? filteredRoutines.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : activeTab === "popular"
    ? mostUsed
    : recentlyUsed;

  return (
    <PageShell variant="standard" className="max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <PageHeader
            leading={<PageBackButton />}
            className="min-w-0 flex-1"
            title={
              <span className="flex items-start gap-3">
                <span className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900 shrink-0">
                  {activeSection === "meals" ? (
                    <Repeat className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Dumbbell className="h-6 w-6 text-green-600 dark:text-green-400" />
                  )}
                </span>
                <span>My Routines</span>
              </span>
            }
            description={
              <span data-testid="text-section-subtitle">
                {activeSection === "meals" ? "Meals and moments that worked well" : "Your scheduled exercise routines"}
              </span>
            }
            actions={
              <PageInfoDialog title="About Routines" description="Save meals and workouts that worked for you">
                <InfoSection title="What are Routines?">
                  <p>Your personal library of meals and workouts that went well. Save the details so you can repeat success with confidence.</p>
                </InfoSection>
                <InfoSection title="Pattern recall">
                  <p>This is not about calculating doses — it is about remembering what worked. When you face a similar meal or workout, you can recall what you did before.</p>
                </InfoSection>
                <InfoSection title="Exercise">
                  <p>Completed workouts appear under Recent. Restart them in the exercise guide and only update today&apos;s BG and meal details.</p>
                </InfoSection>
                <InfoSection title="Not medical advice">
                  <p className="text-xs italic">Educational pattern tracking only. Always use your own judgement and follow your healthcare team&apos;s guidance.</p>
                </InfoSection>
              </PageInfoDialog>
            }
          />
        </div>

        <div className="flex gap-2" data-testid="section-switcher">
          <Button
            variant={activeSection === "meals" ? "default" : "outline"}
            onClick={() => setActiveSection("meals")}
            data-testid="button-section-meals"
          >
            <Utensils className="h-4 w-4 mr-2" />
            Meal Routines
          </Button>
          <Button
            variant={activeSection === "exercise" ? "default" : "outline"}
            onClick={() => setActiveSection("exercise")}
            data-testid="button-section-exercise"
          >
            <Dumbbell className="h-4 w-4 mr-2" />
            Exercise Routines
          </Button>
        </div>

        {activeSection === "meals" && (
        <>
        {logHints.meal && (
          <Card className="rounded-2xl border-border/60 bg-muted/15 shadow-none" data-testid="card-meal-log-hint">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">From your logs:</span> Meal planner entries often use{" "}
                  <strong>{getMealLabel(logHints.meal.mealType)}</strong> ({logHints.meal.count} in the last 30 days). Open
                  a new routine with that meal type?
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    resetForm();
                    setMealType(logHints.meal!.mealType);
                    setIsAddOpen(true);
                  }}
                  data-testid="button-apply-meal-hint"
                >
                  Prefill &amp; save
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between flex-wrap gap-3">
          <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-routine">
                <Plus className="h-4 w-4 mr-2" />
                Save a Routine
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg !grid-rows-[auto_1fr_auto] max-h-[min(80vh,42rem)] gap-5">
              <DialogHeader>
                <DialogTitle>{editingRoutine ? "Edit Routine" : "Save a New Routine"}</DialogTitle>
                <DialogDescription>
                  Record a meal or moment that went well so you can repeat it
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 overflow-y-auto pr-2 -mr-2" style={{ maxHeight: 'calc(80vh - 180px)' }}>
                <div className="space-y-2">
                  <Label htmlFor="routine-name">Give it a name</Label>
                  <Input
                    id="routine-name"
                    placeholder="e.g., 'Monday morning porridge' or 'Friday pizza night'"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    data-testid="input-routine-name"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Meal type</Label>
                    <Select value={mealType} onValueChange={(v: RoutineMealType) => setMealType(v)}>
                      <SelectTrigger data-testid="select-meal-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MEAL_TYPES.map(mt => (
                          <SelectItem key={mt.value} value={mt.value} data-testid={`option-meal-${mt.value}`}>{mt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>How did it go?</Label>
                    <Select value={outcome} onValueChange={(v: RoutineOutcome) => setOutcome(v)}>
                      <SelectTrigger data-testid="select-outcome">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OUTCOMES.map(o => (
                          <SelectItem key={o.value} value={o.value} data-testid={`option-outcome-${o.value}`}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="meal-desc">What did you eat?</Label>
                  <Textarea
                    id="meal-desc"
                    placeholder="Describe the meal in your own words..."
                    value={mealDescription}
                    onChange={(e) => setMealDescription(e.target.value)}
                    className="resize-none"
                    rows={2}
                    data-testid="input-meal-description"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="carbs">Carbs (approx)</Label>
                    <Input
                      id="carbs"
                      type="number"
                      placeholder="e.g., 45"
                      value={carbEstimate}
                      onChange={(e) => setCarbEstimate(e.target.value)}
                      data-testid="input-carbs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dose">Insulin dose</Label>
                    <Input
                      id="dose"
                      type="number"
                      step="0.5"
                      placeholder="e.g., 5"
                      value={insulinDose}
                      onChange={(e) => setInsulinDose(e.target.value)}
                      data-testid="input-insulin-dose"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>When did you take insulin?</Label>
                    <Select value={insulinTiming} onValueChange={(v: "before" | "with" | "after") => setInsulinTiming(v)}>
                      <SelectTrigger data-testid="select-timing">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMING_OPTIONS.map(t => (
                          <SelectItem key={t.value} value={t.value} data-testid={`option-timing-${t.value}`}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {insulinTiming === "before" && (
                    <div className="space-y-2">
                      <Label htmlFor="timing-mins">Minutes before?</Label>
                      <Input
                        id="timing-mins"
                        type="number"
                        placeholder="e.g., 15"
                        value={timingMinutes}
                        onChange={(e) => setTimingMinutes(e.target.value)}
                        data-testid="input-timing-minutes"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="context">Any context to remember?</Label>
                  <Textarea
                    id="context"
                    placeholder="e.g., 'After a morning walk' or 'Had coffee with it'"
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    className="resize-none"
                    rows={2}
                    data-testid="input-context"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="outcome-notes">Notes on the outcome</Label>
                  <Textarea
                    id="outcome-notes"
                    placeholder="How did your levels respond? Anything you'd do differently?"
                    value={outcomeNotes}
                    onChange={(e) => setOutcomeNotes(e.target.value)}
                    className="resize-none"
                    rows={2}
                    data-testid="input-outcome-notes"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tags" className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Tags (comma-separated)
                  </Label>
                  <Input
                    id="tags"
                    placeholder="e.g., quick, high-protein, weekend"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    data-testid="input-tags"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 border-t border-border/40 pt-4 sm:gap-0">
                <DialogClose asChild>
                  <Button variant="outline" data-testid="button-cancel-routine">Cancel</Button>
                </DialogClose>
                <Button onClick={handleSave} disabled={!name || !mealDescription} data-testid="button-save-routine">
                  {editingRoutine ? "Save Changes" : "Save Routine"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="flex items-center gap-2">
            <Select value={filterMealType} onValueChange={(v: RoutineMealType | "all") => setFilterMealType(v)}>
              <SelectTrigger className="w-36" data-testid="select-filter-meal">
                <SelectValue placeholder="Filter by meal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-filter-all">All meals</SelectItem>
                {MEAL_TYPES.map(mt => (
                  <SelectItem key={mt.value} value={mt.value} data-testid={`option-filter-${mt.value}`}>{mt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="all" className="flex items-center gap-2" data-testid="tab-all">
              <Utensils className="h-4 w-4" />
              All
            </TabsTrigger>
            <TabsTrigger value="popular" className="flex items-center gap-2" data-testid="tab-popular">
              <TrendingUp className="h-4 w-4" />
              Most Used
            </TabsTrigger>
            <TabsTrigger value="recent" className="flex items-center gap-2" data-testid="tab-recent">
              <History className="h-4 w-4" />
              Recent
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            {displayRoutines.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <Repeat className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-medium text-lg mb-2">
                      {activeTab === "all" ? "No routines saved yet" : activeTab === "popular" ? "No frequently used routines" : "No recently used routines"}
                    </h3>
                    <p className="text-muted-foreground text-sm max-w-md mx-auto">
                      {activeTab === "all" 
                        ? "Start by saving a meal or moment that went well. Over time, you'll build a library of your personal successes."
                        : "Use your routines to track which approaches work best for you."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3.5">
                {displayRoutines.map((routine) => {
                  const insulinLine = formatRoutineInsulinLine(routine);
                  return (
                  <Card
                    key={routine.id}
                    className="overflow-hidden border-border/50 shadow-none ring-1 ring-black/[0.03] dark:ring-white/[0.04]"
                    data-testid={`card-routine-${routine.id}`}
                  >
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex gap-3.5">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300">
                          {getMealIcon(routine.mealType)}
                        </div>
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-2">
                              <h3
                                className="truncate text-[15px] font-semibold leading-snug tracking-tight text-foreground"
                                data-testid={`text-routine-name-${routine.id}`}
                              >
                                {routine.name}
                              </h3>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variant="outline" className="rounded-md px-2 py-0.5 text-[11px] font-medium">
                                  {getMealLabel(routine.mealType)}
                                </Badge>
                                <Badge className={`rounded-md px-2 py-0.5 text-[11px] font-medium shadow-none ${getOutcomeStyle(routine.outcome)}`}>
                                  {getOutcomeLabel(routine.outcome)}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-9 rounded-xl px-3 font-semibold shadow-none"
                                onClick={() => handleUseRoutine(routine.id)}
                                data-testid={`button-use-routine-${routine.id}`}
                              >
                                <Check className="mr-1.5 h-4 w-4" aria-hidden />
                                Use
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-9 w-9 rounded-xl text-muted-foreground"
                                onClick={() => openEditDialog(routine)}
                                aria-label="Edit routine"
                                data-testid={`button-edit-routine-${routine.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-9 w-9 rounded-xl text-destructive/80 hover:text-destructive"
                                onClick={() => handleDelete(routine.id)}
                                aria-label="Delete routine"
                                data-testid={`button-delete-routine-${routine.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {routine.mealDescription ? (
                            <p
                              className="text-sm leading-relaxed text-muted-foreground line-clamp-3"
                              data-testid={`text-routine-meal-${routine.id}`}
                            >
                              {routine.mealDescription}
                            </p>
                          ) : null}

                          {(routine.carbEstimate || insulinLine || routine.timesUsed > 0) ? (
                            <div className="flex flex-wrap gap-2">
                              {routine.carbEstimate ? (
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/55 px-2.5 py-1.5 text-xs font-medium text-foreground/80">
                                  <Utensils className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                                  ~{routine.carbEstimate}g carbs
                                </span>
                              ) : null}
                              {insulinLine ? (
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/55 px-2.5 py-1.5 text-xs font-medium text-foreground/80">
                                  <Syringe className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                                  {insulinLine}
                                </span>
                              ) : null}
                              {routine.timesUsed > 0 ? (
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/55 px-2.5 py-1.5 text-xs font-medium text-foreground/80">
                                  <Star className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                                  Used {routine.timesUsed}x
                                </span>
                              ) : null}
                            </div>
                          ) : null}

                          {routine.tags.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {routine.tags.map((tag, i) => (
                                <Badge
                                  key={i}
                                  variant="secondary"
                                  className="rounded-md px-2 py-0.5 text-[11px] font-normal"
                                  data-testid={`badge-tag-${routine.id}-${i}`}
                                >
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          ) : null}

                          {(routine.context || routine.outcomeNotes) ? (
                            <div className="space-y-1.5 border-t border-border/50 pt-3 text-sm leading-relaxed text-muted-foreground">
                              {routine.context ? (
                                <p>
                                  <span className="font-medium text-foreground/80">Context:</span> {routine.context}
                                </p>
                              ) : null}
                              {routine.outcomeNotes ? (
                                <p>
                                  <span className="font-medium text-foreground/80">Notes:</span> {routine.outcomeNotes}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            )}
          </div>
        </Tabs>
        </>
        )}

        {activeSection === "exercise" && (
        <>
        {logHints.exercise && (
          <Card className="rounded-2xl border-border/60 bg-muted/15 shadow-none" data-testid="card-exercise-log-hint">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">From your logs:</span> Similar workouts (
                  {EXERCISE_INTENSITIES.find((i) => i.value === logHints.exercise!.intensity)?.label?.toLowerCase()}{" "}
                  {EXERCISE_TYPES.find((t) => t.value === logHints.exercise!.type)?.label.toLowerCase()}) appear often (
                  {logHints.exercise.n} sessions in the last 90 days). Prefill a new exercise routine?
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    resetExerciseForm();
                    setExType(logHints.exercise!.type);
                    setExIntensity(logHints.exercise!.intensity);
                    setIsExerciseAddOpen(true);
                  }}
                  data-testid="button-apply-exercise-hint"
                >
                  Prefill &amp; save
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {recentWorkouts.length > 0 ? (
          <div className="space-y-3" data-testid="section-recent-workouts">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" aria-hidden />
              <h3 className="font-medium text-foreground">Recent workouts</h3>
            </div>
            <p className="text-sm text-muted-foreground -mt-1">
              Restart a completed session in the exercise guide — only update today&apos;s BG and meal details.
            </p>
            <div className="space-y-3">
              {recentWorkouts.map((session) => (
                <Card key={session.id} data-testid={`card-recent-workout-${session.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="p-2 rounded-lg bg-muted shrink-0">
                          <History className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium truncate">
                              {session.exerciseName?.trim() || session.label}
                            </h3>
                            <Badge variant="outline" className="text-xs">
                              {EXERCISE_TYPES.find((t) => t.value === session.exerciseType)?.label}
                            </Badge>
                            <Badge className={`text-xs ${getIntensityStyle(session.intensity)}`}>
                              {EXERCISE_INTENSITIES.find((i) => i.value === session.intensity)?.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {session.durationMinutes} min
                            </span>
                            <span>{format(new Date(session.completedAt), "d MMM yyyy")}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          asChild
                          data-testid={`button-restart-recent-${session.id}`}
                        >
                          <Link href={buildExerciseScenarioRepeatHref(session, { from: "routines" })}>
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Restart
                          </Link>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleSaveRecentAsRoutine(session)}
                          title="Save as routine"
                          data-testid={`button-save-recent-${session.id}`}
                        >
                          <BookmarkPlus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between flex-wrap gap-3">
          <Dialog open={isExerciseAddOpen} onOpenChange={(open) => { setIsExerciseAddOpen(open); if (!open) resetExerciseForm(); }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-exercise-routine">
                <Plus className="h-4 w-4 mr-2" />
                Add Exercise Routine
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg !grid-rows-[auto_1fr_auto] max-h-[min(80vh,42rem)] gap-5">
              <DialogHeader>
                <DialogTitle>{editingExercise ? "Edit Exercise Routine" : "Add Exercise Routine"}</DialogTitle>
                <DialogDescription>
                  Save an exercise for quick access from the dashboard
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 overflow-y-auto pr-2 -mr-2" style={{ maxHeight: 'calc(80vh - 180px)' }}>
                <div className="space-y-2">
                  <Label htmlFor="exercise-name">Name</Label>
                  <Input
                    id="exercise-name"
                    placeholder="e.g., 'Morning jog' or 'Gym session'"
                    value={exName}
                    onChange={(e) => setExName(e.target.value)}
                    data-testid="input-exercise-name"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Exercise type</Label>
                    <Select value={exType} onValueChange={(v: ExerciseType) => setExType(v)}>
                      <SelectTrigger data-testid="select-exercise-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EXERCISE_TYPES.map(et => (
                          <SelectItem key={et.value} value={et.value} data-testid={`option-exercise-type-${et.value}`}>{et.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Intensity</Label>
                    <Select value={exIntensity} onValueChange={(v: ExerciseIntensity) => setExIntensity(v)}>
                      <SelectTrigger data-testid="select-exercise-intensity">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EXERCISE_INTENSITIES.map(ei => (
                          <SelectItem key={ei.value} value={ei.value} data-testid={`option-exercise-intensity-${ei.value}`}>{ei.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="exercise-duration">Duration (minutes)</Label>
                    <Input
                      id="exercise-duration"
                      type="number"
                      placeholder="e.g., 30"
                      value={exDuration}
                      onChange={(e) => setExDuration(e.target.value)}
                      data-testid="input-exercise-duration"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="exercise-notes">Notes (optional)</Label>
                  <Textarea
                    id="exercise-notes"
                    placeholder="Any notes about this routine..."
                    value={exNotes}
                    onChange={(e) => setExNotes(e.target.value)}
                    className="resize-none"
                    rows={2}
                    data-testid="input-exercise-notes"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 border-t border-border/40 pt-4 sm:gap-0">
                <DialogClose asChild>
                  <Button variant="outline" data-testid="button-cancel-exercise">Cancel</Button>
                </DialogClose>
                <Button onClick={handleExerciseSave} disabled={!exName || !exDuration} data-testid="button-save-exercise">
                  {editingExercise ? "Save Changes" : "Add Routine"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {exerciseRoutines.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Dumbbell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium text-lg mb-2">No saved exercise routines yet</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  {recentWorkouts.length > 0
                    ? "Restart a recent workout above, or save one as a routine for quicker access."
                    : "Add your first exercise routine to start tracking your workouts and building healthy habits."}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3.5">
            <h3 className="font-medium text-foreground">Saved routines</h3>
            {exerciseRoutines.map((routine) => (
              <Card
                key={routine.id}
                className="overflow-hidden border-border/50 shadow-none ring-1 ring-black/[0.03] dark:ring-white/[0.04]"
                data-testid={`card-exercise-routine-${routine.id}`}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
                      <Dumbbell className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-2">
                          <h3
                            className="truncate text-[15px] font-semibold leading-snug tracking-tight text-foreground"
                            data-testid={`text-exercise-name-${routine.id}`}
                          >
                            {routine.name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="rounded-md px-2 py-0.5 text-[11px] font-medium">
                              {EXERCISE_TYPES.find((t) => t.value === routine.exerciseType)?.label}
                            </Badge>
                            <Badge className={`rounded-md px-2 py-0.5 text-[11px] font-medium shadow-none ${getIntensityStyle(routine.intensity)}`}>
                              {EXERCISE_INTENSITIES.find((i) => i.value === routine.intensity)?.label}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            size="sm"
                            className="h-9 rounded-xl px-3 font-semibold shadow-none"
                            onClick={() => handleUseExercise(routine.id)}
                            data-testid={`button-use-exercise-${routine.id}`}
                          >
                            <Play className="mr-1.5 h-4 w-4" aria-hidden />
                            Start
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 rounded-xl text-muted-foreground"
                            onClick={() => openExerciseEditDialog(routine)}
                            aria-label="Edit exercise routine"
                            data-testid={`button-edit-exercise-${routine.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 rounded-xl text-destructive/80 hover:text-destructive"
                            onClick={() => handleExerciseDelete(routine.id)}
                            aria-label="Delete exercise routine"
                            data-testid={`button-delete-exercise-${routine.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/55 px-2.5 py-1.5 text-xs font-medium text-foreground/80">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                          {routine.durationMinutes} min
                        </span>
                        {routine.timesUsed > 0 ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/55 px-2.5 py-1.5 text-xs font-medium text-foreground/80">
                            <Star className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                            Used {routine.timesUsed}x
                          </span>
                        ) : null}
                      </div>

                      {routine.notes ? (
                        <div className="border-t border-border/50 pt-3 text-sm leading-relaxed text-muted-foreground">
                          <span className="font-medium text-foreground/80">Notes:</span> {routine.notes}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        </>
        )}
    </PageShell>
  );
}

export default function Routines() {
  return <RoutinesContent />;
}
