import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  recordLongActingDose,
  recordRapidInsulinDose,
  setInsulinChartVisible,
} from "@/lib/insulin-activity";
import { cn } from "@/lib/utils";

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

  const openForm = () => {
    setKind("rapid");
    setTakenAt(localDateTimeValue());
    setUnits("");
    setOpen(true);
  };

  const chooseKind = (nextKind: "rapid" | "long") => {
    setKind(nextKind);
    if (nextKind === "long" && longActingUnits && !units) setUnits(String(longActingUnits));
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
    <div className="mt-1 px-1" data-testid="insulin-chart-controls">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {hasDoses && visible ? (
            <p className="text-sm leading-tight" data-testid="insulin-chart-caption">
              <span className="font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                {remaining > 0.05 ? `${remaining.toFixed(1)}u still working` : "Rapid insulin has run out"}
              </span>
              {runsOutLabel ? <span className="mt-0.5 block text-[13px] text-muted-foreground">{runsOutLabel}</span> : null}
            </p>
          ) : (
            <p className="text-sm font-medium text-foreground" data-testid="insulin-chart-caption">
              {hasDoses ? "Insulin hidden" : "Insulin"}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {hasDoses ? (
            <button
              type="button"
              className="h-9 rounded-full px-3 text-[13px] font-medium text-muted-foreground"
              onClick={() => setInsulinChartVisible(!visible)}
              data-testid="button-toggle-insulin-chart"
            >
              {visible ? "Hide" : "Show"}
            </button>
          ) : null}
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1 rounded-full bg-foreground/[0.05] px-3 text-[13px] font-medium text-foreground"
            onClick={() => (open ? setOpen(false) : openForm())}
            data-testid="button-add-insulin-dose"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add dose
          </button>
        </div>
      </div>

      {open ? (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 rounded-full bg-muted/70 p-1" role="group" aria-label="Insulin type">
            {(
              [
                ["rapid", "Rapid"],
                ["long", "Long-acting"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={cn(
                  "h-9 rounded-full text-sm font-medium",
                  kind === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                )}
                aria-pressed={kind === value}
                onClick={() => chooseKind(value)}
                data-testid={value === "rapid" ? "button-log-rapid-insulin" : "button-log-long-insulin"}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-[5.5rem_1fr] gap-2">
            <Input
              inputMode="decimal"
              value={units}
              onChange={(event) => setUnits(event.target.value)}
              placeholder="Units"
              aria-label={kind === "rapid" ? "Rapid units" : "Long-acting units"}
              className="h-12 text-base"
              data-testid="input-insulin-units"
            />
            <Input
              type="datetime-local"
              value={takenAt}
              onChange={(event) => setTakenAt(event.target.value)}
              aria-label="When"
              className="h-12 text-base"
              data-testid="input-insulin-time"
            />
          </div>
          <Button type="button" className="h-11 w-full rounded-full" onClick={save} data-testid="button-save-insulin-dose">
            Add to graph
          </Button>
        </div>
      ) : null}
    </div>
  );
}
