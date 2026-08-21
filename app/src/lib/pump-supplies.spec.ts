import { beforeEach, describe, expect, it, vi } from "vitest";

import { PUMP_SUPPLIES_SEEDED_KEY, pumpSetupCompletion, seedPumpSuppliesIfNeeded } from "./pump-supplies";

const storageMock = vi.hoisted(() => ({
  getProfile: vi.fn(),
  getSupplies: vi.fn(),
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  addSupply: vi.fn(),
  updateSupply: vi.fn(),
  deleteSupply: vi.fn(),
}));

vi.mock("@/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("./storage")>("./storage");
  return {
    ...actual,
    storage: storageMock,
  };
});

describe("seedPumpSuppliesIfNeeded", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    storageMock.getProfile.mockReturnValue({ insulinDeliveryMethod: "pump" });
    storageMock.getSupplies.mockReturnValue([]);
    storageMock.getSettings.mockReturnValue({ tdd: 42 });
    storageMock.addSupply.mockImplementation((row: { name: string }) => ({ supply: { ...row, id: "x" }, merged: false }));
  });

  it("seeds starter rows for pump users once (no backup pens)", () => {
    const r = seedPumpSuppliesIfNeeded({ tdd: 40, siteChangeDays: 3, reservoirCapacity: 300 });
    expect(r.seeded).toBe(true);
    expect(r.count).toBe(4);
    expect(storageMock.addSupply).toHaveBeenCalledTimes(4);
    expect(storageMock.addSupply).toHaveBeenCalledWith(expect.objectContaining({ type: "cgm" }));
    expect(storageMock.addSupply).toHaveBeenCalledWith(
      expect.objectContaining({ type: "insulin_vial", currentQuantity: 1000 }),
    );
    expect(storageMock.addSupply).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: expect.stringMatching(/^Backup /) }),
    );
    expect(localStorage.getItem(PUMP_SUPPLIES_SEEDED_KEY)).toBe("1");
  });

  it("does not seed twice", () => {
    seedPumpSuppliesIfNeeded({});
    storageMock.getSupplies.mockReturnValue([
      { id: "1", type: "infusion_set", name: "Sets" },
      { id: "2", type: "reservoir", name: "Reservoirs" },
      { id: "3", type: "insulin_vial", name: "Insulin" },
    ]);
    const r2 = seedPumpSuppliesIfNeeded({});
    expect(r2.seeded).toBe(false);
    expect(storageMock.addSupply).toHaveBeenCalledTimes(4);
  });

  it("still seeds pump rows when only a CGM starter exists", () => {
    storageMock.getSupplies.mockReturnValue([{ id: "cgm", type: "cgm", name: "CGM Sensors" }]);
    const r = seedPumpSuppliesIfNeeded({ tdd: 40 });
    expect(r.seeded).toBe(true);
    expect(r.count).toBe(3);
    expect(storageMock.addSupply).toHaveBeenCalledTimes(3);
    expect(storageMock.addSupply).not.toHaveBeenCalledWith(expect.objectContaining({ type: "cgm" }));
  });

  it("skips non-pump profiles", () => {
    storageMock.getProfile.mockReturnValue({ insulinDeliveryMethod: "pen" });
    const r = seedPumpSuppliesIfNeeded({});
    expect(r.seeded).toBe(false);
    expect(storageMock.addSupply).not.toHaveBeenCalled();
  });

  it("removes example backup supplies and sets starter insulin to 1000u", () => {
    storageMock.getSupplies.mockReturnValue([
      {
        id: "vial",
        type: "insulin_vial",
        name: "Pump Insulin (vial/cartridge)",
        currentQuantity: 3,
        dailyUsage: 40,
        notes: "Starter example — typical one pharmacy collection. Edit to match your stock.",
      },
      {
        id: "backup",
        type: "insulin_long",
        name: "Backup Long-Acting Pen",
        currentQuantity: 100,
        dailyUsage: 0,
      },
      {
        id: "needles",
        type: "needle",
        name: "Backup Pen Needles",
        currentQuantity: 30,
        dailyUsage: 0,
      },
      { id: "1", type: "infusion_set", name: "Sets" },
      { id: "2", type: "reservoir", name: "Reservoirs" },
    ]);
    const r = seedPumpSuppliesIfNeeded({ tdd: 40 });
    expect(r.seeded).toBe(false);
    expect(storageMock.deleteSupply).toHaveBeenCalledWith("backup");
    expect(storageMock.deleteSupply).toHaveBeenCalledWith("needles");
    expect(storageMock.updateSupply).toHaveBeenCalledWith(
      "vial",
      expect.objectContaining({ currentQuantity: 1000, quantityAtPickup: 1000 }),
    );
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
