import { describe, expect, it } from "vitest";

import {
  buildOnboardingSteps,
  hasOnboardingMealRatios,
  ONBOARDING_EXERCISE_DEMO_HREF,
  shouldUseRatioAdviserFirstWin,
} from "@/lib/onboarding-routes";

describe("buildOnboardingSteps", () => {
  it("builds patient onboarding path", () => {
    expect(
      buildOnboardingSteps({
        upgradeFlow: false,
        showCommunityPath: false,
        showBothPath: false,
        minimalSetup: false,
      }),
    ).toEqual(["welcome", "struggle", "region", "details", "disclaimer", "first_win"]);
  });

  it("omits details when minimal setup is chosen", () => {
    expect(
      buildOnboardingSteps({
        upgradeFlow: false,
        showCommunityPath: false,
        showBothPath: false,
        minimalSetup: true,
      }),
    ).toEqual(["welcome", "struggle", "region", "disclaimer", "first_win"]);
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

describe("onboarding first-win helpers", () => {
  it("detects meal ratios from any meal slot", () => {
    expect(hasOnboardingMealRatios({ breakfastRatio: "", lunchRatio: "0.8", dinnerRatio: "" })).toBe(true);
    expect(hasOnboardingMealRatios({ breakfastRatio: "", lunchRatio: "", dinnerRatio: "" })).toBe(false);
  });

  it("routes to ratio adviser when ratios unknown or missing", () => {
    expect(
      shouldUseRatioAdviserFirstWin({ breakfastRatio: "1", lunchRatio: "", dinnerRatio: "", mealRatiosUnknown: false }),
    ).toBe(false);
    expect(
      shouldUseRatioAdviserFirstWin({ breakfastRatio: "", lunchRatio: "", dinnerRatio: "", mealRatiosUnknown: true }),
    ).toBe(true);
    expect(shouldUseRatioAdviserFirstWin({ breakfastRatio: "", lunchRatio: "", dinnerRatio: "" })).toBe(true);
  });

  it("builds exercise demo deep link for onboarding", () => {
    expect(ONBOARDING_EXERCISE_DEMO_HREF).toBe("/scenarios/exercise?type=walking&duration=30&intensity=moderate");
  });
});
