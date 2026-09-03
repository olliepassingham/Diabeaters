import { formatInsulinUnits } from "@/lib/insulin-rounding";
import { splitSecondDoseClockLabel } from "@/lib/meal-split-plan";
import { cn } from "@/lib/utils";

type SplitDoseTimelineProps = {
  firstDose: number;
  secondDose: number;
  delayHours: number;
  roundIncrement: number;
  isPumpUser: boolean;
  className?: string;
};

/**
 * Visual now → later insulin timing against a slower delayed-rise shape.
 * Illustrative only — not a glucose forecast.
 */
export function SplitDoseTimeline({
  firstDose,
  secondDose,
  delayHours,
  roundIncrement,
  isPumpUser,
  className,
}: SplitDoseTimelineProps) {
  const totalHours = Math.max(6, delayHours + 2);
  const laterLabel = splitSecondDoseClockLabel(delayHours);
  const firstX = 18;
  const secondX = 18 + (delayHours / totalHours) * 246;
  const firstLabel = formatInsulinUnits(firstDose, roundIncrement);
  const secondLabel = formatInsulinUnits(secondDose, roundIncrement);

  return (
    <div className={cn("space-y-3", className)} data-testid="split-dose-timeline">
      <svg
        viewBox="0 0 320 118"
        className="h-auto w-full text-primary"
        role="img"
        aria-label={`${firstLabel} units now, then ${secondLabel} units at about ${laterLabel}`}
      >
        <defs>
          <linearGradient id="split-dose-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.22" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path
          d="M18 78 C 70 78, 96 34, 142 30 C 188 26, 214 40, 248 52 C 272 60, 292 58, 302 54 L 302 96 L 18 96 Z"
          fill="url(#split-dose-fill)"
        />
        <path
          d="M18 78 C 70 78, 96 34, 142 30 C 188 26, 214 40, 248 52 C 272 60, 292 58, 302 54"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeOpacity="0.55"
          strokeWidth="2"
        />
        <line x1="18" y1="96" x2="302" y2="96" stroke="currentColor" strokeOpacity="0.18" />
        <line
          x1={firstX}
          y1="28"
          x2={firstX}
          y2="96"
          stroke="hsl(var(--primary))"
          strokeWidth="1.5"
          strokeDasharray="3 4"
          strokeOpacity="0.55"
        />
        <line
          x1={secondX}
          y1="28"
          x2={secondX}
          y2="96"
          stroke="hsl(var(--primary))"
          strokeWidth="1.5"
          strokeDasharray="3 4"
          strokeOpacity="0.55"
        />
        <circle cx={firstX} cy="96" r="6" fill="hsl(var(--primary))" />
        <circle cx={secondX} cy="96" r="6" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="2.5" />
        <text x={firstX} y="18" textAnchor="middle" className="fill-foreground text-[11px] font-semibold">
          {firstLabel}u
        </text>
        <text x={secondX} y="18" textAnchor="middle" className="fill-foreground text-[11px] font-semibold">
          {secondLabel}u
        </text>
        <text x="18" y="112" className="fill-muted-foreground text-[9px]">
          0h
        </text>
        <text x="302" y="112" textAnchor="end" className="fill-muted-foreground text-[9px]">
          {totalHours}h
        </text>
      </svg>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">Now</p>
          <p className="mt-0.5 font-display text-2xl font-semibold tabular-nums">
            {firstLabel}
            <span className="ml-0.5 text-sm font-semibold text-muted-foreground">u</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {isPumpUser ? "Program at meal start" : "Take as you start eating"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
            Around {laterLabel}
          </p>
          <p className="mt-0.5 font-display text-2xl font-semibold tabular-nums">
            {secondLabel}
            <span className="ml-0.5 text-sm font-semibold text-muted-foreground">u</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {isPumpUser ? `Check IOB, then the remaining ${delayHours}h` : `Check glucose, then this dose`}
          </p>
        </div>
      </div>
    </div>
  );
}
