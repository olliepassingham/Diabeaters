import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearCommunityProfileReminderState,
  dismissCommunityToolsProfileReminder,
  markCommunitySkippedProfileSetup,
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
});
