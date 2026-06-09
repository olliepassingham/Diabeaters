const CARER_ONBOARDED_KEY = "diabeater_carer_onboarded";
const DISMISSED_PREFIX = "diabeater_supporter_profile_prompt_dismissed_u_";

/** Set when a supporter successfully redeems an invite. */
export function markSupporterCarerOnboarded(): void {
  try {
    localStorage.setItem(CARER_ONBOARDED_KEY, "true");
  } catch {
    // ignore
  }
}

export function isSupporterProfilePromptDismissed(userId: string): boolean {
  try {
    return localStorage.getItem(`${DISMISSED_PREFIX}${userId}`) === "true";
  } catch {
    return false;
  }
}

export function dismissSupporterProfilePrompt(userId: string): void {
  try {
    localStorage.setItem(`${DISMISSED_PREFIX}${userId}`, "true");
    localStorage.removeItem(CARER_ONBOARDED_KEY);
  } catch {
    // ignore
  }
}

export function clearSupporterProfilePromptState(userId: string): void {
  try {
    localStorage.removeItem(CARER_ONBOARDED_KEY);
    localStorage.removeItem(`${DISMISSED_PREFIX}${userId}`);
  } catch {
    // ignore
  }
}

export function shouldShowSupporterProfilePrompt(userId: string): boolean {
  if (isSupporterProfilePromptDismissed(userId)) return false;
  try {
    return localStorage.getItem(CARER_ONBOARDED_KEY) === "true";
  } catch {
    return false;
  }
}
