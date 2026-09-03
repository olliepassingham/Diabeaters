import type { AuthError, PostgrestError } from "@supabase/supabase-js";
import { getSupplyIncrement, getSupplySyncTimestamp, storage, type Supply as LocalSupply } from "./storage";
import { getSupabase } from "./supabase";
import {
  enqueue,
  enqueueLocalSupplyDelete,
  enqueueLocalSupplySync,
  flushQueue,
  getQueue,
  isOnline,
  type LocalSupplySyncPayload,
  type OfflineQueueEntry,
} from "./offline";
import { flushSupplyEventsOfflineQueue } from "./supply-events";

/** Row shape for `public.supplies` (cloud). */
export type Supply = {
  id: string;
  user_id: string;
  name: string;
  quantity: number;
  updated_at: string;
  unit?: string | null;
  category?: string | null;
  notes?: string | null;
  _pending?: boolean;
};

type SuppliesError = AuthError | PostgrestError | Error;

type SuppliesResult<T> = {
  data: T | null;
  error: SuppliesError | null;
  meta?: {
    fromCache?: boolean;
    queued?: boolean;
  };
};

const NOT_CONFIGURED = new Error(
  "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env",
);

const CACHE_KEY = "supplies_cache_v1";

function emitSupplySyncToast(kind: "queued" | "retry"): void {
  try {
    window.dispatchEvent(new CustomEvent("diabeater:supply-sync-toast", { detail: { kind } }));
  } catch {
    // Ignore
  }
}

function isRlsOrAuthError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  if (e.code === "PGRST301") return true;
  const m = (e.message || "").toLowerCase();
  return m.includes("jwt") || m.includes("permission") || m.includes("row-level security");
}

function readCache(): Supply[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { supplies?: Supply[] };
    if (!parsed || !Array.isArray(parsed.supplies)) return null;
    return parsed.supplies;
  } catch {
    return null;
  }
}

function writeCache(supplies: Supply[]) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ fetchedAt: new Date().toISOString(), supplies }),
    );
  } catch {
    // Ignore
  }
}

function applyQueueToSupplies(supplies: Supply[], queue: OfflineQueueEntry[]): Supply[] {
  let next = [...supplies];
  for (const entry of queue) {
    if (entry.kind === "supplies:add") {
      const pending: Supply = {
        id: entry.clientId,
        user_id: "offline",
        name: entry.payload.name,
        quantity: entry.payload.quantity,
        updated_at: entry.clientTs,
        _pending: true,
      };
      next = [pending, ...next.filter((s) => s.id !== pending.id)];
    }
    if (entry.kind === "supplies:update") {
      next = next.map((s) =>
        s.id === entry.payload.id
          ? {
              ...s,
              ...entry.payload.fields,
              updated_at: entry.clientTs,
              _pending: true,
            }
          : s,
      );
    }
    if (entry.kind === "supplies:delete") {
      next = next.filter((s) => s.id !== entry.payload.id);
    }
  }
  return next;
}

async function getCurrentUserId(): Promise<SuppliesResult<string>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) return { data: null, error };
    const userId = data?.user?.id;
    if (!userId) return { data: null, error: new Error("Not authenticated") };
    return { data: userId, error: null };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}

/**
 * List supplies for a given user. If userId is omitted,
 * falls back to the current authenticated user.
 */
