import { describe, expect, it } from "vitest";
import {
  ALCOHOL_DRINKS,
  ALCOHOL_DRINK_PATTERNS,
  formatAlcoholDrinkCarbsForField,
  suggestAlcoholIntensity,
  summarizeAlcoholDrinks,
} from "./alcohol-drinks";

describe("alcohol drinks", () => {
  it("lists common servings with a carb figure and a pattern", () => {
    expect(ALCOHOL_DRINKS.map((drink) => drink.id)).toEqual([
      "pint-lager",
      "half-lager",
      "pint-cider",
      "wine-small",
      "wine-large",
      "prosecco",
      "spirit-diet",
      "spirit-sugar",
      "alcopop",
      "cocktail",
      "low-alcohol-beer",
    ]);
    for (const drink of ALCOHOL_DRINKS) {
      expect(drink.carbsGrams).toBeGreaterThanOrEqual(0);
      expect(ALCOHOL_DRINK_PATTERNS[drink.patternId].length).toBeGreaterThan(10);
    }
    expect(ALCOHOL_DRINKS.find((drink) => drink.id === "spirit-diet")?.carbsGrams).toBe(0);
  });

  it("adds carbs and keeps each pattern once", () => {
    const summary = summarizeAlcoholDrinks([
      { id: "pint-lager", count: 2 },
      { id: "wine-small", count: 1 },
      { id: "missing", count: 4 },
      { id: "pint-cider", count: 0 },
    ]);
    expect(summary.drinkCount).toBe(3);
    expect(summary.carbsGrams).toBe(14 * 2 + 2);
    expect(summary.labels).toEqual(["2 × Pint of lager", "Small glass of wine"]);
    expect(summary.patternLines).toEqual([
      ALCOHOL_DRINK_PATTERNS.carb_then_low,
      ALCOHOL_DRINK_PATTERNS.low_carb_later_low,
    ]);
    expect(summary.suggestedIntensity).toBe("moderate");
  });

  it("suggests a heavier night from four drinks", () => {
    expect(suggestAlcoholIntensity(0)).toBeNull();
    expect(suggestAlcoholIntensity(1)).toBe("light");
    expect(suggestAlcoholIntensity(3)).toBe("moderate");
    expect(suggestAlcoholIntensity(4)).toBe("long_or_heavy");
  });

  it("fills the carb box in grams or CP", () => {
    expect(formatAlcoholDrinkCarbsForField(14, "grams")).toBe("14");
    expect(formatAlcoholDrinkCarbsForField(2, "cp")).toBe("0.2");
    expect(formatAlcoholDrinkCarbsForField(20, "cp")).toBe("2");
    expect(formatAlcoholDrinkCarbsForField(0, "cp")).toBe("0");
  });
});