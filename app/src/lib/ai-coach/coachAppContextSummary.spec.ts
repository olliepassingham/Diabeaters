import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { storage } from "@/lib/storage";
import { buildSuppliesCoachSummaryFromSupplies } from "./coachAppContextSummary";

describe("buildSuppliesCoachSummaryFromSupplies", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("aggregates categories and critical slots like the Edge Function helper", () => {
    const a = storage.addSupply({
      name: "Strips",
      type: "other",
      currentQuantity: 2,
      dailyUsage: 1,
      notes: undefined,
    }).supply;
    const b = storage.addSupply({
      name: "Sensors",
      type: "cgm",
      currentQuantity: 10,
      dailyUsage: 0,
      notes: undefined,
    }).supply;

    const summary = buildSuppliesCoachSummaryFromSupplies([a, b]);
    expect(summary).toBeDefined();
    expect(summary!.trackedSlots).toBe(2);
    expect(summary!.criticalOrEmptySlots).toBe(1);
    expect(summary!.slotsByCategory.other).toBe(1);
    expect(summary!.slotsByCategory.cgm).toBe(1);
  });
});
