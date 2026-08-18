import { describe, expect, it } from "vitest";

import {
  convertGramsToServings,
  formatCarbsAsFavorite,
  formatCarbsForScenario,
  migrateCarbSourcePreferences,
  normalizeCarbSourcePreferences,
} from "./carb-source-preferences";

describe("carb-source-preferences", () => {
  it("convertGramsToServings uses nearest half serving, not a full extra pack", () => {
    expect(convertGramsToServings(45, 22)).toBe(2);
    expect(convertGramsToServings(15, 4)).toBe(4);
    expect(convertGramsToServings(15, 30)).toBe(0.5);
    expect(convertGramsToServings(8, 30)).toBe(0.5);
  });

  it("formats favourite line from grams", () => {
    expect(
      formatCarbsAsFavorite(45, {
        id: "1",
        label: "SIS Beta Fuel gel",
        carbsPerServing: 22,
        unitLabel: "gel",
      }),
    ).toBe("about 2 SIS Beta Fuel gel");
    expect(
      formatCarbsAsFavorite(15, {
        id: "2",
        label: "Running gel",
        carbsPerServing: 30,
        unitLabel: "gel",
      }),
    ).toBe("about ½ Running gel");
    expect(
      formatCarbsAsFavorite(5, {
        id: "3",
        label: "Running gel",
        carbsPerServing: 30,
        unitLabel: "gel",
      }),
    ).toBe("Running gel is 30g each — use about 5g");
  });

  it("migrates primaryHypoTreatment into hypo + driving defaults", () => {
    const prefs = migrateCarbSourcePreferences({ primaryHypoTreatment: "glucose_tablets" });
    expect(prefs.favorites).toHaveLength(1);
    expect(prefs.favorites[0]?.carbsPerServing).toBe(4);
    expect(prefs.defaultByScenario.hypo).toBe(prefs.favorites[0]?.id);
    expect(prefs.defaultByScenario.driving).toBe(prefs.favorites[0]?.id);
    expect(prefs.defaultByScenario.exercise_during).toBeUndefined();
  });

  it("uses exercise favourite when assigned", () => {
    const fav = {
      id: "gel-1",
      label: "Running gel",
      carbsPerServing: 22,
      unitLabel: "gel",
    };
    const profile = {
      carbSourcePreferences: normalizeCarbSourcePreferences({
        favorites: [fav],
        defaultByScenario: { exercise_during: fav.id },
      }),
    };
    expect(formatCarbsForScenario(45, profile, "exercise_during")).toBe("about 2 Running gel");
    expect(formatCarbsForScenario(45, profile, "hypo")).toBeNull();
  });

  it("caps favourites at max", () => {
    const favorites = Array.from({ length: 10 }, (_, i) => ({
      id: `f-${i}`,
      label: `Item ${i}`,
      carbsPerServing: 4,
      unitLabel: "tablet",
    }));
    const prefs = normalizeCarbSourcePreferences({ favorites, defaultByScenario: {} });
    expect(prefs.favorites.length).toBe(8);
  });
});
