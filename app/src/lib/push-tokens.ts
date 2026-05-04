import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

import { getSupabase } from "@/lib/supabase";
import { storage } from "@/lib/storage";

let initialised = false;

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

/** Call when turning iOS push off (or before re-registering) so the next ensure can run again. */
export function resetIosPushRegistrationState(): void {
  initialised = false;
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") return;
  try {
    void PushNotifications.removeAllListeners();
  } catch {
    // ignore
  }
  writePushDiag({ state: "reset" });
}

export async function ensureIosPushRegistered(): Promise<void> {
  if (initialised) return;

  // Web/PWA push is out of scope for v1.
  if (!Capacitor.isNativePlatform()) return;

  const supabase = getSupabase();
  if (!supabase) return;

  const platform = Capacitor.getPlatform();
  if (platform !== "ios") return;

  const settings = storage.getNotificationSettings();
  if (!settings.enabled || !settings.pushNotifications) return;

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user?.id) return;

  writePushDiag({ state: "starting", platform });

  // Mark initialised once we know it's appropriate to prompt/register.
  initialised = true;

  try {
    void PushNotifications.removeAllListeners();
  } catch {
    // ignore
  }

  // Attach listeners BEFORE register() so we never miss the token event.
  PushNotifications.addListener("registration", async (token: { value: string }) => {
    const t = token.value?.trim();
    writePushDiag({
      state: "registered",
      tokenPrefix: t ? `${t.slice(0, 10)}…` : "",
    });
    if (!t) return;

    rememberPushToken(t);

    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (!uid) return;

    const { error } = await supabase.from("push_tokens").upsert(
      { user_id: uid, platform: "ios", token: t },
      { onConflict: "user_id,platform,token" },
    );
    writePushDiag({ state: error ? "token_save_failed" : "token_saved", saveError: error?.message ?? null });
    if (import.meta.env.DEV && error) {
      console.warn("[push_tokens] upsert failed:", error.message);
    }
  });

  PushNotifications.addListener("registrationError", (err: unknown) => {
    writePushDiag({
      state: "registration_error",
      error: typeof err === "string" ? err : JSON.stringify(err),
    });
    if (import.meta.env.DEV) {
      console.warn("[push_tokens] registration error:", err);
    }
  });

  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") {
    initialised = false;
    writePushDiag({ state: "permission_denied" });
    return;
  }

  writePushDiag({ state: "permission_granted" });
  await PushNotifications.register();
  writePushDiag({ state: "register_called" });
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

  if (Capacitor.isNativePlatform?.() && Capacitor.getPlatform?.() === "ios") {
    try {
      await PushNotifications.removeAllListeners();
    } catch {
      // ignore
    }
  }

  initialised = false;
  writePushDiag({ state: "cleaned_up" });
}
