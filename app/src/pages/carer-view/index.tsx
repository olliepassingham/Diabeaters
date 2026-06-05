import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineInfoHint } from "@/components/ui/field-label-with-info";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { HubLoadingSkeleton } from "@/components/empty-state";
import {
  Eye,
  ArrowLeft,
  Package,
  Heart,
  Phone,
  Calendar,
  Plane,
  Thermometer,
  Info,
  Users,
  Pill,
  ArrowRight,
  History,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  normaliseScopes,
  fetchSuppliesForLinkedPatient,
  fetchSupplyEventsForLinkedPatient,
  resolveSupplyEventItemName,
  fetchPatientProfileForCarer,
  fetchAppointmentsForLinkedPatient,
  fetchScenariosForLinkedPatient,
  fetchHypoLogsForLinkedPatient,
  carerAppendSickDayTemperature,
  carerAppendSickDayMedNote,
  carerUpsertSickDayMedicationReminder,
  carerSnoozeSickDayMedicationReminder,
  carerStopSickDayMedicationReminder,
  carerLogSickDayMedicationTaken,
  carerDeactivateSickDayScenarioForPatient,
} from "@/lib/carers";
import type { CloudSupplyEventRow } from "@/lib/carers";
import type { CloudHypoLogRow, CloudSupplyRow, LinkedPatientWithProfile } from "@/lib/carers.types";
import {
  formatCarerSupplyEventDelta,
  formatCarerSupplyQuantity,
  type PatientSupplyPackPrefs,
} from "@/lib/supply-display-for-carer";
import { resolveProfileImageUrl } from "@/lib/storage-profile";
import { getSupabase } from "@/lib/supabase";
import {
  consumeCarerLinkedBannerMessage,
  clearCarerLinkJustCompleted,
  getActiveCarerPatientId,
  setActiveCarerPatientId,
} from "@/lib/carer-session";
import { collectCarerActivityEvents, getActivityWeekSummary } from "@/lib/activity-history";
import { DevNote } from "@/components/dev/DevNote";
import { SupporterPushPromptDialog } from "@/components/supporter-push-prompt-dialog";
import { resolveSupporterPushPromptAfterLink } from "@/lib/supporter-push-prompt";
import { useAuth } from "@/lib/auth-context";
import { useLinkedPatientQuery, useLinkedPatientsForCarerQuery } from "@/lib/carer-link-query";
import { CarerClinicalPrefsCard } from "@/pages/carer-view/carer-clinical-prefs-card";
import { scrollToCarerViewHashTarget } from "@/pages/carer-view/carer-view-nav";
import {
  CarerCardEmpty,
  CarerHypoTimelineItem,
  CarerMutedCard,
  CarerSectionHeading,
  CarerUrgentCard,
  sortSuppliesByUrgency,
  SupporterHero,
  SupporterPageFooter,
  SupporterQuickActions,
  SupplyStockIndicator,
  type CarerGlanceType,
} from "@/pages/carer-view/supporter-home-ui";
import { PageShell } from "@/components/layout";
import { formatDistanceToNowStrict } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function parseLocalDateTime(date: unknown, time: unknown): Date | null {
  if (typeof date !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

  let hh = 12;
  let mm = 0;
  if (typeof time === "string" && time.trim()) {
    const tm = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (tm) {
      hh = Number(tm[1]);
      mm = Number(tm[2]);
    }
  }

  const d = new Date(year, month - 1, day, hh, mm, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function appointmentSortTime(row: Record<string, unknown>): number {
  // Prefer canonical instant from the DB.
  for (const k of ["scheduled_at", "appointment_at", "starts_at", "datetime"]) {
    const v = row[k];
    if (v == null) continue;
    const t = new Date(String(v)).getTime();
    if (!Number.isNaN(t)) return t;
  }
  // Fall back to local date+time to avoid UTC parsing of YYYY-MM-DD.
  const local = parseLocalDateTime(row.date, row.time ?? row.start_time);
  if (local) return local.getTime();
  const u = row.updated_at;
  if (u) return new Date(String(u)).getTime();
  return 0;
}

function pickNextAppointment(rows: Record<string, unknown>[]): Record<string, unknown> | null {
  if (rows.length === 0) return null;
  const now = Date.now();
  const scored = rows
    .map((r) => ({ r, t: appointmentSortTime(r) }))
    .filter((x) => x.t > 0);
  const future = scored.filter((x) => x.t >= now).sort((a, b) => a.t - b.t);
  if (future.length > 0) return future[0]!.r;
  scored.sort((a, b) => b.t - a.t);
  return scored[0]?.r ?? rows[0] ?? null;
}

function appointmentTitle(row: Record<string, unknown>): string {
  for (const k of ["title", "name", "summary", "notes"]) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "Appointment";
}

function formatAppointmentWhen(row: Record<string, unknown>): string | null {
  // Prefer canonical instant from the DB.
  for (const k of ["scheduled_at", "appointment_at", "starts_at", "datetime"]) {
    const v = row[k];
    if (v == null) continue;
    const d = new Date(String(v));
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    }
  }
  const local = parseLocalDateTime(row.date, row.time ?? row.start_time);
  if (local) return local.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  return null;
}

function toIsoString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? null : s;
}

function durationLabel(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin - days * 60 * 24) / 60);
  const mins = totalMin - days * 60 * 24 - hours * 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

const CARER_TRAVEL_DATE_LOCALE = "en-GB";

/** Display label only; does not change stored data. */
function formatCarerScenarioDestinationLabel(destination: string | null): string {
  const raw = destination?.trim() ?? "";
  if (!raw) return "Trip";
  return raw
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
}

