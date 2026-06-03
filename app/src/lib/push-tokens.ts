import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

import { isIosDeviceForCapacitorPush } from "@/lib/ios-user-agent";
import { scheduleNativeAppBadgeSync } from "@/lib/native-app-badge";
import {
  getNativePushPlatform,
  isNativePushPlatform,
  type NativePushPlatform,
} from "@/lib/native-platform";
import { getSupabase } from "@/lib/supabase";
import { storage } from "@/lib/storage";

/** True while `registration` / `registrationError` listeners are attached. */
let pushListenersBound = false;

const PUSH_DIAG_KEY = "diabeaters:push_diag:v1";
const PUSH_TOKEN_LAST_KEY = "diabeaters:push_token:last:v1";
const PUSH_PLATFORM_LAST_KEY = "diabeaters:push_platform:last:v1";

function rememberPushToken(token: string, platform: NativePushPlatform) {
  try {
    localStorage.setItem(PUSH_TOKEN_LAST_KEY, token);
    localStorage.setItem(PUSH_PLATFORM_LAST_KEY, platform);
  } catch {
    // ignore
  }
}

function readRememberedPushPlatform(): NativePushPlatform | null {
  try {
    const p = localStorage.getItem(PUSH_PLATFORM_LAST_KEY);
    return p === "android" || p === "ios" ? p : null;
  } catch {
    return null;
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
    localStorage.removeItem(PUSH_PLATFORM_LAST_KEY);
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

function currentPushPlatform(): NativePushPlatform | null {
  return getNativePushPlatform();
}

export async function syncRememberedPushTokenToSupabase(
  supabaseArg?: NonNullable<ReturnType<typeof getSupabase>>,
): Promise<void> {
  if (!isNativePushPlatform()) return;
  const supabase = supabaseArg ?? getSupabase();
  if (!supabase) return;
  const raw = readRememberedPushToken();
  const t = raw?.trim();
  if (!t) return;
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return;

  await persistPushTokenToCloud(supabase, t, readRememberedPushPlatform() ?? currentPushPlatform() ?? "ios");
}

async function persistPushTokenToCloud(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  token: string,
  platform: NativePushPlatform,
): Promise<void> {
  const t = token.trim();
  const minLen = platform === "android" ? 16 : 32;
  if (!t || t.length < minLen) {
    writePushDiag({ state: "token_save_failed", saveError: "invalid_token_length", platform });
    return;
  }

  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) {
    writePushDiag({ state: "token_save_failed", saveError: "no_session", platform });
    console.warn("[push_tokens] skip persist: no Supabase session (sign in, then open Settings → Notifications).");
    return;
  }

  const rpcName = platform === "android" ? "register_android_push_token" : "register_ios_push_token";
  const rpc = await supabase.rpc(rpcName, { p_token: t });
  if (!rpc.error && rpc.data && typeof rpc.data === "object") {
    const row = rpc.data as { ok?: boolean; error?: string };
    if (row.ok === true) {
      writePushDiag({ state: "token_saved", savePath: "rpc", platform });
      return;
    }
    writePushDiag({ state: "rpc_returned_false", rpcBody: row, platform });
    console.warn(`[push_tokens] ${rpcName} returned ok=false:`, row);
  } else if (rpc.error) {
    writePushDiag({ state: "rpc_invoke_failed", saveError: rpc.error.message, platform });
    console.warn(`[push_tokens] ${rpcName} RPC failed:`, rpc.error.message);
  }

  const { error } = await supabase.from("push_tokens").upsert(
    { user_id: uid, platform, token: t },
    { onConflict: "user_id,platform,token" },
  );
  writePushDiag({
    state: error ? "token_save_failed" : "token_saved",
    saveError: error?.message ?? null,
    savePath: error ? "upsert_failed" : "upsert",
    platform,
  });
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

export async function getPushRegistrationDebugSnapshot(): Promise<Record<string, unknown>> {
  const s = storage.getNotificationSettings();
  const token = readRememberedPushToken();
  const platform = readRememberedPushPlatform() ?? currentPushPlatform();
  let pushPermissionCheck: string | undefined;
  try {
    if (isNativePushPlatform()) {
      const c = await PushNotifications.checkPermissions();
      pushPermissionCheck = c.receive;
    }
  } catch (e) {
    pushPermissionCheck = `error:${e instanceof Error ? e.message : String(e)}`;
  }
  return {
    capacitorPlatform: Capacitor.getPlatform(),
    capacitorIsNativePlatform: Capacitor.isNativePlatform(),
    nativePushPlatform: platform,
    isNativePushPlatform: isNativePushPlatform(),
    isIosDeviceForCapacitorPush: isIosDeviceForCapacitorPush(),
    notificationEnabled: s.enabled,
    pushNotifications: s.pushNotifications,
    pushListenersBound,
    cachedTokenChars: token?.length ?? 0,
    cachedTokenPrefix: token && token.length >= 8 ? `${token.slice(0, 8)}…` : null,
    pushPermissionCheck,
    diag: readPushDiag(),
  };
}

function detachPushListeners(): void {
  pushListenersBound = false;
  if (!isNativePushPlatform()) return;
  try {
    void PushNotifications.removeAllListeners();
  } catch {
    // ignore
  }
}

export function resetNativePushRegistrationState(): void {
  detachPushListeners();
  writePushDiag({ state: "reset" });
}

/** @deprecated Use {@link resetNativePushRegistrationState} */
export const resetIosPushRegistrationState = resetNativePushRegistrationState;

function attachPushListeners(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  platform: NativePushPlatform,
): void {
  try {
    void PushNotifications.removeAllListeners();
  } catch {
    // ignore
  }
  pushListenersBound = false;

  PushNotifications.addListener("registration", async (token: { value: string }) => {
    const t = token.value?.trim();
    writePushDiag({
      state: "registered",
      tokenPrefix: t ? `${t.slice(0, 10)}…` : "",
      platform,
    });
    if (!t) {
      writePushDiag({ state: "registration_empty_token", registrationPayload: JSON.stringify(token), platform });
      return;
    }

    rememberPushToken(t, platform);
    await persistPushTokenToCloud(supabase, t, platform);
  });

  PushNotifications.addListener("registrationError", (err: unknown) => {
    detachPushListeners();
    writePushDiag({
      state: "registration_error",
      error: typeof err === "string" ? err : JSON.stringify(err),
      platform,
    });
    console.warn("[push_tokens] registration error:", err);
  });

  PushNotifications.addListener("pushNotificationReceived", () => {
    writePushDiag({ state: "push_received_foreground", platform });
    scheduleNativeAppBadgeSync();
  });

  pushListenersBound = true;
}

function scheduleMissingTokenRegisterRetries(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  platform: NativePushPlatform,
): void {
  const delays = [6000, 15000, 30000];
  for (const ms of delays) {
    window.setTimeout(() => {
      void (async () => {
        if (!isNativePushPlatform()) return;
        const s = storage.getNotificationSettings();
        if (!s.enabled || !s.pushNotifications) return;
        if (readRememberedPushToken()?.trim()) return;
        writePushDiag({ state: "retry_register_no_cached_token", attemptAfterMs: ms, platform });
        try {
          await PushNotifications.register();
        } catch (e) {
          writePushDiag({ state: "retry_register_threw", error: e instanceof Error ? e.message : String(e), platform });
        }
        await syncRememberedPushTokenToSupabase(supabase);
      })();
    }, ms);
  }
}

/** Current remote push permission without requesting (native only). */
export async function checkNativePushPermission(): Promise<"granted" | "denied" | "prompt" | null> {
  if (!isNativePushPlatform()) return null;
  try {
    const perm = await PushNotifications.checkPermissions();
    if (perm.receive === "granted") return "granted";
    if (perm.receive === "denied") return "denied";
    return "prompt";
  } catch {
    return null;
  }
}

export async function ensureNativePushRegistered(): Promise<void> {
  const platform = currentPushPlatform();
  if (!platform) return;

  const supabase = getSupabase();
  if (!supabase) return;

  const settings = storage.getNotificationSettings();
  if (!settings.enabled || !settings.pushNotifications) return;

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user?.id) return;

  writePushDiag({ state: "starting", platform });

  attachPushListeners(supabase, platform);

  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") {
    detachPushListeners();
    writePushDiag({ state: "permission_denied", platform });
    return;
  }

  writePushDiag({ state: "permission_granted", platform });
  try {
    await PushNotifications.register();
    writePushDiag({ state: "register_called", platform });
  } catch (e) {
    writePushDiag({ state: "register_threw", error: e instanceof Error ? e.message : String(e), platform });
    console.warn("[push_tokens] PushNotifications.register() failed:", e);
  }
  try {
    const chk = await PushNotifications.checkPermissions();
    writePushDiag({ pushPermissionAfterRegister: chk.receive, platform });
  } catch {
    // ignore
  }
  await syncRememberedPushTokenToSupabase(supabase);
  scheduleRememberedTokenResync(supabase, [450, 2200]);
  scheduleMissingTokenRegisterRetries(supabase, platform);
}

