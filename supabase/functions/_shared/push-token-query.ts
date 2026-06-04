/**
 * Fetch the most recently registered push token per platform for a user.
 * Avoids sending APNs/FCM to stale tokens left after reinstall or TestFlight upgrades.
 */
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

import type { PushTokenRow } from "./deliver-push.ts";

export async function fetchLatestPushTokensForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<{ rows: PushTokenRow[]; error?: string }> {
  const rows: PushTokenRow[] = [];
  for (const platform of ["ios", "android"] as const) {
    const { data, error } = await admin
      .from("push_tokens")
      .select("platform, token")
      .eq("user_id", userId)
      .eq("platform", platform)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return { rows: [], error: error.message };
    }
    const token = String(data?.token ?? "").trim();
    if (token) {
      rows.push({ platform, token });
    }
  }
  return { rows };
}

/** Latest ios + android token for one user (for DM, supply low, etc.). */
export async function fetchLatestPushTokensForUserId(
  admin: SupabaseClient,
  userId: string,
): Promise<PushTokenRow[]> {
  const { rows } = await fetchLatestPushTokensForUser(admin, userId);
  return rows;
}
