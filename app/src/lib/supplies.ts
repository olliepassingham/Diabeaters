import type { AuthError, PostgrestError } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";
import { enqueue, flushQueue, getQueue, isOnline, type OfflineQueueEntry } from "./offline";

export type Supply = {
  id: string;
  user_id: string;
  name: string;
  quantity: number;
  updated_at: string;
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
 * Add a new supply for the current authenticated user.
 * user_id is attached from supabase.auth.getUser().
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
 * Update an existing supply by id. RLS ensures only the
 * owning user (auth.uid()) can modify the row.
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
 * Delete a supply by id. RLS ensures only the owner can delete.
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

export async function flushSuppliesOfflineQueue(): Promise<{
  flushed: number;
  skippedNewer: number;
  failed: number;
}> {
  const supabase = getSupabase();
  if (!supabase) return { flushed: 0, skippedNewer: 0, failed: 0 };
  if (!isOnline()) return { flushed: 0, skippedNewer: 0, failed: 0 };

  const result = await flushQueue(async (entry) => {
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
