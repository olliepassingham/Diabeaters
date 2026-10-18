import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  seedType2SuppliesIfNeeded,
  TYPE2_SUPPLIES_SEEDED_KEY,
} from "./starter-type2-supplies";

const storageMock = vi.hoisted(() => ({
  getProfile: vi.fn(),
  getSupplies: vi.fn(),
  getSettings: vi.fn(),
  addSupply: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  storage: storageMock,
}));

vi.mock("@/lib/insulin-clinical-access", () => ({
  isType2AppSession: vi.fn(() => true),
}));

import { isType2AppSession } from "@/lib/insulin-clinical-access";

describe("seedType2SuppliesIfNeeded", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(isType2AppSession).mockReturnValue(true);
    storageMock.getProfile.mockReturnValue({ diabetesType: "type2", usingInsulin: false });
    storageMock.getSupplies.mockReturnValue([]);
    storageMock.getSettings.mockReturnValue({});
    storageMock.addSupply.mockImplementation((row: { name: string; type: string }) => ({
      supply: { ...row, id: "x" },
      merged: false,
    }));
  });

  it("seeds Type 2 kit without insulin or pump items", () => {
    const r = seedType2SuppliesIfNeeded();
    expect(r.seeded).toBe(true);
    expect(r.count).toBeGreaterThan(0);
    const added = storageMock.addSupply.mock.calls.map((c) => c[0] as { name: string; type: string });
    expect(added.some((s) => /test strips/i.test(s.name))).toBe(true);
    expect(added.some((s) => /lancet/i.test(s.name))).toBe(true);
    expect(added.some((s) => /tablet/i.test(s.name))).toBe(true);
    expect(added.some((s) => s.type === "cgm")).toBe(true);
    expect(added.some((s) => s.type.startsWith("insulin"))).toBe(false);
    expect(localStorage.getItem(TYPE2_SUPPLIES_SEEDED_KEY)).toBe("1");
  });

  it("does not re-seed after the one-shot flag", () => {
    seedType2SuppliesIfNeeded();
    const calls = storageMock.addSupply.mock.calls.length;
    const r2 = seedType2SuppliesIfNeeded();
    expect(r2.seeded).toBe(false);
    expect(storageMock.addSupply.mock.calls.length).toBe(calls);
  });

  it("skips for non–Type 2 sessions", () => {
    vi.mocked(isType2AppSession).mockReturnValue(false);
    const r = seedType2SuppliesIfNeeded();
    expect(r.seeded).toBe(false);
    expect(storageMock.addSupply).not.toHaveBeenCalled();
  });
});
