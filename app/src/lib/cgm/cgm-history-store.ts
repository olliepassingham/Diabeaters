/**
 * Local-only rolling history of glucose readings, built up over time from
 * whatever the app already fetches (single-reading prefills and 24h live
 * history batches). No live CGM share API exposes more than a ~24h window,
 * so multi-day patterns (see `/tools/patterns`) depend on this device slowly
 * accumulating readings as the app is used — there is no bulk backfill.
 *
 * Stored local-only (this device), matching how CGM credentials already work
 * in `preferences.ts` — no server round-trip, no cross-device sync.
 */

const HISTORY_KEY = "diabeaters_cgm_local_history_v1";

/** How long we keep readings before pruning. */
export const CGM_HISTORY_RETENTION_DAYS = 14;

/** Hard cap on stored points regardless of retention window (safety bound). */
const MAX_STORED_POINTS = 4_500;

/** Merge window: readings within this many ms are treated as the same sample. */
const DEDUPE_WINDOW_MS = 60_000;

export type CgmHistoryPoint = {
  recordedAtMs: number;
  valueMgDl: number;
};

export type CgmHistoryReadingInput = {
  recordedAt: string;
  valueMgDl: number;
};

function readRaw(): CgmHistoryPoint[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is CgmHistoryPoint =>
        !!p &&
        typeof p === "object" &&
        Number.isFinite((p as CgmHistoryPoint).recordedAtMs) &&
        Number.isFinite((p as CgmHistoryPoint).valueMgDl) &&
        (p as CgmHistoryPoint).valueMgDl > 0,
    );
  } catch {
    return [];
  }
}

function writeRaw(points: CgmHistoryPoint[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(points));
  } catch {
    // Ignore quota errors — history is best-effort, never blocking.
  }
}

function retentionCutoffMs(now: number): number {
  return now - CGM_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
}

/** Merge, dedupe (nearest-minute), sort, prune to the retention window, and cap size. */
function mergeAndPrune(existing: CgmHistoryPoint[], incoming: CgmHistoryPoint[], now: number): CgmHistoryPoint[] {
  const cutoff = retentionCutoffMs(now);
  const merged = [...existing, ...incoming]
    .filter((p) => p.recordedAtMs > cutoff && p.recordedAtMs <= now + 60_000)
    .sort((a, b) => a.recordedAtMs - b.recordedAtMs);

  const deduped: CgmHistoryPoint[] = [];
  for (const point of merged) {
    const prev = deduped[deduped.length - 1];
    if (prev && point.recordedAtMs - prev.recordedAtMs < DEDUPE_WINDOW_MS) {
      // Keep the newer sample when two land within the same dedupe window.
      deduped[deduped.length - 1] = point;
      continue;
    }
    deduped.push(point);
  }

  if (deduped.length <= MAX_STORED_POINTS) return deduped;
  return deduped.slice(deduped.length - MAX_STORED_POINTS);
}

/**
 * Append one or more readings (already in mg/dL) to local history. Safe to
 * call frequently and with overlapping/duplicate data — merges, dedupes, and
 * prunes automatically. Never throws.
 */
export function appendCgmReadings(entries: CgmHistoryReadingInput[], now: number = Date.now()): void {
  if (entries.length === 0) return;
  const incoming = entries
    .map((e) => {
      const recordedAtMs = new Date(e.recordedAt).getTime();
      return { recordedAtMs, valueMgDl: e.valueMgDl };
    })
    .filter((p) => Number.isFinite(p.recordedAtMs) && Number.isFinite(p.valueMgDl) && p.valueMgDl > 0);
  if (incoming.length === 0) return;

  const existing = readRaw();
  writeRaw(mergeAndPrune(existing, incoming, now));
}

/** All stored points within the last `sinceDays` (default: full retention window), oldest first. */
export function getCgmLocalHistory(sinceDays: number = CGM_HISTORY_RETENTION_DAYS, now: number = Date.now()): CgmHistoryPoint[] {
  const cutoff = now - sinceDays * 24 * 60 * 60 * 1000;
  return readRaw()
    .filter((p) => p.recordedAtMs > cutoff)
    .sort((a, b) => a.recordedAtMs - b.recordedAtMs);
}

/** Number of distinct local-calendar days with at least one reading in the stored history. */
export function countCgmLocalHistoryDays(sinceDays: number = CGM_HISTORY_RETENTION_DAYS, now: number = Date.now()): number {
  const days = new Set<string>();
  for (const point of getCgmLocalHistory(sinceDays, now)) {
    const d = new Date(point.recordedAtMs);
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }
  return days.size;
}

/** Clear all locally stored glucose history (e.g. on request, or account switch on a shared device). */
export function clearCgmLocalHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // Ignore
  }
}
