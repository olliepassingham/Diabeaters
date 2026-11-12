import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearCommunityProfileReminderState,
  dismissCommunityFeedProfileReminder,
  dismissCommunityToolsProfileReminder,
  markCommunitySkippedProfileSetup,
  shouldShowCommunityFeedProfileReminder,
  shouldShowCommunityToolsProfileReminder,
} from "@/lib/community-profile-prompt";

const USER_ID = "community-u1";

describe("community-profile-prompt", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("shows tools reminder after skipping profile setup until dismissed or cleared", () => {
    expect(shouldShowCommunityToolsProfileReminder(USER_ID)).toBe(false);
    markCommunitySkippedProfileSetup();
    expect(shouldShowCommunityToolsProfileReminder(USER_ID)).toBe(true);
    dismissCommunityToolsProfileReminder(USER_ID);
    expect(shouldShowCommunityToolsProfileReminder(USER_ID)).toBe(false);
  });

  it("clearCommunityProfileReminderState resets skip and dismiss flags", () => {
    markCommunitySkippedProfileSetup();
    dismissCommunityToolsProfileReminder(USER_ID);
    clearCommunityProfileReminderState(USER_ID);
    markCommunitySkippedProfileSetup();
    expect(shouldShowCommunityToolsProfileReminder(USER_ID)).toBe(true);
  });

  it("shows feed reminder when public profile is incomplete until dismissed", () => {
    const incomplete = { full_name: null, public_handle: null, is_public: false };
    expect(shouldShowCommunityFeedProfileReminder(USER_ID, incomplete)).toBe(true);
    dismissCommunityFeedProfileReminder(USER_ID);
    expect(shouldShowCommunityFeedProfileReminder(USER_ID, incomplete)).toBe(false);
    expect(shouldShowCommunityFeedProfileReminder(USER_ID, { full_name: "A", public_handle: "ab_c", is_public: true })).toBe(
      false,
    );
  });

  it("re-shows the feed reminder to members who dismissed the original version", () => {
    localStorage.setItem(`diabeater_community_feed_profile_reminder_dismissed_u_${USER_ID}`, "true");
    const noHandle = { full_name: "A", public_handle: null, is_public: true };
    expect(shouldShowCommunityFeedProfileReminder(USER_ID, noHandle)).toBe(true);
  });
});
