/**
 * Native copy of the auth session backup (iOS UserDefaults / Android SharedPreferences).
 *
 * The native shell loads the web app from a remote origin, so the session lives in WebView
 * localStorage. iOS can evict that storage after a stretch of no use or under storage
 * pressure, and switching between bundled and remote builds changes the origin — either
 * way the session and our localStorage backup vanish together. Native preferences survive
 * both, so on launch we copy the backup back into localStorage before React reads it.
 *
 * Older binaries without the Preferences plugin load this same web code; every call
 * quietly does nothing there.
 */
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { isCapacitorNativeShell } from "@/lib/native-platform";

/**
 * App-owned mirror of the last good session. GoTrue may clear `sb-…-auth-token`
 * after a failed refresh; this key is only cleared on intentional sign-out.
 */
export const AUTH_SESSION_BACKUP_KEY = "diabeater_auth_session_backup";

/** Cold start waits on this before first render (splash is still up), so keep it short. */
export const NATIVE_AUTH_HYDRATE_TIMEOUT_MS = 500;

let lastMirrored: string | null | undefined;
let pendingWrite: Promise<void> = Promise.resolve();

function nativePreferencesAvailable(): boolean {
  try {
    return isCapacitorNativeShell() && Capacitor.isPluginAvailable("Preferences");
  } catch {
    return false;
  }
}

/**
 * Write (or clear with `null`) the native copy. Skips writes when nothing changed; the
 * returned promise settles once the latest write has finished.
 */
export function mirrorAuthBackupToNative(json: string | null): Promise<void> {
  if (!nativePreferencesAvailable()) return Promise.resolve();
  if (json === lastMirrored) return pendingWrite;
  lastMirrored = json;
  pendingWrite = pendingWrite.then(async () => {
    try {
      if (json == null) await Preferences.remove({ key: AUTH_SESSION_BACKUP_KEY });
      else await Preferences.set({ key: AUTH_SESSION_BACKUP_KEY, value: json });
    } catch {
      if (lastMirrored === json) lastMirrored = undefined;
    }
  });
  return pendingWrite;
}

/**
 * When localStorage has lost the backup but the native copy still has it, restore it.
 * Never overwrites a backup that is already in localStorage. Returns true when restored.
 */
export async function hydrateAuthBackupFromNative(timeoutMs = NATIVE_AUTH_HYDRATE_TIMEOUT_MS): Promise<boolean> {
  if (!nativePreferencesAvailable()) return false;
  try {
    if (localStorage.getItem(AUTH_SESSION_BACKUP_KEY)) return false;
  } catch {
    return false;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      Preferences.get({ key: AUTH_SESSION_BACKUP_KEY }),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
    const value = result?.value;
    if (!value) return false;
    if (localStorage.getItem(AUTH_SESSION_BACKUP_KEY)) return false;
    localStorage.setItem(AUTH_SESSION_BACKUP_KEY, value);
    lastMirrored = value;
    return true;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Await on intentional sign-out so a quick app kill can't leave the native copy behind. */
export async function clearNativeAuthBackup(): Promise<void> {
  await mirrorAuthBackupToNative(null);
}

/** Test hook. */
export function resetNativeAuthMirrorForTests(): void {
  lastMirrored = undefined;
  pendingWrite = Promise.resolve();
}