export async function listSuppliesForUser(
  userId?: string,
): Promise<SuppliesResult<Supply[]>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  try {
    const cached = readCache();
    const queue = getQueue();
    const effectiveCached = cached ? applyQueueToSupplies(cached, queue) : null;

    if (!isOnline()) {
      return {
        data: effectiveCached ?? [],
        error: null,
        meta: { fromCache: true },
      };
    }

    let effectiveUserId = userId;
    if (!effectiveUserId) {
      const { data: uid, error } = await getCurrentUserId();
      if (error || !uid) {
        return { data: null, error: error ?? new Error("Not authenticated") };
      }
      effectiveUserId = uid;
    }
    const { data, error } = await supabase
      .from("supplies")
      .select("*")
      .eq("user_id", effectiveUserId)
      .order("updated_at", { ascending: false });
    if (error) {
      return {
        data: effectiveCached ?? null,
        error,
        meta: effectiveCached ? { fromCache: true } : undefined,
      };
    }
    const serverSupplies = ((data as Supply[] | null) ?? []) as Supply[];
    writeCache(serverSupplies);
    return { data: serverSupplies, error: null };
  } catch (e) {
    const cached = readCache();
    const queue = getQueue();
    const effectiveCached = cached ? applyQueueToSupplies(cached, queue) : null;
    return {
      data: effectiveCached,
      error: effectiveCached
        ? null
        : e instanceof Error
          ? e
          : new Error(String(e)),
      meta: effectiveCached ? { fromCache: true } : undefined,
    };
  }
}

/** Map a local tracker row to a cloud payload (quantity = current stock). */
export function localSupplyToSyncPayload(local: LocalSupply, cloudId: string | null): LocalSupplySyncPayload {
  const unitLabel = getSupplyIncrement(local.type).label;
  return {
    cloudId,
    name: local.name,
    quantity: Math.max(0, Math.round(local.currentQuantity)),
    unit: unitLabel,
    category: local.type,
    notes: local.notes ?? null,
    updated_at: getSupplySyncTimestamp(local),
  };
}

/**
 * Upsert a local Supply Tracker row to `public.supplies`.
 * No-ops when there is no Supabase session. Offline: enqueues with per-local dedupe.
 */
export async function syncToCloud(local: LocalSupply): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return;

  const cloudId = local.cloud_id ?? null;
  const payload = localSupplyToSyncPayload({ ...local, cloud_id: cloudId }, cloudId);
  const clientTs = payload.updated_at;

  if (!isOnline()) {
    enqueueLocalSupplySync({
      kind: "supplies:local-sync",
      localId: local.id,
      payload,
      clientTs,
    });
    emitSupplySyncToast("queued");
    return;
  }

  try {
    if (cloudId) {
      const row = {
        name: payload.name,
        quantity: payload.quantity,
        unit: payload.unit,
        category: payload.category,
        notes: payload.notes,
        updated_at: clientTs,
      };
      const { data, error } = await supabase
        .from("supplies")
        .update(row)
        .eq("id", cloudId)
        .eq("user_id", userId)
        .select("id, updated_at")
        .single();

      if (error) {
        if (isRlsOrAuthError(error)) {
          emitSupplySyncToast("retry");
          return;
        }
        emitSupplySyncToast("retry");
        return;
      }

      storage.updateSupply(local.id, {
        updated_at: (data?.updated_at as string) || clientTs,
      });
      const nextLocal = storage.getSupplies().find((s) => s.id === local.id);
      if (nextLocal) void writeSupplyForecastToCloud(nextLocal);
    } else {
      const insertRow = {
        user_id: userId,
        name: payload.name,
        quantity: payload.quantity,
        unit: payload.unit,
        category: payload.category,
        notes: payload.notes,
        updated_at: clientTs,
      };
      const { data, error } = await supabase.from("supplies").insert(insertRow).select("id, updated_at").single();

      if (error) {
        if (isRlsOrAuthError(error)) {
          emitSupplySyncToast("retry");
          return;
        }
        emitSupplySyncToast("retry");
        return;
      }

      storage.updateSupply(local.id, {
        cloud_id: data.id as string,
        updated_at: (data.updated_at as string) || clientTs,
      });
    }
  } catch {
    emitSupplySyncToast("retry");
  }
}

/**
 * Delete the linked cloud row when the local row is removed. Ignores errors.
 */
