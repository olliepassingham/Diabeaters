import { enqueueSupplyEventAdd, isOnline, type OfflineQueueEntry } from "@/lib/offline";
import { getSupabase } from "@/lib/supabase";

export type SupplyEventKind =
  | "adjust"
  | "refill"
  | "ordered"
  | "clear_order"
  | "edit"
  | "delete";

export type SupplyEvent = {
  id: string;
  supplyId: string;
  kind: SupplyEventKind;
  delta: number | null;
  stockNow: number | null;
  createdAt: string;
  meta: Record<string, unknown>;
  cloud_id?: string;
};

const STORAGE_KEY = "diabeater_supply_events_v1";

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function generateId(): string {
  try {
    // Modern browsers
    return crypto.randomUUID();
  } catch {
    return `evt_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }
}

export function listLocalSupplyEvents(supplyId: string, limit = 10): SupplyEvent[] {
  const all = safeParse<Record<string, SupplyEvent[]>>(localStorage.getItem(STORAGE_KEY)) ?? {};
  const events = all[supplyId] ?? [];
  return events.slice(0, Math.max(0, limit));
}

/** Flat list of supply events across all items, newest first. */
export function listAllLocalSupplyEvents(limit = 500): SupplyEvent[] {
  const all = safeParse<Record<string, SupplyEvent[]>>(localStorage.getItem(STORAGE_KEY)) ?? {};
  const flat = Object.values(all).flat();
  return flat
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, Math.max(0, limit));
}

type InferredUsageResult = {
  usagePerDay: number | null;
  confidence: "low" | "medium" | "high";
  sampleDays: number;
};

export function inferDailyUsageFromLocalEvents(supplyId: string, days = 7): InferredUsageResult {
  const events = listLocalSupplyEvents(supplyId, 200);
  const now = Date.now();
  const windowMs = days * 24 * 60 * 60 * 1000;
  const recent = events.filter((e) => now - new Date(e.createdAt).getTime() <= windowMs);

  // Consumption signal: negative adjustments only (simple + robust).
  const negatives = recent
    .filter((e) => e.kind === "adjust" && typeof e.delta === "number" && e.delta < 0)
    .map((e) => Math.abs(e.delta as number));

  const totalConsumed = negatives.reduce((a, b) => a + b, 0);
  if (totalConsumed <= 0) return { usagePerDay: null, confidence: "low", sampleDays: days };

  const usagePerDay = totalConsumed / Math.max(1, days);

  // Confidence: requires at least 3 consumption signals and not wildly spiky.
  const signals = negatives.length;
  const avg = totalConsumed / Math.max(1, signals);
  const max = negatives.length ? Math.max(...negatives) : 0;
  const spiky = avg > 0 ? max / avg > 4 : true;

  let confidence: InferredUsageResult["confidence"] = "low";
  if (signals >= 3 && !spiky) confidence = "high";
  else if (signals >= 2) confidence = "medium";

  // Clamp to a sensible range to avoid one-offs dominating.
  const clamped = Math.max(0, Math.min(usagePerDay, 5000));
  return { usagePerDay: clamped, confidence, sampleDays: days };
}

export function addLocalSupplyEvent(event: Omit<SupplyEvent, "id"> & { id?: string }): SupplyEvent {
  const id = event.id ?? generateId();
  const entry: SupplyEvent = { ...event, id };
  const all = safeParse<Record<string, SupplyEvent[]>>(localStorage.getItem(STORAGE_KEY)) ?? {};
  const next = [entry, ...(all[entry.supplyId] ?? [])].slice(0, 50);
  all[entry.supplyId] = next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return entry;
}

export async function pushSupplyEventToCloud(event: SupplyEvent): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  if (!isOnline()) return;
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return;

  const cloudSupplyId =
    typeof event.meta?.cloudSupplyId === "string" && event.meta.cloudSupplyId.trim()
      ? event.meta.cloudSupplyId.trim()
      : null;

  await supabase.from("supply_events").insert({
    user_id: userId,
    supply_id: cloudSupplyId ?? event.supplyId,
    kind: event.kind,
    delta: event.delta,
    stock_now: event.stockNow,
    meta: event.meta ?? {},
    created_at: event.createdAt,
  });
}

export function enqueueSupplyEventForCloud(event: SupplyEvent): void {
  // Always enqueue; flushers can skip if not configured/online.
  enqueueSupplyEventAdd({
    kind: "supply_events:add",
    clientId: event.id,
    payload: {
      supply_id:
        typeof event.meta?.cloudSupplyId === "string" && event.meta.cloudSupplyId.trim()
          ? event.meta.cloudSupplyId.trim()
          : event.supplyId,
      kind: event.kind,
      delta: event.delta,
      stock_now: event.stockNow,
      meta: event.meta ?? {},
      created_at: event.createdAt,
    },
    clientTs: new Date().toISOString(),
  });
}

export async function flushSupplyEventsOfflineQueue(
  entries: OfflineQueueEntry[],
): Promise<{ flushed: number; failed: number }> {
  const supabase = getSupabase();
  if (!supabase) return { flushed: 0, failed: 0 };
  if (!isOnline()) return { flushed: 0, failed: 0 };

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return { flushed: 0, failed: 0 };

  let flushed = 0;
  let failed = 0;

  for (const entry of entries) {
    if (entry.kind !== "supply_events:add") continue;
    try {
      const p = entry.payload;
      const meta =
        p.meta && typeof p.meta === "object" ? (p.meta as Record<string, unknown>) : {};
      const cloudSupplyId =
        typeof meta.cloudSupplyId === "string" && meta.cloudSupplyId.trim()
          ? meta.cloudSupplyId.trim()
          : null;
      const { error } = await supabase.from("supply_events").insert({
        user_id: userId,
        supply_id: cloudSupplyId ?? p.supply_id,
        kind: p.kind,
        delta: p.delta,
        stock_now: p.stock_now,
        meta: p.meta ?? {},
        created_at: p.created_at,
      });
      if (error) throw new Error(String(error.message));
      flushed += 1;
    } catch {
      failed += 1;
      break;
    }
  }

  return { flushed, failed };
}