function formatCarerTravelDateRange(startIso: string, endIso: string): string | null {
  const d1 = new Date(startIso);
  const d2 = new Date(endIso);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) {
    return `${startIso.trim()} — ${endIso.trim()}`;
  }
  const sameYear = d1.getFullYear() === d2.getFullYear();
  const startOpts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  if (!sameYear) startOpts.year = "numeric";
  const startStr = d1.toLocaleDateString(CARER_TRAVEL_DATE_LOCALE, startOpts);
  const endStr = d2.toLocaleDateString(CARER_TRAVEL_DATE_LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${startStr} — ${endStr}`;
}

function formatCarerTravelSingleDate(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const t = iso.trim();
    return t || null;
  }
  return d.toLocaleDateString(CARER_TRAVEL_DATE_LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function scenarioBannerLines(rows: Record<string, unknown>[]): string[] {
  const lines: string[] = [];
  const now = Date.now();
  const recentlyEndedWindowMs = 24 * 60 * 60 * 1000;

  for (const row of rows.slice(0, 8)) {
    const scenarioKey =
      typeof row.scenario_key === "string" && row.scenario_key.trim()
        ? row.scenario_key.trim()
        : typeof row.scenarioKey === "string" && row.scenarioKey.trim()
          ? row.scenarioKey.trim()
          : null;

    const rawState =
      (row.state && typeof row.state === "object" ? (row.state as Record<string, unknown>) : null) ??
      (row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : null) ??
      (row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : null);

    const startedAt = toIsoString(rawState?.started_at) ?? toIsoString(rawState?.activated_at);
    const endedAt = toIsoString(rawState?.ended_at) ?? toIsoString(rawState?.deactivated_at);
    const checkedAt = toIsoString(rawState?.checked_at);

    if (scenarioKey === "sick_day") {
      const active = isSickDayScenarioActive(rawState);
      const severity = typeof rawState?.severity === "string" ? rawState?.severity.trim() : null;
      const sevLabel = severity ? ` (${severity})` : "";
      if (active) {
        const startT = startedAt ? new Date(startedAt).getTime() : NaN;
        const dur = Number.isNaN(startT) ? null : durationLabel(now - startT);
        const startLabel = startedAt ? `Started ${new Date(startedAt).toLocaleString(undefined, { timeStyle: "short" })}` : "Started";
        lines.push(`Sick day${sevLabel} — ${startLabel}${dur ? ` · ${dur}` : ""}`);
        const meds = rawState?.meds_next_due && typeof rawState.meds_next_due === "object" ? (rawState.meds_next_due as Record<string, unknown>) : null;
        const medName = meds && typeof meds.name === "string" ? meds.name.trim() : "";
        const dueAt = meds && typeof meds.due_at === "string" ? meds.due_at : null;
        if (medName && dueAt) {
          const t = new Date(dueAt).getTime();
          if (!Number.isNaN(t)) {
            const when = formatDistanceToNowStrict(new Date(dueAt), { addSuffix: true });
            lines.push(`Next meds: ${medName} · ${when}`);
          }
        }
        const medsActive = rawState?.meds_active;
        if (Array.isArray(medsActive) && medsActive.length > 1) {
          lines.push(`${medsActive.length} active medication reminders shared`);
        }
        const tempRecent = rawState?.temp_recent;
        if (Array.isArray(tempRecent) && tempRecent.length > 1) {
          lines.push(`${tempRecent.length} patient temperature readings shared`);
        }
        const carerTemps = rawState?.carer_temp_recent;
        if (Array.isArray(carerTemps) && carerTemps.length > 0) {
          lines.push(`${carerTemps.length} supporter temperature log entr${carerTemps.length === 1 ? "y" : "ies"}`);
        }
        const temp =
          rawState?.temp_latest && typeof rawState.temp_latest === "object"
            ? (rawState.temp_latest as Record<string, unknown>)
            : null;
        const tempVal = temp && typeof temp.value === "number" ? temp.value : null;
        const tempUnit = temp && (temp.unit === "c" || temp.unit === "f") ? (temp.unit as "c" | "f") : null;
        const tempAt = temp && typeof temp.at === "string" ? temp.at : null;
        if (tempVal != null && tempUnit && tempAt) {
          const tT = new Date(tempAt).getTime();
          if (!Number.isNaN(tT)) {
            const when = formatDistanceToNowStrict(new Date(tempAt), { addSuffix: true });
            lines.push(`Temp: ${tempVal}°${tempUnit.toUpperCase()} · ${when}`);
          }
        }
        continue;
      }
      if (endedAt) {
        const endT = new Date(endedAt).getTime();
        if (!Number.isNaN(endT) && now - endT <= recentlyEndedWindowMs) {
          const endedText = formatDistanceToNowStrict(new Date(endedAt), { addSuffix: true });
          const dur =
            startedAt && !Number.isNaN(new Date(startedAt).getTime())
              ? durationLabel(endT - new Date(startedAt).getTime())
              : null;
          lines.push(`Sick day${sevLabel} — Ended ${endedText}${dur ? ` · ${dur}` : ""}`);
          continue;
        }
      }
      continue;
    }

    if (scenarioKey === "travel") {
      const active = isTravelScenarioActive(rawState);
      const destination = typeof rawState?.destination === "string" ? rawState?.destination.trim() : null;
      const start = typeof rawState?.travel_start === "string" ? rawState?.travel_start.trim() : null;
      const end = typeof rawState?.travel_end === "string" ? rawState?.travel_end.trim() : null;
      const destLabel = formatCarerScenarioDestinationLabel(destination);
      const dates =
        start && end
          ? formatCarerTravelDateRange(start, end)
          : start
            ? formatCarerTravelSingleDate(start)
            : null;
      const tripDays =
        start && end && !Number.isNaN(new Date(start).getTime()) && !Number.isNaN(new Date(end).getTime())
          ? Math.max(
              1,
              Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)) + 1,
            )
          : null;
      const core = `Travel — ${destLabel}${dates ? ` · ${dates}` : ""}${tripDays ? ` (${tripDays} days)` : ""}`;
      if (active) {
        lines.push(core);
        continue;
      }
      if (endedAt) {
        const endT = new Date(endedAt).getTime();
        if (!Number.isNaN(endT) && now - endT <= recentlyEndedWindowMs) {
          const endedText = formatDistanceToNowStrict(new Date(endedAt), { addSuffix: true });
          lines.push(`${core} — Ended ${endedText}`);
          continue;
        }
      }
      continue;
    }

    if (scenarioKey === "bedtime") {
      const ready = rawState?.bedtime_ready === true;
      if (!checkedAt) continue;
      const checkT = new Date(checkedAt).getTime();
      if (Number.isNaN(checkT) || now - checkT > recentlyEndedWindowMs) continue;
      const when = formatDistanceToNowStrict(new Date(checkedAt), { addSuffix: true });
      lines.push(`Bedtime — ${ready ? "Ready" : "Needs attention"} · Checked ${when}`);
      continue;
    }

    // Fallback: keep existing label if present.
    if (typeof row.label === "string" && row.label.trim()) {
      lines.push(row.label.trim());
    } else if (typeof row.title === "string" && row.title.trim()) {
      lines.push(row.title.trim());
    } else if (scenarioKey) {
      lines.push(scenarioKey);
    }
  }
  return lines;
}

/**
 * Sick day is "active" for supporter UI only when flags say so and the episode is not already ended in state.
 * Some older flows left `sick_day_active` true in Supabase after the patient ended locally; `ended_at` / `deactivated_at`
 * in the past must win so temps / med notes do not stay visible.
 */
function isSickDayScenarioActive(raw: Record<string, unknown> | null | undefined): boolean {
  if (!raw) return false;
  const endedIso =
    (typeof raw.ended_at === "string" && raw.ended_at.trim() ? raw.ended_at : null) ??
    (typeof raw.deactivated_at === "string" && raw.deactivated_at.trim() ? raw.deactivated_at : null);
  if (endedIso) {
    const endMs = new Date(endedIso).getTime();
    if (!Number.isNaN(endMs) && endMs <= Date.now()) {
      return false;
    }
  }
  const flagOn = raw.sick_day_active === true || raw.sickDayActive === true;
  return flagOn;
}

/** End of scenario window (date-only ISO uses end of that calendar day). */
function scenarioEndTimestampMs(iso: string): number {
  const s = iso.trim();
  if (!s) return NaN;
  if (s.includes("T")) return new Date(s).getTime();
  return new Date(`${s}T23:59:59.999`).getTime();
}

/**
 * Travel is "active" for supporter UI when the flag is on and the trip has not ended
 * (`ended_at` / past `travel_end`). Stale `travel_active: true` after the trip dates must not stick.
 */
function isTravelScenarioActive(raw: Record<string, unknown> | null | undefined): boolean {
  if (!raw) return false;
  const flagOn = raw.travel_active === true || raw.travelActive === true;
  if (!flagOn) return false;

  const endedIso =
    (typeof raw.ended_at === "string" && raw.ended_at.trim() ? raw.ended_at : null) ??
    (typeof raw.deactivated_at === "string" && raw.deactivated_at.trim() ? raw.deactivated_at : null);
  if (endedIso) {
    const endMs = new Date(endedIso).getTime();
    if (!Number.isNaN(endMs) && endMs <= Date.now()) {
      return false;
    }
  }

  const tripEnd = typeof raw.travel_end === "string" && raw.travel_end.trim() ? raw.travel_end.trim() : null;
  if (tripEnd) {
    const endMs = scenarioEndTimestampMs(tripEnd);
    if (!Number.isNaN(endMs) && endMs <= Date.now()) {
      return false;
    }
  }

  return true;
}

function sickDayScenarioState(rows: Record<string, unknown>[]): Record<string, unknown> | null {
  for (const row of rows) {
    const scenarioKey =
      typeof row.scenario_key === "string" && row.scenario_key.trim()
        ? row.scenario_key.trim()
        : typeof row.scenarioKey === "string" && row.scenarioKey.trim()
          ? row.scenarioKey.trim()
          : null;
    if (scenarioKey !== "sick_day") continue;
    const rawState =
      (row.state && typeof row.state === "object" ? (row.state as Record<string, unknown>) : null) ??
      (row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : null) ??
      (row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : null);
    return rawState;
  }
  return null;
}

function combinedSickDayTemperatureRows(state: Record<string, unknown>): Array<{
  value: number;
  unit: string;
  at: string;
  source: "patient" | "carer";
}> {
  const out: Array<{ value: number; unit: string; at: string; source: "patient" | "carer" }> = [];
  const pushRow = (t: Record<string, unknown>, source: "patient" | "carer") => {
    const v = typeof t.value === "number" ? t.value : Number(t.value);
    const u = t.unit === "f" || t.unit === "c" ? String(t.unit) : "";
    const a = typeof t.at === "string" ? t.at : "";
    if (!Number.isFinite(v) || !u || !a) return;
    out.push({ value: v, unit: u, at: a, source });
  };
  for (const t of (Array.isArray(state.temp_recent) ? state.temp_recent : []) as Record<string, unknown>[]) {
    pushRow(t, "patient");
  }
  for (const t of (Array.isArray(state.carer_temp_recent) ? state.carer_temp_recent : []) as Record<
    string,
    unknown
  >[]) {
    pushRow(t, "carer");
  }
  out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return out;
}

function combinedSickDayEpisodeTimeline(state: Record<string, unknown>): Array<{
  at: string;
  id: string;
  kind: "dose" | "temp";
  title: string;
  subtitle: string;
}> {
  const rows: Array<{ at: string; id: string; kind: "dose" | "temp"; title: string; subtitle: string }> = [];
  const doses = Array.isArray(state.medication_dose_log) ? (state.medication_dose_log as Record<string, unknown>[]) : [];
  for (const raw of doses) {
    if (!raw || typeof raw !== "object") continue;
    const id = typeof raw.id === "string" ? raw.id : "";
    const name = typeof raw.name === "string" ? raw.name : "Medication";
    const takenAt = typeof raw.taken_at === "string" ? raw.taken_at : "";
    if (!id || !takenAt) continue;
    const dose = typeof raw.dose_label === "string" ? raw.dose_label : null;
    const src = raw.source === "carer" ? "Supporter" : "Patient";
    rows.push({
      at: takenAt,
      id: `dose-${id}`,
      kind: "dose",
      title: `${name}${dose ? ` · ${dose}` : ""}`,
      subtitle: src,
    });
  }
  const temps = combinedSickDayTemperatureRows(state);
  temps.forEach((t, idx) => {
    rows.push({
      at: t.at,
      id: `temp-${t.at}-${t.source}-${idx}`,
      kind: "temp",
      title: `${t.value}°${t.unit.toUpperCase()}`,
      subtitle: t.source === "carer" ? "Supporter" : "Patient",
    });
  });
  rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return rows.slice(0, 80);
}

function SickDaySupporterCareCard(props: {
  patientId: string;
  sickState: Record<string, unknown> | null;
  onUpdated: () => Promise<void>;
}) {
  const { patientId, sickState, onUpdated } = props;
  const { toast } = useToast();
  const [closingSickDay, setClosingSickDay] = useState(false);
  const [tempVal, setTempVal] = useState("");
  const [tempUnit, setTempUnit] = useState<"c" | "f">("c");
  const [medName, setMedName] = useState("");
  const [medNote, setMedNote] = useState("");
  const [remName, setRemName] = useState("");
  const [remRepeat, setRemRepeat] = useState("4h");
  const [remRepeatCustomMins, setRemRepeatCustomMins] = useState("");
  const [remDoseLabel, setRemDoseLabel] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [takenDialogOpen, setTakenDialogOpen] = useState(false);
  const [takenReminderId, setTakenReminderId] = useState<string | null>(null);
  const [takenReminderName, setTakenReminderName] = useState("");
  const [takenReminderDose, setTakenReminderDose] = useState<string | null>(null);
  const [takenAtLocal, setTakenAtLocal] = useState("");

  const tempsCombined = useMemo(() => {
    if (!sickState || !isSickDayScenarioActive(sickState)) return [];
    return combinedSickDayTemperatureRows(sickState);
  }, [sickState]);

  const episodeTimeline = useMemo(() => {
    if (!sickState || !isSickDayScenarioActive(sickState)) return [];
    return combinedSickDayEpisodeTimeline(sickState);
  }, [sickState]);

  if (!sickState || !isSickDayScenarioActive(sickState)) return null;

  const medsActive = Array.isArray(sickState.meds_active)
    ? (sickState.meds_active as Record<string, unknown>[])
    : [];
  const carerNotes = Array.isArray(sickState.carer_med_notes)
    ? (sickState.carer_med_notes as Record<string, unknown>[])
    : [];

  const resolvedRepeatMinutes = (repeatKey: string, customMins: string): number | null => {
    if (repeatKey === "custom") {
      const n = parseInt(customMins, 10);
      if (!Number.isFinite(n) || n <= 0) return null;
      return Math.min(7 * 24 * 60, Math.max(5, n));
    }
    const map: Record<string, number> = { "2h": 120, "4h": 240, "6h": 360, "8h": 480, "12h": 720, "24h": 1440 };
    return map[repeatKey] ?? null;
  };

  const submitTemp = async () => {
    setFormError(null);
    const raw = tempVal.trim().replace(",", ".");
    const n = parseFloat(raw);
    if (!Number.isFinite(n) || n <= 0) {
      setFormError("Enter a valid temperature.");
      return;
    }
    setBusy(true);
    try {
      const res = await carerAppendSickDayTemperature(patientId, {
        value: Math.round(n * 10) / 10,
        unit: tempUnit,
      });
      if (res.error) {
        setFormError(res.error.message);
        return;
      }
      setTempVal("");
      await onUpdated();
    } finally {
      setBusy(false);
    }
  };

  const submitMedNote = async () => {
    setFormError(null);
    const text = medNote.trim();
    if (!text) {
      setFormError("Enter a short note (e.g. paracetamol given).");
      return;
    }
    setBusy(true);
    try {
      const res = await carerAppendSickDayMedNote(patientId, {
        text,
        medicationName: medName.trim() || undefined,
      });
      if (res.error) {
        setFormError(res.error.message);
        return;
      }
      setMedNote("");
      setMedName("");
      await onUpdated();
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (m: Record<string, unknown>) => {
    const id = typeof m.id === "string" ? m.id : null;
    if (!id) return;
    const name = typeof m.name === "string" ? m.name : "";
    const dose = typeof m.dose_label === "string" ? m.dose_label : "";
    const repeatMins = typeof m.repeat_mins === "number" ? m.repeat_mins : Number(m.repeat_mins);
    const preset =
      repeatMins === 120 ? "2h" :
      repeatMins === 240 ? "4h" :
      repeatMins === 360 ? "6h" :
      repeatMins === 480 ? "8h" :
      repeatMins === 720 ? "12h" :
      repeatMins === 1440 ? "24h" : "custom";
    setEditId(id);
    setRemName(name);
    setRemDoseLabel(dose);
    setRemRepeat(preset);
    setRemRepeatCustomMins(preset === "custom" && Number.isFinite(repeatMins) ? String(Math.max(5, Math.round(repeatMins))) : "");
    setEditOpen(true);
  };

  const submitReminder = async (mode: "add" | "edit") => {
    setFormError(null);
    const name = remName.trim();
    if (!name) {
      setFormError("Enter a medication name.");
      return;
    }
    const repeatMins = resolvedRepeatMinutes(remRepeat, remRepeatCustomMins);
    if (!repeatMins) {
      setFormError("Choose a reminder interval.");
      return;
    }
    setBusy(true);
    try {
      const res = await carerUpsertSickDayMedicationReminder(patientId, {
        id: mode === "edit" ? editId ?? undefined : undefined,
        name,
        repeatEveryMinutes: repeatMins,
        doseLabel: remDoseLabel.trim() ? remDoseLabel.trim() : null,
        resetDueFromNow: mode === "add",
      });
      if (res.error) {
        setFormError(res.error.message);
        return;
      }
      await onUpdated();
      if (mode === "add") {
        setRemName("");
        setRemDoseLabel("");
        setRemRepeat("4h");
        setRemRepeatCustomMins("");
      }
      setEditOpen(false);
      setEditId(null);
    } finally {
      setBusy(false);
    }
  };

  const snoozeReminder = async (id: string, minutes: number) => {
    setFormError(null);
    setBusy(true);
    try {
      const res = await carerSnoozeSickDayMedicationReminder(patientId, { id, minutes });
      if (res.error) {
        setFormError(res.error.message);
        return;
      }
      await onUpdated();
    } finally {
      setBusy(false);
    }
  };

  const stopReminder = async (id: string) => {
    setFormError(null);
    setBusy(true);
    try {
      const res = await carerStopSickDayMedicationReminder(patientId, { id });
      if (res.error) {
        setFormError(res.error.message);
        return;
      }
      await onUpdated();
    } finally {
      setBusy(false);
    }
  };

  const openTakenDialog = (id: string, name: string, doseLabel: string | null) => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    setTakenReminderId(id);
    setTakenReminderName(name);
    setTakenReminderDose(doseLabel);
    setTakenAtLocal(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`);
    setTakenDialogOpen(true);
  };

  const submitTakenMedication = async () => {
    if (!takenReminderId) return;
    setFormError(null);
    const raw = takenAtLocal.trim();
    const takenAt = raw ? new Date(raw) : null;
    if (!takenAt || Number.isNaN(takenAt.getTime())) {
      setFormError("Choose a valid date and time.");
      return;
    }
    if (takenAt.getTime() > Date.now() + 60_000) {
      setFormError("Time cannot be in the future.");
      return;
    }
    setBusy(true);
    try {
      const res = await carerLogSickDayMedicationTaken(patientId, {
        reminderId: takenReminderId,
        takenAtIso: takenAt.toISOString(),
        name: takenReminderName,
        doseLabel: takenReminderDose,
      });
      if (res.error) {
        setFormError(res.error.message);
        return;
      }
      setTakenDialogOpen(false);
      setTakenReminderId(null);
      await onUpdated();
    } finally {
      setBusy(false);
    }
  };

  const handleSupporterMarkSickDayEnded = async () => {
    setFormError(null);
    setClosingSickDay(true);
    try {
      const res = await carerDeactivateSickDayScenarioForPatient(patientId);
      if (res.error) {
        setFormError(res.error.message);
        toast({ title: "Could not update", description: res.error.message, variant: "destructive" });
        return;
      }
      toast({
        title: "Sick day marked as ended",
        description: "Shared status is updated for everyone. Ask them to open the app in User mode if it still shows sick day there.",
      });
      await onUpdated();
    } finally {
      setClosingSickDay(false);
    }
  };

  return (
    <Card className="border-orange-200/60 dark:border-orange-900/40" data-testid="carer-sick-day-care">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Thermometer className="h-5 w-5 text-orange-600" />
          Sick day — temperatures & medication notes
        </CardTitle>
        <CardDescription>
          Shared from their app when sick day mode is on. You can add readings and notes here; they sync to their
          sick-day record for both of you.
        </CardDescription>
        <Alert className="mt-3 border-border/60 bg-muted/30 py-3">
          <AlertDescription className="text-sm space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-3">
            <span className="text-muted-foreground block sm:inline">
              If they have already recovered but this section is still open, you can mark sick day as ended (updates
              their shared sick-day status).
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 w-full sm:w-auto"
              disabled={busy || closingSickDay}
              onClick={() => void handleSupporterMarkSickDayEnded()}
            >
              {closingSickDay ? "Updating…" : "Mark sick day as ended"}
            </Button>
          </AlertDescription>
        </Alert>
      </CardHeader>
      <CardContent className="space-y-4">
        {formError ? (
          <Alert variant="destructive" className="py-2">
            <AlertDescription className="text-sm">{formError}</AlertDescription>
          </Alert>
        ) : null}

        <Dialog
          open={takenDialogOpen}
          onOpenChange={(open) => {
            setTakenDialogOpen(open);
            if (!open) setTakenReminderId(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log dose taken</DialogTitle>
              <DialogDescription>
                When did they take {takenReminderName || "this"}? This updates the shared next reminder to that time plus
                the repeat interval, and adds a row to the activity log.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">Taken at</Label>
                <Input type="datetime-local" step={60} value={takenAtLocal} onChange={(e) => setTakenAtLocal(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setTakenDialogOpen(false)} disabled={busy}>
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={() => void submitTakenMedication()} disabled={busy}>
                  Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <div className="rounded-xl border border-border/60 p-3 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Medication reminders (shared)
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Medication name</Label>
              <Input value={remName} onChange={(e) => setRemName(e.target.value)} placeholder="e.g. Paracetamol" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Repeat</Label>
              <Select value={remRepeat} onValueChange={setRemRepeat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2h">2 hours</SelectItem>
                  <SelectItem value="4h">4 hours</SelectItem>
                  <SelectItem value="6h">6 hours</SelectItem>
                  <SelectItem value="8h">8 hours</SelectItem>
                  <SelectItem value="12h">12 hours</SelectItem>
                  <SelectItem value="24h">24 hours</SelectItem>
                  <SelectItem value="custom">Custom…</SelectItem>
                </SelectContent>
              </Select>
              {remRepeat === "custom" ? (
                <Input
                  type="number"
                  inputMode="numeric"
                  min={5}
                  step={5}
                  placeholder="Minutes"
                  value={remRepeatCustomMins}
                  onChange={(e) => setRemRepeatCustomMins(e.target.value)}
                />
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Dose (optional)</Label>
            <Input value={remDoseLabel} onChange={(e) => setRemDoseLabel(e.target.value)} placeholder="e.g. 500mg, 2 tablets" />
          </div>

          <Button type="button" disabled={busy} onClick={() => void submitReminder("add")}>
            Add reminder
          </Button>

          {medsActive.length > 0 ? (
            <ul className="space-y-2 pt-1">
              {medsActive.map((m, idx) => {
                const id = typeof m.id === "string" ? m.id : `med-${idx}`;
                const name = typeof m.name === "string" ? m.name : "Medication";
                const due = typeof m.due_at === "string" ? m.due_at : null;
                const dose = typeof m.dose_label === "string" ? m.dose_label : null;
                const when =
                  due && !Number.isNaN(new Date(due).getTime())
                    ? formatDistanceToNowStrict(new Date(due), { addSuffix: true })
                    : null;
                return (
                  <li key={id} className="rounded-lg border border-border/60 px-3 py-2 text-sm space-y-2">
                    <div className="flex items-start gap-2">
                      <Pill className="h-4 w-4 shrink-0 mt-0.5 text-orange-600" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{name}</p>
                        {dose ? <p className="text-xs text-muted-foreground">{dose}</p> : null}
                        {when ? (
                          <p className="text-xs text-muted-foreground">
                            Next due {when}{" "}
                            <span className="block sm:inline">(patient schedule)</span>
                          </p>
                        ) : null}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {typeof m.repeat_mins === "number" ? `${m.repeat_mins >= 60 ? `${Math.round(m.repeat_mins / 60)}h` : `${m.repeat_mins}m`}` : "repeat"}
                      </Badge>
                    </div>
                    {typeof m.id === "string" ? (
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => openEdit(m)}>
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => openTakenDialog(m.id as string, name, dose)}
                        >
                          Taken
                        </Button>
                        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void snoozeReminder(m.id as string, 30)}>
                          Snooze 30m
                        </Button>
                        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void stopReminder(m.id as string)}>
                          Stop
                        </Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No active medication reminders yet.</p>
          )}

          {editOpen ? (
            <div className="mt-2 rounded-lg border border-border/60 bg-muted/15 p-3 space-y-2">
              <p className="text-sm font-medium">Edit reminder</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Medication name</Label>
                  <Input value={remName} onChange={(e) => setRemName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Repeat</Label>
                  <Select value={remRepeat} onValueChange={setRemRepeat}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2h">2 hours</SelectItem>
                      <SelectItem value="4h">4 hours</SelectItem>
                      <SelectItem value="6h">6 hours</SelectItem>
                      <SelectItem value="8h">8 hours</SelectItem>
                      <SelectItem value="12h">12 hours</SelectItem>
                      <SelectItem value="24h">24 hours</SelectItem>
                      <SelectItem value="custom">Custom…</SelectItem>
                    </SelectContent>
                  </Select>
                  {remRepeat === "custom" ? (
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={5}
                      step={5}
                      placeholder="Minutes"
                      value={remRepeatCustomMins}
                      onChange={(e) => setRemRepeatCustomMins(e.target.value)}
                    />
                  ) : null}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Dose (optional)</Label>
                <Input value={remDoseLabel} onChange={(e) => setRemDoseLabel(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={busy} onClick={() => void submitReminder("edit")}>
                  Save
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setEditOpen(false);
                    setEditId(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {episodeTimeline.length > 0 ? (
          <div className="rounded-xl border border-border/60 bg-muted/10 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              This sick day — activity
            </p>
            <p className="text-xs text-muted-foreground">
              Doses logged as taken (patient or supporter) and all temperature readings for this sick day.
            </p>
            <ul className="space-y-2 max-h-56 overflow-y-auto">
              {episodeTimeline.map((row) => (
                <li
                  key={row.id}
                  className="flex items-start gap-2 rounded-lg border border-border/50 bg-background/80 px-2 py-2 text-sm"
                >
                  {row.kind === "dose" ? (
                    <Pill className="h-4 w-4 shrink-0 mt-0.5 text-orange-600" aria-hidden />
                  ) : (
                    <Thermometer className="h-4 w-4 shrink-0 mt-0.5 text-orange-600" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">{row.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(row.at).toLocaleString(undefined, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {row.subtitle}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {tempsCombined.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Recent temperatures
            </p>
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {tempsCombined.slice(0, 12).map((t, idx) => {
                const when = formatDistanceToNowStrict(new Date(t.at), { addSuffix: true });
                return (
                  <li
                    key={`${t.at}-${idx}`}
                    className="rounded-lg border border-border/60 px-3 py-2 text-sm flex justify-between gap-2"
                  >
                    <span className="font-medium tabular-nums">
                      {t.value}°{t.unit.toUpperCase()}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {t.source === "carer" ? "You · " : ""}
                      {when}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {carerNotes.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Your medication / care notes
            </p>
            <ul className="space-y-2 max-h-40 overflow-y-auto">
              {carerNotes.map((n, idx) => {
                const at = typeof n.at === "string" ? n.at : "";
                const when =
                  at && !Number.isNaN(new Date(at).getTime())
                    ? formatDistanceToNowStrict(new Date(at), { addSuffix: true })
                    : "";
                const med = typeof n.medication_name === "string" ? n.medication_name : null;
                const text = typeof n.text === "string" ? n.text : "";
                return (
                  <li key={typeof n.id === "string" ? n.id : `note-${idx}`} className="rounded-lg border border-border/60 px-3 py-2 text-sm">
                    {med ? <p className="font-medium">{med}</p> : null}
                    <p className="text-muted-foreground whitespace-pre-wrap">{text}</p>
                    <p className="text-xs text-muted-foreground mt-1">{when}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 border-t border-border/60 pt-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Log temperature</p>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Value</Label>
                <Input
                  inputMode="decimal"
                  value={tempVal}
                  onChange={(e) => setTempVal(e.target.value)}
                  placeholder="e.g. 38.2"
                  className="w-28"
                  disabled={busy}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unit</Label>
                <Select value={tempUnit} onValueChange={(v) => setTempUnit(v as "c" | "f")} disabled={busy}>
                  <SelectTrigger className="w-24 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="c">°C</SelectItem>
                    <SelectItem value="f">°F</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" size="sm" className="min-h-10" onClick={() => void submitTemp()} disabled={busy}>
                Save reading
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Medication / care note</p>
            <div className="space-y-2">
              <Input
                value={medName}
                onChange={(e) => setMedName(e.target.value)}
                placeholder="Medicine name (optional)"
                disabled={busy}
              />
              <Input
                value={medNote}
                onChange={(e) => setMedNote(e.target.value)}
                placeholder="What was given / observed?"
                disabled={busy}
              />
              <Button type="button" size="sm" className="w-full min-h-10" onClick={() => void submitMedNote()} disabled={busy}>
                Save note
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function supplyTone(row: CloudSupplyRow): "ok" | "low" | "critical" {
  const qty = Number(row.quantity);
  if (!Number.isFinite(qty)) return "ok";

  const name = (row.name || "").toLowerCase();
  const unit = (row.unit || "").toLowerCase();
  const category = (row.category || "").toLowerCase();

  // Glycogen is emergency/manual stock: 1 is enough; only flag if empty.
  if (name.includes("glycogen") || name.includes("glucagon")) {
    return qty <= 0 ? "critical" : "ok";
  }

  // CGM sensors: treat "out" as critical, 1 left as low.
  // (Supporter Mode doesn't have forecast/days-remaining, so avoid over-alerting.)
  const isCgm =
    category.includes("cgm") ||
    category.includes("monitor") ||
    name.includes("dexcom") ||
    name.includes("libre") ||
    name.includes("cgm");
  const isSensor = unit.includes("sensor") || name.includes("sensor");
  if (isCgm || isSensor) {
    if (qty <= 0) return "critical";
    if (qty <= 1) return "low";
    return "ok";
  }

  // Default: only flag when empty (avoid false lows when we don't know usage/duration).
  return qty <= 0 ? "critical" : "ok";
}

function travelScenarioSummary(rows: Record<string, unknown>[]): { active: boolean; destination: string | null } {
  for (const row of rows) {
    const scenarioKey =
      typeof row.scenario_key === "string" && row.scenario_key.trim()
        ? row.scenario_key.trim()
        : typeof row.scenarioKey === "string" && row.scenarioKey.trim()
          ? row.scenarioKey.trim()
          : null;
    if (scenarioKey !== "travel") continue;
    const rawState =
      (row.state && typeof row.state === "object" ? (row.state as Record<string, unknown>) : null) ??
      (row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : null) ??
      (row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : null);
    if (!rawState) continue;
    if (!isTravelScenarioActive(rawState)) continue;
    const destination = typeof rawState.destination === "string" ? rawState.destination.trim() : null;
    return { active: true, destination: destination || null };
  }
  return { active: false, destination: null };
}

function deriveCarerHeaderContext(
  supplies: CloudSupplyRow[],
  sickState: Record<string, unknown> | null,
  scenarioRows: Record<string, unknown>[],
): {
  glance: { type: CarerGlanceType; message: string };
  showSickChip: boolean;
  showTravelChip: boolean;
} {
  const travel = travelScenarioSummary(scenarioRows);
  const sick = isSickDayScenarioActive(sickState);
  const hasCritical = supplies.some((s) => supplyTone(s) === "critical");
  const hasLow = supplies.some((s) => supplyTone(s) === "low");
  const severity =
    sickState && typeof sickState.severity === "string" ? String(sickState.severity).trim().toLowerCase() : "";
  const severeSick = sick && severity === "severe";

  let glance: { type: CarerGlanceType; message: string };
  if (sick && travel.active) {
    glance = {
      type: "warning",
      message:
        "Sick day and travel mode are both active — review their plan with their care team if unsure.",
    };
  } else if (severeSick) {
    glance = {
      type: "warning",
      message: "Severe sick day mode — follow their clinic plan and seek help if symptoms worsen.",
    };
  } else if (hasCritical) {
    glance = { type: "warning", message: "Critical supplies need attention" };
  } else if (hasLow || sick || travel.active) {
    if (hasLow) glance = { type: "info", message: "Some supplies are running low" };
    else if (sick) glance = { type: "info", message: "Sick day mode active" };
    else
      glance = {
        type: "info",
        message: travel.destination ? `Travel mode active — ${travel.destination}` : "Travel mode active",
      };
  } else {
    glance = { type: "ok", message: "All clear for now" };
  }

  return {
    glance,
    showSickChip: sick,
    showTravelChip: travel.active,
  };
}

/** Wouter + `LinkedPatientInfo`: resolve link (cached when possible) → show shell → load patient bundle. */
type CarerViewPhase = "loading_link" | "unlinked" | "ready";

export default function CarerViewPage() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const cachedLinkQuery = useLinkedPatientQuery();
  const linkedPatientsQuery = useLinkedPatientsForCarerQuery();
  const linkedPatients = useMemo((): LinkedPatientWithProfile[] => {
    const rows = linkedPatientsQuery.data;
    if (rows && rows.length > 0) return rows;
    if (cachedLinkQuery.data) {
      return [
        {
          ...cachedLinkQuery.data,
          patient_full_name: null,
          patient_avatar_url: null,
        },
      ];
    }
    return [];
  }, [linkedPatientsQuery.data, cachedLinkQuery.data]);
  const [activePatientId, setActivePatientIdState] = useState<string | null>(() => getActiveCarerPatientId());
  const [patientBundleLoading, setPatientBundleLoading] = useState(false);
  const activeLink = useMemo(
    () => linkedPatients.find((p) => p.patientId === activePatientId) ?? null,
    [linkedPatients, activePatientId],
  );
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof fetchPatientProfileForCarer>>["data"]>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [supplies, setSupplies] = useState<CloudSupplyRow[]>([]);
  const [supplyEvents, setSupplyEvents] = useState<CloudSupplyEventRow[]>([]);
  const [appointmentRows, setAppointmentRows] = useState<Record<string, unknown>[]>([]);
  const [scenarioRows, setScenarioRows] = useState<Record<string, unknown>[]>([]);
  const [hypoLogs, setHypoLogs] = useState<CloudHypoLogRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [linkedBanner, setLinkedBanner] = useState<string | null>(null);
  const [supporterPushPromptOpen, setSupporterPushPromptOpen] = useState(false);
  const linkQueriesLoading =
    (cachedLinkQuery.isLoading || linkedPatientsQuery.isLoading) && linkedPatients.length === 0;
  const linkResolvedEmpty =
    cachedLinkQuery.isFetched &&
    linkedPatientsQuery.isFetched &&
    linkedPatients.length === 0 &&
    !linkedPatientsQuery.isError;
  const phase: CarerViewPhase = linkQueriesLoading
    ? "loading_link"
    : linkResolvedEmpty || linkedPatientsQuery.isError
      ? "unlinked"
      : "ready";

  const devOverlay =
    import.meta.env.DEV ? (
      <DevNote note="carer-view" error={loadError ?? undefined} />
    ) : null;

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const raw = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
    if (!raw) {
      console.info("[DEV] Supabase host:", "(not set)");
      return;
    }
    try {
      console.info("[DEV] Supabase host:", new URL(raw).host);
    } catch {
      console.info("[DEV] Supabase host:", "(invalid URL)");
    }
  }, []);

  const scopes = useMemo(() => {
    if (!activeLink) {
      return {
        supplies: false,
        appointments: false,
        scenarios: false,
        hypo_alerts: false,
        emergency_info: false,
        clinical_settings: false,
      };
    }
    const n = normaliseScopes(activeLink.scopes);
    return {
      supplies: !!n.supplies,
      appointments: !!n.appointments,
      scenarios: !!n.scenarios,
      hypo_alerts: !!n.hypo_alerts,
      emergency_info: !!n.emergency_info,
      clinical_settings: !!n.clinical_settings,
    };
  }, [activeLink]);

  useEffect(() => {
    if (phase !== "ready") return;
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash) return;
    const t = window.setTimeout(() => scrollToCarerViewHashTarget(hash), 50);
    const onHash = () => scrollToCarerViewHashTarget(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("hashchange", onHash);
    };
  }, [phase, location]);

  useEffect(() => {
    if (linkedPatients.length === 0) return;
    const stillValid =
      activePatientId != null && linkedPatients.some((p) => p.patientId === activePatientId);
    if (stillValid) return;
    const remembered = getActiveCarerPatientId();
    const picked =
      (remembered && linkedPatients.some((r) => r.patientId === remembered) && remembered) ||
      linkedPatients[0]!.patientId;
    setActiveCarerPatientId(picked);
    setActivePatientIdState(picked);
  }, [linkedPatients, activePatientId]);

  useEffect(() => {
    if (phase !== "ready" || !activeLink) return;
    let active = true;
    const patientId = activeLink.patientId;
    const rawScopes = normaliseScopes(activeLink.scopes);
    setPatientBundleLoading(true);
    setLoadError(null);
    setAppointmentRows([]);
    setScenarioRows([]);
    setHypoLogs([]);
    void (async () => {
      try {
        const [prof, sup, se, ap, sc, hl] = await Promise.all([
          fetchPatientProfileForCarer(patientId),
          rawScopes.supplies
            ? fetchSuppliesForLinkedPatient(patientId)
            : Promise.resolve({ data: [], error: null }),
          rawScopes.supplies
            ? fetchSupplyEventsForLinkedPatient(patientId)
            : Promise.resolve({ data: [], error: null }),
          rawScopes.appointments
            ? fetchAppointmentsForLinkedPatient(patientId)
            : Promise.resolve({ data: [], error: null }),
          rawScopes.scenarios
            ? fetchScenariosForLinkedPatient(patientId)
            : Promise.resolve({ data: [], error: null }),
          rawScopes.hypo_alerts
            ? fetchHypoLogsForLinkedPatient(patientId)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (!active) return;
        if (prof.error) setLoadError(prof.error.message);
        setProfile(prof.data);
        if (sup.error) setLoadError(sup.error.message);
        setSupplies(sup.data ?? []);
        if (se.error) setLoadError(se.error.message);
        setSupplyEvents(se.data ?? []);
        if (ap.error) setLoadError(ap.error.message);
        setAppointmentRows(ap.data ?? []);
        if (sc.error) setLoadError(sc.error.message);
        setScenarioRows(sc.data ?? []);
        if (hl.error) setLoadError(hl.error.message);
        setHypoLogs(hl.data ?? []);
      } catch (e) {
        console.error("carer-view: patient data error", e);
        if (active) {
          setLoadError(e instanceof Error ? e.message : "Something went wrong");
          setSupplies([]);
          setAppointmentRows([]);
          setScenarioRows([]);
          setHypoLogs([]);
        }
      } finally {
        if (active) {
          clearCarerLinkJustCompleted();
          setPatientBundleLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [phase, activeLink?.linkId, activeLink?.patientId]);

  useEffect(() => {
    const avatarPath = profile?.avatar_url ?? activeLink?.patient_avatar_url ?? null;
    if (!avatarPath) {
      setAvatarUrl(null);
      return;
    }
    let active = true;
    void resolveProfileImageUrl(avatarPath).then((url) => {
      if (active) setAvatarUrl(url);
    });
    return () => {
      active = false;
    };
  }, [profile?.avatar_url, activeLink?.patient_avatar_url]);

  useEffect(() => {
    if (phase === "unlinked") {
      setLocation("/carer-setup");
    }
  }, [phase, setLocation]);

  useEffect(() => {
    if (phase !== "ready" || !activeLink) return;
    const msg = consumeCarerLinkedBannerMessage();
    if (msg) setLinkedBanner(msg);
  }, [phase, activeLink]);

  const displayName =
    profile?.full_name?.trim() || activeLink?.patient_full_name?.trim() || "Linked person";

  useEffect(() => {
    if (phase !== "ready" || !user?.id) return;
    let cancelled = false;
    void (async () => {
      const action = await resolveSupporterPushPromptAfterLink(user.id);
      if (!cancelled && action === "show") setSupporterPushPromptOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, user?.id]);
  const upcomingAppointments = useMemo(() => {
    const now = Date.now();
    return (appointmentRows ?? [])
      .map((row) => ({ row, t: appointmentSortTime(row) }))
      .filter((x) => x.t > 0 && x.t >= now)
      .sort((a, b) => a.t - b.t)
      .map((x) => x.row);
  }, [appointmentRows]);
  const scenarioLines = scenarioBannerLines(scenarioRows);
  const sickDayState = useMemo(() => sickDayScenarioState(scenarioRows), [scenarioRows]);
  const carerActivityEvents = useMemo(
    () =>
      collectCarerActivityEvents({
        hypoLogs,
        scenarioRows,
        appointmentRows,
        scopes,
      }),
    [hypoLogs, scenarioRows, appointmentRows, scopes],
  );
  const carerActivityWeek = useMemo(
    () => getActivityWeekSummary(carerActivityEvents),
    [carerActivityEvents],
  );
  const showCarerActivityLog = scopes.hypo_alerts || scopes.scenarios || scopes.appointments;

  const carerHeaderContext = useMemo(
    () =>
      deriveCarerHeaderContext(
        scopes.supplies ? supplies : [],
        scopes.scenarios ? sickDayState : null,
        scopes.scenarios ? scenarioRows : [],
      ),
    [scopes.supplies, scopes.scenarios, supplies, sickDayState, scenarioRows],
  );
  const travelSummary = useMemo(
    () => travelScenarioSummary((scopes.scenarios ?? false) ? scenarioRows : []),
    [scopes.scenarios, scenarioRows],
  );

  const suppliesTone = useMemo(() => {
    if (!(scopes.supplies ?? false)) return null;
    const tones = supplies.map((s) => supplyTone(s));
    if (tones.includes("critical")) return "critical";
    if (tones.includes("low")) return "low";
    return "ok";
  }, [scopes.supplies, supplies]);

  const patientSupplyPackPrefs = useMemo((): PatientSupplyPackPrefs | null => {
    if (!profile) return null;
    return {
      unitsPerInsulinPen: profile.units_per_insulin_pen,
      needlesPerBox: profile.needles_per_box,
    };
  }, [profile]);

  const linkedPeopleForHero = useMemo(
    () =>
      linkedPatients.map((p) => ({
        patientId: p.patientId,
        label: p.patient_full_name?.trim() || "Linked person",
        active: p.patientId === activePatientId,
      })),
    [linkedPatients, activePatientId],
  );

  const travelChipLabel = travelSummary.destination
    ? `Travel · ${travelSummary.destination}`
    : "Travel";

  const sortedSupplies = useMemo(
    () => sortSuppliesByUrgency(supplies, supplyTone),
    [supplies],
  );

  const refreshScenarios = useCallback(async () => {
    if (!activeLink?.patientId) return;
    const sc = await fetchScenariosForLinkedPatient(activeLink.patientId);
    if (!sc.error && sc.data) setScenarioRows(sc.data);
  }, [activeLink?.patientId]);

  if (!getSupabase()) {
    return (
      <>
        {devOverlay}
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 mb-4" aria-label="Back to home">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>Supporter Mode needs Supabase to be configured for this environment.</AlertDescription>
          </Alert>
        </div>
      </>
    );
  }

  if (phase === "loading_link") {
    return (
      <>
        {devOverlay}
        <PageShell variant="standard" className="max-w-3xl space-y-4 py-4" aria-busy="true">
          <Card variant="glass-strong" className="border border-primary/10 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="h-14 w-14 rounded-2xl bg-muted animate-pulse" />
              <div className="h-6 w-40 rounded-lg bg-muted animate-pulse" />
              <div className="h-8 w-full max-w-xs rounded-full bg-muted animate-pulse" />
            </CardContent>
          </Card>
          <div className="px-1">
            <HubLoadingSkeleton tiles={4} />
          </div>
        </PageShell>
      </>
    );
  }

  if (phase === "unlinked") {
    return (
      <>
        {devOverlay}
        <PageShell variant="standard" className="max-w-3xl space-y-4 py-4" data-testid="carer-view-redirecting">
          <div className="sticky top-0 z-20 -mx-2 rounded-2xl border border-border/45 bg-card/90 px-3 py-2 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-card/80">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground truncate">Supporter Mode</p>
                <p className="text-sm font-semibold text-foreground truncate">Read-only</p>
              </div>
              <Badge variant="secondary" className="rounded-full">
                Redirecting…
              </Badge>
            </div>
          </div>
          <div className="px-1">
            <HubLoadingSkeleton tiles={4} />
          </div>
        </PageShell>
      </>
    );
  }

  if (phase !== "ready" || !activeLink) {
    return <>{devOverlay}</>;
  }

  const onPatientChange = (patientId: string) => {
    setActiveCarerPatientId(patientId);
    setActivePatientIdState(patientId);
  };

  return (
    <>
      {devOverlay}
      <PageShell
        variant="standard"
        className="max-w-3xl space-y-6 py-4"
        aria-busy={patientBundleLoading || undefined}
      >
        <div className="flex flex-col gap-3 sm:gap-4 animate-stagger">
          <SupporterHero
            displayName={displayName}
            avatarUrl={avatarUrl}
            glance={carerHeaderContext.glance}
            showEmergencyLink={scopes.emergency_info ?? false}
            showSickChip={(scopes.scenarios ?? false) && carerHeaderContext.showSickChip}
            showTravelChip={(scopes.scenarios ?? false) && carerHeaderContext.showTravelChip}
            travelLabel={travelChipLabel}
            linkedPeople={linkedPeopleForHero}
            onPatientChange={onPatientChange}
          />

          <SupporterQuickActions showActivity={showCarerActivityLog} />

          {activeLink?.patientId ? (
            <CarerClinicalPrefsCard patientId={activeLink.patientId} enabled={scopes.clinical_settings ?? false} />
          ) : null}

          {linkedPatients.length > 1 ? (
            <Card variant="glass-muted" className="border-0 shadow-sm" data-testid="carer-linked-people">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Users className="h-5 w-5 text-primary shrink-0" aria-hidden />
                  People you support
                </CardTitle>
                <CardDescription>
                  Tap a name above to switch, or use the list below.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <ul className="m-0 list-none space-y-2 p-0">
                  {linkedPatients.map((p) => {
                    const label = p.patient_full_name?.trim() || "Linked person";
                    const active = p.patientId === activePatientId;
                    return (
                      <li key={p.patientId}>
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 px-3 py-2.5 text-sm bg-background/40">
                          <span className="min-w-0 font-medium text-foreground">{label}</span>
                          <div className="flex shrink-0 items-center gap-2">
                            {active ? (
                              <Badge variant="secondary">Viewing</Badge>
                            ) : (
                              <Button type="button" size="sm" variant="outline" onClick={() => onPatientChange(p.patientId)}>
                                Switch to
                              </Button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>

      {linkedBanner && (
        <Alert className="border-primary/30 bg-primary/5">
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              You’re now linked to <strong className="font-medium">{linkedBanner}</strong>. Welcome to Supporter Mode.
            </span>
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setLinkedBanner(null)}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loadError && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

        <div className="space-y-4 sm:space-y-5 animate-stagger">
          <CarerSectionHeading
            title="Now"
            subtitle="What may need your attention today."
            icon={Heart}
          />
          {(scopes.hypo_alerts ?? false) && (
            <CarerUrgentCard
              testId="carer-view-hypos"
              accent={hypoLogs.length > 0 ? "rose" : "default"}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Heart className="h-5 w-5 text-primary shrink-0" aria-hidden />
                  Recent hypos
                </CardTitle>
                <CardDescription>Shared hypo logs, newest first.</CardDescription>
              </CardHeader>
              <CardContent>
                {hypoLogs.length === 0 ? (
                  <CarerCardEmpty
                    icon={Heart}
                    title="No hypos shared yet"
                    description="When they log a hypo and share alerts with you, it will appear here."
                  />
                ) : (
                  <ul className="space-y-3 m-0 list-none p-0">
                    {hypoLogs.slice(0, 4).map((h) => {
                      const when = new Date(h.created_at);
                      const whenText = Number.isNaN(when.getTime())
                        ? "Unknown time"
                        : `${formatDistanceToNowStrict(when, { addSuffix: true })}`;
                      const bg =
                        h.blood_glucose == null || Number.isNaN(h.blood_glucose)
                          ? null
                          : Math.round(h.blood_glucose * 10) / 10;
                      return (
                        <CarerHypoTimelineItem
                          key={h.id}
                          bgLabel={bg == null ? "Hypo logged" : `BG ${bg}`}
                          whenText={whenText}
                          treatment={h.treatment}
                          notes={h.notes}
                        />
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </CarerUrgentCard>
          )}

          {(scopes.scenarios ?? false) && isSickDayScenarioActive(sickDayState) && activeLink?.patientId ? (
            <div id="carer-sick-day-care" className="scroll-mt-24">
              <SickDaySupporterCareCard
                patientId={activeLink.patientId}
                sickState={sickDayState}
                onUpdated={refreshScenarios}
              />
            </div>
          ) : null}

          {(scopes.supplies ?? false) && (
            <CarerUrgentCard
              testId="carer-view-supplies"
              accent={suppliesTone === "critical" ? "amber" : suppliesTone === "low" ? "amber" : "default"}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0 flex-1">{displayName}&apos;s supplies</span>
                  <InlineInfoHint
                    ariaLabel="About supplies"
                    content={<p>Cloud stock they have chosen to share with you.</p>}
                    className="-mr-2 shrink-0"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                {supplies.length === 0 ? (
                  <CarerCardEmpty
                    icon={Package}
                    title="No supplies shared yet"
                    description="They can enable supply sharing in their supporter link settings."
                  />
                ) : (
                  <ul className="space-y-2 m-0 list-none p-0">
                    {sortedSupplies.map((s) => {
                      const tone = supplyTone(s);
                      return (
                        <li
                          key={s.id}
                          className={cn(
                            "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm",
                            tone === "critical" && "border-destructive/35 bg-destructive/[0.04]",
                            tone === "low" && "border-amber-500/30 bg-amber-500/[0.04]",
                            tone === "ok" && "border-border/60 bg-background/40",
                          )}
                        >
                          <SupplyStockIndicator tone={tone} />
                          <span className="font-medium truncate min-w-0 flex-1">{s.name}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-muted-foreground tabular-nums text-right text-xs sm:text-sm">
                              {formatCarerSupplyQuantity(s, patientSupplyPackPrefs)}
                            </span>
                            {tone === "critical" && (
                              <Badge variant="destructive" className="text-xs">
                                Out
                              </Badge>
                            )}
                            {tone === "low" && (
                              <Badge
                                variant="secondary"
                                className="text-xs bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
                              >
                                Low
                              </Badge>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                  {supplyEvents.length > 0 && (
                    <details className="mt-4">
                      <summary className="text-sm text-muted-foreground cursor-pointer select-none">
                        Recent changes
                      </summary>
                      <div className="mt-3 space-y-2">
                        {supplyEvents.slice(0, 8).map((e) => {
                          const when = new Date(e.created_at);
                          const whenText = Number.isNaN(when.getTime())
                            ? "Unknown time"
                            : formatDistanceToNowStrict(when, { addSuffix: true });
                          const delta =
                            e.delta == null || Number.isNaN(e.delta) ? null : Math.round(e.delta * 10) / 10;
                          const itemName = resolveSupplyEventItemName(e, supplies);
                          const linkedSupply =
                            supplies.find((s) => s.id === e.supply_id) ??
                            (itemName
                              ? supplies.find((s) => s.name.trim().toLowerCase() === itemName.trim().toLowerCase())
                              : undefined);
                          const eventRowForFormat: CloudSupplyRow =
                            linkedSupply ?? {
                              id: e.supply_id,
                              user_id: e.user_id,
                              name: itemName ?? "Supply",
                              quantity: 0,
                              updated_at: e.created_at,
                              category: null,
                            };
                          return (
                            <div key={e.id} className="rounded-lg border border-border/60 px-3 py-2 text-sm space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">
                                  {e.kind}
                                  {delta != null && delta !== 0 ? (
                                    <span
                                      className={
                                        delta < 0
                                          ? "text-amber-700 dark:text-amber-400"
                                          : "text-emerald-700 dark:text-emerald-400"
                                      }
                                    >
                                      {" "}
                                      {formatCarerSupplyEventDelta(delta, eventRowForFormat, patientSupplyPackPrefs)}
                                    </span>
                                  ) : null}
                                </span>
                                <span className="text-xs text-muted-foreground shrink-0">{whenText}</span>
                              </div>
                              {itemName ? (
                                <p className="text-xs text-muted-foreground">Item: {itemName}</p>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}
              </CardContent>
            </CarerUrgentCard>
          )}

          {(scopes.scenarios ?? false) && (
            <CarerMutedCard id="carer-scenarios" testId="carer-view-scenarios">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Plane className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0 flex-1">Situations</span>
                  <InlineInfoHint
                    ariaLabel="About situations"
                    content={
                      <p>Shared travel, sick-day, and bedtime flags when their project allows it.</p>
                    }
                    className="-mr-2 shrink-0"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {scenarioLines.length === 0 ? (
                  <CarerCardEmpty
                    icon={Plane}
                    title="No situations shared"
                    description="Travel, sick day, or bedtime flags will show here when shared."
                  />
                ) : (
                  scenarioLines.map((line, i) => (
                    <div
                      key={`${line}-${i}`}
                      className="flex items-start gap-2 text-sm rounded-lg border border-border/50 px-3 py-2 bg-background/50"
                    >
                      {line.toLowerCase().includes("sick") ? (
                        <Thermometer className="h-4 w-4 shrink-0 mt-0.5 text-orange-600" />
                      ) : line.toLowerCase().includes("travel") ? (
                        <Plane className="h-4 w-4 shrink-0 mt-0.5 text-purple-600" />
                      ) : (
                        <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                      )}
                      <span>{line}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </CarerMutedCard>
          )}

          {showCarerActivityLog ? (
            <>
              <CarerSectionHeading
                title="History"
                subtitle="Browse shared activity over time."
                icon={History}
              />
              <CarerMutedCard testId="carer-view-activity">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <History className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                    <span className="min-w-0 flex-1">Activity log</span>
                    <InlineInfoHint
                      ariaLabel="About activity log"
                      content={<p>Shared hypos, guides, and clinic visits by day — read-only.</p>}
                      className="-mr-2 shrink-0"
                    />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {carerActivityWeek.countLast7Days === 0 ? (
                    <CarerCardEmpty
                      icon={History}
                      title="Quiet week"
                      description="No shared activity in the last 7 days."
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      <span className="text-2xl font-semibold tabular-nums text-foreground">
                        {carerActivityWeek.countLast7Days}
                      </span>{" "}
                      {carerActivityWeek.countLast7Days === 1 ? "entry" : "entries"} this week
                    </p>
                  )}
                  <Button variant="outline" size="sm" className="w-full sm:w-auto min-h-10 rounded-xl" asChild>
                    <Link href="/carer-view/activity">View calendar</Link>
                  </Button>
                </CardContent>
              </CarerMutedCard>
            </>
          ) : null}
        </div>

        {(scopes.appointments ?? false) && (
          <div className="space-y-4 sm:space-y-5">
            <CarerSectionHeading title="Upcoming" subtitle="Appointments coming up next." icon={Calendar} />
            <Card variant="glass-strong" className="dashboard-card-hover border border-border/60 shadow-sm" data-testid="carer-view-appointments">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0 flex-1">Appointments</span>
                  <InlineInfoHint
                    ariaLabel="About appointments"
                    content={<p>Read-only — from their cloud appointments.</p>}
                    className="-mr-2 shrink-0"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingAppointments.length === 0 ? (
                  <CarerCardEmpty
                    icon={Calendar}
                    title="No upcoming appointments"
                    description="Shared clinic visits will appear here when scheduled."
                  />
                ) : (
                  <div className="space-y-2">
                    {upcomingAppointments.map((appt) => (
                      <div
                        key={String(
                          (appt as Record<string, unknown>).client_id ??
                            (appt as Record<string, unknown>).id ??
                            appointmentSortTime(appt),
                        )}
                        className="rounded-lg border border-border/60 px-3 py-3 text-sm space-y-1"
                      >
                        <p className="font-medium">{appointmentTitle(appt)}</p>
                        {formatAppointmentWhen(appt) ? (
                          <p className="text-muted-foreground">{formatAppointmentWhen(appt)}</p>
                        ) : (
                          <p className="text-muted-foreground text-xs">No scheduled time field on this row.</p>
                        )}
                        {typeof (appt as Record<string, unknown>).location === "string" &&
                        ((appt as Record<string, unknown>).location as string).trim() ? (
                          <p className="text-muted-foreground text-xs">
                            {(appt as Record<string, unknown>).location as string}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {(scopes.emergency_info ?? false) && (
          <div className="space-y-4 sm:space-y-5">
            <CarerSectionHeading title="Reference" subtitle="Details for coordination and emergencies." icon={Phone} />
            <Card
              id="carer-emergency"
              variant="glass-strong"
              className="scroll-mt-24 border border-border/60 shadow-sm"
              data-testid="carer-view-emergency"
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0 flex-1">Emergency details</span>
                  <InlineInfoHint
                    ariaLabel="About emergency details"
                    content={
                      <p>
                        They entered this under Account or Settings. Use only as they intend — this is not
                        emergency services.
                      </p>
                    }
                    className="-mr-2 shrink-0"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {profile?.emergency_contact_name ? (
                  <p>
                    <span className="text-muted-foreground">Name: </span>
                    {profile.emergency_contact_name}
                  </p>
                ) : null}
                {profile?.emergency_contact_phone ? (
                  <p>
                    <a
                      href={`tel:${profile.emergency_contact_phone.replace(/\s+/g, "")}`}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                      aria-label={`Call ${profile.emergency_contact_phone}`}
                    >
                      {profile.emergency_contact_phone}
                    </a>
                  </p>
                ) : (
                  <p className="text-muted-foreground">No phone number saved.</p>
                )}
                {profile?.emergency_notes ? (
                  <p className="text-muted-foreground whitespace-pre-wrap">{profile.emergency_notes}</p>
                ) : null}
                {!profile?.emergency_contact_name &&
                  !profile?.emergency_contact_phone &&
                  !profile?.emergency_notes && <p className="text-muted-foreground">They have not added emergency details yet.</p>}
              </CardContent>
            </Card>
          </div>
        )}

      <SupporterPageFooter />
      <p className="text-xs text-center text-muted-foreground px-2 pb-2">
        For peace of mind and coordination — not medical advice or a substitute for their care team.
      </p>
      </PageShell>
      <SupporterPushPromptDialog
        open={supporterPushPromptOpen}
        onOpenChange={setSupporterPushPromptOpen}
        patientName={linkedBanner ?? displayName}
      />
    </>
  );
}
