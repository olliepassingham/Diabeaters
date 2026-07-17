import type { CgmChartPoint } from "@/lib/cgm/cgm-chart";

export type DetectedHypoEpisode = {
  /** Stable id from nadir time — used for dismiss de-dupe. */
  id: string;
  startAt: string;
  endAt: string;
  nadirAt: string;
  nadirValue: number;
  readingCount: number;
  durationMinutes: number;
};

const DEFAULT_GAP_MS = 20 * 60_000;
/** Ignore single-point sensor blips. */
const MIN_READINGS = 2;
const MIN_DURATION_MS = 10 * 60_000;

/**
 * Cluster contiguous CGM points below `threshold` into possible hypo episodes.
 * Points must be in display units matching `threshold` (e.g. mmol/L profile units).
 */
export function detectHypoEpisodes(
  points: CgmChartPoint[],
  threshold: number,
  options?: { maxGapMs?: number; nowMs?: number },
): DetectedHypoEpisode[] {
  if (!Number.isFinite(threshold) || threshold <= 0 || points.length === 0) return [];

  const maxGapMs = options?.maxGapMs ?? DEFAULT_GAP_MS;
  const sorted = [...points].filter((p) => Number.isFinite(p.timeMs) && Number.isFinite(p.value)).sort((a, b) => a.timeMs - b.timeMs);

  const episodes: DetectedHypoEpisode[] = [];
  let cluster: CgmChartPoint[] = [];

  const flush = () => {
    if (cluster.length < MIN_READINGS) {
      cluster = [];
      return;
    }
    const startMs = cluster[0]!.timeMs;
    const endMs = cluster[cluster.length - 1]!.timeMs;
    const durationMs = endMs - startMs;
    if (durationMs < MIN_DURATION_MS && cluster.length < 3) {
      cluster = [];
      return;
    }
    let nadir = cluster[0]!;
    for (const p of cluster) {
      if (p.value < nadir.value) nadir = p;
    }
    episodes.push({
      id: `cgm-hypo-${nadir.timeMs}`,
      startAt: new Date(startMs).toISOString(),
      endAt: new Date(endMs).toISOString(),
      nadirAt: new Date(nadir.timeMs).toISOString(),
      nadirValue: nadir.value,
      readingCount: cluster.length,
      durationMinutes: Math.max(1, Math.round(durationMs / 60_000)),
    });
    cluster = [];
  };

  for (const point of sorted) {
    const isLow = point.value < threshold;
    if (!isLow) {
      flush();
      continue;
    }
    if (cluster.length === 0) {
      cluster = [point];
      continue;
    }
    const prev = cluster[cluster.length - 1]!;
    if (point.timeMs - prev.timeMs > maxGapMs) {
      flush();
      cluster = [point];
      continue;
    }
    cluster.push(point);
  }
  flush();

  return episodes.sort((a, b) => new Date(b.nadirAt).getTime() - new Date(a.nadirAt).getTime());
}

/**
 * True when an existing logged hypo falls inside (or near) this episode.
 * Uses the full episode window [start, end] plus a buffer so a treatment
 * logged before the CGM nadir still suppresses the confirm card.
 */
export function episodeMatchesLoggedHypo(
  episode: DetectedHypoEpisode,
  loggedTimestamps: string[],
  /** Extra time before start / after end counted as the same event. */
  bufferMs = 45 * 60_000,
): boolean {
  const startMs = new Date(episode.startAt).getTime();
  const endMs = new Date(episode.endAt).getTime();
  const nadirMs = new Date(episode.nadirAt).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return false;

  const windowStart = Math.min(startMs, Number.isFinite(nadirMs) ? nadirMs : startMs) - bufferMs;
  const windowEnd = Math.max(endMs, Number.isFinite(nadirMs) ? nadirMs : endMs) + bufferMs;

  for (const raw of loggedTimestamps) {
    const t = new Date(raw).getTime();
    if (!Number.isFinite(t)) continue;
    if (t >= windowStart && t <= windowEnd) return true;
  }
  return false;
}
