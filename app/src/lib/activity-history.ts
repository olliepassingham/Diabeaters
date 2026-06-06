import { format, isBefore, startOfDay, subDays } from "date-fns";

import type { CarerScopes, CloudHypoLogRow } from "@/lib/carers.types";
import { listAllLocalSupplyEvents, type SupplyEvent, type SupplyEventKind } from "@/lib/supply-events";
import { storage, type HypoTreatment, type ScenarioHistoryEntry } from "@/lib/storage";

export const ACTIVITY_FILTER_STORAGE_KEY = "diabeater_activity_log_filter";

export type ActivityKind =
  | "hypo_treated"
  | "scenario_started"
  | "scenario_ended"
  | "bedtime_check"
  | "exercise_session"
  | "ratio_snapshot"
  | "supply_event"
  | "supply_pickup"
  | "appointment"
  | "adviser_session";

export type ActivitySource = "local" | "cloud";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  at: string;
  title: string;
  subtitle?: string;
  href?: string;
  source: ActivitySource;
}

const SUPPLY_EVENT_KINDS: SupplyEventKind[] = ["refill", "ordered"];

export function parseActivityTimestamp(value: string): Date | null {
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Local calendar day key (yyyy-MM-dd) for grouping. */
export function toActivityDayKey(iso: string): string | null {
  const d = parseActivityTimestamp(iso);
  if (!d) return null;
  return format(d, "yyyy-MM-dd");
}

function event(
  partial: Omit<ActivityEvent, "source"> & { source?: ActivitySource },
): ActivityEvent {
  return { source: "local", ...partial };
}

function appointmentAtIso(date: string, time?: string): string {
  return time ? `${date}T${time}` : `${date}T12:00:00`;
}

function appointmentActivitySubtitle(
  input: { date: string; time?: string; location?: string; isCompleted?: boolean },
  when: Date,
): string | undefined {
  const todayStart = startOfDay(new Date());
  const dayStart = startOfDay(when);
  const parts: string[] = [];
  if (input.time?.trim()) parts.push(input.time.trim());
  if (input.isCompleted) {
    parts.push("Completed");
  } else if (!isBefore(dayStart, todayStart)) {
    parts.push("Upcoming");
  }
  if (input.location?.trim()) parts.push(input.location.trim());
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function mapAppointmentActivityEvent(input: {
  id: string;
  title: string;
  date: string;
  time?: string;
  location?: string;
  isCompleted?: boolean;
  source?: ActivitySource;
}): ActivityEvent | null {
  const at = appointmentAtIso(input.date, input.time);
  const when = parseActivityTimestamp(at);
  if (!when) return null;
  return event({
    id: input.id,
    kind: "appointment",
    at,
    title: input.title.trim() || "Appointment",
    subtitle: appointmentActivitySubtitle(input, when),
    href: "/appointments",
    source: input.source,
  });
}

function mapHypoTreatment(row: HypoTreatment): ActivityEvent {
  const bg = row.glucoseLevel !== undefined ? `${row.glucoseLevel}` : undefined;
  const subtitle = [row.treatment, bg].filter(Boolean).join(" · ") || undefined;
  return event({
    id: `hypo-${row.id}`,
    kind: "hypo_treated",
    at: row.timestamp,
    title: "Hypo treated",
    subtitle,
    href: "/tools/hypo-history",
    source: row.supabaseHypoLogId ? "cloud" : "local",
  });
}

function mapScenarioHistory(entry: ScenarioHistoryEntry): ActivityEvent[] {
  const label = entry.type === "sick_day" ? "Sick day" : "Travel";
  const href = entry.type === "sick_day" ? "/scenarios/sick-day" : "/scenarios/travel";
  const dest = entry.destination?.trim();
  const severity = entry.severity?.trim();
  const detail = [dest, severity].filter(Boolean).join(" · ");

  const events: ActivityEvent[] = [
    event({
      id: `scenario-start-${entry.id}`,
      kind: "scenario_started",
      at: entry.startDate,
      title: `${label} started`,
      subtitle: detail || undefined,
      href,
    }),
  ];

  if (entry.endDate) {
    const endDetail = [
      detail,
      entry.journalEntryCount != null && entry.journalEntryCount > 0
        ? `${entry.journalEntryCount} journal ${entry.journalEntryCount === 1 ? "entry" : "entries"}`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
    events.push(
      event({
        id: `scenario-end-${entry.id}`,
        kind: "scenario_ended",
        at: entry.endDate,
        title: `${label} ended`,
        subtitle: endDetail || undefined,
        href,
      }),
    );
  }

  return events;
}

function mapActiveScenario(): ActivityEvent[] {
  const state = storage.getScenarioState();
  const events: ActivityEvent[] = [];

  if (state.sickDayActive && state.sickDayActivatedAt) {
    events.push(
      event({
        id: "scenario-active-sick-day",
        kind: "scenario_started",
        at: state.sickDayActivatedAt,
        title: "Sick day in progress",
        subtitle: state.sickDaySeverity ? `Severity: ${state.sickDaySeverity}` : undefined,
        href: "/scenarios/sick-day",
      }),
    );
  }

  if (state.travelModeActive && state.travelStartDate) {
    events.push(
      event({
        id: "scenario-active-travel",
        kind: "scenario_started",
        at: state.travelStartDate,
        title: "Travel mode active",
        subtitle: state.travelDestination?.trim() || undefined,
        href: "/scenarios/travel",
      }),
    );
  }

  return events;
}

function mapSupplyEvent(row: SupplyEvent, supplyName: string): ActivityEvent {
  const kindLabel =
    row.kind === "refill"
      ? "Supply refilled"
      : row.kind === "ordered"
        ? "Supply ordered"
        : "Supply updated";
  return event({
    id: `supply-${row.id}`,
    kind: "supply_event",
    at: row.createdAt,
    title: kindLabel,
    subtitle: supplyName,
    href: "/supplies",
  });
}

function supplyNameForId(supplyId: string): string {
  return storage.getSupplies().find((s) => s.id === supplyId)?.name ?? "Supply";
}

function mapAdviserActivityLog(log: { id: string; activityType: string; activityDetails: string; createdAt: string }): ActivityEvent | null {
  const mealTypes = new Set(["meal_planning"]);
  if (!mealTypes.has(log.activityType)) return null;
  return event({
    id: `adviser-${log.id}`,
    kind: "adviser_session",
    at: log.createdAt,
    title: "Meal planning",
    subtitle: log.activityDetails?.trim() || undefined,
    href: "/adviser?tab=meal",
  });
}

/** Collect all activity events from local storage (newest first). */
export function collectAllActivityEvents(): ActivityEvent[] {
  const byId = new Map<string, ActivityEvent>();

  const add = (e: ActivityEvent) => {
    if (!parseActivityTimestamp(e.at)) return;
    byId.set(e.id, e);
  };

  for (const hypo of storage.getHypoTreatments()) {
    add(mapHypoTreatment(hypo));
  }

  for (const entry of storage.getScenarioHistory()) {
    for (const e of mapScenarioHistory(entry)) add(e);
  }

  for (const e of mapActiveScenario()) add(e);

  for (const log of storage.getBedtimeLogs()) {
    add(
      event({
        id: `bedtime-${log.id}`,
        kind: "bedtime_check",
        at: log.date,
        title: "Bedtime check",
        subtitle: `Readiness: ${log.readinessLevel}`,
        href: "/scenarios/bedtime",
      }),
    );
  }

  for (const outcome of storage.getExerciseOutcomes()) {
    add(
      event({
        id: `exercise-${outcome.id}`,
        kind: "exercise_session",
        at: outcome.completedAt,
        title: outcome.exerciseName?.trim() || "Exercise session",
        subtitle: `${outcome.durationMinutes} min · ${outcome.intensity}`,
        href: "/scenarios/exercise",
      }),
    );
  }

  for (const ratio of storage.getRatioHistory()) {
    const at = ratio.date.includes("T") ? ratio.date : `${ratio.date}T12:00:00`;
    add(
      event({
        id: `ratio-${ratio.id}`,
        kind: "ratio_snapshot",
        at,
        title: "Ratios updated",
        subtitle: ratio.note?.trim() || undefined,
        href: "/settings/ratios",
      }),
    );
  }

  for (const appt of storage.getAppointments()) {
    if (appt.deletedAt) continue;
    const mapped = mapAppointmentActivityEvent({
      id: `appt-${appt.id}`,
      title: appt.title,
      date: appt.date,
      time: appt.time,
      location: appt.location,
      isCompleted: appt.isCompleted,
    });
    if (mapped) add(mapped);
  }

  for (const row of listAllLocalSupplyEvents()) {
    if (!SUPPLY_EVENT_KINDS.includes(row.kind)) continue;
    add(mapSupplyEvent(row, supplyNameForId(row.supplyId)));
  }

  for (const pickup of storage.getPickupHistory()) {
    add(
      event({
        id: `pickup-${pickup.id}`,
        kind: "supply_pickup",
        at: pickup.pickupDate,
        title: "Supply pickup",
        subtitle: `${pickup.quantity}× ${pickup.supplyName}`,
        href: "/supplies",
      }),
    );
  }

  for (const log of storage.getActivityLogs()) {
    const mapped = mapAdviserActivityLog(log);
    if (mapped) add(mapped);
  }

  return [...byId.values()].sort((a, b) => {
    const ta = parseActivityTimestamp(a.at)?.getTime() ?? 0;
    const tb = parseActivityTimestamp(b.at)?.getTime() ?? 0;
    return tb - ta;
  });
}

export function getActivityEventsForRange(start: Date, end: Date): ActivityEvent[] {
  const startMs = startOfDay(start).getTime();
  const endMs = startOfDay(end).getTime() + 24 * 60 * 60 * 1000 - 1;
  return collectAllActivityEvents().filter((e) => {
    const t = parseActivityTimestamp(e.at)?.getTime();
    if (t == null) return false;
    return t >= startMs && t <= endMs;
  });
}

export function groupActivityEventsByDay(events: ActivityEvent[]): Map<string, ActivityEvent[]> {
  const map = new Map<string, ActivityEvent[]>();
  for (const e of events) {
    const key = toActivityDayKey(e.at);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(e);
    map.set(key, list);
  }
  for (const [, list] of map) {
    list.sort((a, b) => {
      const ta = parseActivityTimestamp(a.at)?.getTime() ?? 0;
      const tb = parseActivityTimestamp(b.at)?.getTime() ?? 0;
      return tb - ta;
    });
  }
  return map;
}

export function getActivityDayKeys(events: ActivityEvent[]): Set<string> {
  const keys = new Set<string>();
  for (const e of events) {
    const key = toActivityDayKey(e.at);
    if (key) keys.add(key);
  }
  return keys;
}

export const ACTIVITY_KIND_LABELS: Record<ActivityKind, string> = {
  hypo_treated: "Hypo",
  scenario_started: "Scenario",
  scenario_ended: "Scenario",
  bedtime_check: "Bedtime",
  exercise_session: "Exercise",
  ratio_snapshot: "Ratios",
  supply_event: "Supplies",
  supply_pickup: "Pickup",
  appointment: "Appointment",
  adviser_session: "Meal planner",
};

export const PRIMARY_ACTIVITY_KINDS: ActivityKind[] = [
  "hypo_treated",
  "scenario_started",
  "scenario_ended",
  "bedtime_check",
  "exercise_session",
];

const VALID_FILTERS = new Set<ActivityKind | "all">([
  "all",
  "hypo_treated",
  "scenario_started",
  "scenario_ended",
  "bedtime_check",
  "exercise_session",
  "ratio_snapshot",
  "supply_event",
  "supply_pickup",
  "appointment",
  "adviser_session",
  "appointment_past",
]);

export function loadStoredActivityFilter(): ActivityKind | "all" {
  try {
    const raw = sessionStorage.getItem(ACTIVITY_FILTER_STORAGE_KEY);
    if (raw === "appointment_past") return "appointment";
    if (raw && VALID_FILTERS.has(raw as ActivityKind | "all")) {
      return raw as ActivityKind | "all";
    }
  } catch {
    /* ignore */
  }
  return "all";
}

export function saveStoredActivityFilter(filter: ActivityKind | "all"): void {
  try {
    sessionStorage.setItem(ACTIVITY_FILTER_STORAGE_KEY, filter);
  } catch {
    /* ignore */
  }
}

export function filterActivityEvents(events: ActivityEvent[], kind: ActivityKind | "all"): ActivityEvent[] {
  if (kind === "all") return events;
  if (kind === "scenario_started") {
    return events.filter((e) => e.kind === "scenario_started" || e.kind === "scenario_ended");
  }
  if (kind === "supply_event") {
    return events.filter((e) => e.kind === "supply_event" || e.kind === "supply_pickup");
  }
  return events.filter((e) => e.kind === kind);
}

export type ActivityWeekSummary = {
  countLast7Days: number;
  busiestDayKey: string | null;
  busiestDayCount: number;
};

/** Count events in the last 7 calendar days and find the busiest day. */
export function getActivityWeekSummary(events: ActivityEvent[]): ActivityWeekSummary {
  const cutoff = startOfDay(subDays(new Date(), 6)).getTime();
  const recent = events.filter((e) => {
    const t = parseActivityTimestamp(e.at)?.getTime();
    return t != null && t >= cutoff;
  });

  const counts = new Map<string, number>();
  for (const e of recent) {
    const key = toActivityDayKey(e.at);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let busiestDayKey: string | null = null;
  let busiestDayCount = 0;
  for (const [key, count] of counts) {
    if (count > busiestDayCount) {
      busiestDayKey = key;
      busiestDayCount = count;
    }
  }

  return {
    countLast7Days: recent.length,
    busiestDayKey,
    busiestDayCount,
  };
}

function readScenarioState(row: Record<string, unknown>): Record<string, unknown> | null {
  const raw =
    (row.state && typeof row.state === "object" ? (row.state as Record<string, unknown>) : null) ??
    (row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : null) ??
    (row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : null);
  return raw;
}

function scenarioKeyOf(row: Record<string, unknown>): string | null {
  if (typeof row.scenario_key === "string" && row.scenario_key.trim()) return row.scenario_key.trim();
  if (typeof row.scenarioKey === "string" && row.scenarioKey.trim()) return row.scenarioKey.trim();
  return null;
}

function isoFromState(state: Record<string, unknown> | null, ...keys: string[]): string | null {
  if (!state) return null;
  for (const key of keys) {
    const v = state[key];
    if (typeof v === "string" && v.trim()) {
      const d = parseActivityTimestamp(v);
      if (d) return v;
    }
  }
  return null;
}

function sickDayActive(state: Record<string, unknown> | null): boolean {
  if (!state) return false;
  const endedIso = isoFromState(state, "ended_at", "deactivated_at");
  if (endedIso) {
    const endMs = parseActivityTimestamp(endedIso)?.getTime();
    if (endMs != null && endMs <= Date.now()) return false;
  }
  return state.sick_day_active === true || state.sickDayActive === true;
}

/** Cloud-backed activity for linked supporters (scoped). */
export function collectCarerActivityEvents(input: {
  hypoLogs?: CloudHypoLogRow[];
  scenarioRows?: Record<string, unknown>[];
  appointmentRows?: Record<string, unknown>[];
  scopes: CarerScopes;
}): ActivityEvent[] {
  const byId = new Map<string, ActivityEvent>();
  const add = (e: ActivityEvent) => {
    if (!parseActivityTimestamp(e.at)) return;
    byId.set(e.id, e);
  };

  if (input.scopes.hypo_alerts) {
    for (const h of input.hypoLogs ?? []) {
      const bg =
        h.blood_glucose != null && !Number.isNaN(h.blood_glucose)
          ? `${Math.round(h.blood_glucose * 10) / 10}`
          : undefined;
      const subtitle = [h.treatment, bg].filter(Boolean).join(" · ") || undefined;
      add({
        id: `carer-hypo-${h.id}`,
        kind: "hypo_treated",
        at: h.created_at,
        title: "Hypo logged",
        subtitle,
        source: "cloud",
      });
    }
  }

  if (input.scopes.scenarios) {
    for (const row of input.scenarioRows ?? []) {
      const key = scenarioKeyOf(row);
      const state = readScenarioState(row);
      if (!key || !state) continue;

      if (key === "sick_day") {
        const startedAt = isoFromState(state, "started_at", "activated_at", "sick_day_activated_at");
        const endedAt = isoFromState(state, "ended_at", "deactivated_at");
        const severity = typeof state.severity === "string" ? state.severity.trim() : null;
        const detail = severity ? `Severity: ${severity}` : undefined;
        if (startedAt) {
          add({
            id: `carer-sick-start-${row.id ?? startedAt}`,
            kind: sickDayActive(state) ? "scenario_started" : "scenario_started",
            at: startedAt,
            title: sickDayActive(state) ? "Sick day in progress" : "Sick day started",
            subtitle: detail,
            source: "cloud",
          });
        }
        if (endedAt) {
          add({
            id: `carer-sick-end-${row.id ?? endedAt}`,
            kind: "scenario_ended",
            at: endedAt,
            title: "Sick day ended",
            subtitle: detail,
            source: "cloud",
          });
        }
        continue;
      }

      if (key === "travel") {
        const active = state.travel_active === true || state.travelActive === true;
        const start =
          isoFromState(state, "travel_start", "started_at", "activated_at") ??
          (typeof state.travel_start === "string" ? state.travel_start : null);
        const endedAt = isoFromState(state, "ended_at", "deactivated_at");
        const dest =
          typeof state.destination === "string" && state.destination.trim()
            ? state.destination.trim()
            : undefined;
        if (start) {
          add({
            id: `carer-travel-start-${row.id ?? start}`,
            kind: "scenario_started",
            at: start,
            title: active ? "Travel mode active" : "Travel started",
            subtitle: dest,
            source: "cloud",
          });
        }
        if (endedAt) {
          add({
            id: `carer-travel-end-${row.id ?? endedAt}`,
            kind: "scenario_ended",
            at: endedAt,
            title: "Travel ended",
            subtitle: dest,
            source: "cloud",
          });
        }
        continue;
      }

      if (key === "bedtime") {
        const checkedAt = isoFromState(state, "checked_at");
        if (checkedAt) {
          const ready = state.bedtime_ready === true;
          add({
            id: `carer-bedtime-${row.id ?? checkedAt}`,
            kind: "bedtime_check",
            at: checkedAt,
            title: "Bedtime check",
            subtitle: ready ? "Readiness: steady" : "Readiness: needs attention",
            source: "cloud",
          });
        }
      }
    }
  }

  if (input.scopes.appointments) {
    for (const row of input.appointmentRows ?? []) {
      const date = typeof row.date === "string" ? row.date : null;
      if (!date) continue;
      const title = typeof row.title === "string" && row.title.trim() ? row.title.trim() : "Appointment";
      const mapped = mapAppointmentActivityEvent({
        id: `carer-appt-${row.id}`,
        title,
        date,
        time: typeof row.time === "string" ? row.time : undefined,
        location: typeof row.location === "string" ? row.location : undefined,
        isCompleted: row.is_completed === true,
        source: "cloud",
      });
      if (mapped) add(mapped);
    }
  }

  return [...byId.values()].sort((a, b) => {
    const ta = parseActivityTimestamp(a.at)?.getTime() ?? 0;
    const tb = parseActivityTimestamp(b.at)?.getTime() ?? 0;
    return tb - ta;
  });
}
