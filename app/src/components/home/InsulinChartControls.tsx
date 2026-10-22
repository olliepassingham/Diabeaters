import { useState } from "react";
import { Pencil, Plus, Syringe, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteInsulinDose,
  getLongActingDoses,
  getRapidInsulinDoses,
  recordLongActingDose,
  recordRapidInsulinDose,
  remainingRapidUnits,
  setInsulinChartVisible,
  updateInsulinDose,
  type InsulinDoseKind,
} from "@/lib/insulin-activity";
import { cn } from "@/lib/utils";

function localDateTimeValue(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDoseWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const now = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, now)) return `Today ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return `Yesterday ${time}`;
  return `${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })} ${time}`;
}

function relativeAgo(iso: string, nowMs: number): string {
  const mins = Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return mins % 60 >= 5 ? `${hours}h ${mins % 60}m ago` : `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

type DoseRow = {
  kind: InsulinDoseKind;
  id: string;
  units: number;
  takenAtIso: string;
};

export function InsulinChartControls({
  visible,
  hasDoses,
  remaining,
  runsOutLabel,
  longActingUnits,
  showDoseList = true,
}: {
  visible: boolean;
  hasDoses: boolean;
  remaining: number;
  runsOutLabel: string | null;
  longActingUnits?: number;
  /** The tappable dose list (today's doses, tap to edit). Off on compact surfaces like Home. */
  showDoseList?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"rapid" | "long">("rapid");
  const [units, setUnits] = useState("");
  const [takenAt, setTakenAt] = useState(localDateTimeValue);
  const [editing, setEditing] = useState<DoseRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const nowMs = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const rows: DoseRow[] = [
    ...getRapidInsulinDoses().map((d) => ({ kind: "rapid" as const, id: d.id, units: d.units, takenAtIso: d.takenAtIso })),
    ...getLongActingDoses().map((d) => ({ kind: "longActing" as const, id: d.id, units: d.units, takenAtIso: d.takenAtIso })),
  ]
    .filter((d) => new Date(d.takenAtIso).getTime() >= todayStart.getTime())
    .sort((a, b) => new Date(b.takenAtIso).getTime() - new Date(a.takenAtIso).getTime());

  const openForm = () => {
    setEditing(null);
    setConfirmDelete(false);
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

  const startEdit = (row: DoseRow) => {
    setOpen(false);
    setConfirmDelete(false);
    setEditing(row);
    setUnits(String(row.units));
    setTakenAt(localDateTimeValue(new Date(row.takenAtIso)));
  };

  const saveEdit = () => {
    if (!editing) return;
    const amount = Number(units);
    const when = new Date(takenAt);
    if (!Number.isFinite(amount) || amount <= 0 || Number.isNaN(when.getTime())) return;
    if (updateInsulinDose(editing.kind, editing.id, { units: amount, takenAtIso: when.toISOString() })) {
      setInsulinChartVisible(true);
    }
    setEditing(null);
  };

  const removeEditing = () => {
    if (!editing) return;
    deleteInsulinDose(editing.kind, editing.id);
    setEditing(null);
    setConfirmDelete(false);
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

  const kindToggle = (
    <div className="grid grid-cols-2 rounded-full bg-background/70 p-0.5" role="group" aria-label="Insulin type">
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
            "h-7 rounded-full text-[13px] font-medium",
            kind === value ? "bg-foreground/[0.06] text-foreground shadow-sm ring-1 ring-border/60" : "text-muted-foreground",
          )}
          aria-pressed={kind === value}
          onClick={() => chooseKind(value)}
          data-testid={value === "rapid" ? "button-log-rapid-insulin" : "button-log-long-insulin"}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const unitsField = (
    <div className="relative w-[4.75rem] shrink-0">
      <Input
        inputMode="decimal"
        value={units}
        onChange={(event) => setUnits(event.target.value)}
        placeholder="0"
        aria-label="Units"
        className="h-9 rounded-lg border-border/50 bg-background pr-5 text-sm"
        data-testid="input-insulin-units"
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
        u
      </span>
    </div>
  );

  const timeField = (
    <Input
      type="datetime-local"
      value={takenAt}
      onChange={(event) => setTakenAt(event.target.value)}
      aria-label="When"
      className="h-9 min-w-0 flex-1 rounded-lg border-border/50 bg-background text-[13px]"
      data-testid="input-insulin-time"
    />
  );

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
        <div className="mx-2 mb-2 space-y-2 rounded-2xl bg-muted/35 p-2">
          {kindToggle}
          <div className="flex items-center gap-1.5">
            {unitsField}
            {timeField}
            <Button
              type="button"
              className="h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold"
              onClick={save}
              data-testid="button-save-insulin-dose"
            >
              Add
            </Button>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="mx-2 mb-2 space-y-2 rounded-2xl bg-muted/35 p-2" data-testid="insulin-dose-edit-form">
          <p className="px-1 pt-0.5 text-[13px] font-medium text-foreground">
            Edit {editing.kind === "rapid" ? "rapid" : "long-acting"} dose · {formatDoseWhen(editing.takenAtIso)}
          </p>
          <div className="flex items-center gap-1.5">
            {unitsField}
            {timeField}
          </div>
          {confirmDelete ? (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-destructive/[0.06] px-2.5 py-1.5">
              <p className="text-[13px] font-medium text-foreground">Delete this dose?</p>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 rounded-full px-2.5 text-[13px] font-semibold"
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="h-8 rounded-full px-2.5 text-[13px] font-semibold"
                  onClick={removeEditing}
                  data-testid="button-confirm-delete-insulin-dose"
                >
                  Delete
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 px-0.5">
              <Button
                type="button"
                variant="ghost"
                className="h-8 rounded-full px-2 text-[13px] font-semibold text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
                data-testid="button-delete-insulin-dose"
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden />
                Delete
              </Button>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 rounded-full px-2.5 text-[13px] font-semibold"
                  onClick={() => setEditing(null)}
                  data-testid="button-cancel-insulin-edit"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="h-8 rounded-full px-3 text-[13px] font-semibold"
                  onClick={saveEdit}
                  data-testid="button-save-insulin-edit"
                >
                  Save
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {showDoseList && rows.length > 0 && !editing ? (
        <>
        <p className="px-3 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Today&apos;s doses
        </p>
        <ul className="mt-1 space-y-1 px-1 pb-1" data-testid="insulin-dose-list">
          {rows.map((row) => {
            const left =
              row.kind === "rapid"
                ? remainingRapidUnits([{ id: row.id, takenAtIso: row.takenAtIso, units: row.units }], nowMs)
                : 0;
            return (
              <li key={`${row.kind}-${row.id}`}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted/50"
                  onClick={() => startEdit(row)}
                  data-testid={`button-edit-insulin-dose-${row.id}`}
                  aria-label={`Edit ${row.kind === "rapid" ? "rapid" : "long-acting"} dose, ${row.units} units, ${formatDoseWhen(row.takenAtIso)}`}
                >
                  <span
                    className={cn(
                      "flex h-6 w-14 shrink-0 items-center justify-center rounded-full text-[10px] font-bold uppercase tracking-wide",
                      row.kind === "rapid"
                        ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                        : "bg-sky-500/15 text-sky-800 dark:text-sky-200",
                    )}
                  >
                    {row.kind === "rapid" ? "Rapid" : "Long"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold tabular-nums text-foreground">{row.units}u</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{formatDoseWhen(row.takenAtIso)}</span>
                  </span>
                  <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
                    {row.kind === "rapid" && left > 0.05 ? (
                      <span className="text-amber-800 dark:text-amber-200">{left.toFixed(1)}u left</span>
                    ) : (
                      relativeAgo(row.takenAtIso, nowMs)
                    )}
                  </span>
                  <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
        </>
      ) : null}
    </div>
  );
}
