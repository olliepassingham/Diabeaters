import { describe, expect, it } from "vitest";

import { UK_DEFAULT_UNITS_PER_INSULIN_PEN } from "@/lib/insulin-pen-units";

describe("insulin pen units", () => {
  it("defaults to a common 3ml pen total at 100 units/ml", () => {
    expect(UK_DEFAULT_UNITS_PER_INSULIN_PEN).toBe(300);
  });
});
