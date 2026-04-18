import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

import { getSupabase } from "@/lib/supabase";
import { storage } from "@/lib/storage";

let initialised = false;

/** Call when turning iOS push off (or before re-registering) so the next ensure can run again. */
export function resetIosPushRegistrationState(): void {
  initialised = false;
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") return;
  try {
    void PushNotifications.removeAllListeners();
  } catch {
    // ignore
  }
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

  // Only mark initialised once we know it's appropriate to prompt/register.
  initialised = true;

  try {
    void PushNotifications.removeAllListeners();
  } catch {
    // ignore
  }

  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") {
    initialised = false;
    return;
  }

  await PushNotifications.register();

  PushNotifications.addListener("registration", async (token: { value: string }) => {
    const t = token.value?.trim();
    if (!t) return;
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (!uid) return;
    const { error } = await supabase.from("push_tokens").upsert(
      { user_id: uid, platform: "ios", token: t },
      { onConflict: "user_id,platform,token" },
    );
    if (import.meta.env.DEV && error) {
      console.warn("[push_tokens] upsert failed:", error.message);
    }
  });

  PushNotifications.addListener("registrationError", (err: unknown) => {
    if (import.meta.env.DEV) {
      console.warn("[push_tokens] registration error:", err);
    }
  });
}
