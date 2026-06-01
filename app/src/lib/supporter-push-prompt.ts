import { syncNotificationPreferences } from "@/lib/notification-preferences";
import { isNativePushPlatform } from "@/lib/native-platform";
import {
  checkNativePushPermission,
  ensureNativePushRegistered,
  syncRememberedPushTokenToSupabase,
} from "@/lib/push-tokens";
import { storage } from "@/lib/storage";

const PENDING_SESSION_KEY = "diabeater_supporter_push_prompt_pending";
const DISMISSED_PREFIX = "diabeater_supporter_push_prompt_dismissed_u_";

/** Set when a supporter successfully redeems an invite (same session). */
export function markSupporterPushPromptPending(): void {
  try {
    sessionStorage.setItem(PENDING_SESSION_KEY, "1");
  } catch {
    // ignore
  }
}

export function consumeSupporterPushPromptPending(): boolean {
  try {
    const pending = sessionStorage.getItem(PENDING_SESSION_KEY) === "1";
    if (pending) sessionStorage.removeItem(PENDING_SESSION_KEY);
    return pending;
  } catch {
    return false;
  }
}

export function isSupporterPushPromptDismissed(userId: string): boolean {
  try {
    return localStorage.getItem(`${DISMISSED_PREFIX}${userId}`) === "true";
  } catch {
    return false;
  }
}

export function dismissSupporterPushPrompt(userId: string): void {
  try {
    localStorage.setItem(`${DISMISSED_PREFIX}${userId}`, "true");
  } catch {
    // ignore
  }
}

/**
 * Turn on local + cloud prefs for all supporter-facing alerts and register for remote push (native only).
 * Matches edge checks: hypo_alerts, supply_alerts, scenario_alerts, and push === true.
 */
export async function enableSupporterPushNotifications(): Promise<void> {
  const current = storage.getNotificationSettings();
  const updated = {
    ...current,
    enabled: true,
    pushNotifications: true,
    hypoAlerts: true,
    supplyAlerts: true,
    scenarioAlerts: true,
    communityFeedAlerts: current.communityFeedAlerts !== false,
    communityDmAlerts: current.communityDmAlerts !== false,
  };
  storage.saveNotificationSettings(updated);
  await syncNotificationPreferences(updated);
  if (isNativePushPlatform()) {
    await ensureNativePushRegistered();
    await syncRememberedPushTokenToSupabase();
  }
}

/** @deprecated Use {@link enableSupporterPushNotifications} */
export const enableSupporterHypoPushNotifications = enableSupporterPushNotifications;

export type SupporterPushPromptAction = "show" | "skip";

/**
 * After linking, decide whether to show the supporter push prompt on Supporter Mode.
 * Skips web, prior dismiss, or when push is already granted (still syncs token/prefs).
 */
export async function resolveSupporterPushPromptAfterLink(userId: string): Promise<SupporterPushPromptAction> {
  if (!consumeSupporterPushPromptPending()) return "skip";
  if (!isNativePushPlatform()) return "skip";
  if (isSupporterPushPromptDismissed(userId)) return "skip";

  const perm = await checkNativePushPermission();
  if (perm === "granted") {
    await enableSupporterPushNotifications();
    dismissSupporterPushPrompt(userId);
    return "skip";
  }

  return "show";
}
