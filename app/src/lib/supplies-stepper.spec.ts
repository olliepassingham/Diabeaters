import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSupplyIncrement, storage, type UserSettings } from "./storage";

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

describe("CGM supply increment (fixed 1 sensor per step)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T12:00:00.000Z"));
  });

  it("getSupplyIncrement('cgm') is always one sensor regardless of settings", () => {
    expect(getSupplyIncrement("cgm")).toEqual({ amount: 1, label: "sensor" });
    expect(getSupplyIncrement("cgm", {})).toEqual({ amount: 1, label: "sensor" });
  });

  it("getSupplyIncrement('cgm') ignores legacy sensorsPerBox (including 0)", () => {
    const junk = { sensorsPerBox: 0 };
    expect(getSupplyIncrement("cgm", junk as unknown as UserSettings)).toEqual({
      amount: 1,
      label: "sensor",
    });
    expect(
      getSupplyIncrement("cgm", { sensorsPerBox: 99 } as unknown as UserSettings),
    ).toEqual({ amount: 1, label: "sensor" });
  });

  it("setSupplyRemainingNow keeps CGM adjusted quantity aligned after manual increase", () => {
    storage.saveSettings({ cgmDays: 14 });

    const { supply } = storage.addSupply({
      name: "CGM",
      type: "cgm",
      currentQuantity: 4,
      dailyUsage: 0,
      lastPickupDate: new Date("2026-03-10T12:00:00.000Z").toISOString(),
      quantityAtPickup: 4,
    });

    const updated = storage.setSupplyRemainingNow(supply.id, 5);
    expect(updated).not.toBeNull();

    const reread = storage.getSupplies().find((s) => s.id === supply.id)!;
    expect(Math.floor(storage.getAdjustedQuantity(reread))).toBe(5);
  });

  it("setSupplyRemainingNow updates CGM stock while an active sensor is in range", () => {
    storage.saveSettings({ cgmDays: 10 });

    const { supply } = storage.addSupply({
      name: "CGM active",
      type: "cgm",
      currentQuantity: 3,
      dailyUsage: 0,
      lastPickupDate: new Date("2026-03-01T12:00:00.000Z").toISOString(),
      quantityAtPickup: 3,
      activeItemStartDate: new Date("2026-03-08T12:00:00.000Z").toISOString(),
    });

    expect(Math.floor(storage.getAdjustedQuantity(supply))).toBe(3);

    const updated = storage.setSupplyRemainingNow(supply.id, 6);
    expect(updated).not.toBeNull();
    const reread = storage.getSupplies().find((s) => s.id === supply.id)!;
    expect(Math.floor(storage.getAdjustedQuantity(reread))).toBe(6);
    expect(reread.quantityAtPickup).toBe(6);
  });
});

