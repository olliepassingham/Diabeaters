import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Sun, Sunset, Moon, Cookie, Target, TrendingDown, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InfoTooltip } from "@/components/info-tooltip";
import { storage, type RatioFormat, type UserSettings } from "@/lib/storage";
import { recordLastInteraction } from "@/lib/last-interaction";
import {
  formatRatioForStorage,
  formatRatioInputLabel,
  formatRatioInputPlaceholder,
  gramsPerUnitToInputValue,
  parseInputToGramsPerUnit,
  parseRatioToGramsPerUnit,
} from "@/lib/ratio-utils";
import { useToast } from "@/hooks/use-toast";

export type RatiosEditValues = {
  breakfastRatio: string;
  lunchRatio: string;
  dinnerRatio: string;
  snackRatio: string;
  correctionFactor: string;
  targetBgLow: string;
  targetBgHigh: string;
};

const MEAL_KEYS = [
  { key: "breakfastRatio" as const, label: "Breakfast", icon: Sun },
  { key: "lunchRatio" as const, label: "Lunch", icon: Sunset },
  { key: "dinnerRatio" as const, label: "Dinner", icon: Moon },
  { key: "snackRatio" as const, label: "Snack", icon: Cookie },
];

export function settingsToEditValues(
  settings: UserSettings,
  ratioFormat: RatioFormat,
  carbPortionSize?: number,
): RatiosEditValues {
  const toInput = (stored: string | undefined) => {
    const gpu = parseRatioToGramsPerUnit(stored);
    return gpu ? gramsPerUnitToInputValue(gpu, ratioFormat, carbPortionSize) : stored || "";
  };
  return {
    breakfastRatio: toInput(settings.breakfastRatio),
    lunchRatio: toInput(settings.lunchRatio),
    dinnerRatio: toInput(settings.dinnerRatio),
    snackRatio: toInput(settings.snackRatio),
    correctionFactor: settings.correctionFactor?.toString() || "",
    targetBgLow: settings.targetBgLow?.toString() || "",
    targetBgHigh: settings.targetBgHigh?.toString() || "",
  };
}

export function buildSettingsFromEditValues(
  editValues: RatiosEditValues,
  ratioFormat: RatioFormat,
  carbPortionSize?: number,
): UserSettings {
  const oldSettings = storage.getSettings();
  const bGpu = parseInputToGramsPerUnit(editValues.breakfastRatio, ratioFormat, carbPortionSize);
  const lGpu = parseInputToGramsPerUnit(editValues.lunchRatio, ratioFormat, carbPortionSize);
  const dGpu = parseInputToGramsPerUnit(editValues.dinnerRatio, ratioFormat, carbPortionSize);
  const sGpu = parseInputToGramsPerUnit(editValues.snackRatio, ratioFormat, carbPortionSize);

  return {
    ...oldSettings,
    breakfastRatio: bGpu ? formatRatioForStorage(bGpu) : editValues.breakfastRatio || undefined,
    lunchRatio: lGpu ? formatRatioForStorage(lGpu) : editValues.lunchRatio || undefined,
    dinnerRatio: dGpu ? formatRatioForStorage(dGpu) : editValues.dinnerRatio || undefined,
    snackRatio: sGpu ? formatRatioForStorage(sGpu) : editValues.snackRatio || undefined,
    correctionFactor: editValues.correctionFactor ? parseFloat(editValues.correctionFactor) : undefined,
    targetBgLow: editValues.targetBgLow ? parseFloat(editValues.targetBgLow) : undefined,
    targetBgHigh: editValues.targetBgHigh ? parseFloat(editValues.targetBgHigh) : undefined,
  };
}

type RatiosEditPanelProps = {
  settings: UserSettings;
  bgUnit: string;
  ratioFormat: RatioFormat;
  carbPortionSize?: number;
  onSaved: (updated: UserSettings) => void;
  onCancel: () => void;
  idPrefix?: string;
};

