/** Rapid insulin action used for the glucose-chart estimate. Not a pump insulin-on-board reading. */
export const RAPID_ACTION_HOURS = 4;

const STORAGE_KEY = "diabeater_insulin_activity_v1";
const HISTORY_STORAGE_KEY = "diabeater_insulin_dose_history_v1";
const VISIBLE_KEY = "diabeater_insulin_chart_visible";

/**
 * Patterns analysis needs more than the graph's live window: dose history is
 * kept for 30 days so the Patterns page can look at dose timing against
 * glucose and hypo logs. The chart-facing store keeps its own short prune
 * below; history is append-only from `record*` and seeded from the live
 * store on first read so recent graph doses carry across.
 */
export const INSULIN_DOSE_HISTORY_DAYS = 30;
const RAPID_HISTORY_CAP = 400;
const LONG_ACTING_HISTORY_CAP = 120;
export const INSULIN_ACTIVITY_CHANGED_EVENT = "diabeater-insulin-activity-changed";

export type RapidInsulinDose = {
  id: string;
  takenAtIso: string;
  units: number;
  label?: string;
};

export type LongActingDose = {
  id: string;
  takenAtIso: string;
  units: number;
};

type InsulinActivityStore = {
  rapid: RapidInsulinDose[];
  longActing: LongActingDose[];
};

export type InsulinActivitySample = { timeMs: number; units: number };

export type LongActingChartMark = {
  id: string;
  timeMs: number;
  label: string;
  tone: "taken" | "due";
};

function notify() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(INSULIN_ACTIVITY_CHANGED_EVENT));
}

function readStore(): InsulinActivityStore {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<InsulinActivityStore>;
    const rapid = Array.isArray(parsed.rapid) ? parsed.rapid.filter(isRapidDose) : [];
    const longActing = Array.isArray(parsed.longActing) ? parsed.longActing.filter(isLongDose) : [];
    return { rapid, longActing };
  } catch {
    return { rapid: [], longActing: [] };
  }
}

function isRapidDose(value: unknown): value is RapidInsulinDose {
  if (!value || typeof value !== "object") return false;
  const dose = value as RapidInsulinDose;
  return typeof dose.id === "string" && typeof dose.takenAtIso === "string" && Number.isFinite(dose.units) && dose.units > 0;
}

function isLongDose(value: unknown): value is LongActingDose {
  if (!value || typeof value !== "object") return false;
  const dose = value as LongActingDose;
  return typeof dose.id === "string" && typeof dose.takenAtIso === "string" && Number.isFinite(dose.units) && dose.units > 0;
}

function readDoseHistory(): InsulinActivityStore {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) ?? "{}") as Partial<InsulinActivityStore>;
    const rapid = Array.isArray(parsed.rapid) ? parsed.rapid.filter(isRapidDose) : [];
    const longActing = Array.isArray(parsed.longActing) ? parsed.longActing.filter(isLongDose) : [];
    if (rapid.length > 0 || longActing.length > 0) return { rapid, longActing };
  } catch {
    /* fall through to seeding */
  }
  // First read: seed from the live chart store so doses already on the graph
  // start the history off.
  return readStore();
}

function appendDoseHistory(kind: "rapid" | "longActing", dose: RapidInsulinDose | LongActingDose) {
  try {
    const cutoff = Date.now() - INSULIN_DOSE_HISTORY_DAYS * 24 * 60 * 60 * 1000;
    const within = (iso: string) => {
      const time = new Date(iso).getTime();
      return Number.isFinite(time) && time >= cutoff;
    };
    const history = readDoseHistory();
    const next: InsulinActivityStore = {
      rapid: history.rapid.filter((d) => within(d.takenAtIso)),
      longActing: history.longActing.filter((d) => within(d.takenAtIso)),
    };
    if (kind === "rapid") {
      const rapidDose = dose as RapidInsulinDose;
      if (!next.rapid.some((d) => d.id === rapidDose.id)) next.rapid.push(rapidDose);
      next.rapid = next.rapid.slice(-RAPID_HISTORY_CAP);
    } else {
      const longDose = dose as LongActingDose;
      if (!next.longActing.some((d) => d.id === longDose.id)) next.longActing.push(longDose);
      next.longActing = next.longActing.slice(-LONG_ACTING_HISTORY_CAP);
    }
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* history is best-effort — the live chart store already saved the dose */
  }
}

