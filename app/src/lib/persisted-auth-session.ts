/**
 * Read the Supabase auth session still sitting in WebView localStorage.
 *
 * On weak mobile networks GoTrue often returns `session: null` after a failed
 * token refresh while leaving the refresh token in storage. Treating that as a
 * logout forces a login screen — force-closing the app "signs them back in"
 * because storage was never cleared.
 */
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUrlAndAnonKey } from "@/lib/supabase";

export function supabaseAuthStorageKey(): string | null {
  const env = getSupabaseUrlAndAnonKey();
  if (!env) return null;
  try {
    const host = new URL(env.url).hostname;
    const ref = host.split(".")[0]?.trim();
    if (!ref) return null;
    return `sb-${ref}-auth-token`;
  } catch {
    return null;
  }
}

function isSessionShape(value: unknown): value is Session {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  const user = s.user;
  if (!user || typeof user !== "object") return false;
  const id = (user as Record<string, unknown>).id;
  return typeof s.refresh_token === "string" && Boolean(s.refresh_token) && typeof id === "string" && Boolean(id);
}

/** Best-effort parse of whatever GoTrue last wrote under the auth storage key. */
export function readPersistedAuthSession(): Session | null {
  const key = supabaseAuthStorageKey();
  if (!key || typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isSessionShape(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      const wrap = parsed as Record<string, unknown>;
      if (isSessionShape(wrap.currentSession)) return wrap.currentSession;
      if (isSessionShape(wrap.session)) return wrap.session;
    }
    return null;
  } catch {
    return null;
  }
}

export function isRetryableAuthNetworkError(error: { message?: string; status?: number; code?: string } | null | undefined): boolean {
  if (!error) return true;
  const status = error.status;
  if (typeof status === "number" && status >= 500) return true;
  if (status === 0 || status === 408 || status === 429) return true;
  const msg = (error.message ?? "").toLowerCase();
  if (!msg) return true;
  if (msg.includes("invalid refresh") || msg.includes("invalid_grant") || msg.includes("refresh_token_not_found")) {
    return false;
  }
  return (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("timeout") ||
    msg.includes("offline") ||
    msg.includes("failed to fetch") ||
    msg.includes("abort") ||
    msg.includes("load failed") ||
    msg.includes("lock")
  );
}

/**
 * When `getSession()` / INITIAL_SESSION yields null, try to keep the user signed in
 * from storage. Prefer a live refresh; on retryable network failure fall back to the
 * persisted session so the shell does not bounce to login.
 */
export async function recoverAuthSessionAfterNull(
  supabase: SupabaseClient,
): Promise<Session | null> {
  const persisted = readPersistedAuthSession();
  if (!persisted?.refresh_token) return null;

  try {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: persisted.refresh_token,
    });
    if (data.session?.user?.id) return data.session;
    if (error && !isRetryableAuthNetworkError(error)) return null;
  } catch {
    // Weak Wi-Fi / storage lock — keep going with persisted tokens.
  }

  if (!persisted.access_token) return persisted;

  try {
    const { data } = await supabase.auth.setSession({
      access_token: persisted.access_token,
      refresh_token: persisted.refresh_token,
    });
    if (data.session?.user?.id) return data.session;
  } catch {
    // setSession may also need the network; still return persisted for the React shell.
  }

  return persisted;
}
