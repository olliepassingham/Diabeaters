export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

const QUEUE_KEY = "offline_queue_v1";

export type OfflineSupplyOp =
  | {
      kind: "supplies:add";
      clientId: string;
      payload: { name: string; quantity: number };
      clientTs: string;
    }
  | {
      kind: "supplies:update";
      payload: { id: string; fields: Partial<{ name: string; quantity: number }> };
      baseUpdatedAt?: string | null;
      clientTs: string;
    }
  | {
      kind: "supplies:delete";
      payload: { id: string };
      baseUpdatedAt?: string | null;
      clientTs: string;
    };

export type OfflineQueueEntry = OfflineSupplyOp;

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function emitQueueChange(length: number) {
  try {
    window.dispatchEvent(
      new CustomEvent("diabeater:offline-queue-changed", { detail: { length } }),
    );
  } catch {
    // Ignore
  }
}

export function getQueue(): OfflineQueueEntry[] {
  if (typeof localStorage === "undefined") return [];
  const parsed = safeParse<OfflineQueueEntry[]>(localStorage.getItem(QUEUE_KEY));
  return Array.isArray(parsed) ? parsed : [];
}

export function setQueue(entries: OfflineQueueEntry[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(QUEUE_KEY, JSON.stringify(entries));
  emitQueueChange(entries.length);
}

export function getQueueLength(): number {
  return getQueue().length;
}

export function enqueue(entry: OfflineQueueEntry): void {
  const next = [...getQueue(), entry];
  setQueue(next);
}

export type FlushResult =
  | { status: "ok" }
  | { status: "skipped_newer" }
  | { status: "failed"; error: Error };

export async function flushQueue(
  flushFn: (entry: OfflineQueueEntry) => Promise<FlushResult>,
): Promise<{ flushed: number; skippedNewer: number; failed: number }> {
  const queue = getQueue();
  if (queue.length === 0) return { flushed: 0, skippedNewer: 0, failed: 0 };

  let flushed = 0;
  let skippedNewer = 0;
  let failed = 0;

  const remaining: OfflineQueueEntry[] = [];

  for (const entry of queue) {
    try {
      const res = await flushFn(entry);
      if (res.status === "ok") {
        flushed += 1;
        continue;
      }
      if (res.status === "skipped_newer") {
        skippedNewer += 1;
        continue;
      }
      failed += 1;
      remaining.push(entry);
      // Preserve order: stop flushing after first hard failure.
      break;
    } catch (e) {
      failed += 1;
      remaining.push(entry);
      break;
    }
  }

  // Keep unprocessed tail
  if (failed > 0) {
    const firstFailedIdx = queue.findIndex((q) => q === remaining[0]);
    const tail = firstFailedIdx >= 0 ? queue.slice(firstFailedIdx) : remaining;
    setQueue(tail);
  } else {
    setQueue([]);
  }

  return { flushed, skippedNewer, failed };
}

