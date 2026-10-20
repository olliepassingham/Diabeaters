import { useState } from "react";
import { Plus, Syringe } from "lucide-react";
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

  const onBoard = hasDoses && visible;
  const title = onBoard
    ? remaining > 0.05
      ? `${remaining.toFixed(1)}u still working`
      : "Rapid insulin has run out"
    : hasDoses
      ? "Insulin hidden"
      : "Insulin";
  const detail = onBoard
    ? runsOutLabel ?? "Shown on this graph"
    : hasDoses
      ? "Hidden on this graph"
      : "Add a dose to this graph";

  return (
    <div data-testid="insulin-chart-controls">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => (open ? setOpen(false) : openForm())}
          data-testid="button-add-insulin-dose"
          aria-expanded={open}
        >
          <Syringe className="h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                "block truncate text-[13px] font-medium",
                onBoard ? "tabular-nums text-amber-800 dark:text-amber-200" : "text-foreground",
              )}
              data-testid="insulin-chart-caption"
            >
              {onBoard || hasDoses ? title : "Add insulin"}
            </span>
            {onBoard || hasDoses ? (
              <span className="block truncate text-[11px] text-muted-foreground">{detail}</span>
            ) : null}
          </span>
          <Plus
            className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-45")}
            aria-hidden
          />
        </button>
        {hasDoses ? (
          <button
            type="button"
            className="shrink-0 text-[12px] font-medium text-muted-foreground"
            onClick={() => setInsulinChartVisible(!visible)}
            data-testid="button-toggle-insulin-chart"
          >
            {visible ? "Hide" : "Show"}
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-3 space-y-3 border-t border-border/50 pt-3">
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
          <div className="grid gap-2">
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
              className="h-12 min-w-0 text-base"
              data-testid="input-insulin-time"
            />
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="ghost" className="h-9 rounded-full px-3 text-sm font-semibold" onClick={save} data-testid="button-save-insulin-dose">
              Add to graph
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
