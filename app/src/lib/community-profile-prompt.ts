import { needsCommunityProfileSetup, type ProfileRow } from "@/lib/profile";

const SKIPPED_PROFILE_KEY = "diabeater_community_skipped_profile_setup";
const TOOLS_DISMISSED_PREFIX = "diabeater_community_tools_profile_reminder_dismissed_u_";
const FEED_DISMISSED_PREFIX = "diabeater_community_feed_profile_reminder_dismissed_u_";

/** Set when community onboarding finishes via “Browse tools” instead of profile setup. */
export function markCommunitySkippedProfileSetup(): void {
  try {
    localStorage.setItem(SKIPPED_PROFILE_KEY, "true");
  } catch {
    // ignore
  }
}

export function clearCommunitySkippedProfileSetup(): void {
  try {
    localStorage.removeItem(SKIPPED_PROFILE_KEY);
  } catch {
    // ignore
  }
}

export function isCommunityToolsProfileReminderDismissed(userId: string): boolean {
  try {
    return localStorage.getItem(`${TOOLS_DISMISSED_PREFIX}${userId}`) === "true";
  } catch {
    return false;
  }
}

export function dismissCommunityToolsProfileReminder(userId: string): void {
  try {
    localStorage.setItem(`${TOOLS_DISMISSED_PREFIX}${userId}`, "true");
    localStorage.removeItem(SKIPPED_PROFILE_KEY);
  } catch {
    // ignore
  }
}

export function isCommunityFeedProfileReminderDismissed(userId: string): boolean {
  try {
    return localStorage.getItem(`${FEED_DISMISSED_PREFIX}${userId}`) === "true";
  } catch {
    return false;
  }
}

export function dismissCommunityFeedProfileReminder(userId: string): void {
  try {
    localStorage.setItem(`${FEED_DISMISSED_PREFIX}${userId}`, "true");
  } catch {
    // ignore
  }
}

export function clearCommunityProfileReminderState(userId: string): void {
  try {
    localStorage.removeItem(SKIPPED_PROFILE_KEY);
    localStorage.removeItem(`${TOOLS_DISMISSED_PREFIX}${userId}`);
    localStorage.removeItem(`${FEED_DISMISSED_PREFIX}${userId}`);
  } catch {
    // ignore
  }
}

export function shouldShowCommunityToolsProfileReminder(userId: string): boolean {
  if (isCommunityToolsProfileReminderDismissed(userId)) return false;
  try {
    return localStorage.getItem(SKIPPED_PROFILE_KEY) === "true";
  } catch {
    return false;
  }
}

export function shouldShowCommunityFeedProfileReminder(
  userId: string,
  profile: Pick<ProfileRow, "full_name" | "public_handle" | "is_public"> | null | undefined,
): boolean {
  if (!userId || !needsCommunityProfileSetup(profile)) return false;
  return !isCommunityFeedProfileReminderDismissed(userId);
}
