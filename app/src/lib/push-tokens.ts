import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

import { getSupabase } from "@/lib/supabase";
import { storage } from "@/lib/storage";

let initialised = false;

const PUSH_DIAG_KEY = "diabeaters:push_diag:v1";

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