export async function deleteFromCloud(
  local: Pick<LocalSupply, "cloud_id" | "id">,
): Promise<void> {
  const cloudId = local.cloud_id ?? null;
  if (!cloudId) return;

  if (!isOnline()) {
    enqueueLocalSupplyDelete({
      kind: "supplies:local-delete",
      localId: local.id,
      cloudId,
      clientTs: new Date().toISOString(),
    });
    emitSupplySyncToast("queued");
    return;
  }

  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase.from("supplies").delete().eq("id", cloudId);
  } catch {
    // Ignore
  }
}

type CloudSupplyRow = {
  id: string;
  name: string;
  quantity: number;
  updated_at: string;
  unit?: string | null;
  category?: string | null;
  notes?: string | null;
  days_remaining_cached?: number | null;
  supply_forecast_at?: string | null;
};

/**
 * Writes client-computed days-until-empty to `public.supplies` for `notify_supply_low_cron`
 * when the app is not running. Best-effort; ignores failures.
 */
export async function writeSupplyForecastToCloud(local: LocalSupply): Promise<void> {
  const cloudId = local.cloud_id;
  if (!cloudId) return;
  if (!isOnline()) return;
  const supabase = getSupabase();
  if (!supabase) return;
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return;
  const days = storage.getDaysRemaining(local);
  if (!Number.isFinite(days)) return;
  try {
    await supabase
      .from("supplies")
      .update({
        days_remaining_cached: Math.round(days),
        supply_forecast_at: new Date().toISOString(),
      })
      .eq("id", cloudId)
      .eq("user_id", userId);
  } catch {
    /* ignore */
  }
}

/** Compare ISO timestamps; ties favour local to avoid churn. */
export function compareUpdatedAtForSync(
  localIso: string,
  cloudIso: string,
): "local" | "cloud" | "tie" {
  const a = new Date(localIso).getTime();
  const b = new Date(cloudIso).getTime();
  if (a > b) return "local";
  if (b > a) return "cloud";
  return "tie";
}

/** @internal Vitest — single pair LWW used during reconciliation. */
export function reconcilePairWinnerForTest(
  local: { updated_at?: string; lastPickupDate?: string },
  cloud: { updated_at: string },
): "local" | "cloud" {
  const d = compareUpdatedAtForSync(getSupplySyncTimestamp(local), cloud.updated_at);
  return d === "cloud" ? "cloud" : "local";
}

function namesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

const CLOUD_CATEGORY_TYPES: readonly LocalSupply["type"][] = [
  "needle",
  "insulin",
  "insulin_short",
  "insulin_long",
  "insulin_vial",
  "cgm",
  "infusion_set",
  "reservoir",
  "other",
] as const;

function categoryToLocalType(raw: string | null | undefined): LocalSupply["type"] {
  if (raw && (CLOUD_CATEGORY_TYPES as readonly string[]).includes(raw)) {
    return raw as LocalSupply["type"];
  }
  return "other";
}

function cloudRowToLocalUpdates(row: CloudSupplyRow): Partial<LocalSupply> {
  return {
    name: row.name,
    type: categoryToLocalType(row.category),
    currentQuantity: Math.max(0, Math.round(Number(row.quantity))),
    quantityAtPickup: Math.max(0, Math.round(Number(row.quantity))),
    notes: row.notes ?? undefined,
    updated_at: row.updated_at,
    cloud_id: row.id,
  };
}

/**
 * Fetch cloud rows and merge with the local tracker (last-write-wins on `updated_at`).
 * No-ops when offline or unauthenticated.
 */