function writeDoseHistory(store: InsulinActivityStore) {
  try {
    const cutoff = Date.now() - INSULIN_DOSE_HISTORY_DAYS * 24 * 60 * 60 * 1000;
    const within = (iso: string) => {
      const time = new Date(iso).getTime();
      return Number.isFinite(time) && time >= cutoff;
    };
    localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify({
        rapid: store.rapid.filter((d) => within(d.takenAtIso)).slice(-RAPID_HISTORY_CAP),
        longActing: store.longActing.filter((d) => within(d.takenAtIso)).slice(-LONG_ACTING_HISTORY_CAP),
      }),
    );
  } catch {
    /* history is best-effort */
  }
}

export type InsulinDoseKind = "rapid" | "longActing";

/**
 * Correct a dose the user logged earlier (wrong units or time). Updates the
 * live chart store and the 30-day Patterns history together so the two never
 * disagree. Returns false when the dose no longer exists.
 */
export function updateInsulinDose(
  kind: InsulinDoseKind,
  id: string,
  patch: { units: number; takenAtIso: string },
): boolean {
  if (!Number.isFinite(patch.units) || patch.units <= 0 || patch.units > 80) return false;
  const timeMs = new Date(patch.takenAtIso).getTime();
  if (!Number.isFinite(timeMs)) return false;
  const units = Math.round(patch.units * 10) / 10;
  const takenAtIso = new Date(timeMs).toISOString();

  const store = readStore();
  const inStore =
    kind === "rapid" ? store.rapid.some((d) => d.id === id) : store.longActing.some((d) => d.id === id);
  const apply = <T extends { id: string; units: number; takenAtIso: string }>(list: T[]): T[] =>
    list.map((d) => (d.id === id ? { ...d, units, takenAtIso } : d));
  writeStore({
    rapid: kind === "rapid" ? apply(store.rapid) : store.rapid,
    longActing: kind === "longActing" ? apply(store.longActing) : store.longActing,
  });

  const history = readDoseHistory();
  const inHistory =
    kind === "rapid" ? history.rapid.some((d) => d.id === id) : history.longActing.some((d) => d.id === id);
  if (inHistory) {
    writeDoseHistory({
      rapid: kind === "rapid" ? apply(history.rapid) : history.rapid,
      longActing: kind === "longActing" ? apply(history.longActing) : history.longActing,
    });
  }
  return inStore || inHistory;
}

/** Remove a dose entirely — from the chart and from Patterns history. */
export function deleteInsulinDose(kind: InsulinDoseKind, id: string): boolean {
  const store = readStore();
  const inStore =
    kind === "rapid" ? store.rapid.some((d) => d.id === id) : store.longActing.some((d) => d.id === id);
  writeStore({
    rapid: kind === "rapid" ? store.rapid.filter((d) => d.id !== id) : store.rapid,
    longActing: kind === "longActing" ? store.longActing.filter((d) => d.id !== id) : store.longActing,
  });

  const history = readDoseHistory();
  const inHistory =
    kind === "rapid" ? history.rapid.some((d) => d.id === id) : history.longActing.some((d) => d.id === id);
  if (inHistory) {
    writeDoseHistory({
      rapid: kind === "rapid" ? history.rapid.filter((d) => d.id !== id) : history.rapid,
      longActing: kind === "longActing" ? history.longActing.filter((d) => d.id !== id) : history.longActing,
    });
  }
  return inStore || inHistory;
}

function historyWithin<T extends { takenAtIso: string }>(doses: T[], withinDays: number, nowMs: number): T[] {
  const cutoff = nowMs - withinDays * 24 * 60 * 60 * 1000;
  return doses
    .filter((dose) => {
      const time = new Date(dose.takenAtIso).getTime();
      return Number.isFinite(time) && time >= cutoff && time <= nowMs;
    })
    .sort((a, b) => new Date(a.takenAtIso).getTime() - new Date(b.takenAtIso).getTime());
}

/** Rapid doses from the 30-day dose history, oldest first. */
export function getRapidInsulinDoseHistory(withinDays = INSULIN_DOSE_HISTORY_DAYS, nowMs = Date.now()): RapidInsulinDose[] {
  return historyWithin(readDoseHistory().rapid, withinDays, nowMs);
}

