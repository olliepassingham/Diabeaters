import { beforeEach, describe, expect, it, vi } from "vitest";
import { storage } from "./storage";

describe("supplies stepper baseline", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T12:00:00.000Z"));
  });

  it("setSupplyRemainingNow keeps pickup-based adjusted quantity consistent (usage-based)", () => {
    storage.saveSettings({ tdd: 50 }); // ensures insulin effective usage > 0

    const { supply } = storage.addSupply({
      name: "Rapid insulin",
      type: "insulin",
      currentQuantity: 1000,
      dailyUsage: 0,
      lastPickupDate: new Date("2026-03-08T12:00:00.000Z").toISOString(), // 2 days ago
      notes: undefined,
    });

    const updated = storage.setSupplyRemainingNow(supply.id, 800);
    expect(updated).not.toBeNull();

    const reread = storage.getSupplies().find((s) => s.id === supply.id)!;
    expect(Math.floor(storage.getAdjustedQuantity(reread))).toBe(800);
  });

  it("setSupplyRemainingNow clamps at zero", () => {
    storage.saveSettings({ tdd: 50 });

    const { supply } = storage.addSupply({
      name: "Rapid insulin",
      type: "insulin",
      currentQuantity: 100,
      dailyUsage: 0,
      lastPickupDate: new Date("2026-03-08T12:00:00.000Z").toISOString(),
      notes: undefined,
    });

    storage.setSupplyRemainingNow(supply.id, -5);
    const reread = storage.getSupplies().find((s) => s.id === supply.id)!;
    expect(Math.floor(storage.getAdjustedQuantity(reread))).toBe(0);
  });
});

