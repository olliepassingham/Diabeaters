import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  seedDefaultTargetBgRangeIfNeeded,
  STARTER_TARGET_RANGE_SEEDED_KEY,
} from "./starter-target-range";

const storageMock = vi.hoisted(() => ({
  getProfile: vi.fn(),
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  storage: storageMock,
}));

describe("seedDefaultTargetBgRangeIfNeeded", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    storageMock.getProfile.mockReturnValue({ bgUnits: "mmol/L" });
    storageMock.getSettings.mockReturnValue({});
  });

  it("prefills 4–10 mmol/L when unset", () => {
    const r = seedDefaultTargetBgRangeIfNeeded();
    expect(r.seeded).toBe(true);
    expect(storageMock.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ targetBgLow: 4, targetBgHigh: 10 }),
    );
    expect(localStorage.getItem(STARTER_TARGET_RANGE_SEEDED_KEY)).toBe("1");
  });

  it("prefills 72–180 mg/dL for US units", () => {
    storageMock.getProfile.mockReturnValue({ bgUnits: "mg/dL" });
    const r = seedDefaultTargetBgRangeIfNeeded();
    expect(r.seeded).toBe(true);
    expect(storageMock.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ targetBgLow: 72, targetBgHigh: 180 }),
    );
  });

  it("does not overwrite existing targets", () => {
    storageMock.getSettings.mockReturnValue({ targetBgLow: 5, targetBgHigh: 9 });
    const r = seedDefaultTargetBgRangeIfNeeded();
    expect(r.seeded).toBe(false);
    expect(storageMock.saveSettings).not.toHaveBeenCalled();
    expect(localStorage.getItem(STARTER_TARGET_RANGE_SEEDED_KEY)).toBe("1");
  });

  it("does not re-seed after the user clears targets", () => {
    seedDefaultTargetBgRangeIfNeeded();
    storageMock.getSettings.mockReturnValue({});
    const r2 = seedDefaultTargetBgRangeIfNeeded();
    expect(r2.seeded).toBe(false);
    expect(storageMock.saveSettings).toHaveBeenCalledTimes(1);
  });
});
