/**
 * CRUD for `public.carers` — single source of truth for hypo alert targets.
 */
import { getSupabase } from "./supabase";
import type { CarerRow } from "./carer-notify-types";

const NOT_CONFIGURED = new Error("Supabase is not configured.");

function mapCarer(row: Record<string, unknown>): CarerRow {
  const method = row.contact_method === "inapp" ? "inapp" : "push";
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    carer_name: String(row.carer_name ?? ""),
    relationship: row.relationship == null ? null : String(row.relationship),
    contact_method: method,
    contact_value: String(row.contact_value ?? ""),
    receive_hypo_alerts: Boolean(row.receive_hypo_alerts),
    created_at: String(row.created_at),
  };
}

export async function listPatientCarers(): Promise<{ data: CarerRow[] | null; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { data: null, error: new Error("Not signed in") };

  const { data, error } = await supabase
    .from("carers")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: new Error(error.message) };
  return { data: (data ?? []).map((r) => mapCarer(r as Record<string, unknown>)), error: null };
}

/** Carers that would be considered by the Edge Function (alerts on + would be listed). */
export async function countCarersEligibleForHypoAlerts(): Promise<number> {
  const { data, error } = await listPatientCarers();
  if (error || !data) return 0;
  return data.filter((c) => c.receive_hypo_alerts).length;
}

export async function insertCarer(input: {
  carer_name: string;
  relationship?: string;
  contact_method: "push" | "inapp";
  contact_value: string;
  receive_hypo_alerts?: boolean;
}): Promise<{ data: CarerRow | null; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { data: null, error: new Error("Not signed in") };

  const { data, error } = await supabase
    .from("carers")
    .insert({
      user_id: uid,
      carer_name: input.carer_name.trim(),
      relationship: input.relationship?.trim() || null,
      contact_method: input.contact_method,
      contact_value: input.contact_value.trim(),
      receive_hypo_alerts: input.receive_hypo_alerts !== false,
    })
    .select("*")
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  return { data: mapCarer(data as Record<string, unknown>), error: null };
}

export async function updateCarer(
  id: string,
  patch: Partial<
    Pick<CarerRow, "carer_name" | "relationship" | "contact_method" | "contact_value" | "receive_hypo_alerts">
  >,
): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: NOT_CONFIGURED };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { error: new Error("Not signed in") };

  const update: Record<string, unknown> = {};
  if (patch.carer_name !== undefined) update.carer_name = patch.carer_name.trim();
  if (patch.relationship !== undefined) update.relationship = patch.relationship?.trim() || null;
  if (patch.contact_method !== undefined) update.contact_method = patch.contact_method;
  if (patch.contact_value !== undefined) update.contact_value = patch.contact_value.trim();
  if (patch.receive_hypo_alerts !== undefined) update.receive_hypo_alerts = patch.receive_hypo_alerts;

  const { error } = await supabase.from("carers").update(update).eq("id", id).eq("user_id", uid);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function deleteCarer(id: string): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: NOT_CONFIGURED };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { error: new Error("Not signed in") };

  const { error } = await supabase.from("carers").delete().eq("id", id).eq("user_id", uid);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}
