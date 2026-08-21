import { beforeEach, describe, expect, it, vi } from "vitest";

import { PUMP_SUPPLIES_SEEDED_KEY, pumpSetupCompletion, seedPumpSuppliesIfNeeded } from "./pump-supplies";

const storageMock = vi.hoisted(() => ({
  getProfile: vi.fn(),
  getSupplies: vi.fn(),
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  addSupply: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  storage: storageMock,
}));

describe("seedPumpSuppliesIfNeeded", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    storageMock.getProfile.mockReturnValue({ insulinDeliveryMethod: "pump" });
    storageMock.getSupplies.mockReturnValue([]);
    storageMock.getSettings.mockReturnValue({ tdd: 42 });
    storageMock.addSupply.mockImplementation((row: { name: string }) => ({ supply: { ...row, id: "x" }, merged: false }));
  });

  it("seeds starter rows for pump users once", () => {
    const r = seedPumpSuppliesIfNeeded({ tdd: 40, siteChangeDays: 3, reservoirCapacity: 300 });
    expect(r.seeded).toBe(true);
    expect(r.count).toBe(7);
    expect(storageMock.addSupply).toHaveBeenCalledTimes(7);
    expect(storageMock.addSupply).toHaveBeenCalledWith(expect.objectContaining({ type: "cgm" }));
    expect(localStorage.getItem(PUMP_SUPPLIES_SEEDED_KEY)).toBe("1");
  });

  it("does not seed twice", () => {
    seedPumpSuppliesIfNeeded({});
    const r2 = seedPumpSuppliesIfNeeded({});
    expect(r2.seeded).toBe(false);
    expect(storageMock.addSupply).toHaveBeenCalledTimes(7);
  });

  it("skips non-pump profiles", () => {
    storageMock.getProfile.mockReturnValue({ insulinDeliveryMethod: "pen" });
    const r = seedPumpSuppliesIfNeeded({});
    expect(r.seeded).toBe(false);
    expect(storageMock.addSupply).not.toHaveBeenCalled();
  });
});

describe("pumpSetupCompletion", () => {
  it("requires pump supply rows for pump users", () => {
    storageMock.getSettings.mockReturnValue({ siteChangeDays: 3, reservoirCapacity: 300 });
    const c = pumpSetupCompletion({ insulinDeliveryMethod: "pump" } as never, [
      { type: "infusion_set" } as never,
      { type: "reservoir" } as never,
      { type: "insulin_short" } as never,
      { type: "insulin_long" } as never,
    ]);
    expect(c.tracksSets).toBe(true);
    expect(c.tracksBackup).toBe(true);
  });
});
