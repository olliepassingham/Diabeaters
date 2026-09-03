import { describe, expect, it } from "vitest";

import { getHomeMealMoment, homeMealDismissalKey } from "@/lib/home-meal-moment";

function localDate(hours: number, minutes = 0): Date {
  const date = new Date(2026, 8, 3, hours, minutes);
  return date;
}

describe("getHomeMealMoment", () => {
  it.each([
    [6, 0, "breakfast"],
    [10, 29, "breakfast"],
    [11, 0, "lunch"],
    [14, 59, "lunch"],
    [17, 0, "dinner"],
    [21, 29, "dinner"],
  ] as const)("selects the expected meal at %i:%i", (hour, minute, slot) => {
    expect(getHomeMealMoment(localDate(hour, minute))?.slot).toBe(slot);
  });

  it.each([
    [5, 59],
    [10, 30],
    [15, 0],
    [16, 59],
    [21, 30],
  ] as const)("does not show a prominent meal prompt at %i:%i", (hour, minute) => {
    expect(getHomeMealMoment(localDate(hour, minute))).toBeNull();
  });
});

describe("homeMealDismissalKey", () => {
  it("scopes dismissal to the local day and meal", () => {
    expect(homeMealDismissalKey(localDate(12), "lunch")).toBe("2026-09-03:lunch");
    expect(homeMealDismissalKey(localDate(18), "dinner")).toBe("2026-09-03:dinner");
  });
});
