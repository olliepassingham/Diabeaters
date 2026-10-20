import { describe, expect, it } from "vitest";
import { CARB_FOODS } from "@/lib/carb-estimator-data";
import {
  estimateCarbMeal,
  estimateCarbSelection,
  normalizeCarbSearch,
  mealCompositionFromFoods,
  routineCarbFoodLines,
  routineFoodsFromSelections,
  searchCarbFoods,
  selectionsFromRoutineFoods,
} from "@/lib/carb-estimator";

describe("carb estimator", () => {
  it("normalizes punctuation, spacing and accents", () => {
    expect(normalizeCarbSearch("  Café—Latte! ")).toBe("cafe latte");
  });

  it("finds foods by name and alias", () => {
    expect(searchCarbFoods("banana")[0]?.id).toBe("banana");
    expect(searchCarbFoods("oatmeal")[0]?.id).toBe("porridge");
    expect(searchCarbFoods("chippy")[0]?.id).toBe("fish-chips");
    expect(searchCarbFoods("yogurt")[0]?.id).toBe("yogurt");
    expect(searchCarbFoods("yoghurt")[0]?.id).toBe("yogurt");
    expect(searchCarbFoods("weetabix")[0]?.id).toBe("weetabix");
    expect(searchCarbFoods("cheese")[0]?.id).toBe("cheddar");
    expect(searchCarbFoods("chicken")[0]?.id).toBe("chicken");
    expect(searchCarbFoods("pitta")[0]?.id).toBe("pitta");
    expect(searchCarbFoods("peas")[0]?.id).toBe("peas");
    expect(searchCarbFoods("butty")[0]?.id).toBe("sandwich");
    expect(searchCarbFoods("sarnie")[0]?.id).toBe("sandwich");
    expect(searchCarbFoods("chips")[0]?.id).toBe("chips");
    expect(searchCarbFoods("ketchup")[0]?.id).toBe("ketchup");
    expect(searchCarbFoods("pasta sauce")[0]?.id).toBe("pasta-sauce");
    expect(searchCarbFoods("flour")[0]?.id).toBe("plain-flour");
    expect(searchCarbFoods("uncooked rice")[0]?.id).toBe("dry-rice");
    expect(searchCarbFoods("kidney beans")[0]?.id).toBe("kidney-beans");
    expect(searchCarbFoods("tofu")[0]?.id).toBe("tofu");
    expect(searchCarbFoods("mozzarella")[0]?.id).toBe("mozzarella");
    expect(searchCarbFoods("medjool")[0]?.id).toBe("dates");
    expect(searchCarbFoods("nachos")[0]?.id).toBe("tortilla-chips");
  });

  it("browses cooking ingredients as their own category", () => {
    const results = searchCarbFoods("", { category: "ingredients", limit: 50 });
    expect(results.length).toBeGreaterThan(10);
    expect(results.every((food) => food.category === "ingredients")).toBe(true);
    expect(results.map((food) => food.id)).toContain("plain-flour");
  });

  it("builds a meal from weighed ingredients", () => {
    const result = estimateCarbMeal([
      { id: "pasta", foodId: "dry-pasta", portionId: "regular", quantity: 1 },
      { id: "tomatoes", foodId: "chopped-tomatoes", portionId: "regular", quantity: 1 },
      { id: "beans", foodId: "kidney-beans", portionId: "regular", quantity: 1 },
    ]);
    expect(result.estimatedGrams).toBe(95);
    expect(result.compositionHint).toEqual({
      carbType: "starchy",
      hasFat: false,
      hasProtein: true,
      hasFibre: true,
    });
  });

  it("keeps one entry per food", () => {
    const ids = CARB_FOODS.map((food) => food.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(CARB_FOODS.length).toBeGreaterThan(80);
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
    expect(result.compositionHint).toEqual({
      carbType: "quick_refined",
      hasFat: false,
      hasProtein: true,
      hasFibre: false,
    });
  });

  it("keeps valid foods from a routine and drops ones the list no longer has", () => {
    const foods = routineFoodsFromSelections([
      { id: "ok", foodId: "banana", portionId: "regular", quantity: 2 },
      { id: "bad", foodId: "not-a-food", portionId: "regular", quantity: 1 },
    ]);
    expect(foods).toEqual([{ foodId: "banana", portionId: "regular", quantity: 2 }]);
    expect(selectionsFromRoutineFoods(foods)[0]).toEqual(
      expect.objectContaining({ foodId: "banana", quantity: 2 }),
    );
    expect(routineCarbFoodLines(foods)[0]?.label).toBe("2× Banana · 1 medium banana · 54g");
    expect(mealCompositionFromFoods(foods)).toEqual({
      carbType: "fruit",
      hasFat: false,
      hasProtein: false,
      hasFibre: true,
    });
    expect(mealCompositionFromFoods(undefined)).toBeNull();
    expect(selectionsFromRoutineFoods([{ foodId: "gone", portionId: "regular", quantity: 1 }])).toEqual([]);
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
      compositionHint: null,
    });
  });

  it("suggests likely composition for a complete meal", () => {
    const result = estimateCarbMeal([
      { id: "meal", foodId: "curry-rice", portionId: "regular", quantity: 1 },
    ]);
    expect(result.compositionHint).toEqual({
      carbType: "balanced",
      hasFat: true,
      hasProtein: true,
      hasFibre: true,
    });
  });
});
