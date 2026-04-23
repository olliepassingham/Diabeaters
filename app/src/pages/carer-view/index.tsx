import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, ArrowLeft, Package, Heart, Phone, Calendar, Plane, Thermometer, Info, Users, Pill } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  normaliseScopes,
  fetchSuppliesForLinkedPatient,
  fetchSupplyEventsForLinkedPatient,
  fetchPatientProfileForCarer,
  fetchAppointmentsForLinkedPatient,
  fetchScenariosForLinkedPatient,
  fetchHypoLogsForLinkedPatient,
  getLinkedPatientForCarer,
  listLinkedPatientsForCarer,
  carerAppendSickDayTemperature,
  carerAppendSickDayMedNote,
} from "@/lib/carers";
import type { CloudSupplyEventRow } from "@/lib/carers";
import type { CloudHypoLogRow, CloudSupplyRow, LinkedPatientWithProfile } from "@/lib/carers.types";
import { resolveProfileImageUrl } from "@/lib/storage-profile";
import { getSupabase } from "@/lib/supabase";
import {
  consumeCarerLinkedBannerMessage,
  clearCarerLinkJustCompleted,
  getCarerLinkJustCompletedAt,
  getActiveCarerPatientId,
  setActiveCarerPatientId,
} from "@/lib/carer-session";
import { DevNote } from "@/components/dev/DevNote";
import { PageShell } from "@/components/layout";
import { formatDistanceToNowStrict } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {subtitle ? <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p> : null}
      </div>
    </div>
  );
}

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
      const active = rawState?.sick_day_active === true || rawState?.sickDayActive === true;
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
      const active = rawState?.travel_active === true || rawState?.travelActive === true;
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

