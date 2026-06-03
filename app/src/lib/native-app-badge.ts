import { Badge } from "@capawesome/capacitor-badge";

import { fetchNativeAppBadgeCount } from "@/lib/native-app-badge-count";
import { isNativePushPlatform } from "@/lib/native-platform";

let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let inFlight: Promise<void> | null = null;

/**
 * Sets the OS app-icon badge to match unread bell items + unread DM threads.
 * iOS previously stuck at 1 because APNs always sent `badge: 1` and nothing cleared it.
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
      await Badge.set({ count });
    } catch (e) {
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
