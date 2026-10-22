import { describe, expect, it } from "vitest";
import {
  buildAlcoholSituationOutcome,
  type AlcoholSituationInput,
} from "./alcohol-situation-tool";
import type { UserSettings } from "./storage";

const settings = { tdd: 50 } as UserSettings;

const baseInput: AlcoholSituationInput = {
  situation: "meal_with_drinks",
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
  carbsG: 50,
  mealType: "dinner",
};

describe("buildAlcoholSituationOutcome estimate tips", () => {
  it("warns pump users who have not entered IOB, plus the overnight basal tip", () => {
    const outcome = buildAlcoholSituationOutcome(
      { ...baseInput, isPump: true, pumpIobUnits: null },
      settings,
      "mmol/L",
    );
    expect(outcome.kind).toBe("estimate");
    if (outcome.kind !== "estimate") return;
    expect(outcome.tips.join(" ")).toMatch(/insulin on board from the pump/i);
    expect(outcome.tips.join(" ")).toMatch(/temp basal/i);
  });

  it("skips the IOB warning once pump IOB is entered", () => {
    const outcome = buildAlcoholSituationOutcome(
      { ...baseInput, isPump: true, pumpIobUnits: 1.5 },
      settings,
      "mmol/L",
    );
    expect(outcome.kind).toBe("estimate");
    if (outcome.kind !== "estimate") return;
    expect(outcome.tips.join(" ")).not.toMatch(/Enter insulin on board/i);
    expect(outcome.tips.join(" ")).toMatch(/temp basal/i);
  });

  it("gives pen users the long-acting overnight line", () => {
    const outcome = buildAlcoholSituationOutcome({ ...baseInput, isPump: false }, settings, "mmol/L");
    expect(outcome.kind).toBe("estimate");
    if (outcome.kind !== "estimate") return;
    expect(outcome.tips.join(" ")).toMatch(/long-acting/i);
  });
});