/** Long-acting doses from the 30-day dose history, oldest first. */
export function getLongActingDoseHistory(withinDays = INSULIN_DOSE_HISTORY_DAYS, nowMs = Date.now()): LongActingDose[] {
  return historyWithin(readDoseHistory().longActing, withinDays, nowMs);
}

function writeStore(store: InsulinActivityStore) {
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const keep = (iso: string) => {
    const time = new Date(iso).getTime();
    return Number.isFinite(time) && time >= cutoff;
  };
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      rapid: store.rapid.filter((dose) => keep(dose.takenAtIso)).slice(0, 40),
      longActing: store.longActing.filter((dose) => keep(dose.takenAtIso)).slice(0, 14),
    }),
  );
  notify();
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `insulin-${Date.now()}`;
}

export function getRapidInsulinDoses(): RapidInsulinDose[] {
  return readStore().rapid;
}

export function getLongActingDoses(): LongActingDose[] {
  return readStore().longActing;
}

export function hasConfirmedInsulin(): boolean {
  const store = readStore();
  return store.rapid.length > 0 || store.longActing.length > 0;
}

export function recordRapidInsulinDose(input: { units: number; takenAtIso?: string; label?: string }): RapidInsulinDose | null {
  if (!Number.isFinite(input.units) || input.units <= 0 || input.units > 80) return null;
  const dose: RapidInsulinDose = {
    id: newId(),
    takenAtIso: input.takenAtIso ?? new Date().toISOString(),
    units: Math.round(input.units * 10) / 10,
    label: input.label?.trim() || undefined,
  };
  const store = readStore();
  writeStore({ ...store, rapid: [dose, ...store.rapid] });
  appendDoseHistory("rapid", dose);
  return dose;
}

export function recordLongActingDose(input: { units: number; takenAtIso?: string }): LongActingDose | null {
  if (!Number.isFinite(input.units) || input.units <= 0 || input.units > 80) return null;
  const dose: LongActingDose = {
    id: newId(),
    takenAtIso: input.takenAtIso ?? new Date().toISOString(),
    units: Math.round(input.units * 10) / 10,
  };
  const store = readStore();
  writeStore({ ...store, longActing: [dose, ...store.longActing] });
  appendDoseHistory("longActing", dose);
  return dose;
}

export function isInsulinChartVisible(): boolean {
  try {
    return localStorage.getItem(VISIBLE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setInsulinChartVisible(visible: boolean) {
  localStorage.setItem(VISIBLE_KEY, visible ? "1" : "0");
  notify();
}

/** Linear fade to zero across the rapid-action window. Doses add together. */
export function remainingRapidUnits(doses: RapidInsulinDose[], atMs: number): number {
  return doses.reduce((sum, dose) => {
    const start = new Date(dose.takenAtIso).getTime();
    if (!Number.isFinite(start)) return sum;
    const elapsedHours = (atMs - start) / 3_600_000;
    if (elapsedHours < 0 || elapsedHours >= RAPID_ACTION_HOURS) return sum;
    return sum + dose.units * (1 - elapsedHours / RAPID_ACTION_HOURS);
  }, 0);
}

export function rapidActivitySamples(
  doses: RapidInsulinDose[],
  startMs: number,
  endMs: number,
  stepMs = 15 * 60_000,
): InsulinActivitySample[] {
  if (endMs <= startMs) return [];
  const samples: InsulinActivitySample[] = [];
  for (let timeMs = startMs; timeMs <= endMs; timeMs += stepMs) {
    samples.push({ timeMs, units: remainingRapidUnits(doses, timeMs) });
  }
  const tail = samples[samples.length - 1];
  if (!tail || tail.timeMs < endMs) samples.push({ timeMs: endMs, units: remainingRapidUnits(doses, endMs) });
  return samples;
}

/** When the stacked rapid doses reach zero, if any are still working at `nowMs`. */
export function rapidRunsOutAt(doses: RapidInsulinDose[], nowMs: number): number | null {
  const active = doses
    .map((dose) => new Date(dose.takenAtIso).getTime())
    .filter((start) => Number.isFinite(start) && nowMs >= start && nowMs < start + RAPID_ACTION_HOURS * 3_600_000);
  if (active.length === 0) return null;
  return Math.max(...active) + RAPID_ACTION_HOURS * 3_600_000;
}

export function hoursSinceLatestRapidDose(doses: RapidInsulinDose[], nowMs: number): number | null {
  const times = doses
    .map((dose) => new Date(dose.takenAtIso).getTime())
    .filter((time) => Number.isFinite(time) && time <= nowMs);
  if (times.length === 0) return null;
  return (nowMs - Math.max(...times)) / 3_600_000;
}

export function rapidDoseWithinHours(doses: RapidInsulinDose[], hours: number, nowMs: number): boolean {
  const since = hoursSinceLatestRapidDose(doses, nowMs);
  return since != null && since <= hours;
}

function clockOnDay(day: Date, hhmm: string | undefined): number | null {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm.trim())) return null;
  const [hour, minute] = hhmm.trim().split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) return null;
  const next = new Date(day);
  next.setHours(hour, minute, 0, 0);
  return next.getTime();
}

