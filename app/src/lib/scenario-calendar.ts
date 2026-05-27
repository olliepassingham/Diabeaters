import { eachDayOfInterval, format, isValid, parseISO, startOfDay } from "date-fns";

import { storage, type ScenarioHistoryEntry } from "@/lib/storage";

/** Scenario modes shown as coloured ranges on the activity calendar. */
export type ScenarioCalendarMode = "sick_day" | "travel" | "alcohol" | "pump_failure";

export type ScenarioCalendarDayMap = Map<string, Set<ScenarioCalendarMode>>;

export type ScenarioCalendarStyle = {
  label: string;
  /** Inset tile behind the day number on the calendar. */
  boxClass: string;
  /** Bottom accent bar on scenario days. */
  barClass: string;
  /** Swatch in the legend. */
  legendClass: string;
  /** Selected-day chip above the activity list. */
  chipClass: string;
};

export const SCENARIO_CALENDAR_STYLES: Record<ScenarioCalendarMode, ScenarioCalendarStyle> = {
  sick_day: {
    label: "Sick day",
    boxClass: "rounded-lg bg-orange-500/[0.09] dark:bg-orange-400/[0.12]",
    barClass: "bg-orange-500/55 dark:bg-orange-400/50",
    legendClass: "bg-orange-500/70 dark:bg-orange-400/65",
    chipClass: "border-border/50",
  },
  travel: {
    label: "Travel",
    boxClass: "rounded-lg bg-purple-500/[0.09] dark:bg-purple-400/[0.12]",
    barClass: "bg-purple-500/55 dark:bg-purple-400/50",
    legendClass: "bg-purple-500/70 dark:bg-purple-400/65",
    chipClass: "border-border/50",
  },
  alcohol: {
    label: "Alcohol",
    boxClass: "rounded-lg bg-rose-500/[0.09] dark:bg-rose-400/[0.12]",
    barClass: "bg-rose-500/55 dark:bg-rose-400/50",
    legendClass: "bg-rose-500/70 dark:bg-rose-400/65",
    chipClass: "border-border/50",
  },
  pump_failure: {
    label: "Pump failure",
    boxClass: "rounded-lg bg-red-500/[0.09] dark:bg-red-400/[0.12]",
    barClass: "bg-red-500/55 dark:bg-red-400/50",
    legendClass: "bg-red-500/70 dark:bg-red-400/65",
    chipClass: "border-border/50",
  },
};

const MULTI_SCENARIO_BOX_CLASS = "rounded-lg bg-muted/30 dark:bg-muted/20";

/** Soft background tint for a calendar day with active scenario(s). */
export function getScenarioDayBoxClass(modes: ScenarioCalendarMode[]): string | undefined {
  if (modes.length === 0) return undefined;
  if (modes.length > 1) return MULTI_SCENARIO_BOX_CLASS;
  return SCENARIO_CALENDAR_STYLES[modes[0]!]!.boxClass;
}

/** Parse yyyy-MM-dd or ISO timestamp to local start-of-day. */
export function parseScenarioBoundary(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? parseISO(`${trimmed}T12:00:00`)
    : parseISO(trimmed);
  if (!isValid(d)) return null;
  return startOfDay(d);
}

/** Inclusive range; `allowFutureEnd` keeps planned trip end dates beyond today. */
export function enumerateScenarioDayKeysForRange(
  start: string,
  end: string | null | undefined,
  options?: { allowFutureEnd?: boolean },
): string[] {
  const startDay = parseScenarioBoundary(start);
  if (!startDay) return [];

  const today = startOfDay(new Date());
  let endDay = end ? parseScenarioBoundary(end) : today;
  if (!endDay) endDay = today;

  if (!options?.allowFutureEnd && endDay > today) {
    endDay = today;
  }

  if (endDay < startDay) return [];

  return eachDayOfInterval({ start: startDay, end: endDay }).map((d) => format(d, "yyyy-MM-dd"));
}

