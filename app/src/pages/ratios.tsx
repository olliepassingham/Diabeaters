import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trackFeatureEngagement } from "@/components/discovery-prompts";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  BookOpen,
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
  Search,
  Settings,
} from "lucide-react";
import { storage, UserSettings, ScenarioState, RatioHistoryEntry } from "@/lib/storage";
import { recordLastInteraction } from "@/lib/last-interaction";
import { parseRatioToGramsPerUnit, formatRatioForDisplay, formatRatioForStorage, gramsPerUnitToInputValue, parseInputToGramsPerUnit, formatRatioInputPlaceholder, formatRatioInputLabel } from "@/lib/ratio-utils";
import type { RatioFormat } from "@/lib/storage";
import { InfoTooltip } from "@/components/info-tooltip";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";

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
      label: `Sick day (${severity})`,
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

function getAdjustedRatio(baseRatio: string | undefined, factor: number, ratioFormat: RatioFormat, cpSize?: number): string | null {
  const grams = parseRatioToGramsPerUnit(baseRatio);
  if (grams === null) return null;
  const clamped = clampFactor(factor);
  const adjustedGrams = Math.round(grams * clamped * 10) / 10;
  return formatRatioForDisplay(adjustedGrams, ratioFormat, cpSize);
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

export default function Ratios() {
  const [settings, setSettings] = useState<UserSettings>({});
  const [scenarioState, setScenarioState] = useState<ScenarioState>({ travelModeActive: false, sickDayActive: false });
  const [ratioFormat, setRatioFormat] = useState<RatioFormat>("per10g");
  const [cpSize, setCpSize] = useState<number | undefined>();
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
    const profile = storage.getProfile();
    const fmt = profile?.ratioFormat || "per10g";
    const cpSizeVal = profile?.carbPortionSize;
    setRatioFormat(fmt);
    setCpSize(cpSizeVal);
    setSettings(s);
    setScenarioState(storage.getScenarioState());
    setHistory(storage.getRatioHistory());
    trackFeatureEngagement("ratios");
    const bGpu = parseRatioToGramsPerUnit(s.breakfastRatio);
    const lGpu = parseRatioToGramsPerUnit(s.lunchRatio);
    const dGpu = parseRatioToGramsPerUnit(s.dinnerRatio);
    const sGpu = parseRatioToGramsPerUnit(s.snackRatio);
    setEditValues({
      breakfastRatio: bGpu ? gramsPerUnitToInputValue(bGpu, fmt, cpSizeVal) : s.breakfastRatio || "",
      lunchRatio: lGpu ? gramsPerUnitToInputValue(lGpu, fmt, cpSizeVal) : s.lunchRatio || "",
      dinnerRatio: dGpu ? gramsPerUnitToInputValue(dGpu, fmt, cpSizeVal) : s.dinnerRatio || "",
      snackRatio: sGpu ? gramsPerUnitToInputValue(sGpu, fmt, cpSizeVal) : s.snackRatio || "",
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

    const bGpu = parseInputToGramsPerUnit(editValues.breakfastRatio, ratioFormat, cpSize);
    const lGpu = parseInputToGramsPerUnit(editValues.lunchRatio, ratioFormat, cpSize);
    const dGpu = parseInputToGramsPerUnit(editValues.dinnerRatio, ratioFormat, cpSize);
    const sGpu = parseInputToGramsPerUnit(editValues.snackRatio, ratioFormat, cpSize);

    const updated = {
      ...oldSettings,
      breakfastRatio: bGpu ? formatRatioForStorage(bGpu) : editValues.breakfastRatio || undefined,
      lunchRatio: lGpu ? formatRatioForStorage(lGpu) : editValues.lunchRatio || undefined,
      dinnerRatio: dGpu ? formatRatioForStorage(dGpu) : editValues.dinnerRatio || undefined,
      snackRatio: sGpu ? formatRatioForStorage(sGpu) : editValues.snackRatio || undefined,
      correctionFactor: editValues.correctionFactor ? parseFloat(editValues.correctionFactor) : undefined,
      targetBgLow: editValues.targetBgLow ? parseFloat(editValues.targetBgLow) : undefined,
      targetBgHigh: editValues.targetBgHigh ? parseFloat(editValues.targetBgHigh) : undefined,
    };
    storage.saveSettings(updated);
    setSettings(updated);
    setEditing(false);
    if (hasChanged) {
      recordLastInteraction("ratios");
    }
  };

  const handleCancelEdit = () => {
    const bGpu = parseRatioToGramsPerUnit(settings.breakfastRatio);
    const lGpu = parseRatioToGramsPerUnit(settings.lunchRatio);
    const dGpu = parseRatioToGramsPerUnit(settings.dinnerRatio);
    const sGpu = parseRatioToGramsPerUnit(settings.snackRatio);
    setEditValues({
      breakfastRatio: bGpu ? gramsPerUnitToInputValue(bGpu, ratioFormat, cpSize) : settings.breakfastRatio || "",
      lunchRatio: lGpu ? gramsPerUnitToInputValue(lGpu, ratioFormat, cpSize) : settings.lunchRatio || "",
      dinnerRatio: dGpu ? gramsPerUnitToInputValue(dGpu, ratioFormat, cpSize) : settings.dinnerRatio || "",
      snackRatio: sGpu ? gramsPerUnitToInputValue(sGpu, ratioFormat, cpSize) : settings.snackRatio || "",
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
    const bGpu = parseRatioToGramsPerUnit(updated.breakfastRatio);
    const lGpu = parseRatioToGramsPerUnit(updated.lunchRatio);
    const dGpu = parseRatioToGramsPerUnit(updated.dinnerRatio);
    const sGpu = parseRatioToGramsPerUnit(updated.snackRatio);
    setEditValues({
      breakfastRatio: bGpu ? gramsPerUnitToInputValue(bGpu, ratioFormat, cpSize) : updated.breakfastRatio || "",
      lunchRatio: lGpu ? gramsPerUnitToInputValue(lGpu, ratioFormat, cpSize) : updated.lunchRatio || "",
      dinnerRatio: dGpu ? gramsPerUnitToInputValue(dGpu, ratioFormat, cpSize) : updated.dinnerRatio || "",
      snackRatio: sGpu ? gramsPerUnitToInputValue(sGpu, ratioFormat, cpSize) : updated.snackRatio || "",
      correctionFactor: updated.correctionFactor?.toString() || "",
      targetBgLow: updated.targetBgLow?.toString() || "",
      targetBgHigh: updated.targetBgHigh?.toString() || "",
    });
    setHistory(storage.getRatioHistory());
  };

  const profile = storage.getProfile();
  const bgUnit = profile?.bgUnits === "mg/dL" ? "mg/dL" : "mmol/L";

  return (
    <PageShell variant="standard" className="max-w-2xl" data-testid="page-ratios">
      <div className="w-full min-w-0 space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <PageHeader
            leading={<PageBackButton />}
            className="min-w-0 w-full sm:flex-1"
            title={
              <span className="inline-flex items-center gap-2">
                <Syringe className="h-6 w-6 text-primary shrink-0" />
                Your Ratios
              </span>
            }
          />
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:justify-start">
            <Link href="/settings/ratios">
              <Button variant="outline" size="sm" data-testid="button-ratio-settings">
                <Settings className="h-4 w-4 mr-1" />
                Settings
              </Button>
            </Link>
            {!editing ? (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)} data-testid="button-edit-ratios">
                <Pencil className="h-4 w-4 mr-1" />
                Edit ratios
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
        <p className="text-sm leading-snug text-muted-foreground sm:text-body">
          Carb ratios, correction factor (ISF), and target range.
        </p>
      </div>

      <Card className="border-primary/25 bg-primary/[0.04] dark:bg-primary/10" data-testid="card-ratios-at-a-glance">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2 gap-y-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Your ratios at a glance</p>
              <p className="text-sm text-muted-foreground mt-1 leading-snug">
                {hasAnyAdjustment && !editing
                  ? "Carb coverage by meal — strikethrough is your saved base. Open Adjusted ratios for scenario values."
                  : "Carb coverage by meal."}
              </p>
            </div>
            {hasAnyAdjustment && !editing && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1 border-amber-300 bg-amber-50/80 text-amber-950 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/50"
                    data-testid="button-adjusted-ratios-dropdown"
                  >
                    Adjusted ratios
                    <ChevronDown className="h-4 w-4 opacity-80" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[min(calc(100vw-2rem),22rem)] max-h-[min(32rem,75vh)] overflow-y-auto p-0"
                  align="end"
                >
                  <div className="border-b border-border/80 px-3 py-2">
                    <DropdownMenuLabel className="p-0 text-sm font-semibold text-foreground">
                      Scenario-adjusted carb coverage
                    </DropdownMenuLabel>
                    <p className="mt-1 text-xs leading-snug text-muted-foreground">
                      Estimates only — monitor glucose and follow your care team.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
                    {meals.map((meal) => {
                      const Icon = getMealIcon(meal.name);
                      const stored = settings[meal.key];
                      const baseGpu = parseRatioToGramsPerUnit(stored);
                      const primary = baseGpu ? formatRatioForDisplay(baseGpu, ratioFormat, cpSize) : stored || null;
                      const adjusted =
                        stored && hasAnyAdjustment ? getAdjustedRatio(stored, combinedFactor, ratioFormat, cpSize) : null;
                      return (
                        <div
                          key={`dd-${meal.key}`}
                          className="rounded-md border border-border/70 bg-muted/30 px-2 py-2 text-center"
                          data-testid={`dropdown-adjusted-${meal.name.toLowerCase()}`}
                        >
                          <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                            <Icon className="h-3 w-3 text-primary" aria-hidden />
                            <span className="font-medium text-foreground/90">{meal.name}</span>
                          </div>
                          {adjusted ? (
                            <p className="mt-1 text-base font-bold tabular-nums text-amber-800 dark:text-amber-300">{adjusted}</p>
                          ) : (
                            <p className="mt-1 text-xs text-muted-foreground italic">Not set</p>
                          )}
                          {primary && adjusted ? (
                            <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground line-through">{primary}</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  <DropdownMenuSeparator className="my-0" />
                  <div className="space-y-2 px-3 py-2">
                    {adjustments.map((adj, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <adj.icon className={`h-4 w-4 mt-0.5 shrink-0 ${adj.color}`} aria-hidden />
                        <div className="min-w-0">
                          <span className="font-medium text-foreground">{adj.label}</span>
                          <p className="mt-0.5 text-muted-foreground leading-snug">{adj.description}</p>
                        </div>
                      </div>
                    ))}
                    {adjustments.length > 1 ? (
                      <p className="rounded-md bg-muted/60 p-2 text-xs text-muted-foreground leading-snug">
                        <strong className="text-foreground">Multiple adjustments active.</strong> Combined change is capped
                        at 25% from your base ratios for safety. Check with your diabetes team before large changes.
                      </p>
                    ) : null}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {meals.map((meal) => {
              const Icon = getMealIcon(meal.name);
              const stored = settings[meal.key];
              if (editing) {
                return (
                  <div
                    key={meal.key}
                    className="rounded-lg border border-border/80 bg-background/60 dark:bg-background/40 px-3 py-3 text-center sm:text-left"
                    data-testid={`at-a-glance-${meal.name.toLowerCase()}`}
                  >
                    <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-1 sm:justify-start">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="font-medium text-foreground/90">{meal.name}</span>
                    </div>
                    <div className="space-y-1 mt-1 text-left">
                      <Label
                        htmlFor={`ratio-${meal.key}`}
                        className="text-[10px] text-muted-foreground sm:text-xs"
                        data-testid={`label-ratio-${meal.name.toLowerCase()}`}
                      >
                        {formatRatioInputLabel(ratioFormat, cpSize)}
                      </Label>
                      <Input
                        id={`ratio-${meal.key}`}
                        placeholder={formatRatioInputPlaceholder(ratioFormat)}
                        value={editValues[meal.key]}
                        onChange={(e) => setEditValues((prev) => ({ ...prev, [meal.key]: e.target.value }))}
                        data-testid={`input-ratio-${meal.name.toLowerCase()}`}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                );
              }
              const baseGpu = parseRatioToGramsPerUnit(stored);
              const primary = baseGpu ? formatRatioForDisplay(baseGpu, ratioFormat, cpSize) : stored || null;
              const showStrike = Boolean(
                hasAnyAdjustment && stored && getAdjustedRatio(stored, combinedFactor, ratioFormat, cpSize),
              );
              return (
                <div
                  key={meal.key}
                  className="rounded-lg border border-border/80 bg-background/60 dark:bg-background/40 px-3 py-3 text-center sm:text-left"
                  data-testid={`at-a-glance-${meal.name.toLowerCase()}`}
                >
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-1 sm:justify-start">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="font-medium text-foreground/90">{meal.name}</span>
                  </div>
                  {primary ? (
                    <p
                      className={`text-xl font-bold tabular-nums tracking-tight ${showStrike ? "text-muted-foreground line-through text-base" : "text-foreground"}`}
                      data-testid={`at-a-glance-value-${meal.name.toLowerCase()}`}
                    >
                      {primary}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Not set</p>
                  )}
                </div>
              );
            })}
          </div>
          {editing ? (
            <div className="space-y-4 border-t border-border/60 pt-3">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <TrendingDown className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span className="text-sm font-medium text-foreground">Correction factor</span>
                  <InfoTooltip
                    term="Correction Factor"
                    explanation="How much 1 unit of insulin drops your blood glucose. For example, if your factor is 2.5, then 1 unit will lower your BG by approximately 2.5 mmol/L."
                  />
                </div>
                <Label htmlFor="correction-factor" className="text-xs text-muted-foreground">
                  {bgUnit} per unit
                </Label>
                <Input
                  id="correction-factor"
                  type="number"
                  step="0.1"
                  placeholder="e.g. 2.5"
                  value={editValues.correctionFactor}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, correctionFactor: e.target.value }))}
                  data-testid="input-correction-factor"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Target className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span className="text-sm font-medium text-foreground">Target range</span>
                  <InfoTooltip
                    term="Target Range"
                    explanation="Your target blood glucose range. This is the range you aim to keep your blood sugar within."
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label htmlFor="target-low" className="text-xs text-muted-foreground">
                      Low
                    </Label>
                    <Input
                      id="target-low"
                      type="number"
                      step="0.1"
                      placeholder="4.0"
                      value={editValues.targetBgLow}
                      onChange={(e) => setEditValues((prev) => ({ ...prev, targetBgLow: e.target.value }))}
                      data-testid="input-target-low"
                    />
                  </div>
                  <span className="shrink-0 pb-2 text-muted-foreground" aria-hidden>
                    —
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label htmlFor="target-high" className="text-xs text-muted-foreground">
                      High
                    </Label>
                    <Input
                      id="target-high"
                      type="number"
                      step="0.1"
                      placeholder="8.0"
                      value={editValues.targetBgHigh}
                      onChange={(e) => setEditValues((prev) => ({ ...prev, targetBgHigh: e.target.value }))}
                      data-testid="input-target-high"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border/60 pt-3 text-sm">
              <div>
                <span className="text-muted-foreground">ISF </span>
                <span className="font-semibold tabular-nums" data-testid="at-a-glance-isf">
                  {settings.correctionFactor ? (
                    `${settings.correctionFactor} ${bgUnit}`
                  ) : (
                    <span className="text-muted-foreground italic font-normal">Not set</span>
                  )}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Target </span>
                <span className="font-semibold tabular-nums" data-testid="at-a-glance-target">
                  {settings.targetBgLow != null && settings.targetBgHigh != null ? (
                    `${settings.targetBgLow}–${settings.targetBgHigh} ${bgUnit}`
                  ) : (
                    <span className="text-muted-foreground italic font-normal">Not set</span>
                  )}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!hasRatios && !editing ? (
        <Card data-testid="no-ratios-prompt">
          <CardContent className="p-8 text-center space-y-4">
            <Syringe className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <div>
              <h3 className="font-medium text-lg">No ratios set yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your insulin-to-carb ratios tell you how many grams of carbohydrate are covered by 1 unit of insulin.
                For example, {ratioFormat === "per10g" ? "1.0u:10g means 1 unit covers 10g of carbs" : "1:10 means 1 unit covers 10g of carbs"}.
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
      ) : null}

      <Card data-testid="card-quick-actions">
        <CardContent className="p-4 space-y-3">
          <h3 className="font-medium">Quick Actions</h3>
          <Link href="/adviser?tab=ratios&from=ratios">
            <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-go-ratio-adviser">
              <Search className="h-4 w-4" />
              Use Ratio Adviser
              <ArrowRight className="h-4 w-4 ml-auto" />
            </Button>
          </Link>
          <Link href="/adviser?tab=meal&from=ratios">
            <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-go-meal-planner">
              <UtensilsCrossed className="h-4 w-4" />
              Calculate a meal dose
              <ArrowRight className="h-4 w-4 ml-auto" />
            </Button>
          </Link>
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
                      {meals.map(m => { if (!m.ratio) return null; const gpu = parseRatioToGramsPerUnit(m.ratio); return (
                        <p key={m.name}><span className="text-muted-foreground">{m.name}:</span> {gpu ? formatRatioForDisplay(gpu, ratioFormat, cpSize) : m.ratio}</p>
                      ); })}
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
                      {entry.breakfastRatio && (() => { const gpu = parseRatioToGramsPerUnit(entry.breakfastRatio); return <p data-testid={`history-breakfast-${entry.id}`}><span className="text-muted-foreground">Breakfast:</span> {gpu ? formatRatioForDisplay(gpu, ratioFormat, cpSize) : entry.breakfastRatio}</p>; })()}
                      {entry.lunchRatio && (() => { const gpu = parseRatioToGramsPerUnit(entry.lunchRatio); return <p data-testid={`history-lunch-${entry.id}`}><span className="text-muted-foreground">Lunch:</span> {gpu ? formatRatioForDisplay(gpu, ratioFormat, cpSize) : entry.lunchRatio}</p>; })()}
                      {entry.dinnerRatio && (() => { const gpu = parseRatioToGramsPerUnit(entry.dinnerRatio); return <p data-testid={`history-dinner-${entry.id}`}><span className="text-muted-foreground">Dinner:</span> {gpu ? formatRatioForDisplay(gpu, ratioFormat, cpSize) : entry.dinnerRatio}</p>; })()}
                      {entry.snackRatio && (() => { const gpu = parseRatioToGramsPerUnit(entry.snackRatio); return <p data-testid={`history-snack-${entry.id}`}><span className="text-muted-foreground">Snack:</span> {gpu ? formatRatioForDisplay(gpu, ratioFormat, cpSize) : entry.snackRatio}</p>; })()}
                      {entry.correctionFactor && <p data-testid={`history-cf-${entry.id}`}><span className="text-muted-foreground">CF:</span> {entry.correctionFactor}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground pb-4">
        <span className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Not medical advice — always follow your diabetes team's guidance
        </span>
        <span className="text-muted-foreground/50">|</span>
        <Link href="/settings/about" className="flex items-center gap-1 hover:underline text-primary" data-testid="link-sources-footer">
          <BookOpen className="h-3 w-3" />
          Sources
        </Link>
      </div>

      {editing ? (
        <div className="fixed inset-x-0 bottom-[calc(var(--bottom-nav-height,7.5rem)+var(--keyboard-inset-bottom,0px)+0.75rem)] z-40 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))] md:hidden">
          <div className="mx-auto max-w-2xl rounded-2xl border border-border/60 bg-background/80 p-3 shadow-lg backdrop-blur">
            <div className="flex items-center gap-2">
              <Button variant="outline" className="flex-1" onClick={handleCancelEdit} data-testid="button-cancel-edit-sticky">
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSaveRatios} data-testid="button-save-ratios-sticky">
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