export function longActingChartMarks(input: {
  doses: LongActingDose[];
  usualTimes: Array<string | undefined>;
  windowStartMs: number;
  windowEndMs: number;
}): LongActingChartMark[] {
  const marks: LongActingChartMark[] = [];
  for (const dose of input.doses) {
    const timeMs = new Date(dose.takenAtIso).getTime();
    if (!Number.isFinite(timeMs) || timeMs < input.windowStartMs || timeMs > input.windowEndMs) continue;
    marks.push({
      id: dose.id,
      timeMs,
      label: `Long-acting ${dose.units}u taken`,
      tone: "taken",
    });
  }

  const day = new Date(input.windowEndMs);
  for (const usual of input.usualTimes) {
    const timeMs = clockOnDay(day, usual);
    if (timeMs == null || timeMs < input.windowStartMs || timeMs > input.windowEndMs) continue;
    const already = input.doses.some((dose) => Math.abs(new Date(dose.takenAtIso).getTime() - timeMs) < 3 * 60 * 60 * 1000);
    if (already) continue;
    marks.push({
      id: `due-${usual}`,
      timeMs,
      label: timeMs <= Date.now() ? "Long-acting still due" : "Long-acting due",
      tone: "due",
    });
  }
  return marks.sort((a, b) => a.timeMs - b.timeMs);
}

export function usualLongActingUnits(unitsPerDay?: number, injectionsPerDay?: number): number | undefined {
  if (!unitsPerDay || unitsPerDay <= 0) return undefined;
  const doses = injectionsPerDay && injectionsPerDay > 0 ? injectionsPerDay : 1;
  return Math.round((unitsPerDay / doses) * 10) / 10;
}

export type RapidDoseChartMark = { id: string; timeMs: number; units: number };

export function buildHomeInsulinChart(nowMs = Date.now(), usualTimes: Array<string | undefined> = []) {
  if (!hasConfirmedInsulin() || !isInsulinChartVisible()) {
    return {
      visible: isInsulinChartVisible(),
      hasDoses: hasConfirmedInsulin(),
      series: [] as InsulinActivitySample[],
      marks: [] as LongActingChartMark[],
      doseMarks: [] as RapidDoseChartMark[],
      xDomain: null as { startMs: number; endMs: number } | null,
      remaining: 0,
      runsOutLabel: null as string | null,
    };
  }
  const rapid = getRapidInsulinDoses();
  const startMs = nowMs - 12 * 60 * 60 * 1000;
  const runsOut = rapidRunsOutAt(rapid, nowMs);
  const endMs = Math.max(nowMs, runsOut ?? nowMs);
  return {
    visible: true,
    hasDoses: true,
    series: rapidActivitySamples(rapid, startMs, endMs),
    doseMarks: rapid
      .map((dose) => ({ id: dose.id, timeMs: new Date(dose.takenAtIso).getTime(), units: dose.units }))
      .filter((mark) => Number.isFinite(mark.timeMs) && mark.timeMs >= startMs && mark.timeMs <= endMs),
    marks: longActingChartMarks({
      doses: getLongActingDoses(),
      usualTimes,
      windowStartMs: startMs,
      windowEndMs: endMs,
    }),
    xDomain: { startMs, endMs },
    remaining: remainingRapidUnits(rapid, nowMs),
    runsOutLabel: formatRunsOut(runsOut, nowMs),
  };
}

export function formatRunsOut(atMs: number | null, nowMs = Date.now()): string | null {
  if (atMs == null) return null;
  const time = new Date(atMs).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (atMs <= nowMs) return "Ran out";
  return `Runs out ${time}`;
}
