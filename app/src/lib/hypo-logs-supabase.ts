/**
 * Insert into `public.hypo_logs` (cloud) for Edge Function + RLS audit trail.
 */
import { getSupabase } from "./supabase";

export type InsertHypoLogResult = {
  id: string;
  user_id: string;
  blood_glucose: number | null;
  treatment: string | null;
  notes: string | null;
  created_at: string;
};

export async function insertHypoLog(params: {
  blood_glucose?: number | null;
  treatment?: string | null;
  notes?: string | null;
}): Promise<{ data: InsertHypoLogResult | null; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { data: null, error: new Error("Not signed in") };

  const { data, error } = await supabase
    .from("hypo_logs")
    .insert({
      user_id: uid,
      blood_glucose: params.blood_glucose ?? null,
      treatment: params.treatment?.trim() || null,
      notes: params.notes?.trim() || null,
    })
    .select("id, user_id, blood_glucose, treatment, notes, created_at")
    .single();

  if (error) return { data: null, error: new Error(error.message) };

  const row = data as Record<string, unknown>;
  return {
    data: {
      id: String(row.id),
      user_id: String(row.user_id),
      blood_glucose: row.blood_glucose == null ? null : Number(row.blood_glucose),
      treatment: row.treatment == null ? null : String(row.treatment),
      notes: row.notes == null ? null : String(row.notes),
      created_at: String(row.created_at),
    },
    error: null,
  };
}
