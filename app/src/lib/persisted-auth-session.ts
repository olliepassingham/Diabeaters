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
import { AUTH_SESSION_BACKUP_KEY, mirrorAuthBackupToNative } from "@/lib/native-auth-storage";
import { getDevicePlatform } from "@/lib/native-platform";
import { isOnline } from "@/lib/offline";
import { ACTIVE_USER_ID_KEY, LAST_LOCAL_USER_ID_KEY } from "@/lib/storage";
import { getSupabaseUrlAndAnonKey } from "@/lib/supabase";
import { captureAuthSessionLoss, type AuthSessionLossReason } from "@/observability/sentry";

export { AUTH_SESSION_BACKUP_KEY };

/** Hard cap so recovery never hangs the startup shell on flaky Wi‑Fi. */
export const AUTH_RECOVERY_TIMEOUT_MS = 4_000;

/** Set on intentional sign-out and cleared on the next sign-in, so a later login screen isn't reported as a lost session. */
const SIGNED_OUT_INTENTIONALLY_KEY = "diabeater_signed_out_intentionally";

let userInitiatedSignOut = false;
/** Blocks auto-restore briefly after logout so /login cannot revive the just-cleared session. */
let signOutRecoveryBlockedUntil = 0;
const reportedLossReasons = new Set<AuthSessionLossReason>();

/** Call immediately before `supabase.auth.signOut()` so recovery cannot revive the session. */
export function markUserInitiatedSignOut(): void {
  userInitiatedSignOut = true;
  signOutRecoveryBlockedUntil = Date.now() + 8_000;
  clearAuthSessionBackup();
  try {
    localStorage.setItem(SIGNED_OUT_INTENTIONALLY_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Report each reason at most once per app launch. */
export function reportAuthSessionLoss(
  reason: AuthSessionLossReason,
  detail?: { code?: string; status?: number },
): void {
  if (reportedLossReasons.has(reason)) return;
  reportedLossReasons.add(reason);
  let originHost = "unknown";
  try {
    originHost = window.location.hostname || "unknown";
  } catch {
    /* ignore */
  }
  captureAuthSessionLoss({ reason, platform: getDevicePlatform(), originHost, ...detail });
}

/** Test hook: allow the same reason to be reported again. */
export function resetAuthSessionLossReportsForTests(): void {
  reportedLossReasons.clear();
}

/**
 * Called just before redirecting to /login with no session on disk. Reports `storage_missing`
 * when this device had a signed-in user who never chose to sign out.
 */
export function reportIfSessionStorageMissing(): void {
  try {
    if (localStorage.getItem(SIGNED_OUT_INTENTIONALLY_KEY) === "1") return;
    const hadUser = localStorage.getItem(LAST_LOCAL_USER_ID_KEY) || localStorage.getItem(ACTIVE_USER_ID_KEY);
    if (!hadUser) return;
  } catch {
    return;
  }
  reportAuthSessionLoss("storage_missing");
}

function authErrorCode(error: { message?: string; code?: string }): string {
  if (typeof error.code === "string" && error.code) return error.code;
  const msg = (error.message ?? "").toLowerCase();
  if (msg.includes("already used")) return "refresh_token_already_used";
  if (msg.includes("not found")) return "refresh_token_not_found";
  if (msg.includes("expired")) return "session_expired";
  return "unknown";
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
  if (!session?.refresh_token || !session.user?.id) {
    clearAuthSessionBackup();
    return;
  }
  const json = JSON.stringify(session);
  try {
    localStorage.setItem(AUTH_SESSION_BACKUP_KEY, json);
    localStorage.removeItem(SIGNED_OUT_INTENTIONALLY_KEY);
  } catch {
    /* quota / private mode */
  }
  void mirrorAuthBackupToNative(json);
}

export function clearAuthSessionBackup(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(AUTH_SESSION_BACKUP_KEY);
  } catch {
    /* ignore */
  }
  void mirrorAuthBackupToNative(null);
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
 *
 * Concurrent callers share one in-flight recovery: sending the same refresh token twice
 * can trip Supabase's reuse detection and revoke the whole session.
 */
let inflightRecovery: Promise<Session | null> | null = null;

export function recoverAuthSessionAfterNull(supabase: SupabaseClient): Promise<Session | null> {
  if (isAuthRecoveryBlocked()) return Promise.resolve(null);
  if (inflightRecovery) return inflightRecovery;
  const run = runAuthSessionRecovery(supabase).finally(() => {
    if (inflightRecovery === run) inflightRecovery = null;
  });
  inflightRecovery = run;
  return run;
}

async function runAuthSessionRecovery(supabase: SupabaseClient): Promise<Session | null> {
  // Read at call time so a token Supabase rotated a moment ago is the one we send.
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
      reportAuthSessionLoss("refresh_rejected", {
        code: authErrorCode(error),
        status: typeof error.status === "number" ? error.status : undefined,
      });
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
