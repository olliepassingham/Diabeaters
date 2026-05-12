import { useEffect } from "react";
import { App as CapacitorApp } from "@capacitor/app";

import { useAuth } from "@/lib/auth-context";
import { isIosDeviceForCapacitorPush } from "@/lib/ios-user-agent";
import { refreshIosPushRegistration } from "@/lib/push-tokens";
import { syncNotificationPreferences } from "@/lib/notification-preferences";
import { storage } from "@/lib/storage";

/**
 * Re-syncs cloud notification prefs and asks iOS for a fresh push token when the app
 * returns to the foreground. Apple expects `registerForRemoteNotifications` to be
 * invoked on launch / resume; without this, a missed token callback or transient RLS
 * failure can leave the user with no row in `push_tokens` until the next cold start.
 */
export function IosPushForegroundSync() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user?.id) return;
    if (!isIosDeviceForCapacitorPush()) return;

    let listener: { remove: () => Promise<void> } | undefined;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    const run = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined;
        const s = storage.getNotificationSettings();
        void syncNotificationPreferences(s);
        if (s.enabled && s.pushNotifications) {
          void refreshIosPushRegistration();
        }
      }, 600);
    };

    void CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) run();
    }).then((h) => {
      listener = h;
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      void listener?.remove();
    };
  }, [loading, user?.id]);

  return null;
}
