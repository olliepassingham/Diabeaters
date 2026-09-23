import type { Appointment, AppointmentOutcome, AppointmentType } from "@/lib/storage";

/** Screening / check result enums — user-entered, educational history only. */
export type AppointmentScreeningResult = "clear" | "follow_up" | "referral" | "other";

export type { AppointmentOutcome };

export type Hba1cHistoryPoint = {
  appointmentId: string;
  title: string;
  /** ISO date used for the x-axis (resultDate or appointment date). */
  date: string;
  hba1cPercent: number;
};

const SCREENING_RESULTS: AppointmentScreeningResult[] = ["clear", "follow_up", "referral", "other"];

export function isAppointmentScreeningResult(v: unknown): v is AppointmentScreeningResult {
  return typeof v === "string" && (SCREENING_RESULTS as string[]).includes(v);
}

export function parseAppointmentOutcome(raw: unknown): AppointmentOutcome | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const out: AppointmentOutcome = {};

  if (typeof o.hba1cPercent === "number" && Number.isFinite(o.hba1cPercent)) {
    out.hba1cPercent = Math.round(o.hba1cPercent * 10) / 10;
  } else if (typeof o.hba1cPercent === "string" && o.hba1cPercent.trim()) {
    const n = Number(o.hba1cPercent);
    if (Number.isFinite(n)) out.hba1cPercent = Math.round(n * 10) / 10;
  }

  if (typeof o.resultDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.resultDate.trim())) {
    out.resultDate = o.resultDate.trim();
  }
  if (isAppointmentScreeningResult(o.eyeResult)) out.eyeResult = o.eyeResult;
  if (isAppointmentScreeningResult(o.footResult)) out.footResult = o.footResult;
  if (typeof o.outcomeNote === "string" && o.outcomeNote.trim()) {
    out.outcomeNote = o.outcomeNote.trim().slice(0, 500);
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

/** Persistable outcome or undefined when empty. */
export function normalizeAppointmentOutcome(partial: AppointmentOutcome): AppointmentOutcome | undefined {
  const clamped =
    partial.hba1cPercent != null
      ? { ...partial, hba1cPercent: clampHba1cInput(String(partial.hba1cPercent)) }
      : partial;
  return parseAppointmentOutcome(clamped);
}

export function appointmentShowsHba1cFields(type: AppointmentType): boolean {
  return type === "clinic" || type === "blood_test";
}

export function appointmentShowsEyeFields(type: AppointmentType): boolean {
  return type === "eye_check" || type === "clinic";
}

export function appointmentShowsFootFields(type: AppointmentType): boolean {
  return type === "foot_check" || type === "clinic";
}

export function appointmentHasOutcome(a: Appointment): boolean {
  return Boolean(parseAppointmentOutcome(a.outcome));
}

export function screeningResultLabel(r: AppointmentScreeningResult): string {
  switch (r) {
    case "clear":
      return "Clear / no action";
    case "follow_up":
      return "Follow-up needed";
    case "referral":
      return "Referral";
    case "other":
      return "Other";
  }
}

export function formatOutcomeSummary(a: Appointment): string | null {
  const o = parseAppointmentOutcome(a.outcome);
  if (!o) return null;
  const bits: string[] = [];
  if (o.hba1cPercent != null) bits.push(`HbA1c ${o.hba1cPercent}%`);
  if (o.eyeResult) bits.push(`Eyes: ${screeningResultLabel(o.eyeResult)}`);
  if (o.footResult) bits.push(`Feet: ${screeningResultLabel(o.footResult)}`);
  if (o.outcomeNote) bits.push(o.outcomeNote);
  return bits.length ? bits.join(" · ") : null;
}

/** HbA1c points for Patterns — educational history only. */
export function buildHba1cHistory(appointments: Appointment[]): Hba1cHistoryPoint[] {
  const points: Hba1cHistoryPoint[] = [];
  for (const a of appointments) {
    if (a.deletedAt) continue;
    const o = parseAppointmentOutcome(a.outcome);
    if (o?.hba1cPercent == null) continue;
    const date = o.resultDate && /^\d{4}-\d{2}-\d{2}$/.test(o.resultDate) ? o.resultDate : a.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    points.push({
      appointmentId: a.id,
      title: a.title,
      date,
      hba1cPercent: o.hba1cPercent,
    });
  }
  return points.sort((x, y) => x.date.localeCompare(y.date));
}

export function clampHba1cInput(raw: string): number | undefined {
  const t = raw.trim().replace(",", ".");
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n)) return undefined;
  if (n < 3 || n > 20) return undefined;
  return Math.round(n * 10) / 10;
}
