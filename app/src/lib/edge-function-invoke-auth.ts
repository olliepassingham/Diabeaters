import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns Authorization headers for `functions.invoke` using the current user JWT.
 * Refreshes the session when missing or expiring soon so Edge Functions (verify_jwt) accept the request.
 */
export async function getBearerAuthHeadersForEdgeFunctions(
  supabase: SupabaseClient,
): Promise<{ Authorization: string } | null> {
  let {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    const { data } = await supabase.auth.refreshSession();
    session = data.session ?? null;
  }
  if (!session?.access_token) return null;

  const expiresAt = session.expires_at;
  const nowSec = Math.floor(Date.now() / 1000);
  if (expiresAt != null && expiresAt - nowSec < 120) {
    const { data } = await supabase.auth.refreshSession();
    if (data.session?.access_token) {
      return { Authorization: `Bearer ${data.session.access_token}` };
    }
  }

  return { Authorization: `Bearer ${session.access_token}` };
}
