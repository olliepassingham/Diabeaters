import { describe, expect, it } from "vitest";
import { buildSuppliesCoachSummary } from "./trustedContextFromDb.ts";

describe("buildSuppliesCoachSummary", () => {
  it("returns undefined for empty rows", () => {
    expect(buildSuppliesCoachSummary([])).toBeUndefined();
  });

  it("counts critical slots and buckets unknown categories into other", () => {
    const s = buildSuppliesCoachSummary([
      { category: "cgm", quantity: 2, days_remaining_cached: 10 },
      { category: "infusion_set", quantity: 0, days_remaining_cached: null },
      { category: "weird", quantity: 1, days_remaining_cached: null },
    ]);
    expect(s?.trackedSlots).toBe(3);
    expect(s?.criticalOrEmptySlots).toBe(1);
    expect(s?.slotsByCategory.cgm).toBe(1);
    expect(s?.slotsByCategory.infusion_set).toBe(1);
    expect(s?.slotsByCategory.other).toBe(1);
  });

  it("treats low days_remaining_cached as critical", () => {
    const s = buildSuppliesCoachSummary([
      { category: "insulin", quantity: 5, days_remaining_cached: 2 },
    ]);
    expect(s?.criticalOrEmptySlots).toBe(1);
  });
});