/** @deprecated Use {@link ensureNativePushRegistered} */
export const ensureIosPushRegistered = ensureNativePushRegistered;

export async function refreshNativePushRegistration(): Promise<void> {
  if (!isNativePushPlatform()) return;

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
    await ensureNativePushRegistered();
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

/** @deprecated Use {@link refreshNativePushRegistration} */
export const refreshIosPushRegistration = refreshNativePushRegistration;

export async function cleanupPushRegistration(): Promise<void> {
  const supabase = getSupabase();
  const token = readRememberedPushToken();
  const platform = readRememberedPushPlatform();

  if (supabase && token) {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (uid) {
        let q = supabase.from("push_tokens").delete().eq("user_id", uid).eq("token", token);
        if (platform) q = q.eq("platform", platform);
        const { error } = await q;
        writePushDiag({
          state: error ? "token_delete_failed" : "token_deleted",
          deleteError: error?.message ?? null,
          platform,
        });
        if (import.meta.env.DEV && error) {
          console.warn("[push_tokens] delete failed:", error.message);
        }
      }
    } catch (e) {
      writePushDiag({
        state: "token_delete_threw",
        deleteError: e instanceof Error ? e.message : String(e),
        platform,
      });
    }
  }

  forgetPushToken();
  detachPushListeners();
  writePushDiag({ state: "cleaned_up" });
}
