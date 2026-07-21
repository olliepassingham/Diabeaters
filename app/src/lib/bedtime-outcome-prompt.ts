import { computeBedtimeSleepWindow } from "@/lib/bedtime-overnight-window";
import type { BedtimeLog } from "@/lib/storage";

const DISMISSED_IDS_KEY = "diabeater_bedtime_outcome_dismissed_ids";
/** Don't ask about nights this stale — the moment has passed and it just feels like nagging. */
const MAX_STALENESS_MS = 48 * 60 * 60 * 1000;
const MAX_DISMISSED_IDS = 90;

function readDismissedIds(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function isBedtimeOutcomePromptDismissed(logId: string): boolean {
  return readDismissedIds().includes(logId);
}

export function dismissBedtimeOutcomePrompt(logId: string): void {
  try {
    const ids = readDismissedIds();
    if (ids.includes(logId)) return;
    ids.push(logId);
    const trimmed = ids.slice(-MAX_DISMISSED_IDS);
    localStorage.setItem(DISMISSED_IDS_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}

/**
 * Most recent bedtime log that is ready for a "how did last night go?" follow-up:
 * its estimated sleep window has ended, it doesn't already have an outcome, it isn't too stale,
 * and the user hasn't dismissed the prompt for that specific night.
 */
export function findLogNeedingOutcome(logs: BedtimeLog[], nowMs: number = Date.now()): BedtimeLog | null {
  const sorted = [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  for (const log of sorted) {
    if (log.outcome) continue;
    if (isBedtimeOutcomePromptDismissed(log.id)) continue;
    const window = computeBedtimeSleepWindow(log);
    if (!window) continue;
    if (window.endMs > nowMs) continue;
    if (nowMs - window.endMs > MAX_STALENESS_MS) continue;
    return log;
  }
  return null;
}
