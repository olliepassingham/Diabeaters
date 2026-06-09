const SKIPPED_PROFILE_KEY = "diabeater_community_skipped_profile_setup";
const DISMISSED_PREFIX = "diabeater_community_tools_profile_reminder_dismissed_u_";

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
    return localStorage.getItem(`${DISMISSED_PREFIX}${userId}`) === "true";
  } catch {
    return false;
  }
}

export function dismissCommunityToolsProfileReminder(userId: string): void {
  try {
    localStorage.setItem(`${DISMISSED_PREFIX}${userId}`, "true");
    localStorage.removeItem(SKIPPED_PROFILE_KEY);
  } catch {
    // ignore
  }
}

export function clearCommunityProfileReminderState(userId: string): void {
  try {
    localStorage.removeItem(SKIPPED_PROFILE_KEY);
    localStorage.removeItem(`${DISMISSED_PREFIX}${userId}`);
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
