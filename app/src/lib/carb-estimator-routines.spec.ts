import { beforeEach, describe, expect, it } from "vitest";
import { listMealRoutinesForCarbEstimator } from "@/lib/carb-estimator-routines";
import { storage } from "@/lib/storage";

describe("listMealRoutinesForCarbEstimator", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns only meal routines with a positive carb estimate, most recent first", () => {
    storage.addRoutine({
      name: "No carbs yet",
      mealType: "lunch",
      mealDescription: "",
      insulinTiming: "before",
      outcome: "okay",
      tags: [],
    });
    const oats = storage.addRoutine({
      name: "Weekday oats",
      mealType: "breakfast",
      mealDescription: "Porridge",
      carbEstimate: 45,
      insulinTiming: "before",
      outcome: "good",
      tags: [],
    });
    const pasta = storage.addRoutine({
      name: "Pasta night",
      mealType: "dinner",
      mealDescription: "",
      carbEstimate: 70,
      insulinTiming: "before",
      outcome: "great",
      tags: [],
    });
    storage.useRoutine(oats.id);

    const listed = listMealRoutinesForCarbEstimator();
    expect(listed.map((r) => r.id)).toEqual([oats.id, pasta.id]);
  });

  it("filters by name, description, or meal type label", () => {
    storage.addRoutine({
      name: "Gym shake",
      mealType: "snack",
      mealDescription: "banana blend",
      carbEstimate: 30,
      insulinTiming: "with",
      outcome: "okay",
      tags: [],
    });
    storage.addRoutine({
      name: "Sunday roast",
      mealType: "dinner",
      mealDescription: "",
      carbEstimate: 55,
      insulinTiming: "before",
      outcome: "good",
      tags: [],
    });

    expect(listMealRoutinesForCarbEstimator({ query: "banana" }).map((r) => r.name)).toEqual([
      "Gym shake",
    ]);
    expect(listMealRoutinesForCarbEstimator({ query: "dinner" }).map((r) => r.name)).toEqual([
      "Sunday roast",
    ]);
  });
});
