import { useMemo } from "react";
import { getCgmLocalHistory } from "@/lib/cgm/cgm-history-store";
import type { BgUnits } from "@/lib/cgm/types";
import {
  buildExerciseSessionBgSeries,
  exerciseSessionBgGlance,
  type ExerciseSessionBgPoint,
} from "@/lib/exercise-session-summary";
import { formatTargetBgInput } from "@/lib/hypo-context";
import type { ActiveExerciseSession } from "@/lib/storage";
import { resolveUserTargetBgRange } from "@/lib/target-bg-range";
import { storage } from "@/lib/storage";

function Sparkline({
  points,
  low,
  high,
}: {
  points: ExerciseSessionBgPoint[];
  low: number;
  high: number;
}) {
  const width = 320;
  const height = 92;
  const padX = 8;
  const padY = 10;
  const values = points.map((p) => p.value);
  const minV = Math.min(low, ...values);
  const maxV = Math.max(high, ...values);
  const span = Math.max(0.4, maxV - minV);
  const t0 = points[0]!.timeMs;
  const t1 = points[points.length - 1]!.timeMs;
  const x = (t: number) =>
    padX + ((t1 === t0 ? 0.5 : (t - t0) / (t1 - t0)) * (width - padX * 2));
  const y = (v: number) => padY + (1 - (v - minV) / span) * (height - padY * 2);
  const line = points.map((p) => `${x(p.timeMs).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const bandTop = y(high);
  const bandBottom = y(low);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[5.75rem] w-full" role="img" aria-hidden>
      <rect
        x={padX}
        y={Math.min(bandTop, bandBottom)}
        width={width - padX * 2}
        height={Math.max(2, Math.abs(bandBottom - bandTop))}
        rx="6"
        className="fill-emerald-500/15"
      />
      {points.length > 1 ? (
        <polyline
          points={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinejoin="round"
          strokeLinecap="round"
          className="text-foreground"
        />
      ) : null}
      <circle cx={x(points[0]!.timeMs)} cy={y(points[0]!.value)} r="3.5" className="fill-foreground" />
      <circle
        cx={x(points[points.length - 1]!.timeMs)}
        cy={y(points[points.length - 1]!.value)}
        r="3.5"
        className="fill-primary"
      />
    </svg>
  );
}

export function ExerciseRecoverySummary({
  session,
  units,
}: {
  session: ActiveExerciseSession;
  units: BgUnits;
}) {
  const series = useMemo(() => {
    const history = getCgmLocalHistory(2);
    return buildExerciseSessionBgSeries(session, history, units);
  }, [session, units]);
  const glance = exerciseSessionBgGlance(series.points);
  const target = useMemo(() => resolveUserTargetBgRange(storage.getSettings(), units), [units]);
  const intensity =
    session.intensity.length > 0
      ? session.intensity.charAt(0).toUpperCase() + session.intensity.slice(1)
      : session.intensity;

  return (
    <div className="space-y-4" data-testid="exercise-recovery-summary">
      <div>
        <p className="text-base font-semibold tracking-tight text-foreground">{session.exerciseName}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {session.durationMinutes} min · {intensity}
        </p>
      </div>

      {glance && series.points.length > 0 ? (
        <div className="rounded-2xl border border-border/50 bg-muted/20 px-2 py-2">
          <Sparkline points={series.points} low={target.low} high={target.high} />
          <div className="grid grid-cols-3 gap-2 px-2 pb-1.5 pt-1">
            {(
              [
                ["Start", glance.start],
                ["Low", glance.low],
                ["Now", glance.now],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="text-center">
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-foreground">
                  {formatTargetBgInput(value, units)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-border/60 px-3 py-4 text-center text-sm text-muted-foreground">
          No glucose logged this session
        </p>
      )}
    </div>
  );
}
