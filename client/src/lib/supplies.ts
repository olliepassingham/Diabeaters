import type { AuthError, PostgrestError } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type Supply = {
  id: string;
  user_id: string;
  name: string;
  quantity: number;
  updated_at: string;
};

type SuppliesError = AuthError | PostgrestError | Error;

type SuppliesResult<T> = {
  data: T | null;
  error: SuppliesError | null;
};

async function getCurrentUserId(): Promise<SuppliesResult<string>> {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return { data: null, error };
  }

  const userId = data?.user?.id;
  if (!userId) {
    return { data: null, error: new Error("Not authenticated") };
  }

  return { data: userId, error: null };
}

/**
 * List supplies for a given user. If userId is omitted,
 * falls back to the current authenticated user.
 */
export async function listSuppliesForUser(
  userId?: string,
): Promise<SuppliesResult<Supply[]>> {
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

  return { data: (data as Supply[] | null) ?? null, error };
}

/**
 * Add a new supply for the current authenticated user.
 * user_id is attached from supabase.auth.getUser().
 */
export async function addSupply(args: {
  name: string;
  quantity: number;
}): Promise<SuppliesResult<Supply>> {
  const { data: userId, error: userError } = await getCurrentUserId();
  if (userError || !userId) {
    return { data: null, error: userError ?? new Error("Not authenticated") };
  }

  const { name, quantity } = args;

  const { data, error } = await supabase
    .from("supplies")
    .insert({
      user_id: userId,
      name,
      quantity,
    })
    .select("*")
    .single();

  return { data: (data as Supply | null) ?? null, error };
}

/**
 * Update an existing supply by id. RLS ensures only the
 * owning user (auth.uid()) can modify the row.
 */
export async function updateSupply(
  id: string,
  fields: Partial<{ name: string; quantity: number }>,
): Promise<SuppliesResult<Supply>> {
  if (!id) {
    return { data: null, error: new Error("Supply id is required") };
  }

  if (Object.keys(fields).length === 0) {
    return { data: null, error: new Error("No fields to update") };
  }

  const { data, error } = await supabase
    .from("supplies")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();

  return { data: (data as Supply | null) ?? null, error };
}

/**
 * Delete a supply by id. RLS ensures only the owner can delete.
 */
export async function deleteSupply(
  id: string,
): Promise<SuppliesResult<Supply>> {
  if (!id) {
    return { data: null, error: new Error("Supply id is required") };
  }

  const { data, error } = await supabase
    .from("supplies")
    .delete()
    .eq("id", id)
    .select("*")
    .single();

  return { data: (data as Supply | null) ?? null, error };
}

