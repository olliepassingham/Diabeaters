import { rescheduleBedtimeReminders } from "@/lib/bedtime-reminders";
import { DEFAULT_BEDTIME_REMINDER_TIME } from "@/lib/bedtime-reminder-schedule";
import { syncNotificationPreferences } from "@/lib/notification-preferences";
import { storage } from "@/lib/storage";

const PENDING_SESSION_KEY = "diabeater_bedtime_reminder_prompt_pending";
const ONBOARDING_DISMISSED_PREFIX = "diabeater_bedtime_reminder_onboarding_dismissed_u_";
const SECOND_CHANCE_DISMISSED_PREFIX = "diabeater_bedtime_reminder_second_chance_dismissed_u_";

/** Set when patient (User Mode) onboarding finishes (same session). */
export function markBedtimeReminderPromptPending(): void {
  try {
    sessionStorage.setItem(PENDING_SESSION_KEY, "1");
  } catch {
    // ignore
  }
}

export function consumeBedtimeReminderPromptPending(): boolean {
  try {
    const pending = sessionStorage.getItem(PENDING_SESSION_KEY) === "1";
    if (pending) sessionStorage.removeItem(PENDING_SESSION_KEY);
    return pending;
  } catch {
    return false;
  }
}

export function isBedtimeReminderOnboardingPromptDismissed(userId: string): boolean {
  try {
    return localStorage.getItem(`${ONBOARDING_DISMISSED_PREFIX}${userId}`) === "true";
  } catch {
    return false;
  }
}

export function dismissBedtimeReminderOnboardingPrompt(userId: string): void {
  try {
    localStorage.setItem(`${ONBOARDING_DISMISSED_PREFIX}${userId}`, "true");
  } catch {
    // ignore
  }
}

export function isBedtimeReminderSecondChancePromptDismissed(userId: string): boolean {
  try {
    return localStorage.getItem(`${SECOND_CHANCE_DISMISSED_PREFIX}${userId}`) === "true";
  } catch {
    return false;
  }
}

export function dismissBedtimeReminderSecondChancePrompt(userId: string): void {
  try {
    localStorage.setItem(`${SECOND_CHANCE_DISMISSED_PREFIX}${userId}`, "true");
  } catch {
    // ignore
  }
}

export function shouldOfferBedtimeReminderSecondChance(userId: string): boolean {
  const settings = storage.getNotificationSettings();
  if (settings.bedtimeCheckReminders === true) return false;
  if (!isBedtimeReminderOnboardingPromptDismissed(userId)) return false;
  if (isBedtimeReminderSecondChancePromptDismissed(userId)) return false;
  return true;
}

/** Turn on bedtime check reminders and schedule native / in-app nudges. */
export async function enableBedtimeCheckReminders(time?: string): Promise<void> {
  const current = storage.getNotificationSettings();
  const reminderTime = time?.trim() || current.bedtimeReminderTime || DEFAULT_BEDTIME_REMINDER_TIME;
  const updated = {
    ...current,
    enabled: true,
    bedtimeCheckReminders: true,
    bedtimeReminderTime: reminderTime,
  };
  storage.saveNotificationSettings(updated);
  await syncNotificationPreferences(updated);
  await rescheduleBedtimeReminders();
}

export type BedtimeReminderPromptAction = "show" | "skip";

/**
 * After patient onboarding, decide whether to show the bedtime reminder opt-in dialog.
 */
export function resolveBedtimeReminderPromptAfterOnboarding(userId: string): BedtimeReminderPromptAction {
  if (!consumeBedtimeReminderPromptPending()) return "skip";
  if (isBedtimeReminderOnboardingPromptDismissed(userId)) return "skip";

  const settings = storage.getNotificationSettings();
  if (settings.bedtimeCheckReminders === true) return "skip";

  return "show";
}
