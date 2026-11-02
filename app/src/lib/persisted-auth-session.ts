/**
 * Read the Supabase auth session still sitting in WebView localStorage.
 *
 * On weak mobile networks GoTrue often returns `session: null` after a failed
 * token refresh while leaving — or even clearing — the refresh token in its own
 * storage key. Treating that as a logout forces a login screen; force-closing
 * the app “signs them back in” because a separate backup (or uncleared storage)
 * still had the session.
 */
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { isOnline } from "@/lib/offline";
import { getSupabaseUrlAndAnonKey } from "@/lib/supabase";

/** Hard cap so recovery never hangs the startup shell on flaky Wi‑Fi. */
export const AUTH_RECOVERY_TIMEOUT_MS = 4_000;

/**
 * App-owned mirror of the last good session. GoTrue may clear `sb-…-auth-token`
 * after a failed refresh; this key is only cleared on intentional sign-out.
 */
export const AUTH_SESSION_BACKUP_KEY = "diabeater_auth_session_backup";

let userInitiatedSignOut = false;
/** Blocks auto-restore briefly after logout so /login cannot revive the just-cleared session. */
let signOutRecoveryBlockedUntil = 0;

/** Call immediately before `supabase.auth.signOut()` so recovery cannot revive the session. */
export function markUserInitiatedSignOut(): void {
  userInitiatedSignOut = true;
  signOutRecoveryBlockedUntil = Date.now() + 8_000;
  clearAuthSessionBackup();
}

export function clearUserInitiatedSignOut(): void {
  userInitiatedSignOut = false;
  signOutRecoveryBlockedUntil = 0;
}

export function wasUserInitiatedSignOut(): boolean {
  return userInitiatedSignOut;
}

export function isAuthRecoveryBlocked(): boolean {
  return userInitiatedSignOut || Date.now() < signOutRecoveryBlockedUntil;
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

function parseSessionJson(raw: string | null): Session | null {
  if (!raw) return null;
  try {
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

/** Best-effort parse of whatever GoTrue last wrote under the auth storage key. */
export function readPersistedAuthSession(): Session | null {
  const key = supabaseAuthStorageKey();
  if (!key || typeof localStorage === "undefined") return null;
  try {
    return parseSessionJson(localStorage.getItem(key));
  } catch {
    return null;
  }
}

/** Last known-good session we mirrored (survives GoTrue wiping its own key). */
export function readAuthSessionBackup(): Session | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return parseSessionJson(localStorage.getItem(AUTH_SESSION_BACKUP_KEY));
  } catch {
    return null;
  }
}

export function writeAuthSessionBackup(session: Session | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (!session?.refresh_token || !session.user?.id) {
      localStorage.removeItem(AUTH_SESSION_BACKUP_KEY);
      return;
    }
    localStorage.setItem(AUTH_SESSION_BACKUP_KEY, JSON.stringify(session));
  } catch {
    /* quota / private mode */
  }
}

export function clearAuthSessionBackup(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(AUTH_SESSION_BACKUP_KEY);
  } catch {
    /* ignore */
  }
}

/** GoTrue key first, then our backup — used before any login redirect. */
export function readBestEffortAuthSession(): Session | null {
  return readPersistedAuthSession() ?? readAuthSessionBackup();
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
    return readBestEffortAuthSession();
  }
}

/**
 * When `getSession()` / INITIAL_SESSION yields null, try to keep the user signed in
 * from storage. Prefer a live refresh when online; on retryable network failure
 * (or offline) fall back to the persisted / backup session so the shell does not
 * bounce to login.
 *
 * Important: never call `setSession` after a network-failed refresh — that can
 * clear GoTrue storage and make the false logout stick.
 */
export async function recoverAuthSessionAfterNull(
  supabase: SupabaseClient,
): Promise<Session | null> {
  if (isAuthRecoveryBlocked()) return null;

  const persisted = readBestEffortAuthSession();
  if (!persisted?.refresh_token) return null;

  // Offline / captive portal: keep the last session for the UI. Do not hit the network.
  if (!isOnline()) {
    writeAuthSessionBackup(persisted);
    return persisted;
  }

  try {
    const { data, error } = await withTimeout(
      supabase.auth.refreshSession({ refresh_token: persisted.refresh_token }),
      AUTH_RECOVERY_TIMEOUT_MS,
    );
    if (wasUserInitiatedSignOut()) return null;
    if (data.session?.user?.id) {
      writeAuthSessionBackup(data.session);
      return data.session;
    }
    // Real auth rejection (revoked refresh) — clear backup so we do not loop forever.
    if (error && !isRetryableAuthNetworkError(error)) {
      clearAuthSessionBackup();
      return null;
    }
    // Network / timeout-ish failure: keep the user signed in from disk.
    writeAuthSessionBackup(persisted);
    return persisted;
  } catch {
    writeAuthSessionBackup(persisted);
    return wasUserInitiatedSignOut() ? null : persisted;
  }
}
