import { useEffect, useMemo, useState } from "react";
import { Check, Pencil, Pill, Plus, Trash2 } from "lucide-react";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addMedication,
  deleteMedication,
  listMedications,
  MEDICATIONS_CHANGED_EVENT,
  medicationAdherence,
  setDoseTaken,
  toLocalDateKey,
  todaysDoses,
  updateMedication,
  type Medication,
} from "@/lib/medications";
import { cn } from "@/lib/utils";

const COMMON_TIMES = ["08:00", "13:00", "18:00", "22:00"] as const;

export default function MedicationsPage() {
  const [tick, setTick] = useState(0);
  const [editing, setEditing] = useState<Medication | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [times, setTimes] = useState<string[]>(["08:00"]);
  const [customTime, setCustomTime] = useState("");

  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    window.addEventListener(MEDICATIONS_CHANGED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(MEDICATIONS_CHANGED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const meds = useMemo(() => listMedications(), [tick]);
  const today = useMemo(() => todaysDoses(), [tick]);
  const adherence = useMemo(() => medicationAdherence(7), [tick]);
  const formOpen = adding || editing != null;

  const resetForm = () => {
    setEditing(null);
    setAdding(false);
    setConfirmDelete(false);
    setName("");
    setDose("");
    setTimes(["08:00"]);
    setCustomTime("");
  };

  const startAdd = () => {
    resetForm();
    setAdding(true);
  };

  const startEdit = (med: Medication) => {
    setAdding(false);
    setConfirmDelete(false);
    setEditing(med);
    setName(med.name);
    setDose(med.dose);
    setTimes(med.times);
    setCustomTime("");
  };

  const toggleTime = (time: string) => {
    setTimes((prev) => (prev.includes(time) ? prev.filter((t) => t !== time) : [...prev, time].sort()));
  };

  const addCustomTime = () => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(customTime)) return;
    setTimes((prev) => [...new Set([...prev, customTime])].sort());
    setCustomTime("");
  };

  const save = () => {
    if (editing) {
      if (updateMedication(editing.id, { name, dose, times })) resetForm();
      return;
    }
    if (addMedication({ name, dose, times })) resetForm();
  };

  return (
    <PageShell variant="narrow" density="compact" className="space-y-4" data-testid="page-medications">
      <PageHeader leading={<PageBackButton />} title="Medication" description="Your regular medication, times, and taken ticks" />

      <section className="space-y-2 rounded-3xl border border-border/50 bg-card p-4" data-testid="medications-today">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Today</h2>
          {adherence.pct != null ? (
            <p className="text-[11px] font-medium text-muted-foreground" data-testid="medications-adherence">
              {adherence.pct}% taken this week
            </p>
          ) : null}
        </div>
        {today.length === 0 ? (
          <p className="text-[13px] leading-snug text-muted-foreground">
            No medication added yet. Add your first one below and today's doses will appear here to tick off.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {today.map((d) => (
              <li key={`${d.med.id}-${d.time}`}>
                <button
                  type="button"
                  onClick={() => setDoseTaken(d.med.id, toLocalDateKey(new Date()), d.time, !d.taken)}
                  aria-pressed={d.taken}
                  data-testid={`button-dose-${d.med.id}-${d.time}`}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors",
                    d.taken
                      ? "border-emerald-500/30 bg-emerald-500/[0.07]"
                      : d.due
                        ? "border-amber-500/30 bg-amber-500/[0.05]"
                        : "border-border/50 bg-background/60",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                      d.taken ? "border-emerald-500 bg-emerald-500 text-white" : "border-border text-transparent",
                    )}
                    aria-hidden
                  >
                    <Check className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {d.med.name}
                      {d.med.dose ? <span className="font-medium text-muted-foreground"> · {d.med.dose}</span> : null}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {d.taken ? "Taken" : d.due ? "Due now" : "Later today"}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{d.time}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2" data-testid="medications-list-section">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <h2 className="text-sm font-semibold text-foreground">My medication</h2>
          {!formOpen ? (
            <Button type="button" variant="ghost" className="h-9 rounded-full px-3 text-sm font-semibold" onClick={startAdd} data-testid="button-add-medication">
              <Plus className="mr-1 h-4 w-4" aria-hidden />
              Add
            </Button>
          ) : null}
        </div>

        {formOpen ? (
          <div className="space-y-3 rounded-3xl border border-border/50 bg-card p-4" data-testid="medication-form">
            <p className="text-sm font-semibold text-foreground">{editing ? "Edit medication" : "Add medication"}</p>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name, e.g. Metformin"
              aria-label="Medication name"
              className="h-12 text-base"
              data-testid="input-medication-name"
            />
            <Input
              value={dose}
              onChange={(e) => setDose(e.target.value)}
              placeholder="Dose, e.g. 500mg or 2 tablets"
              aria-label="Dose"
              className="h-12 text-base"
              data-testid="input-medication-dose"
            />
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-foreground">Times each day</p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dose times">
                {COMMON_TIMES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTime(t)}
                    aria-pressed={times.includes(t)}
                    data-testid={`button-med-time-${t}`}
                    className={cn(
                      "h-9 rounded-full px-3 text-[13px] font-medium tabular-nums",
                      times.includes(t) ? "bg-primary text-primary-foreground" : "bg-muted/70 text-muted-foreground",
                    )}
                  >
                    {t}
                  </button>
                ))}
                {times
                  .filter((t) => !(COMMON_TIMES as readonly string[]).includes(t))
                  .map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTime(t)}
                      aria-pressed
                      className="h-9 rounded-full bg-primary px-3 text-[13px] font-medium tabular-nums text-primary-foreground"
                    >
                      {t}
                    </button>
                  ))}
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  aria-label="Add another time"
                  className="h-10 min-w-0 flex-1 text-base"
                  data-testid="input-medication-custom-time"
                />
                <Button type="button" variant="outline" className="h-10 rounded-full px-3 text-sm font-semibold" onClick={addCustomTime}>
                  Add time
                </Button>
              </div>
            </div>
            {editing && confirmDelete ? (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-destructive/[0.06] px-3 py-2">
                <p className="text-[13px] font-medium text-foreground">Delete this medication?</p>
                <div className="flex shrink-0 gap-1.5">
                  <Button type="button" variant="ghost" className="h-9 rounded-full px-3 text-sm font-semibold" onClick={() => setConfirmDelete(false)}>
                    Keep
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="h-9 rounded-full px-3 text-sm font-semibold"
                    onClick={() => {
                      deleteMedication(editing.id);
                      resetForm();
                    }}
                    data-testid="button-confirm-delete-medication"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                {editing ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 rounded-full px-2.5 text-sm font-semibold text-destructive hover:text-destructive"
                    onClick={() => setConfirmDelete(true)}
                    data-testid="button-delete-medication"
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
                    Delete
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex gap-1.5">
                  <Button type="button" variant="ghost" className="h-9 rounded-full px-3 text-sm font-semibold" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button type="button" className="h-10 rounded-full px-4 text-sm font-semibold" onClick={save} data-testid="button-save-medication">
                    {editing ? "Save changes" : "Add medication"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : meds.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/60 px-4 py-8 text-center">
            <Pill className="mx-auto h-6 w-6 text-muted-foreground/60" aria-hidden />
            <p className="mt-2 text-sm font-medium text-foreground">No medication added yet</p>
            <p className="mx-auto mt-1 max-w-[28ch] text-[13px] leading-snug text-muted-foreground">
              Add what you take and when, and tick each dose off here as you take it.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {meds.map((med) => (
              <li key={med.id}>
                <button
                  type="button"
                  onClick={() => startEdit(med)}
                  data-testid={`button-edit-medication-${med.id}`}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border/50 bg-card px-3.5 py-2.5 text-left transition-colors hover:bg-muted/40"
                  aria-label={`Edit ${med.name}`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Pill className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {med.name}
                      {med.dose ? <span className="font-medium text-muted-foreground"> · {med.dose}</span> : null}
                    </span>
                    <span className="block text-[11px] tabular-nums text-muted-foreground">{med.times.join(" · ")}</span>
                  </span>
                  <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="px-1 text-center text-[11px] leading-snug text-muted-foreground">
        This helps you remember your own plan — it never changes doses. If you're unsure about any medication, ask
        your care team or pharmacist.
      </p>
    </PageShell>
  );
}
