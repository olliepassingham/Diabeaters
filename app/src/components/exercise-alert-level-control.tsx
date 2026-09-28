import { useEffect, useState } from "react";
import { Link } from "wouter";
import { carbsGramsToCloseBgGapMmol } from "@/lib/exercise-hypo-auto";
import {
  exerciseCgmAlertAimOptions,
  exerciseCgmAlertThresholdOptions,
  resolveExerciseCgmAlertAim,
  resolveExerciseCgmAlertThreshold,
} from "@/lib/exercise-cgm-alert-thresholds";
import { getBodyWeightKgFromProfile } from "@/lib/body-weight";
import { DIABEATER_SETTINGS_CHANGED_EVENT, storage, type NotificationSettings } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const EXERCISE_ALERT_LEVELS_HREF = "/settings/notifications#exercise-low-alerts";

function formatBg(value: number, bgUnits: "mmol/L" | "mg/dL"): string {
  return bgUnits === "mmol/L" ? value.toFixed(1) : String(Math.round(value));
}

function withSelected(options: readonly number[], selected: number): number[] {
  if (options.some((value) => Math.abs(value - selected) < 0.05)) return [...options];
  return [...options, selected].sort((a, b) => a - b);
}

function BgSelect({
  id,
  label,
  values,
  selected,
  bgUnits,
  disabled,
  testId,
  onSelect,
}: {
  id: string;
  label: string;
  values: number[];
  selected: number;
  bgUnits: "mmol/L" | "mg/dL";
  disabled?: boolean;
  testId: string;
  onSelect: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <Select
        value={formatBg(selected, bgUnits)}
        onValueChange={(raw) => {
          const next = Number(raw);
          if (Number.isFinite(next)) onSelect(next);
        }}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="h-12 rounded-xl" data-testid={testId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {values.map((value) => {
            const labelText = `${formatBg(value, bgUnits)} ${bgUnits}`;
            return (
              <SelectItem key={value} value={formatBg(value, bgUnits)}>
                {labelText}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ExerciseAlertLevelControl({
  bgUnits,
  settings,
  onChange,
  disabled,
}: {
  bgUnits: "mmol/L" | "mg/dL";
  settings: NotificationSettings;
  onChange: (patch: Pick<NotificationSettings, "exerciseCgmAlertThreshold" | "exerciseCgmAlertAimBg">) => void;
  disabled?: boolean;
}) {
  const threshold = resolveExerciseCgmAlertThreshold(settings, bgUnits);
  const aim = resolveExerciseCgmAlertAim(settings, bgUnits);
  const notifyOptions = withSelected(exerciseCgmAlertThresholdOptions(bgUnits), threshold);
  const aimOptions = withSelected(exerciseCgmAlertAimOptions(threshold, bgUnits), aim);
  const profile = storage.getProfile();
  const grams = carbsGramsToCloseBgGapMmol(
    bgUnits === "mg/dL" ? threshold / 18 : threshold,
    bgUnits === "mg/dL" ? aim / 18 : aim,
    { bodyWeightKg: getBodyWeightKgFromProfile(profile) ?? undefined },
  );

  const selectThreshold = (next: number) => {
    const minGap = bgUnits === "mmol/L" ? 0.5 : 9;
    const nextAim = resolveExerciseCgmAlertAim({ ...settings, exerciseCgmAlertThreshold: next }, bgUnits);
    if (nextAim < next + minGap) {
      const bump = bgUnits === "mmol/L" ? 1.5 : 27;
      const bumped = bgUnits === "mmol/L" ? Math.round((next + bump) * 10) / 10 : Math.round(next + bump);
      onChange({ exerciseCgmAlertThreshold: next, exerciseCgmAlertAimBg: bumped });
      return;
    }
    onChange({ exerciseCgmAlertThreshold: next, exerciseCgmAlertAimBg: nextAim });
  };

  return (
    <div className="space-y-3" data-testid="exercise-alert-level-control">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <BgSelect
          id="exercise-alert-below"
          label="Notify below"
          values={notifyOptions}
          selected={threshold}
          bgUnits={bgUnits}
          disabled={disabled}
          testId="select-exercise-alert-below"
          onSelect={selectThreshold}
        />
        <BgSelect
          id="exercise-alert-aim"
          label="Bring back to"
          values={aimOptions}
          selected={aim}
          bgUnits={bgUnits}
          disabled={disabled}
          testId="select-exercise-alert-aim"
          onSelect={(value) => onChange({ exerciseCgmAlertAimBg: value })}
        />
      </div>
      <p className="text-sm font-medium tabular-nums" data-testid="text-exercise-alert-carbs">
        {formatBg(threshold, bgUnits)} → {formatBg(aim, bgUnits)} · {grams}g
      </p>
    </div>
  );
}

/** Shortcut from a workout to the saved notify / bring-back levels. */
export function ExerciseAlertLevelsLink({ className }: { className?: string }) {
  const [settings, setSettings] = useState(() => storage.getNotificationSettings());

  useEffect(() => {
    const sync = () => setSettings(storage.getNotificationSettings());
    window.addEventListener(DIABEATER_SETTINGS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(DIABEATER_SETTINGS_CHANGED_EVENT, sync);
  }, []);

  const bgUnits = storage.getProfile()?.bgUnits === "mg/dL" ? "mg/dL" : "mmol/L";
  const threshold = resolveExerciseCgmAlertThreshold(settings, bgUnits);
  const aim = resolveExerciseCgmAlertAim(settings, bgUnits);

  return (
    <Button
      asChild
      variant="outline"
      className={cn("h-11 w-full justify-between rounded-xl px-3.5 text-sm font-medium", className)}
    >
      <Link href={EXERCISE_ALERT_LEVELS_HREF} data-testid="link-exercise-alert-levels">
        <span>Workout alerts</span>
        <span className="tabular-nums text-muted-foreground">
          {formatBg(threshold, bgUnits)} → {formatBg(aim, bgUnits)} · Change
        </span>
      </Link>
    </Button>
  );
}
