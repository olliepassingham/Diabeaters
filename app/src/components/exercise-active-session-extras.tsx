import type { ExerciseFuelPlanLine } from "@/lib/exercise-readiness";
import type { ExercisePhase } from "@/lib/storage";
import type { ExerciseHypoSuggestion } from "@/lib/exercise-hypo-auto";
import { getWorkoutElapsedMs } from "@/lib/exercise-session-timing";
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
  pausedAt?: string;
  totalPausedMs?: number;
  className?: string;
  /** Collapse vertical gap when embedded in a tight strip */
  compact?: boolean;
  /** Dark stage styling to match Exercise mode. */
  variant?: "default" | "immersive";
}) {
  const {
    phase,
    exerciseStartedAt,
    durationMinutes,
    nowMs,
    pausedAt,
    totalPausedMs,
    className,
    compact,
    variant = "default",
  } = props;
  if (phase !== "active" || !exerciseStartedAt) return null;
  const total = Math.max(60_000, durationMinutes * 60_000);
  const elapsed = getWorkoutElapsedMs({ exerciseStartedAt, pausedAt, totalPausedMs }, nowMs);
  const pct = Math.min(100, (elapsed / total) * 100);
  const isOvertime = elapsed > total;
  const isPaused = Boolean(pausedAt);
  const remMin = isOvertime
    ? Math.ceil((elapsed - total) / 60_000)
    : Math.max(0, Math.ceil((total - elapsed) / 60_000));
  const immersive = variant === "immersive";

  return (
    <div className={cn(compact ? "space-y-1" : "space-y-1.5", className)}>
      <div
        className={cn(
          "flex items-center justify-between gap-2 text-[11px] font-medium tabular-nums",
          immersive ? "text-white/45" : "text-muted-foreground",
        )}
      >
        <span className="inline-flex items-center gap-1">
          <Timer className={cn("h-3 w-3", immersive ? "opacity-60" : "opacity-70")} aria-hidden />
          {isPaused ? "Paused" : immersive ? "Progress" : "Workout progress"}
        </span>
        <span
          className={cn(
            isOvertime && (immersive ? "text-amber-300" : "text-amber-600 dark:text-amber-400"),
            isPaused && immersive && "text-amber-200/80",
          )}
        >
          {isPaused ? "Clock frozen" : isOvertime ? "Planned time up" : `${Math.round(pct)}%`}
          {!compact && !isPaused ? (
            <span className={immersive ? "text-white/40" : isOvertime ? "opacity-90" : "text-muted-foreground/80"}>
              {" "}
              · {isOvertime ? `+${remMin} min over` : `~${remMin} min left`}
            </span>
          ) : null}
        </span>
      </div>
      <div
        className={cn(
          "h-1.5 overflow-hidden rounded-full",
          immersive ? "bg-white/10" : "bg-muted/70 ring-1 ring-border/50 dark:bg-muted/40",
        )}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            immersive
              ? isPaused
                ? "bg-white/40"
                : isOvertime
                  ? "bg-amber-400"
                  : "bg-emerald-400"
              : isPaused
                ? "bg-muted-foreground/50"
                : isOvertime
                  ? "bg-amber-500"
                  : "bg-primary",
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
  variant?: "default" | "pre" | "active" | "recovery" | "immersive";
}) {
  const { lines, className, variant = "default" } = props;
  if (lines.length === 0) return null;

  if (variant === "immersive") {
    const primary = lines[0]!;
    const { amount, detail } = splitCarbLineText(primary.text);
    const extras = lines.slice(1);
    return (
      <div
        className={cn(
          "rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 backdrop-blur-sm",
          className,
        )}
        data-testid="exercise-fuel-plan"
      >
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/40">{primary.label}</p>
        <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-white">{amount}</p>
        {detail ? <p className="mt-1 text-sm leading-snug text-white/50">{detail}</p> : null}
        {extras.length > 0 ? (
          <ul className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
            {extras.map((line) => {
              const extra = splitCarbLineText(line.text);
              return (
                <li key={line.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-white/55">{line.label}</span>
                  {line.text.trim() ? (
                    <span className="min-w-0 text-right font-medium text-white/80">
                      {extra.amount}
                      {extra.detail ? <span className="font-normal text-white/40"> · {extra.detail}</span> : null}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    );
  }

  if (variant === "pre" || variant === "active" || variant === "recovery") {
    const primary = lines[0];
    const { amount, detail } = splitCarbLineText(primary.text);
    const extras = lines.slice(1);

    return (
      <div
        className={cn(
          "rounded-2xl border border-border/50 bg-background/80 px-4 py-3.5 shadow-none",
          className,
        )}
        data-testid="exercise-fuel-plan"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <UtensilsCrossed className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {primary.label}
            </p>
            <p className="text-xl font-bold tabular-nums leading-none tracking-tight text-foreground">{amount}</p>
            {detail ? <p className="text-sm leading-snug text-muted-foreground">{detail}</p> : null}
            {extras.length > 0 ? (
              <ul className="space-y-1.5 border-t border-border/50 pt-2.5">
                {extras.map((line) => {
                  const extra = splitCarbLineText(line.text);
                  return (
                    <li key={line.id} className="flex items-baseline justify-between gap-3 text-sm leading-snug">
                      <span className="font-medium text-foreground">{line.label}</span>
                      {line.text.trim() ? (
                        <span className="min-w-0 text-right text-muted-foreground">
                          {extra.amount}
                          {extra.detail ? (
                            <span className="text-muted-foreground/80"> · {extra.detail}</span>
                          ) : null}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
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

function hypoSupportLine(suggestion: ExerciseHypoSuggestion): string {
  if (suggestion.approximate) {
    return "Then recheck. Use your care team's hypo plan if it differs.";
  }
  if (suggestion.primaryTreatmentLine) {
    return `${suggestion.primaryTreatmentLine} · recheck in 10–15 min`;
  }
  return `~${suggestion.glucoseTablets} tablets or ~${suggestion.juiceMl}ml juice · recheck in 10–15 min`;
}

export function ExerciseHypoTreatmentHint(props: {
  suggestion: ExerciseHypoSuggestion | null;
  className?: string;
  /** Dark stage styling inspired by Exercise mode. */
  variant?: "default" | "immersive";
}) {
  const { suggestion, className, variant = "default" } = props;
  if (!suggestion) return null;

  const title = suggestion.clinicalHypo ? "Reading looks low" : "Treat now";
  const support = hypoSupportLine(suggestion);

  if (variant === "immersive") {
    return (
      <div
        className={cn(
          "rounded-2xl border border-amber-400/30 bg-amber-500/15 px-4 py-4 text-center shadow-[0_8px_32px_rgba(0,0,0,0.25)] backdrop-blur-sm",
          className,
        )}
        data-testid="exercise-hypo-auto-hint"
      >
        <div className="flex items-center justify-center gap-1.5 text-amber-200">
          <Droplet className="h-4 w-4" aria-hidden />
          <p className="text-sm font-semibold tracking-tight">{title}</p>
        </div>
        <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-white">
          {suggestion.carbsGrams}
          <span className="ml-1 text-lg font-semibold text-white/55">g</span>
        </p>
        <p className="mt-1 text-sm font-medium text-amber-100/90">fast carbs now</p>
        <p className="mt-2 text-xs leading-snug text-amber-100/60">{support}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.12] via-amber-500/[0.08] to-transparent px-4 py-4",
        className,
      )}
      data-testid="exercise-hypo-auto-hint"
    >
      <div className="flex items-start gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
          <Droplet className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-800/80 dark:text-amber-200/80">
            {title}
          </p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
              {suggestion.carbsGrams}
            </span>
            <span className="text-base font-semibold text-muted-foreground">g fast carbs</span>
          </p>
          <p className="mt-1.5 text-sm leading-snug text-muted-foreground">{support}</p>
        </div>
      </div>
    </div>
  );
}