export async function reconcileSupplies(): Promise<void> {
  if (!isOnline()) return;

  const supabase = getSupabase();
  if (!supabase) return;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return;

  const { data, error } = await supabase.from("supplies").select("*").eq("user_id", userId);

  if (error || !data) return;

  const cloudRows = data as CloudSupplyRow[];

  let locals = storage.getSupplies();
  const cloudById = new Map(cloudRows.map((r) => [r.id, r]));
  const matchedCloudIds = new Set<string>();

  for (const local of [...locals]) {
    if (!local.cloud_id) continue;
    const c = cloudById.get(local.cloud_id);
    if (!c) {
      storage.updateSupply(local.id, { cloud_id: null });
      continue;
    }
    matchedCloudIds.add(c.id);
    const decision = compareUpdatedAtForSync(getSupplySyncTimestamp(local), c.updated_at);
    if (decision === "local" || decision === "tie") {
      await syncToCloud({ ...local, cloud_id: c.id });
    } else {
      storage.updateSupply(local.id, cloudRowToLocalUpdates(c));
    }
  }

  locals = storage.getSupplies();
  const unmatchedCloud = cloudRows.filter((r) => !matchedCloudIds.has(r.id));

  for (const local of locals.filter((l) => !l.cloud_id)) {
    const idx = unmatchedCloud.findIndex((c) => {
      if (!namesMatch(c.name, local.name)) return false;
      // Match when category is missing/legacy, or equals local type.
      if (!c.category) return true;
      return (c.category || "") === (local.type || "");
    });
    if (idx === -1) continue;
    const c = unmatchedCloud[idx];
    unmatchedCloud.splice(idx, 1);
    matchedCloudIds.add(c.id);

    const decision = compareUpdatedAtForSync(getSupplySyncTimestamp(local), c.updated_at);
    if (decision === "local" || decision === "tie") {
      storage.updateSupply(local.id, { cloud_id: c.id });
      await syncToCloud({ ...local, cloud_id: c.id });
    } else {
      storage.updateSupply(local.id, cloudRowToLocalUpdates(c));
    }
  }

  for (const c of unmatchedCloud) {
    if (matchedCloudIds.has(c.id)) continue;
    matchedCloudIds.add(c.id);
    storage.importSupplyFromCloudReconcile(c);
  }

  // Push locals that still have no cloud row (supporters only see public.supplies).
  for (const local of storage.getSupplies()) {
    if (!local.cloud_id) {
      await syncToCloud(local);
    }
  }

  for (const l of storage.getSupplies()) {
    if (l.cloud_id) void writeSupplyForecastToCloud(l);
  }
}

async function addSupplyOnline(args: { name: string; quantity: number }): Promise<SuppliesResult<Supply>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  try {
    const { data: userId, error: userError } = await getCurrentUserId();
    if (userError || !userId) {
      return { data: null, error: userError ?? new Error("Not authenticated") };
    }
    const { name, quantity } = args;
    const { data, error } = await supabase
      .from("supplies")
      .insert({ user_id: userId, name, quantity })
      .select("*")
      .single();
    return { data: (data as Supply | null) ?? null, error };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}

/**
 * @deprecated Legacy dashboard direct-add; prefer local tracker + {@link syncToCloud}.
 */
