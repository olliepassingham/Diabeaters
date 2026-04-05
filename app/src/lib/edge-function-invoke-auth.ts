import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns Authorization headers for Edge Functions using the current user JWT.
 * Refreshes the session when missing or expiring soon so the gateway accepts the request.
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

  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = session.expires_at;
  const secondsLeft = expiresAt != null ? expiresAt - nowSec : Number.POSITIVE_INFINITY;

  /** Proactively refresh before the gateway rejects an expired JWT (401, execution_id null). */
  if (secondsLeft < 300) {
    const { data } = await supabase.auth.refreshSession();
    if (data.session?.access_token) {
      session = data.session;
    }
  }

  const finalExpires = session.expires_at;
  const finalLeft =
    finalExpires != null ? finalExpires - Math.floor(Date.now() / 1000) : Number.POSITIVE_INFINITY;
  if (finalLeft <= 0 || !session.access_token) {
    return null;
  }

  return { Authorization: `Bearer ${session.access_token}` };
}

/**
 * POST to `functions/v1/{name}` with **both** `apikey` (anon) and `Authorization` (user JWT).
 * Use this instead of `supabase.functions.invoke` when the gateway returns 401 without running the function.
 */
export async function invokeEdgeFunctionPost<TJson>(
  functionName: string,
  body: Record<string, unknown>,
  env: { url: string; anonKey: string },
  auth: { Authorization: string },
): Promise<{ data: TJson | null; error: Error | null }> {
  const url = `${env.url}/functions/v1/${functionName}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.anonKey,
      Authorization: auth.Authorization,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = null;
    }
  }

  if (!res.ok) {
    const detail =
      parsed && typeof parsed === "object" && parsed !== null && "error" in parsed
        ? String((parsed as { error?: unknown }).error)
        : text || res.statusText;
    return { data: null, error: new Error(`${res.status}: ${detail}`) };
  }

  return { data: (parsed as TJson) ?? null, error: null };
}
