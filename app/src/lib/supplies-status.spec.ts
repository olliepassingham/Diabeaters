import { beforeEach, describe, expect, it, vi } from "vitest";
import { storage } from "./storage";

describe("supplies status + days remaining", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T12:00:00.000Z"));
  });

  it("CGM days remaining includes active sensor + remaining stock", () => {
    storage.saveSettings({ cgmDays: 10 });

    const { supply } = storage.addSupply({
      name: "Dexcom",
      type: "cgm",
      currentQuantity: 2,
      dailyUsage: 0,
      lastPickupDate: new Date("2026-03-20T12:00:00.000Z").toISOString(),
      notes: undefined,
      activeItemStartDate: new Date("2026-03-28T12:00:00.000Z").toISOString(), // 4 days left of a 10-day sensor
    });

    const reread = storage.getSupplies().find((s) => s.id === supply.id)!;
    const info = storage.getActiveItemInfo(reread);
    expect(info).not.toBeNull();
    // Active remaining + spare sensors (qty includes the one in use).
    const expected =
      (info?.daysLeft || 0) + Math.floor(Math.max(0, storage.getAdjustedQuantity(reread) - 1) * 10);
    expect(storage.getDaysRemaining(reread)).toBe(expected);
  });

  it("Glycogen (manual/emergency) with usage 0 and qty 1 is never flagged low", () => {
    const { supply } = storage.addSupply({
      name: "Glycogen",
      type: "other",
      currentQuantity: 1,
      dailyUsage: 0,
      lastPickupDate: new Date("2026-03-20T12:00:00.000Z").toISOString(),
      notes: undefined,
    });

    const reread = storage.getSupplies().find((s) => s.id === supply.id)!;
    expect(storage.getSupplyStatus(reread)).toBe("ok");

    storage.updateSupply(supply.id, { currentQuantity: 0, quantityAtPickup: 0 });
    const empty = storage.getSupplies().find((s) => s.id === supply.id)!;
    expect(storage.getSupplyStatus(empty)).toBe("critical");
  });
});