/** Inline editor for meal ratios, ISF, and targets (same fields as the Ratios page). */
export function RatiosEditPanel({
  settings,
  bgUnit,
  ratioFormat,
  carbPortionSize,
  onSaved,
  onCancel,
  idPrefix = "ratio-adviser-edit",
}: RatiosEditPanelProps) {
  const { toast } = useToast();
  const [editValues, setEditValues] = useState(() => settingsToEditValues(settings, ratioFormat, carbPortionSize));

  useEffect(() => {
    setEditValues(settingsToEditValues(settings, ratioFormat, carbPortionSize));
  }, [settings, ratioFormat, carbPortionSize]);

  const handleSave = () => {
    const oldSettings = storage.getSettings();
    const hadRatios = !!(oldSettings.breakfastRatio || oldSettings.lunchRatio || oldSettings.dinnerRatio || oldSettings.snackRatio);
    const next = buildSettingsFromEditValues(editValues, ratioFormat, carbPortionSize);

    const ratiosChanged =
      oldSettings.breakfastRatio !== next.breakfastRatio ||
      oldSettings.lunchRatio !== next.lunchRatio ||
      oldSettings.dinnerRatio !== next.dinnerRatio ||
      oldSettings.snackRatio !== next.snackRatio ||
      oldSettings.correctionFactor !== next.correctionFactor ||
      oldSettings.targetBgLow !== next.targetBgLow ||
      oldSettings.targetBgHigh !== next.targetBgHigh;

    if (!ratiosChanged) {
      onCancel();
      return;
    }

    if (hadRatios) {
      storage.snapshotCurrentRatios("Auto-saved before update");
    }

    storage.saveSettings(next);
    recordLastInteraction("ratios");
    onSaved(next);
    toast({ title: "Ratios saved", description: "Your meal ratios and targets are updated." });
  };

  return (
    <div
      className="space-y-4 rounded-[1.35rem] border border-primary/30 bg-primary/[0.04] p-4 dark:bg-primary/10"
      data-testid={`${idPrefix}-panel`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Edit ratios &amp; targets</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0"
          onClick={onCancel}
          aria-label="Close editor"
          data-testid={`${idPrefix}-close`}
        >
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {MEAL_KEYS.map(({ key, label, icon: Icon }) => (
          <div key={key} className="space-y-1.5 rounded-[1.15rem] border border-border/70 bg-background/70 px-2.5 py-2.5 dark:bg-background/40">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground/90">
              <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              {label}
            </div>
            <Label htmlFor={`${idPrefix}-${key}`} className="text-[10px] text-muted-foreground">
              {formatRatioInputLabel(ratioFormat, carbPortionSize)}
            </Label>
            <Input
              id={`${idPrefix}-${key}`}
              placeholder={formatRatioInputPlaceholder(ratioFormat)}
              value={editValues[key]}
              onChange={(e) => setEditValues((prev) => ({ ...prev, [key]: e.target.value }))}
              className="h-11 text-base"
              data-testid={`${idPrefix}-input-${label.toLowerCase()}`}
            />
          </div>
        ))}
      </div>

      <div className="space-y-3 border-t border-border/60 pt-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <TrendingDown className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="text-sm font-medium">Correction factor (ISF)</span>
            <InfoTooltip
              term="Correction Factor"
              explanation="How much 1 unit of insulin lowers your blood glucose."
            />
          </div>
          <Label htmlFor={`${idPrefix}-isf`} className="text-xs text-muted-foreground">
            {bgUnit} per unit
          </Label>
          <Input
            id={`${idPrefix}-isf`}
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder="e.g. 2.5"
            value={editValues.correctionFactor}
            onChange={(e) => setEditValues((prev) => ({ ...prev, correctionFactor: e.target.value }))}
            className="h-11 text-base"
            data-testid={`${idPrefix}-input-isf`}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Target className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="text-sm font-medium">Target range</span>
            <InfoTooltip term="Target Range" explanation="The blood glucose range you aim to stay within." />
          </div>
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <Label htmlFor={`${idPrefix}-target-low`} className="text-xs text-muted-foreground">
                Low
              </Label>
              <Input
                id={`${idPrefix}-target-low`}
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder="4.0"
                value={editValues.targetBgLow}
                onChange={(e) => setEditValues((prev) => ({ ...prev, targetBgLow: e.target.value }))}
                className="h-11 text-base"
                data-testid={`${idPrefix}-input-target-low`}
              />
            </div>
            <span className="shrink-0 pb-3 text-muted-foreground" aria-hidden>
              —
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <Label htmlFor={`${idPrefix}-target-high`} className="text-xs text-muted-foreground">
                High
              </Label>
              <Input
                id={`${idPrefix}-target-high`}
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder="8.0"
                value={editValues.targetBgHigh}
                onChange={(e) => setEditValues((prev) => ({ ...prev, targetBgHigh: e.target.value }))}
                className="h-11 text-base"
                data-testid={`${idPrefix}-input-target-high`}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" className="min-h-11 w-full sm:flex-1" onClick={onCancel} data-testid={`${idPrefix}-cancel`}>
          Cancel
        </Button>
        <Button type="button" className="min-h-11 w-full sm:flex-1" onClick={handleSave} data-testid={`${idPrefix}-save`}>
          <Save className="mr-2 h-4 w-4" aria-hidden />
          Save ratios
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        TDD, history, and scenario-adjusted ratios —{" "}
        <Link href="/settings/ratios" className="font-medium text-primary underline underline-offset-2">
          open Ratios in Settings
        </Link>
      </p>
    </div>
  );
}
