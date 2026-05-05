import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyPharmacyHours, storage, type Pharmacy } from "./storage";

function buildPharmacy(): Pharmacy {
  const hours = emptyPharmacyHours();
  const open = { open: "09:00", close: "18:00" } as const;
  hours.mon = { ...open };
  hours.tue = { ...open };
  hours.wed = { ...open };
  hours.thu = { ...open };
  hours.fri = { ...open };
  hours.sat = { open: "09:00", close: "13:00" };
  hours.sun = { closed: true };
  return { name: "Boots", hours, updatedAt: new Date().toISOString() };
}

describe("getSmartPrescriptionAdvice with pharmacy hours", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("appends a closed-day hint when run-out lands on a Sunday (24-day prescription)", () => {
    // Wednesday 2026-05-06; +4 days = Sunday 2026-05-10 (closed in fixture).
    vi.setSystemTime(new Date(2026, 4, 6, 12, 0, 0));
    storage.savePharmacy(buildPharmacy());
    storage.savePrescriptionCycle({ intervalDays: 28, leadTimeDays: 5 });

    const { supply } = storage.addSupply({
      name: "Test strips",
      type: "other",
      currentQuantity: 4,
      dailyUsage: 1,
      notes: undefined,
    });

    const advice = storage.getSmartPrescriptionAdvice(storage.getSupplies());
    const collect = advice.collectSoon.find((c) => c.supply.id === supply.id);
    expect(collect).toBeDefined();
    expect(collect!.reason).toMatch(/will run out in 4 days/);
    expect(collect!.reason).toMatch(/pharmacy is closed Sun/);
    expect(collect!.reason).toMatch(/collect by Sat 13:00/);
  });

  it("does not append a hint when no pharmacy is saved", () => {
    vi.setSystemTime(new Date(2026, 4, 6, 12, 0, 0));
    storage.savePrescriptionCycle({ intervalDays: 28, leadTimeDays: 5 });
    const { supply } = storage.addSupply({
      name: "Test strips",
      type: "other",
      currentQuantity: 4,
      dailyUsage: 1,
      notes: undefined,
    });

    const advice = storage.getSmartPrescriptionAdvice(storage.getSupplies());
    const collect = advice.collectSoon.find((c) => c.supply.id === supply.id);
    expect(collect).toBeDefined();
    expect(collect!.reason).not.toMatch(/pharmacy/i);
  });
});
