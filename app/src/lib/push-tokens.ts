import { PushNotifications } from "@capacitor/push-notifications";

import { isIosDeviceForCapacitorPush } from "@/lib/ios-user-agent";
import { getSupabase } from "@/lib/supabase";
import { storage } from "@/lib/storage";

/** True while `registration` / `registrationError` listeners are attached. */
let pushListenersBound = false;

const PUSH_DIAG_KEY = "diabeaters:push_diag:v1";
/** Persists the most recent native push token so logout can DELETE it from `push_tokens`. */
const PUSH_TOKEN_LAST_KEY = "diabeaters:push_token:last:v1";

function rememberPushToken(token: string) {
  try {
    localStorage.setItem(PUSH_TOKEN_LAST_KEY, token);
  } catch {
    // ignore
  }
}

function readRememberedPushToken(): string | null {
  try {
    return localStorage.getItem(PUSH_TOKEN_LAST_KEY);
  } catch {
    return null;
  }
}

function forgetPushToken() {
  try {
    localStorage.removeItem(PUSH_TOKEN_LAST_KEY);
  } catch {
    // ignore
  }
}

function scheduleRememberedTokenResync(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  delaysMs: readonly number[],
): void {
  for (const ms of delaysMs) {
    window.setTimeout(() => {
      void syncRememberedPushTokenToSupabase(supabase);
    }, ms);
  }
}

/**
 * Writes the last known device token from localStorage to `push_tokens` if the user is signed in.
 * Needed when the DB row was deleted but iOS does not re-fire `registration` for the same token.
 */
export async function syncRememberedPushTokenToSupabase(
  supabaseArg?: NonNullable<ReturnType<typeof getSupabase>>,
): Promise<void> {
  if (!isIosDeviceForCapacitorPush()) return;
  const supabase = supabaseArg ?? getSupabase();
  if (!supabase) return;
  const raw = readRememberedPushToken();
  const t = raw?.trim();
  if (!t) return;
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return;

  const { error } = await supabase.from("push_tokens").upsert(
    { user_id: uid, platform: "ios", token: t },
    { onConflict: "user_id,platform,token" },
  );
  writePushDiag({ state: error ? "token_save_failed" : "token_saved", saveError: error?.message ?? null });
  if (error) {
    console.warn("[push_tokens] upsert failed:", error.message);
  }
}

function writePushDiag(patch: Record<string, unknown>) {
  try {
    const raw = localStorage.getItem(PUSH_DIAG_KEY);
    const prev = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    localStorage.setItem(
      PUSH_DIAG_KEY,
      JSON.stringify({
        ...prev,
        ...patch,
        updatedAt: new Date().toISOString(),
      }),
    );
  } catch {
    // ignore
  }
}

export function readPushDiag(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(PUSH_DIAG_KEY);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function detachPushListeners(): void {
  pushListenersBound = false;
  if (!isIosDeviceForCapacitorPush()) return;
  try {
    void PushNotifications.removeAllListeners();
  } catch {
    // ignore
  }
}

/** Call when turning iOS push off (or before re-registering) so the next ensure can run again. */
export function resetIosPushRegistrationState(): void {
  detachPushListeners();
  writePushDiag({ state: "reset" });
}

function attachPushListeners(supabase: NonNullable<ReturnType<typeof getSupabase>>): void {
  if (pushListenersBound) return;

  try {
    void PushNotifications.removeAllListeners();
  } catch {
    // ignore
  }

  PushNotifications.addListener("registration", async (token: { value: string }) => {
    const t = token.value?.trim();
    writePushDiag({
      state: "registered",
      tokenPrefix: t ? `${t.slice(0, 10)}…` : "",
    });
    if (!t) return;

    rememberPushToken(t);
    await syncRememberedPushTokenToSupabase(supabase);
  });

  PushNotifications.addListener("registrationError", (err: unknown) => {
    detachPushListeners();
    writePushDiag({
      state: "registration_error",
      error: typeof err === "string" ? err : JSON.stringify(err),
    });
    if (import.meta.env.DEV) {
      console.warn("[push_tokens] registration error:", err);
    }
  });

  pushListenersBound = true;
}

export async function ensureIosPushRegistered(): Promise<void> {
  if (!isIosDeviceForCapacitorPush()) return;

  const supabase = getSupabase();
  if (!supabase) return;

  const settings = storage.getNotificationSettings();
  if (!settings.enabled || !settings.pushNotifications) return;

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user?.id) return;

  writePushDiag({ state: "starting", platform: "ios" });

  attachPushListeners(supabase);

  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") {
    detachPushListeners();
    writePushDiag({ state: "permission_denied" });
    return;
  }

  writePushDiag({ state: "permission_granted" });
  await PushNotifications.register();
  writePushDiag({ state: "register_called" });
  await syncRememberedPushTokenToSupabase(supabase);
  scheduleRememberedTokenResync(supabase, [450, 2200]);
}

/**
 * Lightweight refresh when returning from background: does not remove listeners.
 * If listeners were never bound (e.g. race on first launch), falls back to full ensure.
 */
export async function refreshIosPushRegistration(): Promise<void> {
  if (!isIosDeviceForCapacitorPush()) return;

  const supabase = getSupabase();
  if (!supabase) return;

  const settings = storage.getNotificationSettings();
  if (!settings.enabled || !settings.pushNotifications) return;

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user?.id) return;

  const check = await PushNotifications.checkPermissions();
  if (check.receive !== "granted") {
    writePushDiag({ state: "foreground_skip_no_permission" });
    return;
  }

  if (!pushListenersBound) {
    await ensureIosPushRegistered();
    return;
  }

  try {
    await PushNotifications.register();
    writePushDiag({ state: "foreground_reregister" });
    await syncRememberedPushTokenToSupabase(supabase);
    scheduleRememberedTokenResync(supabase, [450, 2200]);
  } catch (e) {
    writePushDiag({ state: "foreground_register_failed", error: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * Removes this device's push token from `public.push_tokens` (own-row DELETE
 * via RLS) and resets the in-process listener state so the next sign-in starts
 * clean. Safe to call from anywhere — every step is best-effort and silent on
 * failure so logout is never blocked.
 */
export async function cleanupPushRegistration(): Promise<void> {
  const supabase = getSupabase();
  const token = readRememberedPushToken();

  if (supabase && token) {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (uid) {
        const { error } = await supabase
          .from("push_tokens")
          .delete()
          .eq("user_id", uid)
          .eq("token", token);
        writePushDiag({
          state: error ? "token_delete_failed" : "token_deleted",
          deleteError: error?.message ?? null,
        });
        if (import.meta.env.DEV && error) {
          console.warn("[push_tokens] delete failed:", error.message);
        }
      }
    } catch (e) {
      writePushDiag({
        state: "token_delete_threw",
        deleteError: e instanceof Error ? e.message : String(e),
      });
    }
  }

  forgetPushToken();

  detachPushListeners();
  writePushDiag({ state: "cleaned_up" });
}
