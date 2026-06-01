import { useEffect } from "react";
import { App as CapacitorApp } from "@capacitor/app";

import { useAuth } from "@/lib/auth-context";
import { isNativePushPlatform } from "@/lib/native-platform";
import { refreshNativePushRegistration } from "@/lib/push-tokens";
import { syncNotificationPreferences } from "@/lib/notification-preferences";
import { storage } from "@/lib/storage";

/**
 * Re-syncs cloud notification prefs and asks the native shell for a fresh push token when the app
 * returns to the foreground (iOS APNs or Android FCM).
 */
export function NativePushForegroundSync() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user?.id) return;
    if (!isNativePushPlatform()) return;

    let listener: { remove: () => Promise<void> } | undefined;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    const run = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined;
        const s = storage.getNotificationSettings();
        void (async () => {
          await syncNotificationPreferences(s);
          if (s.enabled && s.pushNotifications) {
            await refreshNativePushRegistration();
          }
        })();
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

/** @deprecated Use {@link NativePushForegroundSync} */
export const IosPushForegroundSync = NativePushForegroundSync;
