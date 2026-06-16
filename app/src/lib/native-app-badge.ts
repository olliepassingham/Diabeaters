import { Badge } from "@capawesome/capacitor-badge";

import { AppIconBadge } from "@/lib/app-icon-badge";
import { fetchNativeAppBadgeCount } from "@/lib/native-app-badge-count";
import {
  getNativePushPlatform,
  isCapacitorNativeShell,
} from "@/lib/native-platform";

let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let inFlight: Promise<void> | null = null;
let needsFollowUpSync = false;

/**
 * Home-screen icon badge disabled until unread sync is reliable across all users.
 * When false, the OS badge is always cleared to 0 — pushes and in-app sync never increment it.
 */
export const NATIVE_HOME_SCREEN_BADGE_ENABLED = false;

/** Whether the app should reflect unread counts on the OS home-screen icon. */
export function isNativeHomeScreenBadgeEnabled(): boolean {
  return NATIVE_HOME_SCREEN_BADGE_ENABLED;
}

/** Where to write the OS icon badge (handles remote server.url shells). */
function resolveNativeBadgeWritePlatform(): "ios" | "android" | null {
  const pushPlatform = getNativePushPlatform();
  if (pushPlatform) return pushPlatform;
  if (isCapacitorNativeShell()) return "ios";
  return null;
}

function canWriteNativeAppBadge(): boolean {
  return resolveNativeBadgeWritePlatform() != null;
}

async function applyNativeAppBadgeCount(count: number): Promise<void> {
  const safeCount = Math.max(0, Math.floor(count));
  const platform = resolveNativeBadgeWritePlatform();
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
  if (!canWriteNativeAppBadge()) return;
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
  if (!NATIVE_HOME_SCREEN_BADGE_ENABLED) {
    await applyNativeAppBadgeCount(0);
    return;
  }

  const { count, error } = await resolveBadgeCountWithRetry();
  if (error) {
    console.warn("[native_app_badge] count failed; clearing stale badge:", error.message);
    await applyNativeAppBadgeCount(0);
    return;
  }
  await applyNativeAppBadgeCount(count);
}

/**
 * Sets the OS app-icon badge to match header unread counts (bell + Messages when shown).
 * Always attempts to write the resolved count so a stale "1" from APNs does not linger.
 */
export async function syncNativeAppBadgeNow(): Promise<void> {
  if (!canWriteNativeAppBadge()) return;

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
  if (!canWriteNativeAppBadge()) return;
  if (!NATIVE_HOME_SCREEN_BADGE_ENABLED) {
    void clearNativeAppBadge();
    return;
  }
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = undefined;
    void syncNativeAppBadgeNow();
  }, delayMs);
}

/** Clears stale SpringBoard badges after cold start; syncs when badge is enabled. */
export function scheduleNativeAppBadgeBootClear(): void {
  if (!canWriteNativeAppBadge()) return;
  if (!NATIVE_HOME_SCREEN_BADGE_ENABLED) {
    for (const ms of [400, 1200, 3500]) {
      window.setTimeout(() => void clearNativeAppBadge(), ms);
    }
    return;
  }
  for (const ms of [400, 1200, 3500]) {
    window.setTimeout(() => void syncNativeAppBadgeNow(), ms);
  }
}
