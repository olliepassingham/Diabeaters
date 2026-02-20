import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Repeat, Plus, Utensils, Coffee, Sun, Moon, Cookie, Clock, Syringe, Check, Trash2, Pencil, Sparkles, Star, TrendingUp, History, Info, Tag, Dumbbell, Calendar } from "lucide-react";
import { storage, Routine, RoutineMealType, RoutineOutcome, UserSettings, ExerciseRoutine, ExerciseType, ExerciseIntensity, UpcomingExercise } from "@/lib/storage";
import { format } from "date-fns";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";

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

function getMealIcon(type: RoutineMealType) {
  const found = MEAL_TYPES.find(t => t.value === type);
  const Icon = found ? found.icon : Utensils;
  return <Icon className="h-4 w-4" />;
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

const EXERCISE_TYPES: { value: ExerciseType; label: string }[] = [
  { value: "cardio", label: "Cardio" },
  { value: "strength", label: "Strength" },
  { value: "hiit", label: "HIIT" },
  { value: "yoga", label: "Yoga" },
  { value: "walking", label: "Walking" },
  { value: "sports", label: "Sports" },
  { value: "swimming", label: "Swimming" },
];

const EXERCISE_INTENSITIES: { value: ExerciseIntensity; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "moderate", label: "Moderate" },
  { value: "intense", label: "Intense" },
];

const DAY_LABELS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

function formatScheduleDays(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  return sorted.map(d => DAY_LABELS.find(dl => dl.value === d)?.label || "").join(", ");
}

function getIntensityStyle(intensity: ExerciseIntensity): string {
  switch (intensity) {
    case "light": return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
    case "moderate": return "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300";
    case "intense": return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
  }
}

