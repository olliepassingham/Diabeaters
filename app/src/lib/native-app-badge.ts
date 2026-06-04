import { Capacitor } from "@capacitor/core";
import { Badge } from "@capawesome/capacitor-badge";

import { AppIconBadge } from "@/lib/app-icon-badge";
import { fetchNativeAppBadgeCount } from "@/lib/native-app-badge-count";
import { isNativePushPlatform } from "@/lib/native-platform";

let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let inFlight: Promise<void> | null = null;

async function applyNativeAppBadgeCount(count: number): Promise<void> {
  const platform = Capacitor.getPlatform();
  if (platform === "ios") {
    // Never use @capawesome/capacitor-badge on iOS: Badge.set() re-requests .badge-only permission
    // and regressed remote notification delivery. Use our minimal AppIconBadge plugin instead.
    await AppIconBadge.setCount({ count });
    return;
  }
  if (platform === "android") {
    await Badge.set({ count });
  }
}

/**
 * Sets the OS app-icon badge to match unread bell items + unread DM threads.
 */
export async function syncNativeAppBadgeNow(): Promise<void> {
  if (!isNativePushPlatform()) return;

  if (inFlight) {
    await inFlight;
    return;
  }

  inFlight = (async () => {
    try {
      const { count, error } = await fetchNativeAppBadgeCount();
      if (error) {
        console.warn("[native_app_badge] count failed:", error.message);
        return;
      }
      await applyNativeAppBadgeCount(count);
    } catch (e) {
      // AppIconBadge is only in native builds that include AppIconBadgePlugin.swift (1.0.4+).
      console.warn("[native_app_badge] sync failed:", e);
    } finally {
      inFlight = null;
    }
  })();

  await inFlight;
}

/** Debounced badge sync after notification or inbox changes. */
export function scheduleNativeAppBadgeSync(delayMs = 400): void {
  if (!isNativePushPlatform()) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = undefined;
    void syncNativeAppBadgeNow();
  }, delayMs);
}
