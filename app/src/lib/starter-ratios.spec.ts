import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyStarterRatios,
  STARTER_ICR_GRAMS_PER_UNIT,
  starterRatioDisplayValues,
  starterRatioStorageValues,
} from "./starter-ratios";

const storageMock = vi.hoisted(() => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  storage: storageMock,
}));

describe("starter-ratios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMock.getSettings.mockReturnValue({});
  });

  it("uses 1u:10g (10 g per unit) for every meal", () => {
    expect(STARTER_ICR_GRAMS_PER_UNIT).toEqual({
      breakfast: 10,
      lunch: 10,
      dinner: 10,
      snack: 10,
    });
  });

  it("formats storage values as 1:X", () => {
    expect(starterRatioStorageValues()).toEqual({
      breakfastRatio: "1:10",
      lunchRatio: "1:10",
      dinnerRatio: "1:10",
      snackRatio: "1:10",
    });
  });

  it("formats display values for per10g", () => {
    const d = starterRatioDisplayValues("per10g");
    expect(d.breakfast).toBe("1u:10g");
    expect(d.lunch).toBe("1u:10g");
    expect(d.dinner).toBe("1u:10g");
    expect(d.snack).toBe("1u:10g");
  });

  it("applyStarterRatios persists only after explicit call", () => {
    storageMock.getSettings.mockReturnValue({ tdd: 40 });
    const next = applyStarterRatios();
    expect(storageMock.saveSettings).toHaveBeenCalledTimes(1);
    expect(next).toMatchObject({
      tdd: 40,
      breakfastRatio: "1:10",
      lunchRatio: "1:10",
      dinnerRatio: "1:10",
      snackRatio: "1:10",
    });
  });

  it("applyStarterRatios merges over provided settings without re-reading when passed", () => {
    const next = applyStarterRatios({ isf: "3" });
    expect(storageMock.getSettings).not.toHaveBeenCalled();
    expect(next.isf).toBe("3");
    expect(next.lunchRatio).toBe("1:10");
  });
});
