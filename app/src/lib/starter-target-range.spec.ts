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

  it("does not write a target range until the person confirms one", () => {
    const r = seedDefaultTargetBgRangeIfNeeded();
    expect(r.seeded).toBe(false);
    expect(storageMock.saveSettings).not.toHaveBeenCalled();
    expect(localStorage.getItem(STARTER_TARGET_RANGE_SEEDED_KEY)).toBeNull();
  });

  it("remembers that a saved range already exists", () => {
    storageMock.getSettings.mockReturnValue({ targetBgLow: 5, targetBgHigh: 9 });
    const r = seedDefaultTargetBgRangeIfNeeded();
    expect(r.seeded).toBe(false);
    expect(storageMock.saveSettings).not.toHaveBeenCalled();
    expect(localStorage.getItem(STARTER_TARGET_RANGE_SEEDED_KEY)).toBe("1");
  });
});