export async function addSupply(args: {
  name: string;
  quantity: number;
}): Promise<SuppliesResult<Supply>> {
  if (!isOnline()) {
    const clientId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `offline-${crypto.randomUUID()}`
        : `offline-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    enqueue({
      kind: "supplies:add",
      clientId,
      payload: { name: args.name, quantity: args.quantity },
      clientTs: new Date().toISOString(),
    });

    const cached = readCache() ?? [];
    const pending: Supply = {
      id: clientId,
      user_id: "offline",
      name: args.name,
      quantity: args.quantity,
      updated_at: new Date().toISOString(),
      _pending: true,
    };
    writeCache([pending, ...cached.filter((s) => s.id !== clientId)]);

    return { data: pending, error: null, meta: { queued: true, fromCache: true } };
  }

  const res = await addSupplyOnline(args);
  if (res.data && !res.error) {
    const cached = readCache() ?? [];
    writeCache([res.data, ...cached.filter((s) => s.id !== res.data!.id)]);
  }
  return res;
}

async function updateSupplyOnline(
  id: string,
  fields: Partial<{ name: string; quantity: number }>,
): Promise<SuppliesResult<Supply>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };
  if (!id) return { data: null, error: new Error("Supply id is required") };
  if (Object.keys(fields).length === 0) {
    return { data: null, error: new Error("No fields to update") };
  }

  try {
    const { data, error } = await supabase
      .from("supplies")
      .update(fields)
      .eq("id", id)
      .select("*")
      .single();
    return { data: (data as Supply | null) ?? null, error };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}

/**
 * @deprecated Legacy direct cloud update.
 */
export async function updateSupply(
  id: string,
  fields: Partial<{ name: string; quantity: number }>,
): Promise<SuppliesResult<Supply>> {
  if (!isOnline()) {
    const cached = readCache() ?? [];
    const baseUpdatedAt = cached.find((s) => s.id === id)?.updated_at ?? null;
    const clientTs = new Date().toISOString();
    enqueue({
      kind: "supplies:update",
      payload: { id, fields },
      baseUpdatedAt,
      clientTs,
    });
    const next = cached.map((s) =>
      s.id === id ? { ...s, ...fields, updated_at: clientTs, _pending: true } : s,
    );
    writeCache(next);
    return { data: next.find((s) => s.id === id) ?? null, error: null, meta: { queued: true, fromCache: true } };
  }

  const res = await updateSupplyOnline(id, fields);
  if (res.data && !res.error) {
    const cached = readCache() ?? [];
    writeCache([res.data, ...cached.filter((s) => s.id !== res.data!.id)]);
  }
  return res;
}

async function deleteSupplyOnline(id: string): Promise<SuppliesResult<Supply>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };
  if (!id) return { data: null, error: new Error("Supply id is required") };

  try {
    const { data, error } = await supabase
      .from("supplies")
      .delete()
      .eq("id", id)
      .select("*")
      .single();
    return { data: (data as Supply | null) ?? null, error };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}

/**
 * @deprecated Legacy direct cloud delete.
 */
export async function deleteSupply(
  id: string,
): Promise<SuppliesResult<Supply>> {
  if (!isOnline()) {
    const cached = readCache() ?? [];
    const baseUpdatedAt = cached.find((s) => s.id === id)?.updated_at ?? null;
    enqueue({
      kind: "supplies:delete",
      payload: { id },
      baseUpdatedAt,
      clientTs: new Date().toISOString(),
    });
    writeCache(cached.filter((s) => s.id !== id));
    return { data: null, error: null, meta: { queued: true, fromCache: true } };
  }

  const res = await deleteSupplyOnline(id);
  if (!res.error) {
    const cached = readCache() ?? [];
    writeCache(cached.filter((s) => s.id !== id));
  }
  return res;
}

async function flushLocalSyncEntry(
  entry: Extract<OfflineQueueEntry, { kind: "supplies:local-sync" }>,
): Promise<{ status: "ok" } | { status: "failed"; error: Error }> {
  const supabase = getSupabase();
  if (!supabase) return { status: "failed", error: NOT_CONFIGURED };

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return { status: "failed", error: new Error("Not authenticated") };

  const p = entry.payload;

  try {
    if (p.cloudId) {
      const { error } = await supabase
        .from("supplies")
        .update({
          name: p.name,
          quantity: p.quantity,
          unit: p.unit,
          category: p.category,
          notes: p.notes,
          updated_at: p.updated_at,
        })
        .eq("id", p.cloudId)
        .eq("user_id", userId);

      if (error) {
        if (isRlsOrAuthError(error)) return { status: "failed", error: new Error(String(error.message)) };
        return { status: "failed", error: new Error(String(error.message)) };
      }
      storage.updateSupply(entry.localId, { updated_at: p.updated_at });
    } else {
      const { data, error } = await supabase
        .from("supplies")
        .insert({
          user_id: userId,
          name: p.name,
          quantity: p.quantity,
          unit: p.unit,
          category: p.category,
          notes: p.notes,
          updated_at: p.updated_at,
        })
        .select("id, updated_at")
        .single();

      if (error) {
        if (isRlsOrAuthError(error)) return { status: "failed", error: new Error(String(error.message)) };
        return { status: "failed", error: new Error(String(error.message)) };
      }
      storage.updateSupply(entry.localId, {
        cloud_id: data.id as string,
        updated_at: (data.updated_at as string) || p.updated_at,
      });
    }
    return { status: "ok" };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e : new Error(String(e)) };
  }
}

async function flushLocalDeleteEntry(
  entry: Extract<OfflineQueueEntry, { kind: "supplies:local-delete" }>,
): Promise<{ status: "ok" } | { status: "failed"; error: Error }> {
  if (!entry.cloudId) return { status: "ok" };
  const supabase = getSupabase();
  if (!supabase) return { status: "failed", error: NOT_CONFIGURED };
  try {
    await supabase.from("supplies").delete().eq("id", entry.cloudId);
  } catch {
    // Ignore — same as deleteFromCloud online
  }
  return { status: "ok" };
}

export async function flushSuppliesOfflineQueue(): Promise<{
  flushed: number;
  skippedNewer: number;
  failed: number;
}> {
  const supabase = getSupabase();
  if (!supabase) return { flushed: 0, skippedNewer: 0, failed: 0 };
  if (!isOnline()) return { flushed: 0, skippedNewer: 0, failed: 0 };

  const result = await flushQueue(async (entry) => {
    if (entry.kind === "supply_events:add") {
      const res = await flushSupplyEventsOfflineQueue([entry]);
      if (res.failed > 0) return { status: "failed", error: new Error("Supply event flush failed") };
      return { status: "ok" };
    }

    if (entry.kind === "supplies:local-sync") {
      const res = await flushLocalSyncEntry(entry);
      if (res.status === "failed") return { status: "failed", error: res.error };
      return { status: "ok" };
    }

    if (entry.kind === "supplies:local-delete") {
      const res = await flushLocalDeleteEntry(entry);
      if (res.status === "failed") return { status: "failed", error: res.error };
      return { status: "ok" };
    }

    if (entry.kind === "supplies:add") {
      const res = await addSupplyOnline(entry.payload);
      if (res.error || !res.data) return { status: "failed", error: res.error ?? new Error("Add failed") };

      const cached = readCache() ?? [];
      const replaced = cached.map((s) => (s.id === entry.clientId ? res.data! : s));
      writeCache([res.data, ...replaced.filter((s) => s.id !== res.data!.id)]);
      return { status: "ok" };
    }

    if (entry.kind === "supplies:update") {
      if (entry.baseUpdatedAt) {
        const { data: existing } = await supabase
          .from("supplies")
          .select("updated_at")
          .eq("id", entry.payload.id)
          .single();
        const serverUpdatedAt = existing?.updated_at as string | undefined;
        if (serverUpdatedAt && new Date(serverUpdatedAt).getTime() > new Date(entry.baseUpdatedAt).getTime()) {
          return { status: "skipped_newer" };
        }
      }
      const res = await updateSupplyOnline(entry.payload.id, entry.payload.fields);
      if (res.error || !res.data) return { status: "failed", error: res.error ?? new Error("Update failed") };
      const cached = readCache() ?? [];
      writeCache([res.data, ...cached.filter((s) => s.id !== res.data!.id)]);
      return { status: "ok" };
    }

    if (entry.kind === "supplies:delete") {
      if (entry.baseUpdatedAt) {
        const { data: existing } = await supabase
          .from("supplies")
          .select("updated_at")
          .eq("id", entry.payload.id)
          .single();
        const serverUpdatedAt = existing?.updated_at as string | undefined;
        if (serverUpdatedAt && new Date(serverUpdatedAt).getTime() > new Date(entry.baseUpdatedAt).getTime()) {
          return { status: "skipped_newer" };
        }
      }
      const res = await deleteSupplyOnline(entry.payload.id);
      if (res.error) return { status: "failed", error: res.error };
      const cached = readCache() ?? [];
      writeCache(cached.filter((s) => s.id !== entry.payload.id));
      return { status: "ok" };
    }

    return { status: "ok" };
  });

  return result;
}
