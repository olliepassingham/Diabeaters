import { describe, expect, it } from "vitest";

import { buildOnboardingSteps } from "@/lib/onboarding-routes";

describe("buildOnboardingSteps", () => {
  it("inserts struggle preview for patient paths", () => {
    expect(
      buildOnboardingSteps({
        upgradeFlow: false,
        showCommunityPath: false,
        showBothPath: false,
        minimalSetup: false,
      }),
    ).toEqual(["welcome", "struggle", "struggle_preview", "region", "details", "disclaimer", "first_win"]);
  });

  it("omits details when minimal setup is chosen", () => {
    expect(
      buildOnboardingSteps({
        upgradeFlow: false,
        showCommunityPath: false,
        showBothPath: false,
        minimalSetup: true,
      }),
    ).toEqual(["welcome", "struggle", "struggle_preview", "region", "disclaimer", "first_win"]);
  });

  it("keeps community and upgrade flows unchanged", () => {
    expect(
      buildOnboardingSteps({
        upgradeFlow: true,
        showCommunityPath: false,
        showBothPath: false,
        minimalSetup: true,
      }),
    ).toEqual(["details", "disclaimer", "first_win"]);
    expect(
      buildOnboardingSteps({
        upgradeFlow: false,
        showCommunityPath: true,
        showBothPath: false,
        minimalSetup: true,
      }),
    ).toEqual(["welcome", "region", "disclaimer", "first_win"]);
  });
});
