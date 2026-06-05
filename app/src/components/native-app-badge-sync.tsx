import { useEffect } from "react";
import { App as CapacitorApp } from "@capacitor/app";

import { useAuth } from "@/lib/auth-context";
import { DM_INBOX_CHANGED } from "@/lib/community/dm-inbox-events";
import { INAPP_NOTIFICATIONS_CHANGED } from "@/lib/in-app-notifications-events";
import { isNativePushPlatform } from "@/lib/native-platform";
import { scheduleNativeAppBadgeSync, syncNativeAppBadgeNow } from "@/lib/native-app-badge";

/**
 * Keeps the iOS/Android home-screen icon badge aligned with unread bell + DM inbox counts.
 */
export function NativeAppBadgeSync() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user?.id) return;
    if (!isNativePushPlatform()) return;

    void syncNativeAppBadgeNow();

    const onNotifs = () => scheduleNativeAppBadgeSync();
    const onInbox = () => scheduleNativeAppBadgeSync();

    window.addEventListener(INAPP_NOTIFICATIONS_CHANGED, onNotifs);
    window.addEventListener(DM_INBOX_CHANGED, onInbox);

    let listener: { remove: () => Promise<void> } | undefined;
    void CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      scheduleNativeAppBadgeSync(isActive ? 200 : 0);
    }).then((h) => {
      listener = h;
    });

    return () => {
      window.removeEventListener(INAPP_NOTIFICATIONS_CHANGED, onNotifs);
      window.removeEventListener(DM_INBOX_CHANGED, onInbox);
      void listener?.remove();
    };
  }, [loading, user?.id]);

  return null;
}
