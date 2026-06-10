import { useEffect } from "react";
import { App as CapacitorApp } from "@capacitor/app";

import { useAuth } from "@/lib/auth-context";
import { DM_INBOX_CHANGED } from "@/lib/community/dm-inbox-events";
import { INAPP_NOTIFICATIONS_CHANGED } from "@/lib/in-app-notifications-events";
import { isCapacitorNativeShell } from "@/lib/native-platform";
import { clearNativeAppBadge, scheduleNativeAppBadgeSync, syncNativeAppBadgeNow } from "@/lib/native-app-badge";

/**
 * Keeps the iOS/Android home-screen icon badge aligned with unread bell + DM inbox counts.
 * Mounted at the app root so login/welcome routes clear stale APNs badges before sign-in.
 */
export function NativeAppBadgeSync() {
  const { user, loading } = useAuth();
  const signedIn = Boolean(user?.id) && !loading;

  useEffect(() => {
    if (!isCapacitorNativeShell()) return;

    if (!signedIn) {
      void clearNativeAppBadge();
    } else {
      void syncNativeAppBadgeNow();
    }

    const onNotifs = () => {
      if (signedIn) scheduleNativeAppBadgeSync(0);
      else void clearNativeAppBadge();
    };
    const onInbox = () => {
      if (signedIn) scheduleNativeAppBadgeSync(0);
      else void clearNativeAppBadge();
    };

    window.addEventListener(INAPP_NOTIFICATIONS_CHANGED, onNotifs);
    window.addEventListener(DM_INBOX_CHANGED, onInbox);

    let listener: { remove: () => Promise<void> } | undefined;
    void CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) {
        if (signedIn) scheduleNativeAppBadgeSync(0);
        return;
      }
      if (signedIn) void syncNativeAppBadgeNow();
      else void clearNativeAppBadge();
    }).then((h) => {
      listener = h;
    });

    return () => {
      window.removeEventListener(INAPP_NOTIFICATIONS_CHANGED, onNotifs);
      window.removeEventListener(DM_INBOX_CHANGED, onInbox);
      void listener?.remove();
    };
  }, [signedIn]);

  return null;
}
