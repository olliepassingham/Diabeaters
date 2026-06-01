import { syncNotificationPreferences } from "@/lib/notification-preferences";
import { isNativePushPlatform } from "@/lib/native-platform";
import {
  checkNativePushPermission,
  ensureNativePushRegistered,
  syncRememberedPushTokenToSupabase,
} from "@/lib/push-tokens";
import { storage } from "@/lib/storage";

const PENDING_SESSION_KEY = "diabeater_community_push_prompt_pending";
const DISMISSED_PREFIX = "diabeater_community_push_prompt_dismissed_u_";

/** Set when community onboarding finishes (same session). */
export function markCommunityPushPromptPending(): void {
  try {
    sessionStorage.setItem(PENDING_SESSION_KEY, "1");
  } catch {
    // ignore
  }
}

export function consumeCommunityPushPromptPending(): boolean {
  try {
    const pending = sessionStorage.getItem(PENDING_SESSION_KEY) === "1";
    if (pending) sessionStorage.removeItem(PENDING_SESSION_KEY);
    return pending;
  } catch {
    return false;
  }
}

export function isCommunityPushPromptDismissed(userId: string): boolean {
  try {
    return localStorage.getItem(`${DISMISSED_PREFIX}${userId}`) === "true";
  } catch {
    return false;
  }
}

export function dismissCommunityPushPrompt(userId: string): void {
  try {
    localStorage.setItem(`${DISMISSED_PREFIX}${userId}`, "true");
  } catch {
    // ignore
  }
}

/** Turn on community feed + DM push prefs and register for remote push (native only). */
export async function enableCommunityPushNotifications(): Promise<void> {
  const current = storage.getNotificationSettings();
  const updated = {
    ...current,
    enabled: true,
    pushNotifications: true,
    communityFeedAlerts: true,
    communityDmAlerts: true,
  };
  storage.saveNotificationSettings(updated);
  await syncNotificationPreferences(updated);
  if (isNativePushPlatform()) {
    await ensureNativePushRegistered();
    await syncRememberedPushTokenToSupabase();
  }
}

export type CommunityPushPromptAction = "show" | "skip";

/**
 * After community onboarding, decide whether to show the push prompt on first landing.
 * Skips web, prior dismiss, or when push is already granted (still syncs token/prefs).
 */
export async function resolveCommunityPushPromptAfterOnboarding(
  userId: string,
): Promise<CommunityPushPromptAction> {
  if (!consumeCommunityPushPromptPending()) return "skip";
  if (!isNativePushPlatform()) return "skip";
  if (isCommunityPushPromptDismissed(userId)) return "skip";

  const perm = await checkNativePushPermission();
  if (perm === "granted") {
    await enableCommunityPushNotifications();
    dismissCommunityPushPrompt(userId);
    return "skip";
  }

  return "show";
}
