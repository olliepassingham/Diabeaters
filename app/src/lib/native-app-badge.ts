import { Badge } from "@capawesome/capacitor-badge";

import { AppIconBadge } from "@/lib/app-icon-badge";
import { fetchNativeAppBadgeCount } from "@/lib/native-app-badge-count";
import { getNativePushPlatform, isNativePushPlatform } from "@/lib/native-platform";

let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let inFlight: Promise<void> | null = null;
let needsFollowUpSync = false;

async function applyNativeAppBadgeCount(count: number): Promise<void> {
  const safeCount = Math.max(0, Math.floor(count));
  const platform = getNativePushPlatform();
  if (platform === "ios") {
    // Never use @capawesome/capacitor-badge on iOS: Badge.set() re-requests badge-only permission
    // and regressed remote notification delivery. Use our minimal AppIconBadge plugin instead.
    await AppIconBadge.setCount({ count: safeCount });
    return;
  }
  if (platform === "android") {
    await Badge.set({ count: safeCount });
  }
}

/** Clears the OS app-icon badge (e.g. on sign-out). */
export async function clearNativeAppBadge(): Promise<void> {
  if (!isNativePushPlatform()) return;
  try {
    await applyNativeAppBadgeCount(0);
  } catch (e) {
    console.warn("[native_app_badge] clear failed:", e);
  }
}

async function resolveBadgeCountWithRetry(): Promise<{ count: number; error: Error | null }> {
  let last = await fetchNativeAppBadgeCount();
  if (!last.error) return last;
  await new Promise((r) => setTimeout(r, 350));
  last = await fetchNativeAppBadgeCount();
  return last;
}

async function performBadgeSync(): Promise<void> {
  const { count, error } = await resolveBadgeCountWithRetry();
  if (error) {
    console.warn("[native_app_badge] count failed; clearing stale badge:", error.message);
    await applyNativeAppBadgeCount(0);
    return;
  }
  await applyNativeAppBadgeCount(count);
}

/**
 * Sets the OS app-icon badge to match unread bell items + unread DM threads.
 * Always attempts to write the resolved count so a stale "1" from APNs does not linger.
 */
export async function syncNativeAppBadgeNow(): Promise<void> {
  if (!isNativePushPlatform()) return;

  if (inFlight) {
    needsFollowUpSync = true;
    await inFlight;
    if (needsFollowUpSync) {
      needsFollowUpSync = false;
      return syncNativeAppBadgeNow();
    }
    return;
  }

  inFlight = (async () => {
    try {
      await performBadgeSync();
    } catch (e) {
      console.warn("[native_app_badge] sync failed; clearing stale badge:", e);
      try {
        await applyNativeAppBadgeCount(0);
      } catch {
        // ignore secondary failure
      }
    } finally {
      inFlight = null;
    }
  })();

  await inFlight;

  if (needsFollowUpSync) {
    needsFollowUpSync = false;
    return syncNativeAppBadgeNow();
  }
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
