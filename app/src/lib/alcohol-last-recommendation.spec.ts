import { describe, expect, it } from "vitest";

import { formatAlcoholRecommendationWhen, alcoholRecommendationSummary } from "./alcohol-last-recommendation";
import type { AlcoholSituationInput, AlcoholSituationOutcome } from "./alcohol-situation-tool";

const input: AlcoholSituationInput = {
  situation: "before_out",
  redFlags: {
    vomiting: false,
    severeAbdominalPain: false,
    confusion: false,
    veryHighBgOrKetones: false,
    cantKeepFluids: false,
  },
  bgSkipped: true,
  bgValue: null,
  bgTrend: null,
  drinkingIntensity: "moderate",
  carbsG: null,
  mealType: "snack",
};

describe("alcoholRecommendationSummary", () => {
  it("skips prompts that did not produce guidance", () => {
    const outcome: AlcoholSituationOutcome = { kind: "needs_carbs", message: "Enter carbs" };
    expect(alcoholRecommendationSummary(input, outcome)).toBeNull();
  });

  it("describes the night from the situation and drinking level", () => {
    const outcome: AlcoholSituationOutcome = {
      kind: "prep_only",
      headline: "Before you go out",
      tips: [],
      checklist: [],
    };
    expect(alcoholRecommendationSummary(input, outcome)).toBe("Before going out · Moderate");
  });
});

describe("formatAlcoholRecommendationWhen", () => {
  const now = new Date(2026, 8, 28, 11, 0, 0);

  it("calls yesterday last night", () => {
    const asked = new Date(2026, 8, 27, 21, 40, 0).toISOString();
    expect(formatAlcoholRecommendationWhen(asked, now).title).toBe("Last night");
  });

  it("labels an older ask as last time", () => {
    const asked = new Date(2026, 8, 20, 21, 40, 0).toISOString();
    expect(formatAlcoholRecommendationWhen(asked, now).title).toBe("Last time");
  });
});
