/**
 * Medication list with dose times and taken ticks — remembering support for
 * tablets and other regular diabetes medication. This never suggests dose
 * changes; it records what the person's own plan already says.
 */
const MEDS_KEY = "diabeater_medications_v1";
const TAKEN_KEY = "diabeater_medication_taken_v1";

export const MEDICATIONS_CHANGED_EVENT = "diabeater-medications-changed";

export type Medication = {
  id: string;
  name: string;
  /** Free text as printed on the plan, e.g. "500mg" or "2 tablets". */
  dose: string;
  /** Local dose times, "HH:mm". */
  times: string[];
};

export type MedicationTakenMark = {
  medId: string;
  /** Local date "YYYY-MM-DD". */
  date: string;
  /** Scheduled time "HH:mm". */
  time: string;
  takenAtIso: string;
};

function notify() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MEDICATIONS_CHANGED_EVENT));
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `med-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function cleanTimes(times: string[]): string[] {
  return [...new Set(times.filter((t) => TIME_RE.test(t)))].sort();
}

function isMedication(value: unknown): value is Medication {
  if (!value || typeof value !== "object") return false;
  const m = value as Medication;
  return typeof m.id === "string" && typeof m.name === "string" && m.name.trim() !== "" && Array.isArray(m.times);
}

export function listMedications(): Medication[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(MEDS_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isMedication).map((m) => ({ ...m, dose: m.dose ?? "", times: cleanTimes(m.times) }));
  } catch {
    return [];
  }
}

function writeMedications(meds: Medication[]) {
  try {
    localStorage.setItem(MEDS_KEY, JSON.stringify(meds));
  } catch {
    /* best-effort */
  }
  notify();
}

export function addMedication(input: { name: string; dose: string; times: string[] }): Medication | null {
  const name = input.name.trim();
  const times = cleanTimes(input.times);
  if (!name || times.length === 0) return null;
  const med: Medication = { id: newId(), name, dose: input.dose.trim(), times };
  writeMedications([...listMedications(), med]);
  return med;
}

export function updateMedication(id: string, patch: { name: string; dose: string; times: string[] }): boolean {
  const name = patch.name.trim();
  const times = cleanTimes(patch.times);
  if (!name || times.length === 0) return false;
  const meds = listMedications();
  if (!meds.some((m) => m.id === id)) return false;
  writeMedications(meds.map((m) => (m.id === id ? { ...m, name, dose: patch.dose.trim(), times } : m)));
  return true;
}

export function deleteMedication(id: string): boolean {
  const meds = listMedications();
  if (!meds.some((m) => m.id === id)) return false;
  writeMedications(meds.filter((m) => m.id !== id));
  writeTaken(readTaken().filter((t) => t.medId !== id));
  return true;
}

function readTaken(): MedicationTakenMark[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(TAKEN_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is MedicationTakenMark =>
        !!t &&
        typeof t === "object" &&
        typeof (t as MedicationTakenMark).medId === "string" &&
        typeof (t as MedicationTakenMark).date === "string" &&
        typeof (t as MedicationTakenMark).time === "string",
    );
  } catch {
    return [];
  }
}

function writeTaken(marks: MedicationTakenMark[]) {
  // Taken history only needs a few weeks for adherence; prune older marks.
  const cutoff = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
  const cutoffKey = toLocalDateKey(cutoff);
  try {
    localStorage.setItem(TAKEN_KEY, JSON.stringify(marks.filter((m) => m.date >= cutoffKey)));
  } catch {
    /* best-effort */
  }
  notify();
}

export function toLocalDateKey(date: Date): string {
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isDoseTaken(medId: string, date: string, time: string, marks = readTaken()): boolean {
  return marks.some((m) => m.medId === medId && m.date === date && m.time === time);
}

/** Toggle a scheduled dose's taken state. Returns the new state. */
export function setDoseTaken(medId: string, date: string, time: string, taken: boolean): boolean {
  const marks = readTaken();
  const exists = isDoseTaken(medId, date, time, marks);
  if (taken && !exists) {
    writeTaken([...marks, { medId, date, time, takenAtIso: new Date().toISOString() }]);
  } else if (!taken && exists) {
    writeTaken(marks.filter((m) => !(m.medId === medId && m.date === date && m.time === time)));
  }
  return taken;
}

export type ScheduledDose = {
  med: Medication;
  time: string;
  taken: boolean;
  due: boolean;
};

/** Today's scheduled doses in time order; `due` once the clock passes the dose time. */
export function todaysDoses(now = new Date()): ScheduledDose[] {
  const dateKey = toLocalDateKey(now);
  const marks = readTaken();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return listMedications()
    .flatMap((med) =>
      med.times.map((time) => {
        const [h, m] = time.split(":").map(Number);
        return {
          med,
          time,
          taken: isDoseTaken(med.id, dateKey, time, marks),
          due: (h ?? 0) * 60 + (m ?? 0) <= nowMinutes,
        };
      }),
    )
    .sort((a, b) => a.time.localeCompare(b.time));
}

/** Share of scheduled doses (up to now) marked taken over the last `days` days. */
export function medicationAdherence(days = 7, now = new Date()): { scheduled: number; taken: number; pct: number | null } {
  const meds = listMedications();
  const marks = readTaken();
  let scheduled = 0;
  let taken = 0;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  for (let d = 0; d < days; d++) {
    const day = new Date(now);
    day.setDate(now.getDate() - d);
    const dateKey = toLocalDateKey(day);
    const isToday = d === 0;
    for (const med of meds) {
      for (const time of med.times) {
        if (isToday) {
          const [h, m] = time.split(":").map(Number);
          if ((h ?? 0) * 60 + (m ?? 0) > nowMinutes) continue;
        }
        scheduled += 1;
        if (isDoseTaken(med.id, dateKey, time, marks)) taken += 1;
      }
    }
  }
  return { scheduled, taken, pct: scheduled > 0 ? Math.round((taken / scheduled) * 100) : null };
}
