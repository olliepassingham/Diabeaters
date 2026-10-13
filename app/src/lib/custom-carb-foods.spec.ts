import { beforeEach, describe, expect, it } from "vitest";
import { estimateCarbSelection, getCarbFood, searchCarbFoods } from "@/lib/carb-estimator";
import { saveCustomCarbFood } from "@/lib/custom-carb-foods";

describe("custom carb foods", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves a name and carb amount and finds it again in search", () => {
    const saved = saveCustomCarbFood("Corner shop yoghurt", 18);
    expect(saved?.id).toBe("custom-corner-shop-yoghurt");
    expect(searchCarbFoods("yoghurt").some((food) => food.id === saved?.id)).toBe(true);
    expect(getCarbFood(saved!.id)?.portions[0]?.carbsGrams).toBe(18);

    const updated = saveCustomCarbFood("Corner shop yoghurt", 22);
    expect(updated?.id).toBe(saved?.id);
    expect(getCarbFood(saved!.id)?.portions[0]?.carbsGrams).toBe(22);
  });

  it("can be used on a meal the same way as a listed food", () => {
    const saved = saveCustomCarbFood("Family curry", 46);
    const item = estimateCarbSelection({
      id: "row",
      foodId: saved!.id,
      portionId: "serving",
      quantity: 1,
    });
    expect(item?.estimatedGrams).toBe(46);
  });

  it("rejects a blank name and an impossible carb amount", () => {
    expect(saveCustomCarbFood(" ", 10)).toBeNull();
    expect(saveCustomCarbFood("Oil", -1)).toBeNull();
    expect(saveCustomCarbFood("Oil", 400)).toBeNull();
  });
});
