import { carbsGramsToCloseBgGapMmol } from "@/lib/exercise-hypo-auto";
import {
  exerciseCgmAlertAimOptions,
  exerciseCgmAlertThresholdOptions,
  resolveExerciseCgmAlertAim,
  resolveExerciseCgmAlertThreshold,
} from "@/lib/exercise-cgm-alert-thresholds";
import { getBodyWeightKgFromProfile } from "@/lib/body-weight";
import { storage, type NotificationSettings } from "@/lib/storage";
import { cn } from "@/lib/utils";

function formatBg(value: number, bgUnits: "mmol/L" | "mg/dL"): string {
  return bgUnits === "mmol/L" ? value.toFixed(1) : String(Math.round(value));
}

function LevelChips({
  label,
  values,
  selected,
  bgUnits,
  disabled,
  testIdPrefix,
  onSelect,
}: {
  label: string;
  values: number[];
  selected: number;
  bgUnits: "mmol/L" | "mg/dL";
  disabled?: boolean;
  testIdPrefix: string;
  onSelect: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => {
          const active = Math.abs(value - selected) < 0.05;
          return (
            <button
              key={value}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(value)}
              data-testid={`${testIdPrefix}-${formatBg(value, bgUnits)}`}
              className={cn(
                "h-8 min-w-9 rounded-full border px-2 text-[11px] font-semibold tabular-nums transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/70 bg-background text-foreground",
                disabled && "opacity-50",
              )}
            >
              {formatBg(value, bgUnits)}
            </button>
          );
        })}
      </div>
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
  const notifyOptions = exerciseCgmAlertThresholdOptions(bgUnits);
  const aimChoices = exerciseCgmAlertAimOptions(threshold, bgUnits);
  const aimOptions = aimChoices.some((value) => Math.abs(value - aim) < 0.05)
    ? aimChoices
    : [...aimChoices, aim].sort((a, b) => a - b);
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
      <LevelChips
        label="Notify below"
        values={[...notifyOptions]}
        selected={threshold}
        bgUnits={bgUnits}
        disabled={disabled}
        testIdPrefix="button-exercise-alert-below"
        onSelect={selectThreshold}
      />
      <LevelChips
        label="Bring back to"
        values={aimOptions}
        selected={aim}
        bgUnits={bgUnits}
        disabled={disabled}
        testIdPrefix="button-exercise-alert-aim"
        onSelect={(value) => onChange({ exerciseCgmAlertAimBg: value })}
      />
      <p className="text-sm font-medium tabular-nums" data-testid="text-exercise-alert-carbs">
        {formatBg(threshold, bgUnits)} → {formatBg(aim, bgUnits)} · {grams}g
      </p>
    </div>
  );
}