export function RoutinesContent() {
  const [activeSection, setActiveSection] = useState<"meals" | "exercise">("meals");
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
  const [upcomingExercises, setUpcomingExercises] = useState<UpcomingExercise[]>([]);
  const [isExerciseAddOpen, setIsExerciseAddOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<ExerciseRoutine | null>(null);
  const [exName, setExName] = useState("");
  const [exType, setExType] = useState<ExerciseType>("cardio");
  const [exIntensity, setExIntensity] = useState<ExerciseIntensity>("moderate");
  const [exDuration, setExDuration] = useState("");
  const [exDays, setExDays] = useState<number[]>([]);
  const [exTime, setExTime] = useState("08:00");
  const [exNotes, setExNotes] = useState("");

  useEffect(() => {
    setRoutines(storage.getRoutines());
    setSettings(storage.getSettings());
    setExerciseRoutines(storage.getExerciseRoutines());
    setUpcomingExercises(storage.getUpcomingExercises());
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
    setExDays([]);
    setExTime("08:00");
    setExNotes("");
    setEditingExercise(null);
  };

  const openExerciseEditDialog = (routine: ExerciseRoutine) => {
    setEditingExercise(routine);
    setExName(routine.name);
    setExType(routine.exerciseType);
    setExIntensity(routine.intensity);
    setExDuration(routine.durationMinutes.toString());
    setExDays([...routine.scheduledDays]);
    setExTime(routine.scheduledTime);
    setExNotes(routine.notes || "");
    setIsExerciseAddOpen(true);
  };

  const handleExerciseSave = () => {
    if (!exName || !exDuration || exDays.length === 0) return;

    const routineData = {
      name: exName,
      exerciseType: exType,
      intensity: exIntensity,
      durationMinutes: parseInt(exDuration),
      scheduledDays: exDays,
      scheduledTime: exTime,
      notes: exNotes || undefined,
    };

    if (editingExercise) {
      storage.updateExerciseRoutine(editingExercise.id, routineData);
    } else {
      storage.addExerciseRoutine(routineData);
    }

    setExerciseRoutines(storage.getExerciseRoutines());
    setUpcomingExercises(storage.getUpcomingExercises());
    setIsExerciseAddOpen(false);
    resetExerciseForm();
  };

  const handleExerciseDelete = (id: string) => {
    storage.deleteExerciseRoutine(id);
    setExerciseRoutines(storage.getExerciseRoutines());
    setUpcomingExercises(storage.getUpcomingExercises());
  };

  const handleUseExercise = (id: string) => {
    storage.useExerciseRoutine(id);
    setExerciseRoutines(storage.getExerciseRoutines());
    setUpcomingExercises(storage.getUpcomingExercises());
  };

  const toggleExerciseDay = (day: number) => {
    setExDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const filteredRoutines = filterMealType === "all" 
    ? routines 
    : routines.filter(r => r.mealType === filterMealType);

  const mostUsed = storage.getMostUsedRoutines(5);
  const recentlyUsed = storage.getRecentRoutines(5);

  const displayRoutines = activeTab === "all" 
    ? filteredRoutines.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : activeTab === "popular"
    ? mostUsed
    : recentlyUsed;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900">
              {activeSection === "meals" ? (
                <Repeat className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Dumbbell className="h-6 w-6 text-green-600 dark:text-green-400" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold">My Routines</h1>
              <p className="text-muted-foreground text-sm" data-testid="text-section-subtitle">
                {activeSection === "meals" ? "Meals and moments that worked well" : "Your scheduled exercise routines"}
              </p>
            </div>
          </div>
          <PageInfoDialog title="About Routines" description="Save and recall your successful meals and moments">
            <InfoSection title="What are Routines?">
              <p>Routines are your personal collection of meals and moments that went well. Save the details of what worked so you can confidently repeat success.</p>
            </InfoSection>
            <InfoSection title="Pattern Recall">
              <p>This isn't about calculating doses - it's about remembering what worked. When you face a similar meal or situation, you can recall exactly what you did before.</p>
            </InfoSection>
            <InfoSection title="Building Confidence">
              <p>Every successful routine you save builds your confidence and reduces the mental load of daily decisions. Over time, you'll develop a reliable library of go-to approaches.</p>
            </InfoSection>
            <InfoSection title="Not Medical Advice">
              <p className="text-xs italic">[This feature helps you track patterns. It does not provide medical recommendations. Always use your own judgement and follow your healthcare team's guidance.]</p>
            </InfoSection>
          </PageInfoDialog>
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
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-emerald-100 dark:border-emerald-900">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-emerald-800 dark:text-emerald-200">Your Success Library</p>
                <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                  Save meals that went well so you can repeat them with confidence. No calculations, no recommendations - just your own patterns that work for you.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-routine">
                <Plus className="h-4 w-4 mr-2" />
                Save a Routine
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg !grid-rows-[auto_1fr_auto] max-h-[80vh]">
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
              <DialogFooter className="border-t pt-4">
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
              <div className="space-y-3">
                {displayRoutines.map((routine) => (
                  <Card key={routine.id} data-testid={`card-routine-${routine.id}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="p-2 rounded-lg bg-muted shrink-0">
                            {getMealIcon(routine.mealType)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium" data-testid={`text-routine-name-${routine.id}`}>{routine.name}</h3>
                              <Badge variant="outline" className="text-xs">{getMealLabel(routine.mealType)}</Badge>
                              <Badge className={`text-xs ${getOutcomeStyle(routine.outcome)}`}>
                                {getOutcomeLabel(routine.outcome)}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2" data-testid={`text-routine-meal-${routine.id}`}>
                              {routine.mealDescription}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                              {routine.carbEstimate && (
                                <span className="flex items-center gap-1">
                                  <Utensils className="h-3 w-3" />
                                  ~{routine.carbEstimate}g carbs
                                </span>
                              )}
                              {routine.insulinDose && (
                                <span className="flex items-center gap-1">
                                  <Syringe className="h-3 w-3" />
                                  {routine.insulinDose}u {routine.insulinTiming === "before" && routine.timingMinutes ? `(${routine.timingMinutes}min before)` : routine.insulinTiming === "with" ? "(with meal)" : "(after)"}
                                </span>
                              )}
                              {routine.timesUsed > 0 && (
                                <span className="flex items-center gap-1">
                                  <Star className="h-3 w-3" />
                                  Used {routine.timesUsed}x
                                </span>
                              )}
                            </div>
                            {routine.tags.length > 0 && (
                              <div className="flex items-center gap-1 mt-2 flex-wrap">
                                {routine.tags.map((tag, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs" data-testid={`badge-tag-${routine.id}-${i}`}>
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUseRoutine(routine.id)}
                            data-testid={`button-use-routine-${routine.id}`}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Use
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEditDialog(routine)}
                            data-testid={`button-edit-routine-${routine.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(routine.id)}
                            className="text-destructive"
                            data-testid={`button-delete-routine-${routine.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {routine.context && (
                        <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
                          <span className="font-medium">Context:</span> {routine.context}
                        </div>
                      )}
                      {routine.outcomeNotes && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          <span className="font-medium">Notes:</span> {routine.outcomeNotes}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </Tabs>
        </>
        )}

        {activeSection === "exercise" && (
        <>
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-100 dark:border-green-900">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Dumbbell className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">Exercise Schedule</p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  Plan and track your exercise routines. Set your schedule and log when you complete workouts.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {upcomingExercises.length > 0 && (
          <Card className="border-green-200 dark:border-green-800">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="font-medium text-sm">Next up</span>
              </div>
              <div className="space-y-2">
                {upcomingExercises.slice(0, 3).map((upcoming, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-sm" data-testid={`text-upcoming-exercise-${i}`}>
                    <div className="flex items-center gap-2">
                      <Dumbbell className="h-3 w-3 text-green-600 dark:text-green-400" />
                      <span className="font-medium">{upcoming.routine.name}</span>
                      <span className="text-muted-foreground">
                        {upcoming.minutesUntil < 60
                          ? `in ${upcoming.minutesUntil} min`
                          : upcoming.minutesUntil < 1440
                          ? `in ${Math.round(upcoming.minutesUntil / 60)}h`
                          : `in ${Math.round(upcoming.minutesUntil / 1440)}d`}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs">{upcoming.routine.exerciseType}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between flex-wrap gap-3">
          <Dialog open={isExerciseAddOpen} onOpenChange={(open) => { setIsExerciseAddOpen(open); if (!open) resetExerciseForm(); }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-exercise-routine">
                <Plus className="h-4 w-4 mr-2" />
                Add Exercise Routine
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg !grid-rows-[auto_1fr_auto] max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>{editingExercise ? "Edit Exercise Routine" : "Add Exercise Routine"}</DialogTitle>
                <DialogDescription>
                  Schedule a regular exercise routine
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
                  <div className="space-y-2">
                    <Label htmlFor="exercise-time">Scheduled time</Label>
                    <Input
                      id="exercise-time"
                      type="time"
                      value={exTime}
                      onChange={(e) => setExTime(e.target.value)}
                      data-testid="input-exercise-time"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Scheduled days</Label>
                  <div className="flex gap-1 flex-wrap" data-testid="day-selector">
                    {DAY_LABELS.map(day => (
                      <Button
                        key={day.value}
                        type="button"
                        size="sm"
                        variant={exDays.includes(day.value) ? "default" : "outline"}
                        className={`toggle-elevate ${exDays.includes(day.value) ? "toggle-elevated" : ""}`}
                        onClick={() => toggleExerciseDay(day.value)}
                        data-testid={`button-day-${day.value}`}
                      >
                        {day.label}
                      </Button>
                    ))}
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
              <DialogFooter className="border-t pt-4">
                <DialogClose asChild>
                  <Button variant="outline" data-testid="button-cancel-exercise">Cancel</Button>
                </DialogClose>
                <Button onClick={handleExerciseSave} disabled={!exName || !exDuration || exDays.length === 0} data-testid="button-save-exercise">
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
                <h3 className="font-medium text-lg mb-2">No exercise routines yet</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  Add your first exercise routine to start tracking your workouts and building healthy habits.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {exerciseRoutines.map((routine) => (
              <Card key={routine.id} data-testid={`card-exercise-routine-${routine.id}`}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900 shrink-0">
                        <Dumbbell className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium" data-testid={`text-exercise-name-${routine.id}`}>{routine.name}</h3>
                          <Badge variant="outline" className="text-xs">{EXERCISE_TYPES.find(t => t.value === routine.exerciseType)?.label}</Badge>
                          <Badge className={`text-xs ${getIntensityStyle(routine.intensity)}`}>
                            {EXERCISE_INTENSITIES.find(i => i.value === routine.intensity)?.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1" data-testid={`text-exercise-schedule-${routine.id}`}>
                            <Calendar className="h-3 w-3" />
                            {formatScheduleDays(routine.scheduledDays)} at {routine.scheduledTime}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {routine.durationMinutes} min
                          </span>
                          {routine.timesUsed > 0 && (
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3" />
                              Used {routine.timesUsed}x
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUseExercise(routine.id)}
                        data-testid={`button-use-exercise-${routine.id}`}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Use
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openExerciseEditDialog(routine)}
                        data-testid={`button-edit-exercise-${routine.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleExerciseDelete(routine.id)}
                        className="text-destructive"
                        data-testid={`button-delete-exercise-${routine.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {routine.notes && (
                    <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
                      <span className="font-medium">Notes:</span> {routine.notes}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        </>
        )}

        <Card data-testid="card-routines-disclaimer">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong>About Routines:</strong> This is your personal library of what works for you. 
                  It's about pattern recall and building confidence, not calculations or recommendations.
                </p>
                <p>
                  Everyone's diabetes is different. A routine that works once might need adjusting based on 
                  activity, stress, illness, or other factors.
                </p>
                <p className="text-xs italic" data-testid="text-routines-disclaimer">
                  [Not medical advice. Use your own judgement and follow your healthcare team's guidance.]
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}

export default function Routines() {
  return <RoutinesContent />;
}