function addDaysToMap(map: ScenarioCalendarDayMap, mode: ScenarioCalendarMode, dayKeys: string[]) {
  for (const key of dayKeys) {
    let set = map.get(key);
    if (!set) {
      set = new Set();
      map.set(key, set);
    }
    set.add(mode);
  }
}

function addHistoryEntry(map: ScenarioCalendarDayMap, entry: ScenarioHistoryEntry) {
  const mode: ScenarioCalendarMode = entry.type === "sick_day" ? "sick_day" : "travel";
  const days = enumerateScenarioDayKeysForRange(entry.startDate, entry.endDate, {
    allowFutureEnd: false,
  });
  addDaysToMap(map, mode, days);
}

function addActiveScenarios(map: ScenarioCalendarDayMap) {
  const state = storage.getScenarioState();
  const today = format(new Date(), "yyyy-MM-dd");

  if (state.sickDayActive && state.sickDayActivatedAt) {
    addDaysToMap(
      map,
      "sick_day",
      enumerateScenarioDayKeysForRange(state.sickDayActivatedAt, today, { allowFutureEnd: false }),
    );
  }

  if (state.travelModeActive && state.travelStartDate) {
    addDaysToMap(
      map,
      "travel",
      enumerateScenarioDayKeysForRange(state.travelStartDate, state.travelEndDate ?? today, {
        allowFutureEnd: true,
      }),
    );
  }

  if (state.alcoholModeActive && state.alcoholActivatedAt) {
    addDaysToMap(
      map,
      "alcohol",
      enumerateScenarioDayKeysForRange(state.alcoholActivatedAt, today, { allowFutureEnd: false }),
    );
  }

  if (state.pumpFailureActive && state.pumpFailureActivatedAt) {
    addDaysToMap(
      map,
      "pump_failure",
      enumerateScenarioDayKeysForRange(state.pumpFailureActivatedAt, today, { allowFutureEnd: false }),
    );
  }
}

/** Local patient data: past episodes + currently active scenario modes by calendar day. */
export function collectScenarioCalendarDays(): ScenarioCalendarDayMap {
  const map: ScenarioCalendarDayMap = new Map();

  for (const entry of storage.getScenarioHistory()) {
    addHistoryEntry(map, entry);
  }

  addActiveScenarios(map);

  return map;
}

function readCloudScenarioState(row: Record<string, unknown>): Record<string, unknown> | null {
  const raw =
    (row.state && typeof row.state === "object" ? (row.state as Record<string, unknown>) : null) ??
    (row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : null) ??
    (row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : null);
  return raw;
}

function cloudScenarioKey(row: Record<string, unknown>): string | null {
  if (typeof row.scenario_key === "string" && row.scenario_key.trim()) return row.scenario_key.trim();
  if (typeof row.scenarioKey === "string" && row.scenarioKey.trim()) return row.scenarioKey.trim();
  return null;
}

function cloudIso(state: Record<string, unknown> | null, ...keys: string[]): string | null {
  if (!state) return null;
  for (const key of keys) {
    const v = state[key];
    if (typeof v === "string" && v.trim()) {
      const d = parseScenarioBoundary(v);
      if (d) return v.trim();
    }
  }
  return null;
}

function cloudSickDayActive(state: Record<string, unknown> | null): boolean {
  if (!state) return false;
  const ended = cloudIso(state, "ended_at", "deactivated_at");
  if (ended) {
    const endDay = parseScenarioBoundary(ended);
    if (endDay && endDay.getTime() <= startOfDay(new Date()).getTime()) return false;
  }
  return state.sick_day_active === true || state.sickDayActive === true;
}

