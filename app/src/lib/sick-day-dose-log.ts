import type { SickDayMedicationDoseLogEntry } from "@/lib/storage";

export type SickDayMedicationDoseScenarioRow = {
  id: string;
  reminder_id?: string | null;
  name: string;
  dose_label?: string | null;
  taken_at: string;
  source: "user" | "carer";
  notes?: string | null;
};

function isDoseSource(v: unknown): v is "user" | "carer" {
  return v === "user" || v === "carer";
}

export function parseMedicationDoseLogFromScenario(raw: unknown): SickDayMedicationDoseLogEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: SickDayMedicationDoseLogEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id.trim() : "";
    const name = typeof r.name === "string" ? r.name.trim() : "";
    const takenAt =
      typeof r.taken_at === "string"
        ? r.taken_at.trim()
        : typeof r.takenAtIso === "string"
          ? r.takenAtIso.trim()
          : "";
    if (!id || !name || !takenAt) continue;
    const reminderRaw = r.reminder_id ?? r.reminderId;
    const reminderId = typeof reminderRaw === "string" && reminderRaw.trim() ? reminderRaw.trim() : undefined;
    const doseRaw = r.dose_label ?? r.doseLabel;
    const doseLabel = typeof doseRaw === "string" && doseRaw.trim() ? doseRaw.trim() : undefined;
    const src = r.source;
    const source = isDoseSource(src) ? src : "user";
    const notesRaw = r.notes;
    const notes = typeof notesRaw === "string" && notesRaw.trim() ? notesRaw.trim() : undefined;
    out.push({ id, reminderId, name, doseLabel, takenAtIso: takenAt, source, notes });
  }
  return out;
}

export function mergeMedicationDoseLogs(
  a: SickDayMedicationDoseLogEntry[],
  b: SickDayMedicationDoseLogEntry[],
): SickDayMedicationDoseLogEntry[] {
  const byId = new Map<string, SickDayMedicationDoseLogEntry>();
  for (const d of b) byId.set(d.id, d);
  for (const d of a) byId.set(d.id, d);
  return [...byId.values()].sort((x, y) => new Date(y.takenAtIso).getTime() - new Date(x.takenAtIso).getTime());
}

export function medicationDoseLogToScenarioRows(entries: SickDayMedicationDoseLogEntry[]): SickDayMedicationDoseScenarioRow[] {
  return entries.slice(0, 80).map((d) => ({
    id: d.id,
    reminder_id: d.reminderId ?? null,
    name: d.name,
    dose_label: d.doseLabel ?? null,
    taken_at: d.takenAtIso,
    source: d.source,
    notes: d.notes ?? null,
  }));
}
