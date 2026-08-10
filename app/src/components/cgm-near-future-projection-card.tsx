import { useMemo } from "react";
import type { CgmChartPoint } from "@/lib/cgm/cgm-chart";
import {
  computeNearFutureProjection,
  type NearFutureProjectionResult,
} from "@/lib/cgm/near-future-projection";
import type { BgUnits } from "@/lib/cgm/types";
import { formatTargetBgInput } from "@/lib/hypo-context";

type CgmNearFutureProjectionCardProps = {
  points: CgmChartPoint[];
  units: BgUnits;
};

function projectionPointsFromChart(points: CgmChartPoint[]) {
  return points
    .filter((p) => typeof p.valueMgDl === "number" && Number.isFinite(p.valueMgDl))
    .map((p) => ({ valueMgDl: p.valueMgDl!, recordedAt: p.recordedAt }));
}

export function CgmNearFutureProjectionCard({ points, units }: CgmNearFutureProjectionCardProps) {
  const projection = useMemo((): NearFutureProjectionResult | null => {
    if (points.length === 0) return null;
    const latest = points[points.length - 1]!;
    return computeNearFutureProjection({
      points: projectionPointsFromChart(points),
      latestRawTrend: latest.rawTrend ?? null,
      units,
    });
  }, [points, units]);

  if (!projection) return null;

  const unitSuffix = projection.units;

  return (
    <div
      className="rounded-xl border border-border/60 bg-muted/15 px-3 py-2.5 shadow-none"
      data-testid="card-cgm-near-future-projection"
      role="region"
      aria-label="Near-future glucose projection"
    >
      <div className="space-y-2">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">If this pace continued</p>
          <p className="text-xs text-muted-foreground leading-snug">
            Illustration only — not a prediction. Does not include insulin, food, exercise, or CGM lag.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-background/70 px-2.5 py-2" data-testid="cgm-projection-15min">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">+15 min</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight">
              {formatTargetBgInput(projection.at15Min, unitSuffix)}{" "}
              <span className="text-sm font-medium text-muted-foreground">{unitSuffix}</span>
            </p>
            <p className="text-[11px] text-muted-foreground">would be if the current rate continued</p>
          </div>
          <div className="rounded-lg bg-background/70 px-2.5 py-2" data-testid="cgm-projection-30min">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">+30 min</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight">
              {formatTargetBgInput(projection.at30Min, unitSuffix)}{" "}
              <span className="text-sm font-medium text-muted-foreground">{unitSuffix}</span>
            </p>
            <p className="text-[11px] text-muted-foreground">would be if the current rate continued</p>
          </div>
        </div>

        <p className="text-[11px] leading-snug text-muted-foreground" data-testid="cgm-projection-note">
          {projection.note}
        </p>
      </div>
    </div>
  );
}