/** Supporter view: sick day and travel ranges from synced scenario rows. */
export function collectCarerScenarioCalendarDays(rows: Record<string, unknown>[]): ScenarioCalendarDayMap {
  const map: ScenarioCalendarDayMap = new Map();
  const today = format(new Date(), "yyyy-MM-dd");

  for (const row of rows) {
    const key = cloudScenarioKey(row);
    const state = readCloudScenarioState(row);
    if (!key || !state) continue;

    if (key === "sick_day") {
      const startedAt = cloudIso(state, "started_at", "activated_at", "sick_day_activated_at");
      if (!startedAt) continue;
      const endedAt = cloudIso(state, "ended_at", "deactivated_at");
      const end = cloudSickDayActive(state) ? today : endedAt;
      addDaysToMap(
        map,
        "sick_day",
        enumerateScenarioDayKeysForRange(startedAt, end, { allowFutureEnd: false }),
      );
      continue;
    }

    if (key === "travel") {
      const active = state.travel_active === true || state.travelActive === true;
      const start =
        cloudIso(state, "travel_start", "started_at", "activated_at") ??
        (typeof state.travel_start === "string" ? state.travel_start : null);
      if (!start) continue;
      const endedAt = cloudIso(state, "ended_at", "deactivated_at", "travel_end");
      const tripEnd =
        typeof state.travel_end === "string" && state.travel_end.trim() ? state.travel_end.trim() : endedAt;
      const end = active ? (tripEnd ?? today) : endedAt ?? tripEnd;
      addDaysToMap(
        map,
        "travel",
        enumerateScenarioDayKeysForRange(start, end, { allowFutureEnd: active }),
      );
    }
  }

  return map;
}

export function scenarioModesOnDay(map: ScenarioCalendarDayMap, dayKey: string): ScenarioCalendarMode[] {
  const modes = map.get(dayKey);
  if (!modes?.size) return [];
  const order: ScenarioCalendarMode[] = ["sick_day", "travel", "alcohol", "pump_failure"];
  return order.filter((m) => modes.has(m));
}

export function formatScenarioModesLabel(modes: ScenarioCalendarMode[]): string {
  return modes.map((m) => SCENARIO_CALENDAR_STYLES[m].label).join(", ");
}

export type ScenarioCalendarModifiers = {
  scenarioSickDay: Date[];
  scenarioTravel: Date[];
  scenarioAlcohol: Date[];
  scenarioPumpFailure: Date[];
  scenarioMultiple: Date[];
};

export function buildScenarioCalendarModifiers(map: ScenarioCalendarDayMap): ScenarioCalendarModifiers {
  const modifiers: ScenarioCalendarModifiers = {
    scenarioSickDay: [],
    scenarioTravel: [],
    scenarioAlcohol: [],
    scenarioPumpFailure: [],
    scenarioMultiple: [],
  };

  for (const [key, modes] of map) {
    const date = parseISO(`${key}T12:00:00`);
    if (!isValid(date)) continue;

    if (modes.size > 1) {
      modifiers.scenarioMultiple.push(date);
      continue;
    }

    if (modes.has("sick_day")) modifiers.scenarioSickDay.push(date);
    if (modes.has("travel")) modifiers.scenarioTravel.push(date);
    if (modes.has("alcohol")) modifiers.scenarioAlcohol.push(date);
    if (modes.has("pump_failure")) modifiers.scenarioPumpFailure.push(date);
  }

  return modifiers;
}

/** Modes that appear on at least one day in the visible month. */
export function scenarioModesInMonth(
  map: ScenarioCalendarDayMap,
  monthStart: Date,
  monthEnd: Date,
): ScenarioCalendarMode[] {
  const found = new Set<ScenarioCalendarMode>();
  const startKey = format(monthStart, "yyyy-MM-dd");
  const endKey = format(monthEnd, "yyyy-MM-dd");

  for (const [key, modes] of map) {
    if (key < startKey || key > endKey) continue;
    for (const m of modes) found.add(m);
  }

  const order: ScenarioCalendarMode[] = ["sick_day", "travel", "alcohol", "pump_failure"];
  return order.filter((m) => found.has(m));
}
