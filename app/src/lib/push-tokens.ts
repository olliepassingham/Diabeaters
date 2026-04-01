import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

import { getSupabase } from "@/lib/supabase";

let initialised = false;

export async function ensureIosPushRegistered(): Promise<void> {
  if (initialised) return;
  initialised = true;

  // Web/PWA push is out of scope for v1.
  if (!Capacitor.isNativePlatform()) return;

  const supabase = getSupabase();
  if (!supabase) return;

  const platform = Capacitor.getPlatform();
  if (platform !== "ios") return;

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return;

  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") return;

  await PushNotifications.register();

  PushNotifications.addListener("registration", async (token) => {
    const t = token.value?.trim();
    if (!t) return;
    const { error } = await supabase
      .from("push_tokens")
      .upsert({ user_id: uid, platform: "ios", token: t }, { onConflict: "user_id,platform,token" });
    if (import.meta.env.DEV && error) {
      console.warn("[push_tokens] upsert failed:", error.message);
    }
  });

  PushNotifications.addListener("registrationError", (err) => {
    if (import.meta.env.DEV) {
      console.warn("[push_tokens] registration error:", err);
    }
  });
}

