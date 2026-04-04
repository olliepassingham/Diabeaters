/**
 * Minimal content reports (RLS: insert/select own rows).
 */
import { getSupabase } from "@/lib/supabase";

export type ReportTargetType = "post" | "comment" | "profile";

export async function submitContentReport(params: {
  targetType: ReportTargetType;
  targetId: string;
  reason?: string | null;
}): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { error: new Error("Not signed in") };

  const { error } = await supabase.from("content_reports").insert({
    reporter_id: uid,
    target_type: params.targetType,
    target_id: params.targetId,
    reason: params.reason?.trim() || null,
  });

  if (error) return { error: new Error(error.message) };
  return { error: null };
}
