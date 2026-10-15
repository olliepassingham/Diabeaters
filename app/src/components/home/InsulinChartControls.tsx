import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  recordLongActingDose,
  recordRapidInsulinDose,
  setInsulinChartVisible,
} from "@/lib/insulin-activity";

function localDateTimeValue(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function InsulinChartControls({
  visible,
  hasDoses,
  remaining,
  runsOutLabel,
  longActingUnits,
}: {
  visible: boolean;
  hasDoses: boolean;
  remaining: number;
  runsOutLabel: string | null;
  longActingUnits?: number;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"rapid" | "long">("rapid");
  const [units, setUnits] = useState("");
  const [takenAt, setTakenAt] = useState(localDateTimeValue);

  const openForm = (nextKind: "rapid" | "long") => {
    setKind(nextKind);
    setTakenAt(localDateTimeValue());
    setUnits(nextKind === "long" && longActingUnits ? String(longActingUnits) : "");
    setOpen(true);
  };

  const save = () => {
    const amount = Number(units);
    const when = new Date(takenAt);
    if (!Number.isFinite(amount) || amount <= 0 || Number.isNaN(when.getTime())) return;
    const saved =
      kind === "rapid"
        ? recordRapidInsulinDose({ units: amount, takenAtIso: when.toISOString() })
        : recordLongActingDose({ units: amount, takenAtIso: when.toISOString() });
    if (!saved) return;
    setInsulinChartVisible(true);
    setOpen(false);
  };

  return (
    <div className="mt-2 space-y-2 px-1" data-testid="insulin-chart-controls">
      <div className="flex items-center justify-between gap-2">
        {hasDoses && visible ? (
          <p className="min-w-0 text-sm text-foreground" data-testid="insulin-chart-caption">
            <span className="font-medium text-amber-700 dark:text-amber-400">
              {remaining > 0.05 ? `${remaining.toFixed(1)}u still working` : "Rapid insulin has run out"}
            </span>
            {runsOutLabel ? <span className="text-muted-foreground"> · {runsOutLabel}</span> : null}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {hasDoses ? "Insulin line is hidden" : "Log a dose to see it run out on this graph"}
          </p>
        )}
        {hasDoses ? (
          <Button
            type="button"
            variant={visible ? "secondary" : "outline"}
            size="sm"
            className="h-9 shrink-0 rounded-full px-3"
            onClick={() => setInsulinChartVisible(!visible)}
            data-testid="button-toggle-insulin-chart"
          >
            {visible ? "Hide insulin" : "Show insulin"}
          </Button>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-10 flex-1 rounded-xl" onClick={() => openForm("rapid")} data-testid="button-log-rapid-insulin">
          I took rapid
        </Button>
        <Button type="button" variant="outline" className="h-10 flex-1 rounded-xl" onClick={() => openForm("long")} data-testid="button-log-long-insulin">
          I took long-acting
        </Button>
      </div>
      {open ? (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-background/80 p-3">
          <div className="space-y-1.5">
            <Label htmlFor="insulin-units" className="text-sm font-medium">
              {kind === "rapid" ? "Rapid units" : "Long-acting units"}
            </Label>
            <Input
              id="insulin-units"
              inputMode="decimal"
              value={units}
              onChange={(event) => setUnits(event.target.value)}
              placeholder="Units"
              className="h-12 text-base"
              data-testid="input-insulin-units"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="insulin-time" className="text-sm font-medium">
              When
            </Label>
            <Input
              id="insulin-time"
              type="datetime-local"
              value={takenAt}
              onChange={(event) => setTakenAt(event.target.value)}
              className="h-12 text-base"
              data-testid="input-insulin-time"
            />
          </div>
          <Button type="button" className="h-11 w-full" onClick={save} data-testid="button-save-insulin-dose">
            Show on graph
          </Button>
        </div>
      ) : null}
    </div>
  );
}
