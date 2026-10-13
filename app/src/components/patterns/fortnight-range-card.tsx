import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FortnightRangePicture } from "@/lib/cgm/fortnight-range";
import type { BgUnits } from "@/lib/cgm/types";
import { formatTargetBgInput } from "@/lib/hypo-context";
import { veryLowThreshold } from "@/lib/cgm/window-summary";
import { cn } from "@/lib/utils";

type FortnightRangeCardProps = {
  picture: FortnightRangePicture;
  units: BgUnits;
};

export function FortnightRangeCard({ picture, units }: FortnightRangeCardProps) {
  const veryLowLabel = formatTargetBgInput(veryLowThreshold(units), units);
  const aria = [
    `Last 14 days: ${picture.inRangePercent}% in range`,
    `${picture.belowPercent}% below range`,
    picture.veryLowPercent > 0 ? `including ${picture.veryLowPercent}% very low` : null,
    `${picture.abovePercent}% above range`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Card data-testid="card-patterns-fortnight-range">
      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="text-base">Last 14 days</CardTitle>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Share of the readings stored on this phone. Not a lab result.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted/40"
          role="img"
          aria-label={aria}
        >
          <BarSegment percent={picture.belowPercent} className="bg-red-500 dark:bg-red-400" />
          <BarSegment percent={picture.inRangePercent} className="bg-emerald-500 dark:bg-emerald-400" />
          <BarSegment percent={picture.abovePercent} className="bg-orange-400 dark:bg-orange-400" />
        </div>
        <ul className="space-y-2">
          <RangeRow
            label="In range"
            percent={picture.inRangePercent}
            dotClassName="bg-emerald-500 dark:bg-emerald-400"
            emphasize
            testId="fortnight-in-range"
          />
          <RangeRow
            label="Below range"
            percent={picture.belowPercent}
            dotClassName="bg-red-500 dark:bg-red-400"
            testId="fortnight-below"
            detail={
              picture.veryLowPercent > 0
                ? `Includes ${picture.veryLowPercent}% very low, under ${veryLowLabel} ${units}`
                : undefined
            }
          />
          <RangeRow
            label="Above range"
            percent={picture.abovePercent}
            dotClassName="bg-orange-400"
            testId="fortnight-above"
          />
        </ul>
      </CardContent>
    </Card>
  );
}

function BarSegment({ percent, className }: { percent: number; className: string }) {
  if (percent <= 0) return null;
  return <div className={cn("h-full min-w-[2px]", className)} style={{ width: `${percent}%` }} />;
}

function RangeRow({
  label,
  percent,
  dotClassName,
  detail,
  emphasize = false,
  testId,
}: {
  label: string;
  percent: number;
  dotClassName: string;
  detail?: string;
  emphasize?: boolean;
  testId: string;
}) {
  return (
    <li className="flex items-start gap-2.5" data-testid={testId}>
      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dotClassName)} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className={cn("text-sm text-foreground", emphasize && "font-medium")}>{label}</span>
          <span className={cn("text-sm tabular-nums text-foreground", emphasize && "font-semibold")}>{percent}%</span>
        </span>
        {detail ? <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span> : null}
      </span>
    </li>
  );
}
