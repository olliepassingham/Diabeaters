import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Syringe,
  Sun,
  Sunset,
  Moon,
  Cookie,
  Target,
  TrendingDown,
  ArrowRight,
  Pencil,
  Save,
  X,
  AlertCircle,
  ThermometerSun,
  ThermometerSnowflake,
  Pill,
  History,
  Trash2,
  Plus,
  UtensilsCrossed,
  Clock,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { storage, UserSettings, ScenarioState, RatioHistoryEntry } from "@/lib/storage";
import { InfoTooltip } from "@/components/info-tooltip";

function parseRatio(ratio?: string): number | null {
  if (!ratio) return null;
  const match = ratio.match(/1\s*:\s*(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function formatRatio(grams: number): string {
  return `1:${Math.round(grams)}`;
}

interface ScenarioAdjustment {
  label: string;
  description: string;
  factor: number;
  icon: typeof Pill;
  color: string;
}

function getActiveAdjustments(scenarioState: ScenarioState): ScenarioAdjustment[] {
  const adjustments: ScenarioAdjustment[] = [];

  if (scenarioState.sickDayActive) {
    const severity = scenarioState.sickDaySeverity || "moderate";
    let factor: number;
    let desc: string;
    if (severity === "mild") {
      factor = 0.9;
      desc = "Mild illness — insulin resistance may increase slightly. Your body may need a little more insulin per gram of carb than usual.";
    } else if (severity === "severe") {
      factor = 0.8;
      desc = "Severe illness — insulin resistance often increases noticeably. Monitor closely and contact your diabetes team if blood sugars remain high.";
    } else {
      factor = 0.85;
      desc = "Moderate illness — insulin resistance usually increases. You may need somewhat more insulin per gram of carb.";
    }
    adjustments.push({
      label: `Sick Day (${severity})`,
      description: desc,
      factor,
      icon: Pill,
      color: "text-amber-600 dark:text-amber-400",
    });
  }

  if (scenarioState.travelModeActive) {
    const travelPlan = storage.getTravelPlan();
    if (travelPlan) {
      const weather = travelPlan.weatherChange;
      if (weather === "warmer") {
        const intensity = travelPlan.weatherIntensity || "moderate";
        let factor: number;
        let desc: string;
        if (intensity === "extreme") {
          factor = 1.15;
          desc = "Very hot destination — heat can increase insulin absorption. You may be more sensitive and need slightly less insulin per gram of carb.";
        } else if (intensity === "significant") {
          factor = 1.1;
          desc = "Significantly warmer destination — heat may increase insulin sensitivity slightly.";
        } else {
          factor = 1.05;
          desc = "Moderately warmer destination — minor increase in insulin sensitivity possible.";
        }
        adjustments.push({
          label: `Travel — Hot Climate`,
          description: desc,
          factor,
          icon: ThermometerSun,
          color: "text-orange-600 dark:text-orange-400",
        });
      } else if (weather === "colder") {
        const intensity = travelPlan.weatherIntensity || "moderate";
        let factor: number;
        let desc: string;
        if (intensity === "extreme") {
          factor = 0.85;
          desc = "Very cold destination — cold can increase insulin resistance. You may need somewhat more insulin per gram of carb.";
        } else if (intensity === "significant") {
          factor = 0.9;
          desc = "Significantly colder destination — cold may increase insulin resistance slightly.";
        } else {
          factor = 0.95;
          desc = "Moderately colder destination — minor increase in insulin resistance possible.";
        }
        adjustments.push({
          label: `Travel — Cold Climate`,
          description: desc,
          factor,
          icon: ThermometerSnowflake,
          color: "text-blue-600 dark:text-blue-400",
        });
      }
    }
  }

  return adjustments;
}

const MIN_COMBINED_FACTOR = 0.75;
const MAX_COMBINED_FACTOR = 1.25;

function clampFactor(factor: number): number {
  return Math.max(MIN_COMBINED_FACTOR, Math.min(MAX_COMBINED_FACTOR, factor));
}

function getAdjustedRatio(baseRatio: string | undefined, factor: number): string | null {
  const grams = parseRatio(baseRatio);
  if (grams === null) return null;
  const clamped = clampFactor(factor);
  return formatRatio(Math.round(grams * clamped));
}

function getMealIcon(meal: string) {
  switch (meal) {
    case "Breakfast": return Sun;
    case "Lunch": return Sunset;
    case "Dinner": return Moon;
    case "Snack": return Cookie;
    default: return UtensilsCrossed;
  }
}

function getMealTime(meal: string) {
  switch (meal) {
    case "Breakfast": return "Morning";
    case "Lunch": return "Midday";
    case "Dinner": return "Evening";
    case "Snack": return "Any time";
    default: return "";
  }
}

export default function Ratios() {
  const [settings, setSettings] = useState<UserSettings>({});
  const [scenarioState, setScenarioState] = useState<ScenarioState>({ travelModeActive: false, sickDayActive: false });
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    breakfastRatio: "",
    lunchRatio: "",
    dinnerRatio: "",
    snackRatio: "",
    correctionFactor: "",
    targetBgLow: "",
    targetBgHigh: "",
  });
  const [history, setHistory] = useState<RatioHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [snapshotNote, setSnapshotNote] = useState("");
  const [showSnapshotDialog, setShowSnapshotDialog] = useState(false);

  useEffect(() => {
    const s = storage.getSettings();
    setSettings(s);
    setScenarioState(storage.getScenarioState());
    setHistory(storage.getRatioHistory());
    setEditValues({
      breakfastRatio: s.breakfastRatio || "",
      lunchRatio: s.lunchRatio || "",
      dinnerRatio: s.dinnerRatio || "",
      snackRatio: s.snackRatio || "",
      correctionFactor: s.correctionFactor?.toString() || "",
      targetBgLow: s.targetBgLow?.toString() || "",
      targetBgHigh: s.targetBgHigh?.toString() || "",
    });
  }, []);

  const adjustments = getActiveAdjustments(scenarioState);
  const hasAnyAdjustment = adjustments.length > 0;
  const combinedFactor = adjustments.reduce((acc, a) => acc * a.factor, 1);

  const meals = [
    { name: "Breakfast", ratio: settings.breakfastRatio, key: "breakfastRatio" as const },
    { name: "Lunch", ratio: settings.lunchRatio, key: "lunchRatio" as const },
    { name: "Dinner", ratio: settings.dinnerRatio, key: "dinnerRatio" as const },
    { name: "Snack", ratio: settings.snackRatio, key: "snackRatio" as const },
  ];

  const hasRatios = meals.some(m => m.ratio);

  const handleSaveRatios = () => {
    const oldSettings = storage.getSettings();
    const hasChanged =
      oldSettings.breakfastRatio !== editValues.breakfastRatio ||
      oldSettings.lunchRatio !== editValues.lunchRatio ||
      oldSettings.dinnerRatio !== editValues.dinnerRatio ||
      oldSettings.snackRatio !== editValues.snackRatio ||
      oldSettings.correctionFactor?.toString() !== editValues.correctionFactor;

    if (hasChanged && hasRatios) {
      storage.snapshotCurrentRatios("Auto-saved before update");
      setHistory(storage.getRatioHistory());
    }

    const updated = {
      ...oldSettings,
      breakfastRatio: editValues.breakfastRatio || undefined,
      lunchRatio: editValues.lunchRatio || undefined,
      dinnerRatio: editValues.dinnerRatio || undefined,
      snackRatio: editValues.snackRatio || undefined,
      correctionFactor: editValues.correctionFactor ? parseFloat(editValues.correctionFactor) : undefined,
      targetBgLow: editValues.targetBgLow ? parseFloat(editValues.targetBgLow) : undefined,
      targetBgHigh: editValues.targetBgHigh ? parseFloat(editValues.targetBgHigh) : undefined,
    };
    storage.saveSettings(updated);
    setSettings(updated);
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setEditValues({
      breakfastRatio: settings.breakfastRatio || "",
      lunchRatio: settings.lunchRatio || "",
      dinnerRatio: settings.dinnerRatio || "",
      snackRatio: settings.snackRatio || "",
      correctionFactor: settings.correctionFactor?.toString() || "",
      targetBgLow: settings.targetBgLow?.toString() || "",
      targetBgHigh: settings.targetBgHigh?.toString() || "",
    });
    setEditing(false);
  };

  const handleManualSnapshot = () => {
    storage.snapshotCurrentRatios(snapshotNote || "Manual snapshot");
    setHistory(storage.getRatioHistory());
    setSnapshotNote("");
    setShowSnapshotDialog(false);
  };

  const handleDeleteHistoryEntry = (id: string) => {
    storage.deleteRatioHistoryEntry(id);
    setHistory(storage.getRatioHistory());
  };

  const handleRestoreHistoryEntry = (entry: RatioHistoryEntry) => {
    storage.snapshotCurrentRatios("Auto-saved before restore");
    const current = storage.getSettings();
    const updated = {
      ...current,
      breakfastRatio: entry.breakfastRatio,
      lunchRatio: entry.lunchRatio,
      dinnerRatio: entry.dinnerRatio,
      snackRatio: entry.snackRatio,
      correctionFactor: entry.correctionFactor,
    };
    storage.saveSettings(updated);
    setSettings(updated);
    setEditValues({
      breakfastRatio: updated.breakfastRatio || "",
      lunchRatio: updated.lunchRatio || "",
      dinnerRatio: updated.dinnerRatio || "",
      snackRatio: updated.snackRatio || "",
      correctionFactor: updated.correctionFactor?.toString() || "",
      targetBgLow: updated.targetBgLow?.toString() || "",
      targetBgHigh: updated.targetBgHigh?.toString() || "",
    });
    setHistory(storage.getRatioHistory());
  };

  const profile = storage.getProfile();
  const bgUnit = profile?.bgUnits === "mg/dl" ? "mg/dL" : "mmol/L";

  return (
    <div className="max-w-2xl mx-auto space-y-6" data-testid="page-ratios">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <Syringe className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Your Ratios</h1>
            <p className="text-sm text-muted-foreground">Insulin-to-carb ratios by meal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} data-testid="button-edit-ratios">
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCancelEdit} data-testid="button-cancel-edit">
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveRatios} data-testid="button-save-ratios">
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
          )}
        </div>
      </div>

      {hasAnyAdjustment && (
        <Card className="border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20" data-testid="scenario-adjustments-banner">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <p className="font-medium text-amber-900 dark:text-amber-200">Active Scenario Adjustments</p>
            </div>
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Your ratios below show adjusted values based on your current situation.
              These are estimates only — always monitor your blood glucose and adjust based on your actual readings.
            </p>
            {adjustments.map((adj, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <adj.icon className={`h-4 w-4 mt-0.5 ${adj.color}`} />
                <div>
                  <span className="font-medium text-amber-900 dark:text-amber-200">{adj.label}:</span>{" "}
                  <span className="text-amber-800 dark:text-amber-300">{adj.description}</span>
                </div>
              </div>
            ))}
            {adjustments.length > 1 && (
              <div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-2 text-sm text-amber-800 dark:text-amber-300">
                <strong>Multiple adjustments active.</strong> Combined adjustments are capped at 25% change from your base ratios for safety.
                Speak to your diabetes team before making significant ratio changes during complex situations.
              </div>
            )}
            <p className="text-xs text-muted-foreground flex items-center gap-1 pt-1">
              <AlertCircle className="h-3 w-3" />
              Not medical advice — these are rough estimates to prompt awareness, not exact dose calculations
            </p>
          </CardContent>
        </Card>
      )}

      {!hasRatios && !editing ? (
        <Card data-testid="no-ratios-prompt">
          <CardContent className="p-8 text-center space-y-4">
            <Syringe className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <div>
              <h3 className="font-medium text-lg">No ratios set yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your insulin-to-carb ratios tell you how many grams of carbohydrate are covered by 1 unit of insulin.
                For example, 1:10 means 1 unit covers 10g of carbs.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                These are usually provided by your diabetes team and can vary by time of day.
              </p>
            </div>
            <Button onClick={() => setEditing(true)} data-testid="button-setup-ratios">
              Set Up Your Ratios
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {meals.map((meal) => {
            const Icon = getMealIcon(meal.name);
            const baseRatio = meal.ratio;
            const adjustedRatio = hasAnyAdjustment ? getAdjustedRatio(baseRatio, combinedFactor) : null;

            return (
              <Card key={meal.name} data-testid={`card-ratio-${meal.name.toLowerCase()}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">{meal.name}</p>
                        <p className="text-xs text-muted-foreground">{getMealTime(meal.name)}</p>
                      </div>
                    </div>
                  </div>

                  {editing ? (
                    <div className="space-y-1">
                      <Label htmlFor={`ratio-${meal.key}`} className="text-xs text-muted-foreground">
                        Ratio (e.g. 1:10)
                      </Label>
                      <Input
                        id={`ratio-${meal.key}`}
                        placeholder="1:10"
                        value={editValues[meal.key]}
                        onChange={(e) => setEditValues(prev => ({ ...prev, [meal.key]: e.target.value }))}
                        data-testid={`input-ratio-${meal.name.toLowerCase()}`}
                      />
                    </div>
                  ) : (
                    <div className="mt-1">
                      {baseRatio ? (
                        <div>
                          <p className={`text-2xl font-bold ${hasAnyAdjustment ? "text-muted-foreground line-through text-lg" : ""}`}>
                            {baseRatio}
                          </p>
                          {adjustedRatio && (
                            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400" data-testid={`adjusted-ratio-${meal.name.toLowerCase()}`}>
                              {adjustedRatio}
                              <span className="text-xs font-normal ml-1 text-amber-600 dark:text-amber-500">adjusted</span>
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Not set</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card data-testid="card-correction-factor">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-primary" />
              <div className="flex items-center gap-1">
                <p className="font-medium">Correction Factor</p>
                <InfoTooltip term="Correction Factor" explanation="How much 1 unit of insulin drops your blood glucose. For example, if your factor is 2.5, then 1 unit will lower your BG by approximately 2.5 mmol/L." />
              </div>
            </div>
            {editing ? (
              <div className="space-y-1">
                <Label htmlFor="correction-factor" className="text-xs text-muted-foreground">
                  {bgUnit} per unit
                </Label>
                <Input
                  id="correction-factor"
                  type="number"
                  step="0.1"
                  placeholder="e.g. 2.5"
                  value={editValues.correctionFactor}
                  onChange={(e) => setEditValues(prev => ({ ...prev, correctionFactor: e.target.value }))}
                  data-testid="input-correction-factor"
                />
              </div>
            ) : (
              <p className="text-2xl font-bold">
                {settings.correctionFactor ? `${settings.correctionFactor} ${bgUnit}` : <span className="text-sm text-muted-foreground italic font-normal">Not set</span>}
              </p>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-target-range">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <div className="flex items-center gap-1">
                <p className="font-medium">Target Range</p>
                <InfoTooltip term="Target Range" explanation="Your target blood glucose range. This is the range you aim to keep your blood sugar within." />
              </div>
            </div>
            {editing ? (
              <div className="flex items-center gap-2">
                <div className="space-y-1 flex-1">
                  <Label htmlFor="target-low" className="text-xs text-muted-foreground">Low</Label>
                  <Input
                    id="target-low"
                    type="number"
                    step="0.1"
                    placeholder="4.0"
                    value={editValues.targetBgLow}
                    onChange={(e) => setEditValues(prev => ({ ...prev, targetBgLow: e.target.value }))}
                    data-testid="input-target-low"
                  />
                </div>
                <span className="text-muted-foreground mt-5">—</span>
                <div className="space-y-1 flex-1">
                  <Label htmlFor="target-high" className="text-xs text-muted-foreground">High</Label>
                  <Input
                    id="target-high"
                    type="number"
                    step="0.1"
                    placeholder="8.0"
                    value={editValues.targetBgHigh}
                    onChange={(e) => setEditValues(prev => ({ ...prev, targetBgHigh: e.target.value }))}
                    data-testid="input-target-high"
                  />
                </div>
              </div>
            ) : (
              <p className="text-2xl font-bold">
                {settings.targetBgLow && settings.targetBgHigh
                  ? `${settings.targetBgLow} — ${settings.targetBgHigh} ${bgUnit}`
                  : <span className="text-sm text-muted-foreground italic font-normal">Not set</span>}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-quick-actions">
        <CardContent className="p-4 space-y-3">
          <h3 className="font-medium">Quick Actions</h3>
          <div className="flex flex-col sm:flex-row gap-2">
            <Link href="/advisor?tab=meal">
              <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-go-meal-planner">
                <UtensilsCrossed className="h-4 w-4" />
                Calculate a meal dose
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
            </Link>
            <Link href="/advisor?tab=tools">
              <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-go-ratio-adviser">
                <Syringe className="h-4 w-4" />
                Ratio Adviser tool
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-ratio-history">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setShowHistory(!showHistory)}>
              <History className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Ratio Change History</CardTitle>
              {history.length > 0 && (
                <Badge variant="secondary">{history.length}</Badge>
              )}
              {showHistory ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
            <Dialog open={showSnapshotDialog} onOpenChange={setShowSnapshotDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={!hasRatios} data-testid="button-save-snapshot">
                  <Plus className="h-4 w-4 mr-1" />
                  Save Snapshot
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Save Ratio Snapshot</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Save your current ratios so you can track changes over time or restore them later.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="snapshot-note">Note (optional)</Label>
                    <Textarea
                      id="snapshot-note"
                      placeholder="e.g. Clinic appointment — ratios adjusted by DSN"
                      value={snapshotNote}
                      onChange={(e) => setSnapshotNote(e.target.value)}
                      data-testid="input-snapshot-note"
                    />
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Current ratios to save:</p>
                    <div className="grid grid-cols-2 gap-1 text-sm">
                      {meals.map(m => m.ratio && (
                        <p key={m.name}><span className="text-muted-foreground">{m.name}:</span> {m.ratio}</p>
                      ))}
                      {settings.correctionFactor && (
                        <p><span className="text-muted-foreground">CF:</span> {settings.correctionFactor}</p>
                      )}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button onClick={handleManualSnapshot} data-testid="button-confirm-snapshot">
                    Save Snapshot
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        {showHistory && (
          <CardContent className="space-y-3">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No history yet. Your ratio changes will be tracked here automatically when you update them, or you can save a manual snapshot.
              </p>
            ) : (
              <div className="space-y-2">
                {history.map((entry) => (
                  <div key={entry.id} className="border rounded-lg p-3 space-y-2" data-testid={`history-entry-${entry.id}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {new Date(entry.date).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        {entry.note && (
                          <span className="text-xs text-muted-foreground">— {entry.note}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRestoreHistoryEntry(entry)}
                          title="Restore these ratios"
                          data-testid={`button-restore-${entry.id}`}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteHistoryEntry(entry.id)}
                          title="Delete entry"
                          data-testid={`button-delete-history-${entry.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-sm">
                      {entry.breakfastRatio && <p><span className="text-muted-foreground">Breakfast:</span> {entry.breakfastRatio}</p>}
                      {entry.lunchRatio && <p><span className="text-muted-foreground">Lunch:</span> {entry.lunchRatio}</p>}
                      {entry.dinnerRatio && <p><span className="text-muted-foreground">Dinner:</span> {entry.dinnerRatio}</p>}
                      {entry.snackRatio && <p><span className="text-muted-foreground">Snack:</span> {entry.snackRatio}</p>}
                      {entry.correctionFactor && <p><span className="text-muted-foreground">CF:</span> {entry.correctionFactor}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <div className="flex items-center gap-1 text-xs text-muted-foreground justify-center pb-4">
        <AlertCircle className="h-3 w-3" />
        <span>Not medical advice — always follow your diabetes team's guidance</span>
      </div>
    </div>
  );
}