function SickDaySupporterCareCard(props: {
  patientId: string;
  sickState: Record<string, unknown> | null;
  onUpdated: () => Promise<void>;
}) {
  const { patientId, sickState, onUpdated } = props;
  const [tempVal, setTempVal] = useState("");
  const [tempUnit, setTempUnit] = useState<"c" | "f">("c");
  const [medName, setMedName] = useState("");
  const [medNote, setMedNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!sickState || sickState.sick_day_active !== true) return null;

  const medsActive = Array.isArray(sickState.meds_active)
    ? (sickState.meds_active as Record<string, unknown>[])
    : [];
  const carerNotes = Array.isArray(sickState.carer_med_notes)
    ? (sickState.carer_med_notes as Record<string, unknown>[])
    : [];
  const tempsCombined = combinedSickDayTemperatureRows(sickState);

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

  return (
    <Card className="border-orange-200/60 dark:border-orange-900/40" data-testid="carer-sick-day-care">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Thermometer className="h-5 w-5 text-orange-600" />
          Sick day — temperatures & medication notes
        </CardTitle>
        <CardDescription>
          Shared from their app when Sick Day mode is on. You can add readings and notes here; they sync to their
          scenario for both of you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {formError ? (
          <Alert variant="destructive" className="py-2">
            <AlertDescription className="text-sm">{formError}</AlertDescription>
          </Alert>
        ) : null}

        {medsActive.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Active reminders (from their device)
            </p>
            <ul className="space-y-2">
              {medsActive.map((m, idx) => {
                const name = typeof m.name === "string" ? m.name : "Medication";
                const due = typeof m.due_at === "string" ? m.due_at : null;
                const dose = typeof m.dose_label === "string" ? m.dose_label : null;
                const when =
                  due && !Number.isNaN(new Date(due).getTime())
                    ? formatDistanceToNowStrict(new Date(due), { addSuffix: true })
                    : null;
                return (
                  <li
                    key={typeof m.id === "string" ? m.id : `med-${idx}`}
                    className="rounded-lg border border-border/60 px-3 py-2 text-sm flex items-start gap-2"
                  >
                    <Pill className="h-4 w-4 shrink-0 mt-0.5 text-orange-600" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{name}</p>
                      {dose ? <p className="text-xs text-muted-foreground">{dose}</p> : null}
                      {when ? <p className="text-xs text-muted-foreground">Next due {when}</p> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

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

/** Wouter + `LinkedPatientInfo`: load link → optionally load patient bundle → ready. */
type CarerViewPhase = "loading_link" | "unlinked" | "loading_patient" | "ready";

export default function CarerViewPage() {
  const [location, setLocation] = useLocation();
  const [phase, setPhase] = useState<CarerViewPhase>("loading_link");
  const [linkedPatients, setLinkedPatients] = useState<LinkedPatientWithProfile[]>([]);
  const [activePatientId, setActivePatientIdState] = useState<string | null>(null);
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
  const [error, setError] = useState<string | null>(null);

  const devOverlay =
    import.meta.env.DEV ? (
      <DevNote note="carer-view" error={error ?? loadError ?? undefined} />
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
      };
    }
    const n = normaliseScopes(activeLink.scopes);
    return {
      supplies: !!n.supplies,
      appointments: !!n.appointments,
      scenarios: !!n.scenarios,
      hypo_alerts: !!n.hypo_alerts,
      emergency_info: !!n.emergency_info,
    };
  }, [activeLink]);

  useEffect(() => {
    if (phase !== "ready") return;
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#carer-scenarios") return;
    requestAnimationFrame(() => {
      document.getElementById("carer-scenarios")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [phase, location]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const justLinkedAt = getCarerLinkJustCompletedAt();
        const linkingGraceMs = 20_000;
        const shouldRetry =
          typeof justLinkedAt === "number" &&
          Date.now() - justLinkedAt >= 0 &&
          Date.now() - justLinkedAt < linkingGraceMs;
        const delays = shouldRetry ? [300, 600, 1200, 2400, 4000] : [];

        const sleep = (ms: number) =>
          new Promise<void>((resolve) => {
            setTimeout(resolve, ms);
          });

        let lastErr: Error | null = null;
        let rows: LinkedPatientWithProfile[] = [];
        for (let attempt = 0; attempt <= delays.length; attempt++) {
          const res = await listLinkedPatientsForCarer();
          if (!active) return;
          lastErr = res.error;
          rows = res.data ?? [];
          if (!lastErr && rows.length > 0) break;
          if (attempt < delays.length) await sleep(delays[attempt]!);
        }

        if (!active) return;
        if (lastErr) {
          console.error("carer-view: link error", lastErr);
          setLinkedPatients([]);
          setActivePatientIdState(null);
          setError("unlinked or load error");
          setPhase("unlinked");
          return;
        }
        if (rows.length === 0) {
          const fallback = await getLinkedPatientForCarer();
          if (!active) return;
          if (fallback.data && !fallback.error) {
            const fp = fallback.data;
            rows = [
              {
                linkId: fp.linkId,
                patientId: fp.patientId,
                carerId: fp.carerId,
                scopes: fp.scopes,
                patient_full_name: null,
                patient_avatar_url: null,
              },
            ];
          }
        }
        if (rows.length === 0) {
          console.warn("carer-view: no linked patients");
          setLinkedPatients([]);
          setActivePatientIdState(null);
          setError("unlinked or load error");
          setPhase("unlinked");
          return;
        }
        setError(null);
        setLinkedPatients(rows);
        const remembered = getActiveCarerPatientId();
        const picked =
          (remembered && rows.some((r) => r.patientId === remembered) && remembered) ||
          rows[0]!.patientId;
        setActiveCarerPatientId(picked);
        setActivePatientIdState(picked);
        setPhase("loading_patient");
      } catch (e) {
        console.error("carer-view: link error", e);
        if (!active) return;
        setLinkedPatients([]);
        setActivePatientIdState(null);
        setError("unlinked or load error");
        setPhase("unlinked");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (phase !== "loading_patient" || !activeLink) return;
    let active = true;
    setLoadError(null);
    setAppointmentRows([]);
    setScenarioRows([]);
    setHypoLogs([]);
    (async () => {
      try {
        const patientId = activeLink.patientId;
        const rawScopes = normaliseScopes(activeLink.scopes);
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

        if (active) {
          if (prof.error) setLoadError(prof.error.message);
          setProfile(prof.data);

          if (prof.data?.avatar_url) {
            const url = await resolveProfileImageUrl(prof.data.avatar_url);
            if (active) setAvatarUrl(url);
          } else {
            setAvatarUrl(null);
          }

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
        }
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
          setPhase("ready");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [phase, activeLink]);

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

  const displayName = profile?.full_name?.trim() || "Linked person";
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
        <div
          className="max-w-2xl mx-auto px-4 py-12 text-center text-muted-foreground text-sm"
          aria-busy="true"
        >
          Loading…
        </div>
      </>
    );
  }

  if (phase === "unlinked") {
    return (
      <>
        {devOverlay}
        <div
          className="max-w-2xl mx-auto px-4 py-12 text-center text-muted-foreground text-sm"
          data-testid="carer-view-redirecting"
        >
          Redirecting…
        </div>
      </>
    );
  }

  if (phase === "loading_patient" || !activeLink) {
    return (
      <>
        {devOverlay}
        <div
          className="max-w-2xl mx-auto px-4 py-12 text-center text-muted-foreground text-sm"
          aria-busy="true"
        >
          Loading…
        </div>
      </>
    );
  }

  if (phase !== "ready" || !activeLink) {
    return <>{devOverlay}</>;
  }

  const onPatientChange = (patientId: string) => {
    setActiveCarerPatientId(patientId);
    setActivePatientIdState(patientId);
    setPhase("loading_patient");
  };

  return (
    <>
      {devOverlay}
      <PageShell variant="standard" className="max-w-3xl space-y-6 py-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="min-w-0">
                <h1 className="text-h1 text-foreground flex items-center gap-2 flex-wrap" data-testid="heading-carer-view">
                  <Eye className="h-6 w-6 text-primary shrink-0" />
                  Supporter Mode
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Read-only — you can view shared information and coordinate support.
                </p>
              </div>
            </div>

            <Badge variant="secondary" className="gap-1 shrink-0" aria-label="Read only">
              <Eye className="h-3 w-3" />
              Read only
            </Badge>
          </div>

          <Card className="border-border/60 shadow-sm" data-testid="carer-view-header">
            <CardContent className="p-4 md:p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden"
                    aria-hidden={!avatarUrl}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Heart className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Viewing</p>
                    <p className="text-lg font-semibold text-foreground truncate" data-testid="text-carer-view-name">
                      {displayName}
                    </p>
                  </div>
                </div>

                {(scopes.emergency_info ?? false) && (
                  <a
                    href="#carer-emergency"
                    className="text-sm font-medium text-muted-foreground hover:text-foreground underline underline-offset-4 shrink-0"
                    aria-label="Jump to emergency details"
                  >
                    Emergency
                  </a>
                )}
              </div>
            </CardContent>
          </Card>

          {linkedPatients.length > 1 ? (
            <Card className="border-border/60 shadow-sm" data-testid="carer-linked-people">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Users className="h-5 w-5 text-primary shrink-0" aria-hidden />
                  People you support
                </CardTitle>
                <CardDescription>
                  Each person chooses what you can see. Use{" "}
                  <span className="font-medium text-foreground">Switch to</span> to change who you are viewing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <ul className="m-0 list-none space-y-2 p-0">
                  {linkedPatients.map((p) => {
                    const label = p.patient_full_name?.trim() || "Linked person";
                    const active = p.patientId === activePatientId;
                    return (
                      <li key={p.patientId}>
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 px-3 py-2.5 text-sm">
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

        <div className="space-y-4">
          <SectionHeading
            title="Now"
            subtitle="High-signal items that might need attention."
          />
          {(scopes.hypo_alerts ?? false) && (
            <Card className="border-border/60 shadow-sm" data-testid="carer-view-hypos">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-primary" />
                  Recent hypos
                </CardTitle>
                <CardDescription>Recent hypo logs they have chosen to share.</CardDescription>
              </CardHeader>
              <CardContent>
                {hypoLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No hypo logs visible yet.</p>
                ) : (
                  <ul className="space-y-2">
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
                        <li key={h.id} className="rounded-lg border border-border/60 px-3 py-2 text-sm space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{bg == null ? "Hypo logged" : `BG ${bg}`}</span>
                            <span className="text-xs text-muted-foreground shrink-0">{whenText}</span>
                          </div>
                          {h.treatment ? <p className="text-muted-foreground">Treatment: {h.treatment}</p> : null}
                          {h.notes ? (
                            <p className="text-muted-foreground whitespace-pre-wrap">{h.notes}</p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {(scopes.scenarios ?? false) && (
              <Card id="carer-scenarios" className="border-border/60 shadow-sm scroll-mt-24" data-testid="carer-view-scenarios">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <Plane className="h-5 w-5 text-primary" />
                    Scenario status
                  </CardTitle>
                  <CardDescription>Shared scenario flags (Sick day, Travel, Bedtime).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {scenarioLines.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No scenario data visible yet.</p>
                  ) : (
                    scenarioLines.map((line, i) => (
                      <div
                        key={`${line}-${i}`}
                        className="flex items-start gap-2 text-sm rounded-lg border border-border/60 px-3 py-2 bg-muted/20"
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
              </Card>
            )}

            {(scopes.scenarios ?? false) && sickDayState?.sick_day_active === true && activeLink?.patientId ? (
              <SickDaySupporterCareCard
                patientId={activeLink.patientId}
                sickState={sickDayState}
                onUpdated={refreshScenarios}
              />
            ) : null}

            {(scopes.supplies ?? false) && (
              <Card className="border-border/60 shadow-sm" data-testid="carer-view-supplies">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    Supplies
                  </CardTitle>
                  <CardDescription>Cloud stock figures they have chosen to share.</CardDescription>
                </CardHeader>
                <CardContent>
                  {supplies.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No supply rows visible yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {supplies.map((s) => {
                        const tone = supplyTone(s);
                        return (
                          <li
                            key={s.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
                          >
                            <span className="font-medium truncate">{s.name}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-muted-foreground tabular-nums">{s.quantity}</span>
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
                                      {delta > 0 ? `+${delta}` : `${delta}`}
                                    </span>
                                  ) : null}
                                </span>
                                <span className="text-xs text-muted-foreground shrink-0">{whenText}</span>
                              </div>
                              {typeof e.supply_id === "string" ? (
                                <p className="text-xs text-muted-foreground">Item: {e.supply_id}</p>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {(scopes.appointments ?? false) && (
          <div className="space-y-4">
            <SectionHeading title="Upcoming" subtitle="Appointments coming up next." />
            <Card className="border-border/60 shadow-sm" data-testid="carer-view-appointments">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Appointments
                </CardTitle>
                <CardDescription>Read-only — from their cloud appointments.</CardDescription>
              </CardHeader>
              <CardContent>
                {upcomingAppointments.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No upcoming appointments visible yet.</p>
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
          <div className="space-y-4">
            <SectionHeading title="Reference" subtitle="Details for coordination and emergencies." />
            <Card id="carer-emergency" className="border-border/60 shadow-sm scroll-mt-24" data-testid="carer-view-emergency">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-primary" />
                  Emergency details
                </CardTitle>
                <CardDescription>
                  They entered this under Account or Settings. Use only as they intend — this is not emergency services.
                </CardDescription>
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

      <p className="text-xs text-center text-muted-foreground px-2">
        This screen is for peace of mind and coordination. It does not give medical advice or replace their care team.
      </p>
      </PageShell>
    </>
  );
}
