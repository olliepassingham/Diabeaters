import type { ExerciseFuelPlanLine } from "@/lib/exercise-readiness";
import type { ExercisePhase } from "@/lib/storage";
import type { ExerciseHypoSuggestion } from "@/lib/exercise-hypo-auto";
import { cn } from "@/lib/utils";
import { Droplet, Timer, UtensilsCrossed } from "lucide-react";

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
            "h-full rounded-full bg-primary transition-[width] duration-500 ease-out",
          )}
          style={{ width: `${pct}%` }}
          data-testid="progress-exercise"
        />
      </div>
    </div>
  );
}

function splitCarbLineText(text: string): { amount: string; detail: string | null } {
  const sep = " · ";
  const idx = text.indexOf(sep);
  if (idx === -1) return { amount: text, detail: null };
  return {
    amount: text.slice(0, idx),
    detail: text.slice(idx + sep.length) || null,
  };
}

export function ExerciseFuelPlanSummary(props: {
  lines: ExerciseFuelPlanLine[];
  className?: string;
  /** Pre/during/recovery strip: larger type, action-first layout. */
  variant?: "default" | "pre" | "active" | "recovery";
}) {
  const { lines, className, variant = "default" } = props;
  if (lines.length === 0) return null;

  if (variant === "pre" || variant === "active" || variant === "recovery") {
    const primary = lines[0];
    const { amount, detail } = splitCarbLineText(primary.text);
    const extras = lines.slice(1);

    return (
      <div
        className={cn(
          "rounded-xl border border-border/60 bg-muted/15 px-3.5 py-3",
          className,
        )}
        data-testid="exercise-fuel-plan"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <UtensilsCrossed className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-semibold text-foreground">{primary.label}</p>
            <p className="text-xl font-bold tabular-nums leading-none tracking-tight text-foreground">{amount}</p>
            {detail ? <p className="text-sm leading-snug text-muted-foreground">{detail}</p> : null}
            {extras.length > 0 ? (
              <ul className="space-y-1.5 border-t border-border/50 pt-2">
                {extras.map((line) => (
                  <li key={line.id} className="text-sm leading-snug">
                    <span className="font-medium text-foreground">{line.label}</span>
                    {line.text.trim() ? (
                      <span className="text-muted-foreground"> — {line.text.trim()}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-muted/15 px-3 py-2.5",
        className,
      )}
      data-testid="exercise-fuel-plan"
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <UtensilsCrossed className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-semibold text-foreground">Fuel plan</p>
          <ul className="space-y-1">
            {lines.map((line) => (
              <li key={line.id} className="text-[11px] leading-snug text-muted-foreground">
                <span className="font-medium text-foreground/90">{line.label}</span>
                {line.text.trim() ? <span>: {line.text.trim()}</span> : null}
              </li>
            ))}
          </ul>
        </div>
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
        "rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5",
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
