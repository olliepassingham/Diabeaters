import type { HypoTreatment } from "@/lib/storage";

export const KNOWN_HYPO_TREATMENT_TYPE_IDS = [
  "glucose_tablets",
  "juice",
  "gel",
  "sugary_drink",
  "sweets",
  "other",
  "from_trends",
  "quick_log",
] as const;

export type KnownHypoTreatmentTypeId = (typeof KNOWN_HYPO_TREATMENT_TYPE_IDS)[number];
export type HypoTreatmentTypeId = KnownHypoTreatmentTypeId | `custom:${string}`;

export type ClassifiedHypoTreatment = {
  id: HypoTreatmentTypeId;
  label: string;
};

export type HypoTreatmentTypeCount = ClassifiedHypoTreatment & { count: number };

export type HypoHistoryMonth = {
  key: string;
  year: number;
  monthIndex: number;
  count: number;
  overnightCount: number;
  types: HypoTreatmentTypeCount[];
  entries: HypoTreatment[];
};

const KNOWN_LABELS: Record<KnownHypoTreatmentTypeId, string> = {
  glucose_tablets: "Glucose tablets",
  juice: "Juice",
  gel: "Gel",
  sugary_drink: "Sugary drink",
  sweets: "Sweets",
  other: "Other",
  from_trends: "From trends",
  quick_log: "Quick log",
};

const TRENDS_NOTES = /logged from glucose trends/i;

export function hypoTreatmentTypeLabel(id: HypoTreatmentTypeId, fallbackLabel?: string): string {
  if (id.startsWith("custom:")) return fallbackLabel?.trim() || titleCase(id.slice(7));
  return KNOWN_LABELS[id as KnownHypoTreatmentTypeId] ?? (fallbackLabel?.trim() || "Other");
}

export function classifyHypoTreatment(
  entry: Pick<HypoTreatment, "treatment" | "notes">,
): ClassifiedHypoTreatment {
  const notes = entry.notes?.trim() ?? "";
  if (TRENDS_NOTES.test(notes)) {
    return { id: "from_trends", label: KNOWN_LABELS.from_trends };
  }

  const raw = entry.treatment?.trim() ?? "";
  if (!raw) {
    return { id: "quick_log", label: KNOWN_LABELS.quick_log };
  }

  const known = matchKnownTreatment(raw);
  if (known) return { id: known, label: KNOWN_LABELS[known] };

  const customKey = raw.toLowerCase().replace(/\s+/g, " ");
  return { id: `custom:${customKey}`, label: raw };
}

export function isOvernightHypo(timestamp: string): boolean {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return false;
  const hour = date.getHours();
  return hour >= 22 || hour < 7;
}

export function hypoMonthKey(timestamp: string): string | null {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  return monthKeyFromParts(date.getFullYear(), date.getMonth());
}

export function currentHypoMonthKey(now: Date = new Date()): string {
  return monthKeyFromParts(now.getFullYear(), now.getMonth());
}

export function previousHypoMonthKey(monthKey: string): string {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return monthKey;
  const d = new Date(parsed.year, parsed.monthIndex - 1, 1);
  return monthKeyFromParts(d.getFullYear(), d.getMonth());
}

export function parseMonthKey(key: string): { year: number; monthIndex: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11) return null;
  return { year, monthIndex };
}

export function buildHypoHistoryMonths(
  entries: HypoTreatment[],
  now: Date = new Date(),
): HypoHistoryMonth[] {
  const byMonth = new Map<string, HypoTreatment[]>();
  for (const entry of sortNewestFirst(entries)) {
    const key = hypoMonthKey(entry.timestamp);
    if (!key) continue;
    const list = byMonth.get(key);
    if (list) list.push(entry);
    else byMonth.set(key, [entry]);
  }

  const currentKey = currentHypoMonthKey(now);
  if (!byMonth.has(currentKey) && byMonth.size > 0) {
    byMonth.set(currentKey, []);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([key, monthEntries]) => {
      const parsed = parseMonthKey(key)!;
      const types = countTypes(monthEntries);
      return {
        key,
        year: parsed.year,
        monthIndex: parsed.monthIndex,
        count: monthEntries.length,
        overnightCount: monthEntries.filter((row) => isOvernightHypo(row.timestamp)).length,
        types,
        entries: monthEntries,
      };
    });
}

export function countTypes(entries: HypoTreatment[]): HypoTreatmentTypeCount[] {
  const map = new Map<HypoTreatmentTypeId, HypoTreatmentTypeCount>();
  for (const entry of entries) {
    const classified = classifyHypoTreatment(entry);
    const existing = map.get(classified.id);
    if (existing) existing.count += 1;
    else map.set(classified.id, { ...classified, count: 1 });
  }
  return [...map.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label);
  });
}

export function groupHypoEntriesByDay(entries: HypoTreatment[]): { dayKey: string; entries: HypoTreatment[] }[] {
  const map = new Map<string, HypoTreatment[]>();
  for (const entry of sortNewestFirst(entries)) {
    const date = new Date(entry.timestamp);
    if (!Number.isFinite(date.getTime())) continue;
    const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const list = map.get(dayKey);
    if (list) list.push(entry);
    else map.set(dayKey, [entry]);
  }
  return [...map.entries()].map(([dayKey, dayEntries]) => ({ dayKey, entries: dayEntries }));
}

export function cgmTrendsDurationMinutes(notes: string | undefined): number | null {
  if (!notes || !TRENDS_NOTES.test(notes)) return null;
  const match = /~(\d+)\s*min/i.exec(notes);
  if (!match) return null;
  const minutes = Number(match[1]);
  return Number.isFinite(minutes) ? minutes : null;
}

function matchKnownTreatment(raw: string): KnownHypoTreatmentTypeId | null {
  const s = raw.toLowerCase();
  if (/glucose\s*tab|dextrose\s*tab/.test(s)) return "glucose_tablets";
  if (/glucose\s*gel|\bgel(s| tube)?\b/.test(s)) return "gel";
  if (/jelly\s*bab|\bsweets?\b|\bcandy\b/.test(s)) return "sweets";
  if (/sugary\s*drink|lucozade|\bcoke\b|lemonade/.test(s)) return "sugary_drink";
  if (/\bjuice\b/.test(s)) return "juice";
  if (/^other\b/.test(s)) return "other";
  return null;
}

function monthKeyFromParts(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function sortNewestFirst(rows: HypoTreatment[]): HypoTreatment[] {
  return [...rows].sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (ch) => ch.toUpperCase());
}
