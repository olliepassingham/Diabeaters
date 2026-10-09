import { useMemo } from "react";
import { Link } from "wouter";
import { TestTube } from "lucide-react";
import { Hba1cUnitToggle } from "@/components/appointments/hba1c-unit-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHba1cUnit } from "@/hooks/use-hba1c-unit";
import type { Hba1cHistoryPoint } from "@/lib/appointment-outcomes";
import { formatHba1c, hba1cChartValue, hba1cUnitLabel } from "@/lib/hba1c-units";
import { cn } from "@/lib/utils";

const WIDTH = 320;
const HEIGHT = 160;
const PAD = { top: 14, right: 12, bottom: 28, left: 32 };

type Props = {
  points: Hba1cHistoryPoint[];
  className?: string;
};

/**
 * Educational HbA1c history from appointment outcomes — not a clinical target chart.
 */
export function Hba1cHistoryChart({ points, className }: Props) {
  const [unit, setUnit] = useHba1cUnit();
  const pad = unit === "mmol" ? { ...PAD, left: 42 } : PAD;
  const { path, dots, yTicks, xLabels, minY, maxY } = useMemo(() => {
    if (points.length === 0) {
      return { path: "", dots: [] as { x: number; y: number; p: Hba1cHistoryPoint }[], yTicks: [] as number[], xLabels: [] as { x: number; label: string }[], minY: 5, maxY: 10 };
    }
    const values = points.map((p) => hba1cChartValue(p.hba1cPercent, unit));
    const minY = unit === "mmol" ? Math.min(31, ...values) - 5 : Math.min(5, ...values) - 0.5;
    const maxY = unit === "mmol" ? Math.max(86, ...values) + 5 : Math.max(10, ...values) + 0.5;
    const innerW = WIDTH - pad.left - pad.right;
    const innerH = HEIGHT - pad.top - pad.bottom;
    const xFor = (i: number) =>
      points.length === 1
        ? pad.left + innerW / 2
        : pad.left + (i / (points.length - 1)) * innerW;
    const yFor = (v: number) => pad.top + innerH - ((v - minY) / (maxY - minY)) * innerH;
    const dots = points.map((p, i) => ({ x: xFor(i), y: yFor(hba1cChartValue(p.hba1cPercent, unit)), p }));
    const path = dots.map((d, i) => `${i === 0 ? "M" : "L"}${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(" ");
    const steps = 4;
    const yTicks = Array.from({ length: steps + 1 }, (_, i) => {
      const raw = minY + ((maxY - minY) * i) / steps;
      return unit === "mmol" ? Math.round(raw) : Math.round(raw * 10) / 10;
    });
    const labelIdx =
      points.length <= 4
        ? points.map((_, i) => i)
        : [0, Math.floor((points.length - 1) / 2), points.length - 1];
    const xLabels = labelIdx.map((i) => {
      const d = points[i]!.date;
      const m = /^(\d{4})-(\d{2})/.exec(d);
      const label = m ? `${m[2]}/${m[1].slice(2)}` : d;
      return { x: xFor(i), label };
    });
    return { path, dots, yTicks, xLabels, minY, maxY };
  }, [pad.bottom, pad.left, pad.right, pad.top, points, unit]);

  if (points.length === 0) {
    return (
      <Card className={cn("rounded-2xl border-border/60 shadow-sm", className)} data-testid="patterns-hba1c-empty">
        <CardHeader className="space-y-2 p-4 pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <TestTube className="h-4 w-4 text-primary" aria-hidden />
              HbA1c history
            </CardTitle>
            <Hba1cUnitToggle unit={unit} onChange={setUnit} />
          </div>
          <p className="text-xs leading-snug text-muted-foreground">
            Add past HbA1c results on Appointments to see your history here. Educational only — discuss trends with
            your team.
          </p>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <Link
            href="/appointments"
            className="text-sm font-medium text-primary underline-offset-2 hover:underline"
            data-testid="link-patterns-hba1c-appointments"
          >
            Open Appointments
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("rounded-2xl border-border/60 shadow-sm", className)} data-testid="patterns-hba1c-chart">
      <CardHeader className="space-y-2 p-4 pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <TestTube className="h-4 w-4 text-primary" aria-hidden />
            HbA1c history
          </CardTitle>
          <Hba1cUnitToggle unit={unit} onChange={setUnit} />
        </div>
        <p className="text-xs leading-snug text-muted-foreground">
          Your logged HbA1c in {hba1cUnitLabel(unit)} — a conversation starter with your team, not a diagnosis.
        </p>
      </CardHeader>
      <CardContent className="px-2 pb-4 sm:px-4">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full min-h-[160px] text-muted-foreground"
          role="img"
          aria-label={`HbA1c history in ${hba1cUnitLabel(unit)} with ${points.length} logged results`}
        >
          {yTicks.map((t, i) => {
            const y =
              pad.top +
              (HEIGHT - pad.top - pad.bottom) -
              ((t - minY) / (maxY - minY)) * (HEIGHT - pad.top - pad.bottom);
            return (
              <g key={`${i}-${t}`}>
                <line
                  x1={pad.left}
                  y1={y}
                  x2={WIDTH - pad.right}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity="0.12"
                  strokeDasharray="3 3"
                />
                <text x={pad.left - 6} y={y + 3} textAnchor="end" fontSize="9" fill="currentColor">
                  {unit === "mmol" ? String(Math.round(t)) : t.toFixed(1)}
                </text>
              </g>
            );
          })}
          {path ? (
            <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" />
          ) : null}
          {dots.map((d) => (
            <circle
              key={d.p.appointmentId}
              cx={d.x}
              cy={d.y}
              r="4.5"
              fill="hsl(var(--primary))"
              stroke="hsl(var(--background))"
              strokeWidth="2"
            >
              <title>{`${formatHba1c(d.p.hba1cPercent, unit)} · ${d.p.date} · ${d.p.title}`}</title>
            </circle>
          ))}
          {xLabels.map((l) => (
            <text
              key={`${l.x}-${l.label}`}
              x={l.x}
              y={HEIGHT - 8}
              textAnchor="middle"
              fontSize="9"
              fill="currentColor"
              fillOpacity="0.85"
            >
              {l.label}
            </text>
          ))}
        </svg>
        <p className="mt-1 px-2 text-[11px] text-muted-foreground">
          Latest: {formatHba1c(points[points.length - 1]!.hba1cPercent, unit)} ({points[points.length - 1]!.date})
        </p>
      </CardContent>
    </Card>
  );
}
