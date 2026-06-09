import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isPublicCommunityProfileComplete, needsCommunityProfileSetup } from "@/lib/profile";
import {
  clearSupporterProfilePromptState,
  dismissSupporterProfilePrompt,
  markSupporterCarerOnboarded,
  shouldShowSupporterProfilePrompt,
} from "@/lib/supporter-profile-prompt";

const USER_ID = "supporter-u1";

describe("isPublicCommunityProfileComplete", () => {
  it("requires public visibility, name, and valid handle", () => {
    expect(
      isPublicCommunityProfileComplete({
        is_public: true,
        full_name: "Sam Supporter",
        public_handle: "sam_s",
      }),
    ).toBe(true);
    expect(
      isPublicCommunityProfileComplete({
        is_public: false,
        full_name: "Sam Supporter",
        public_handle: "sam_s",
      }),
    ).toBe(false);
    expect(
      isPublicCommunityProfileComplete({
        is_public: true,
        full_name: "",
        public_handle: "sam_s",
      }),
    ).toBe(false);
    expect(needsCommunityProfileSetup(null)).toBe(true);
  });
});

describe("supporter-profile-prompt", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("shows prompt after onboarding flag until dismissed or cleared", () => {
    expect(shouldShowSupporterProfilePrompt(USER_ID)).toBe(false);
    markSupporterCarerOnboarded();
    expect(shouldShowSupporterProfilePrompt(USER_ID)).toBe(true);
    dismissSupporterProfilePrompt(USER_ID);
    expect(shouldShowSupporterProfilePrompt(USER_ID)).toBe(false);
  });

  it("clearSupporterProfilePromptState resets onboarding and dismiss flags", () => {
    markSupporterCarerOnboarded();
    dismissSupporterProfilePrompt(USER_ID);
    clearSupporterProfilePromptState(USER_ID);
    markSupporterCarerOnboarded();
    expect(shouldShowSupporterProfilePrompt(USER_ID)).toBe(true);
  });
});
