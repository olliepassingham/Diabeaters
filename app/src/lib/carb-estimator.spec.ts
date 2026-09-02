import { describe, expect, it } from "vitest";
import {
  estimateCarbMeal,
  estimateCarbSelection,
  normalizeCarbSearch,
  searchCarbFoods,
} from "@/lib/carb-estimator";

describe("carb estimator", () => {
  it("normalizes punctuation, spacing and accents", () => {
    expect(normalizeCarbSearch("  Café—Latte! ")).toBe("cafe latte");
  });

  it("finds foods by name and alias", () => {
    expect(searchCarbFoods("banana")[0]?.id).toBe("banana");
    expect(searchCarbFoods("oatmeal")[0]?.id).toBe("porridge");
    expect(searchCarbFoods("chippy")[0]?.id).toBe("fish-chips");
  });

  it("can browse a category with no query", () => {
    const results = searchCarbFoods("", { category: "fruit", limit: 20 });
    expect(results.length).toBeGreaterThan(3);
    expect(results.every((food) => food.category === "fruit")).toBe(true);
  });

  it("scales a selected portion by quantity", () => {
    const result = estimateCarbSelection({
      id: "one",
      foodId: "toast",
      portionId: "one-slice",
      quantity: 2,
    });
    expect(result?.estimatedGrams).toBe(30);
    expect(result?.lowGrams).toBe(24);
    expect(result?.highGrams).toBe(36);
  });

  it("totals multiple meal items and rounds the displayed range outwards", () => {
    const result = estimateCarbMeal([
      { id: "toast", foodId: "toast", portionId: "two-slices", quantity: 1 },
      { id: "milk", foodId: "milk", portionId: "glass", quantity: 1 },
    ]);
    expect(result.estimatedGrams).toBe(40);
    expect(result.suggestedGrams).toBe(40);
    expect(result.lowGrams).toBe(33);
    expect(result.highGrams).toBe(47);
    expect(result.items).toHaveLength(2);
  });

  it("ignores invalid food, portion and quantity selections", () => {
    expect(
      estimateCarbSelection({ id: "bad", foodId: "unknown", portionId: "regular", quantity: 1 }),
    ).toBeNull();
    expect(
      estimateCarbSelection({ id: "bad", foodId: "banana", portionId: "regular", quantity: 0 }),
    ).toBeNull();
    expect(
      estimateCarbSelection({ id: "bad", foodId: "banana", portionId: "missing", quantity: 1 }),
    ).toBeNull();
    expect(estimateCarbMeal([])).toEqual({
      items: [],
      estimatedGrams: 0,
      suggestedGrams: 0,
      lowGrams: 0,
      highGrams: 0,
    });
  });
});
