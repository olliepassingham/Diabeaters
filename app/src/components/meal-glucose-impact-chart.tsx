import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { MealImpactProfile } from "@/lib/meal-impact";

type MealGlucoseImpactChartProps = {
  profile: MealImpactProfile;
  className?: string;
  "data-testid"?: string;
};

const WIDTH = 320;
const HEIGHT = 168;
const PAD = { top: 16, right: 10, bottom: 22, left: 10 };

function gaussian(t: number, center: number, sigma: number, height: number): number {
  return height * Math.exp(-((t - center) ** 2) / (2 * sigma * sigma));
}

/**
 * Illustrative glucose-response curve for a meal's typical absorption pattern —
 * same charting language (viewBox, muted grid, chart-2 accent) as the Patterns
 * page charts. Not real data: a shape only, always paired with a "typical
 * pattern only" caption.
 */
export function MealGlucoseImpactChart({ profile, className, "data-testid": testId }: MealGlucoseImpactChartProps) {
  const { totalHours, peakTimeHours, peakSigma, peakHeight, tailTimeHours, tailSigma, tailHeight } = profile.chart;
  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const baselineY = PAD.top + innerHeight;

  const { pathD, areaD, peakPoint, tailPoint } = useMemo(() => {
    const steps = 80;
    const xFor = (t: number) => PAD.left + (t / totalHours) * innerWidth;
    const yFor = (v: number) => PAD.top + innerHeight - v * innerHeight;

    const samples: { t: number; v: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * totalHours;
      const main = gaussian(t, peakTimeHours, peakSigma, peakHeight);
      const tail = tailTimeHours != null ? gaussian(t, tailTimeHours, tailSigma ?? 0.9, tailHeight ?? 0.4) : 0;
      samples.push({ t, v: Math.min(1, main + tail) });
    }

    const path = samples.map((s, i) => `${i === 0 ? "M" : "L"}${xFor(s.t).toFixed(1)},${yFor(s.v).toFixed(1)}`).join(" ");
    const area = `${path} L${xFor(totalHours).toFixed(1)},${(PAD.top + innerHeight).toFixed(1)} L${xFor(0).toFixed(1)},${(PAD.top + innerHeight).toFixed(1)} Z`;

    const peak = samples.reduce((best, s) => (s.v > best.v ? s : best), samples[0]);
    let tailPeak: { t: number; v: number } | null = null;
    if (tailTimeHours != null) {
      const afterMain = samples.filter((s) => s.t > peakTimeHours + peakSigma);
      const candidate = afterMain.reduce((best, s) => (s.v > best.v ? s : best), afterMain[0] ?? peak);
      if (candidate && candidate.v > 0.08) tailPeak = candidate;
    }

    return {
      pathD: path,
      areaD: area,
      peakPoint: { x: xFor(peak.t), y: yFor(peak.v) },
      tailPoint: tailPeak ? { x: xFor(tailPeak.t), y: yFor(tailPeak.v) } : null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- xFor/yFor derive only from the stable dimensions above
  }, [totalHours, peakTimeHours, peakSigma, peakHeight, tailTimeHours, tailSigma, tailHeight, innerWidth, innerHeight]);

  const hourTicks = Array.from({ length: totalHours + 1 }, (_, i) => i);

  return (
    <div className={cn("w-full", className)} data-testid={testId}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full min-h-[150px] text-muted-foreground"
        role="img"
        aria-label={`Illustrative glucose impact curve for a ${profile.patternLabel.toLowerCase()} meal`}
      >
        <defs>
          <linearGradient id="meal-impact-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity="0.35" />
            <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <line
          x1={PAD.left}
          y1={baselineY}
          x2={WIDTH - PAD.right}
          y2={baselineY}
          stroke="currentColor"
          strokeOpacity={0.25}
          strokeDasharray="4 4"
        />

        <path d={areaD} fill="url(#meal-impact-fill)" />
        <path d={pathD} fill="none" stroke="hsl(var(--chart-2))" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />

        <circle cx={peakPoint.x} cy={peakPoint.y} r={3.5} fill="hsl(var(--chart-2))" />
        <text x={peakPoint.x} y={Math.max(10, peakPoint.y - 8)} textAnchor="middle" fontSize="8" fontWeight={600} fill="currentColor">
          Peak
        </text>

        {tailPoint ? (
          <>
            <circle cx={tailPoint.x} cy={tailPoint.y} r={3} fill="hsl(var(--chart-2))" fillOpacity={0.75} />
            <text x={tailPoint.x} y={Math.max(10, tailPoint.y - 8)} textAnchor="middle" fontSize="8" fontWeight={600} fill="currentColor">
              Delayed rise
            </text>
          </>
        ) : null}

        {hourTicks.map((h) => {
          const x = PAD.left + (h / totalHours) * innerWidth;
          return (
            <text key={h} x={x} y={HEIGHT - 6} textAnchor="middle" fontSize="8" fill="currentColor">
              {h}h
            </text>
          );
        })}
      </svg>
    </div>
  );
}
