/**
 * Supporter acknowledgements for cloud hypo_logs rows.
 */
import { getSupabase } from "./supabase";

export type HypoLogAcknowledgementRow = {
  hypo_log_id: string;
  carer_id: string;
  carer_name: string;
  acknowledged_at: string;
};

export type HypoLogAcknowledgement = {
  id: string;
  hypo_log_id: string;
  carer_id: string;
  patient_id: string;
  reaction: string;
  acknowledged_at: string;
};

function mapAckRow(row: Record<string, unknown>): HypoLogAcknowledgementRow {
  return {
    hypo_log_id: String(row.hypo_log_id),
    carer_id: String(row.carer_id),
    carer_name: String(row.carer_name ?? "Supporter"),
    acknowledged_at: String(row.acknowledged_at),
  };
}

export function hypoIdFromNotificationData(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const id = typeof d.hypo_id === "string" ? d.hypo_id.trim() : "";
  return id || null;
}

/** Group acknowledgements by hypo log id for list UIs. */
export function groupHypoAcknowledgementsByLogId(
  rows: HypoLogAcknowledgementRow[],
): Map<string, HypoLogAcknowledgementRow[]> {
  const map = new Map<string, HypoLogAcknowledgementRow[]>();
  for (const row of rows) {
    const list = map.get(row.hypo_log_id) ?? [];
    list.push(row);
    map.set(row.hypo_log_id, list);
  }
  return map;
}

/** Patient-facing one-line summary, e.g. "Sarah acknowledged" or "2 supporters acknowledged". */
export function formatHypoAcknowledgementSummary(
  rows: HypoLogAcknowledgementRow[],
  opts?: { relativeWhen?: string },
): string | null {
  if (rows.length === 0) return null;
  const suffix = opts?.relativeWhen ? ` · ${opts.relativeWhen}` : "";
  if (rows.length === 1) {
    return `${rows[0]!.carer_name} acknowledged${suffix}`;
  }
  return `${rows.length} supporters acknowledged${suffix}`;
}

export async function fetchHypoLogAcknowledgements(
  hypoLogIds: string[],
): Promise<{ data: HypoLogAcknowledgementRow[] | null; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const ids = [...new Set(hypoLogIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return { data: [], error: null };

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user?.id) return { data: [], error: null };

  const { data, error } = await supabase.rpc("list_hypo_log_acknowledgements", {
    p_hypo_log_ids: ids,
  });

  if (error) return { data: null, error: new Error(error.message) };
  const rows = ((data ?? []) as Record<string, unknown>[]).map(mapAckRow);
  return { data: rows, error: null };
}

export async function acknowledgeHypoLog(
  hypoLogId: string,
): Promise<{ data: HypoLogAcknowledgement | null; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const id = hypoLogId.trim();
  if (!id) return { data: null, error: new Error("Missing hypo log id") };

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user?.id) return { data: null, error: new Error("Not signed in") };

  const { data, error } = await supabase.rpc("acknowledge_hypo_log", { p_hypo_log_id: id });

  if (error) return { data: null, error: new Error(error.message) };

  const row = data as Record<string, unknown> | null;
  if (!row) return { data: null, error: new Error("No acknowledgement returned") };

  return {
    data: {
      id: String(row.id),
      hypo_log_id: String(row.hypo_log_id),
      carer_id: String(row.carer_id),
      patient_id: String(row.patient_id),
      reaction: String(row.reaction ?? "seen"),
      acknowledged_at: String(row.acknowledged_at),
    },
    error: null,
  };
}
