import type { ExercisePhase } from "@/lib/storage";
import type { ExerciseHypoSuggestion } from "@/lib/exercise-hypo-auto";
import { cn } from "@/lib/utils";
import { Droplet, Timer } from "lucide-react";

/** Elapsed time as `H:MM:SS` or `M:SS` — shared by status strip, travel, and coach timers. */
export function formatExerciseElapsedShort(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ExerciseWorkoutProgressBar(props: {
  phase: ExercisePhase;
  exerciseStartedAt?: string;
  durationMinutes: number;
  nowMs: number;
  className?: string;
  /** Collapse vertical gap when embedded in a tight strip */
  compact?: boolean;
}) {
  const { phase, exerciseStartedAt, durationMinutes, nowMs, className, compact } = props;
  if (phase !== "active" || !exerciseStartedAt) return null;
  const start = new Date(exerciseStartedAt).getTime();
  if (!Number.isFinite(start)) return null;
  const total = Math.max(60_000, durationMinutes * 60_000);
  const elapsed = Math.max(0, nowMs - start);
  const pct = Math.min(100, (elapsed / total) * 100);
  const remMin = Math.max(0, Math.ceil((total - elapsed) / 60_000));

  return (
    <div className={cn(compact ? "space-y-1" : "space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2 text-[11px] font-medium tabular-nums text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Timer className="h-3 w-3 opacity-70" aria-hidden />
          Workout progress
        </span>
        <span>
          {Math.min(100, Math.round(pct))}%
          {!compact ? <span className="text-muted-foreground/80"> · ~{remMin} min left</span> : null}
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted/70 ring-1 ring-border/50 dark:bg-muted/40"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            "h-full rounded-full bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500",
            "shadow-[0_0_12px_-2px_rgba(16,185,129,0.45)] transition-[width] duration-500 ease-out",
            "dark:from-emerald-500 dark:via-teal-400 dark:to-cyan-400",
          )}
          style={{ width: `${pct}%` }}
          data-testid="progress-exercise"
        />
      </div>
    </div>
  );
}

export function ExerciseHypoTreatmentHint(props: {
  suggestion: ExerciseHypoSuggestion | null;
  className?: string;
}) {
  const { suggestion, className } = props;
  if (!suggestion) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.06] to-transparent",
        "px-3 py-2.5 dark:from-amber-950/35",
        className,
      )}
      data-testid="exercise-hypo-auto-hint"
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
          <Droplet className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="min-w-0 space-y-0.5">
          <p className="text-xs font-semibold text-foreground">Reading looks low</p>
          <p className="text-[11px] leading-snug text-muted-foreground">
            {suggestion.approximate ? (
              <>
                Try about <strong className="font-semibold text-foreground">{suggestion.carbsGrams}g</strong> fast
                carbs, then recheck. Use your care team&apos;s hypo plan if it differs.
              </>
            ) : suggestion.primaryTreatmentLine ? (
              <>
                About <strong className="font-semibold text-foreground">{suggestion.carbsGrams}g</strong> fast carbs (
                {suggestion.primaryTreatmentLine}). Recheck soon.
              </>
            ) : (
              <>
                About <strong className="font-semibold text-foreground">{suggestion.carbsGrams}g</strong> fast carbs
                (~{suggestion.glucoseTablets} glucose tablets or ~{suggestion.juiceMl}ml juice). Recheck soon.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
