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
import { Repeat, Plus, Utensils, Coffee, Sun, Moon, Cookie, Clock, Syringe, Check, Trash2, Pencil, Sparkles, Star, TrendingUp, History, Info, Tag } from "lucide-react";
import { storage, Routine, RoutineMealType, RoutineOutcome, UserSettings } from "@/lib/storage";
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

export function RoutinesContent() {
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

  useEffect(() => {
    setRoutines(storage.getRoutines());
    setSettings(storage.getSettings());
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
              <Repeat className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">My Routines</h1>
              <p className="text-muted-foreground text-sm">Meals and moments that worked well</p>
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
            <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>{editingRoutine ? "Edit Routine" : "Save a New Routine"}</DialogTitle>
                <DialogDescription>
                  Record a meal or moment that went well so you can repeat it
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 overflow-y-auto flex-1 pr-2">
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
              <DialogFooter className="flex-shrink-0 border-t pt-4 mt-2">
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
