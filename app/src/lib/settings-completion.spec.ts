import { beforeEach, describe, expect, it } from "vitest";
import { storage } from "./storage";

describe("settings completion (Finish your setup)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("is 0% with no settings and lists all four items as missing", () => {
    const completion = storage.getSettingsCompletion();
    expect(completion.percentage).toBe(0);
    expect(completion.completed).toBe(0);
    expect(completion.total).toBe(4);
    expect(completion.missing.map((m) => m.key)).toEqual([
      "tdd",
      "carbRatio",
      "correctionFactor",
      "targetRange",
    ]);
    expect(storage.isSettingsComplete()).toBe(false);
  });

  it("counts a dinner-only or snack-only ratio as satisfying the carb ratio requirement", () => {
    // Regression test: a user who only ever fills in a dinner or snack ratio
    // (e.g. skips breakfast, or doses only for dinner) used to be stuck below
    // 100% forever because the old check only looked at breakfast/lunch.
    storage.saveSettings({
      tdd: 40,
      correctionFactor: 3,
      targetBgLow: 4,
      targetBgHigh: 8,
      dinnerRatio: 10,
    });
    expect(storage.getSettingsCompletion().missing.some((m) => m.key === "carbRatio")).toBe(false);
    expect(storage.isSettingsComplete()).toBe(true);

    localStorage.clear();
    storage.saveSettings({
      tdd: 40,
      correctionFactor: 3,
      targetBgLow: 4,
      targetBgHigh: 8,
      snackRatio: 12,
    });
    expect(storage.isSettingsComplete()).toBe(true);
  });

  it("reaches exactly 75% when only one item is missing, and names it", () => {
    storage.saveSettings({
      tdd: 40,
      breakfastRatio: 10,
      correctionFactor: 3,
      // targetBgLow/targetBgHigh intentionally left unset
    });
    const completion = storage.getSettingsCompletion();
    expect(completion.percentage).toBe(75);
    expect(completion.completed).toBe(3);
    expect(completion.total).toBe(4);
    expect(completion.missing).toHaveLength(1);
    expect(completion.missing[0].key).toBe("targetRange");
    expect(storage.isSettingsComplete()).toBe(false);
  });

  it("is 100% complete once TDD, a carb ratio, correction factor, and target range are all set", () => {
    storage.saveSettings({
      tdd: 40,
      lunchRatio: 8,
      correctionFactor: 3,
      targetBgLow: 4,
      targetBgHigh: 8,
    });
    const completion = storage.getSettingsCompletion();
    expect(completion.percentage).toBe(100);
    expect(completion.missing).toHaveLength(0);
    expect(storage.isSettingsComplete()).toBe(true);
  });

  it("accepts derived MDI total (short + long acting units) in place of an explicit TDD", () => {
    storage.saveSettings({
      shortActingUnitsPerDay: 20,
      longActingUnitsPerDay: 15,
      lunchRatio: 8,
      correctionFactor: 3,
      targetBgLow: 4,
      targetBgHigh: 8,
    });
    expect(storage.getSettingsCompletion().missing.some((m) => m.key === "tdd")).toBe(false);
    expect(storage.isSettingsComplete()).toBe(true);
  });
});
