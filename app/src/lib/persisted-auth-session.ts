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

/** Hard cap so recovery never hangs the startup shell on flaky Wi‑Fi. */
export const AUTH_RECOVERY_TIMEOUT_MS = 4_000;

let userInitiatedSignOut = false;

/** Call immediately before `supabase.auth.signOut()` so recovery cannot revive the session. */
export function markUserInitiatedSignOut(): void {
  userInitiatedSignOut = true;
}

export function clearUserInitiatedSignOut(): void {
  userInitiatedSignOut = false;
}

export function wasUserInitiatedSignOut(): boolean {
  return userInitiatedSignOut;
}

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

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("auth recovery timed out")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Timed `getSession()` so a stuck GoTrue refresh lock cannot block the shell forever.
 * On timeout, falls back to the disk session when present.
 */
export async function getSessionWithTimeout(
  supabase: SupabaseClient,
  ms = AUTH_RECOVERY_TIMEOUT_MS,
): Promise<Session | null> {
  try {
    const { data } = await withTimeout(supabase.auth.getSession(), ms);
    return data.session ?? null;
  } catch {
    return readPersistedAuthSession();
  }
}

/**
 * When `getSession()` / INITIAL_SESSION yields null, try to keep the user signed in
 * from storage. Prefer a live refresh; on retryable network failure fall back to the
 * persisted session so the shell does not bounce to login.
 */
export async function recoverAuthSessionAfterNull(
  supabase: SupabaseClient,
): Promise<Session | null> {
  if (wasUserInitiatedSignOut()) return null;

  const persisted = readPersistedAuthSession();
  if (!persisted?.refresh_token) return null;

  try {
    const { data, error } = await withTimeout(
      supabase.auth.refreshSession({ refresh_token: persisted.refresh_token }),
      AUTH_RECOVERY_TIMEOUT_MS,
    );
    if (wasUserInitiatedSignOut()) return null;
    if (data.session?.user?.id) return data.session;
    if (error && !isRetryableAuthNetworkError(error)) return null;
  } catch {
    // Timed out / lock / network — paint from disk immediately instead of waiting on setSession too.
    return wasUserInitiatedSignOut() ? null : persisted;
  }

  if (wasUserInitiatedSignOut()) return null;
  if (!persisted.access_token) return persisted;

  try {
    const { data } = await withTimeout(
      supabase.auth.setSession({
        access_token: persisted.access_token,
        refresh_token: persisted.refresh_token,
      }),
      AUTH_RECOVERY_TIMEOUT_MS,
    );
    if (wasUserInitiatedSignOut()) return null;
    if (data.session?.user?.id) return data.session;
  } catch {
    // setSession may also need the network; still return persisted for the React shell.
  }

  return wasUserInitiatedSignOut() ? null : persisted;
}
