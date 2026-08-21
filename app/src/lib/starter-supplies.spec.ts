import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ensureStarterCgmIfNeeded,
  MDI_SUPPLIES_SEEDED_KEY,
  seedMdiSuppliesIfNeeded,
  STARTER_CGM_SEEDED_KEY,
  STARTER_CGM_SENSOR_COUNT,
  STARTER_MDI_PEN_COUNT,
  STARTER_NEEDLE_COUNT,
} from "./starter-supplies";
import { UK_DEFAULT_UNITS_PER_INSULIN_PEN } from "./insulin-pen-units";

const storageMock = vi.hoisted(() => ({
  getProfile: vi.fn(),
  getSupplies: vi.fn(),
  getSettings: vi.fn(),
  addSupply: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  storage: storageMock,
}));

describe("seedMdiSuppliesIfNeeded", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    storageMock.getProfile.mockReturnValue({ insulinDeliveryMethod: "pen" });
    storageMock.getSupplies.mockReturnValue([]);
    storageMock.getSettings.mockReturnValue({});
    storageMock.addSupply.mockImplementation((row: { name: string }) => ({
      supply: { ...row, id: "x" },
      merged: false,
    }));
  });

  it("seeds CGM, needles, short and long insulin once", () => {
    const r = seedMdiSuppliesIfNeeded();
    expect(r.seeded).toBe(true);
    expect(r.count).toBe(4);
    expect(storageMock.addSupply).toHaveBeenCalledTimes(4);
    expect(storageMock.addSupply).toHaveBeenCalledWith(
      expect.objectContaining({ type: "cgm", currentQuantity: STARTER_CGM_SENSOR_COUNT }),
    );
    expect(storageMock.addSupply).toHaveBeenCalledWith(
      expect.objectContaining({ type: "needle", currentQuantity: STARTER_NEEDLE_COUNT }),
    );
    expect(storageMock.addSupply).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "insulin_short",
        currentQuantity: STARTER_MDI_PEN_COUNT * UK_DEFAULT_UNITS_PER_INSULIN_PEN,
      }),
    );
    expect(storageMock.addSupply).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "insulin_long",
        currentQuantity: STARTER_MDI_PEN_COUNT * UK_DEFAULT_UNITS_PER_INSULIN_PEN,
      }),
    );
    expect(localStorage.getItem(MDI_SUPPLIES_SEEDED_KEY)).toBe("1");
    expect(localStorage.getItem(STARTER_CGM_SEEDED_KEY)).toBe("1");
  });

  it("does not seed twice", () => {
    seedMdiSuppliesIfNeeded();
    storageMock.getSupplies.mockReturnValue([
      { id: "1", type: "needle", name: "Pen Needles" },
      { id: "2", type: "insulin_short", name: "Short" },
      { id: "3", type: "insulin_long", name: "Long" },
    ]);
    const r2 = seedMdiSuppliesIfNeeded();
    expect(r2.seeded).toBe(false);
    expect(storageMock.addSupply).toHaveBeenCalledTimes(4);
  });

  it("still seeds MDI core when only a CGM starter row exists", () => {
    storageMock.getSupplies.mockReturnValue([{ id: "cgm", type: "cgm", name: "CGM Sensors" }]);
    const r = seedMdiSuppliesIfNeeded();
    expect(r.seeded).toBe(true);
    expect(r.count).toBe(3);
    expect(storageMock.addSupply).toHaveBeenCalledTimes(3);
    expect(storageMock.addSupply).not.toHaveBeenCalledWith(expect.objectContaining({ type: "cgm" }));
  });

  it("skips when MDI core supplies already exist", () => {
    storageMock.getSupplies.mockReturnValue([{ id: "1", type: "needle", name: "Pen Needles" }]);
    const r = seedMdiSuppliesIfNeeded();
    expect(r.seeded).toBe(false);
    expect(storageMock.addSupply).not.toHaveBeenCalled();
    expect(localStorage.getItem(MDI_SUPPLIES_SEEDED_KEY)).toBe("1");
  });

  it("skips pump profiles", () => {
    storageMock.getProfile.mockReturnValue({ insulinDeliveryMethod: "pump" });
    const r = seedMdiSuppliesIfNeeded();
    expect(r.seeded).toBe(false);
    expect(storageMock.addSupply).not.toHaveBeenCalled();
  });
});

describe("ensureStarterCgmIfNeeded", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    storageMock.getProfile.mockReturnValue({ insulinDeliveryMethod: "pump" });
    storageMock.getSupplies.mockReturnValue([{ id: "1", type: "infusion_set", name: "Sets" }]);
    storageMock.addSupply.mockImplementation((row: { name: string }) => ({
      supply: { ...row, id: "cgm" },
      merged: false,
    }));
  });

  it("adds CGM once for existing pump inventories without sensors", () => {
    const r = ensureStarterCgmIfNeeded();
    expect(r.seeded).toBe(true);
    expect(storageMock.addSupply).toHaveBeenCalledWith(
      expect.objectContaining({ type: "cgm", currentQuantity: STARTER_CGM_SENSOR_COUNT }),
    );
    expect(localStorage.getItem(STARTER_CGM_SEEDED_KEY)).toBe("1");
  });

  it("does not re-add after delete when flag is set", () => {
    localStorage.setItem(STARTER_CGM_SEEDED_KEY, "1");
    const r = ensureStarterCgmIfNeeded();
    expect(r.seeded).toBe(false);
    expect(storageMock.addSupply).not.toHaveBeenCalled();
  });
});
