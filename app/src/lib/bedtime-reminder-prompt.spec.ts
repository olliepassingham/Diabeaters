import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  consumeBedtimeReminderPromptPending,
  dismissBedtimeReminderOnboardingPrompt,
  dismissBedtimeReminderSecondChancePrompt,
  enableBedtimeCheckReminders,
  isBedtimeReminderOnboardingPromptDismissed,
  isBedtimeReminderSecondChancePromptDismissed,
  markBedtimeReminderPromptPending,
  resolveBedtimeReminderPromptAfterOnboarding,
  shouldOfferBedtimeReminderSecondChance,
} from "@/lib/bedtime-reminder-prompt";
import { storage } from "@/lib/storage";

vi.mock("@/lib/notification-preferences", () => ({
  syncNotificationPreferences: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/bedtime-reminders", () => ({
  rescheduleBedtimeReminders: vi.fn().mockResolvedValue(undefined),
}));

const USER_ID = "user-test-1";
const PENDING_KEY = "diabeater_bedtime_reminder_prompt_pending";
const ONBOARDING_DISMISSED_KEY = `diabeater_bedtime_reminder_onboarding_dismissed_u_${USER_ID}`;
const SECOND_CHANCE_DISMISSED_KEY = `diabeater_bedtime_reminder_second_chance_dismissed_u_${USER_ID}`;
const NOTIF_KEY = "diabeater_notification_settings";

describe("bedtime-reminder-prompt", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("marks and consumes pending flag once", () => {
    markBedtimeReminderPromptPending();
    expect(sessionStorage.getItem(PENDING_KEY)).toBe("1");
    expect(consumeBedtimeReminderPromptPending()).toBe(true);
    expect(consumeBedtimeReminderPromptPending()).toBe(false);
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it("tracks onboarding dismiss per user", () => {
    expect(isBedtimeReminderOnboardingPromptDismissed(USER_ID)).toBe(false);
    dismissBedtimeReminderOnboardingPrompt(USER_ID);
    expect(localStorage.getItem(ONBOARDING_DISMISSED_KEY)).toBe("true");
    expect(isBedtimeReminderOnboardingPromptDismissed(USER_ID)).toBe(true);
  });

  it("tracks second-chance dismiss per user", () => {
    expect(isBedtimeReminderSecondChancePromptDismissed(USER_ID)).toBe(false);
    dismissBedtimeReminderSecondChancePrompt(USER_ID);
    expect(localStorage.getItem(SECOND_CHANCE_DISMISSED_KEY)).toBe("true");
    expect(isBedtimeReminderSecondChancePromptDismissed(USER_ID)).toBe(true);
  });

  it("resolveBedtimeReminderPromptAfterOnboarding shows when pending and not dismissed", () => {
    markBedtimeReminderPromptPending();
    expect(resolveBedtimeReminderPromptAfterOnboarding(USER_ID)).toBe("show");
  });

  it("resolveBedtimeReminderPromptAfterOnboarding skips without pending flag", () => {
    expect(resolveBedtimeReminderPromptAfterOnboarding(USER_ID)).toBe("skip");
  });

  it("resolveBedtimeReminderPromptAfterOnboarding skips when onboarding dismissed", () => {
    markBedtimeReminderPromptPending();
    dismissBedtimeReminderOnboardingPrompt(USER_ID);
    expect(resolveBedtimeReminderPromptAfterOnboarding(USER_ID)).toBe("skip");
  });

  it("resolveBedtimeReminderPromptAfterOnboarding skips when reminders already on", () => {
    markBedtimeReminderPromptPending();
    storage.saveNotificationSettings({
      ...storage.getNotificationSettings(),
      bedtimeCheckReminders: true,
    });
    expect(resolveBedtimeReminderPromptAfterOnboarding(USER_ID)).toBe("skip");
  });

  it("shouldOfferBedtimeReminderSecondChance requires onboarding dismiss and reminders off", () => {
    expect(shouldOfferBedtimeReminderSecondChance(USER_ID)).toBe(false);

    dismissBedtimeReminderOnboardingPrompt(USER_ID);
    expect(shouldOfferBedtimeReminderSecondChance(USER_ID)).toBe(true);

    dismissBedtimeReminderSecondChancePrompt(USER_ID);
    expect(shouldOfferBedtimeReminderSecondChance(USER_ID)).toBe(false);
  });

  it("shouldOfferBedtimeReminderSecondChance is false when reminders already enabled", () => {
    dismissBedtimeReminderOnboardingPrompt(USER_ID);
    storage.saveNotificationSettings({
      ...storage.getNotificationSettings(),
      bedtimeCheckReminders: true,
    });
    expect(shouldOfferBedtimeReminderSecondChance(USER_ID)).toBe(false);
  });

  it("enableBedtimeCheckReminders turns on prefs with chosen time", async () => {
    await enableBedtimeCheckReminders("21:00");

    const raw = localStorage.getItem(NOTIF_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as { bedtimeCheckReminders?: boolean; bedtimeReminderTime?: string; enabled?: boolean };
    expect(parsed.bedtimeCheckReminders).toBe(true);
    expect(parsed.bedtimeReminderTime).toBe("21:00");
    expect(parsed.enabled).toBe(true);

    const settings = storage.getNotificationSettings();
    expect(settings.bedtimeCheckReminders).toBe(true);
    expect(settings.bedtimeReminderTime).toBe("21:00");
  });
});
