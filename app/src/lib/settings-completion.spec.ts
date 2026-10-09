import { beforeEach, describe, expect, it } from "vitest";
import { storage, type UserProfile } from "./storage";

const readyProfile: UserProfile = {
  name: "Alex",
  email: "",
  dateOfBirth: "",
  bgUnits: "mmol/L",
  carbUnits: "grams",
  diabetesType: "type1",
  insulinDeliveryMethod: "pen",
  usingInsulin: true,
  hasAcceptedDisclaimer: true,
  bodyWeightKg: 70,
};

describe("settings completion (Finish your setup)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("is 0% with no settings and lists every required item", () => {
    const completion = storage.getSettingsCompletion();
    expect(completion.percentage).toBe(0);
    expect(completion.completed).toBe(0);
    expect(completion.total).toBe(7);
    expect(completion.missing.map((m) => m.key)).toEqual([
      "name",
      "delivery",
      "weight",
      "tdd",
      "carbRatio",
      "correctionFactor",
      "targetRange",
    ]);
    expect(storage.isSettingsComplete()).toBe(false);
  });

  it("counts a dinner-only or snack-only ratio as satisfying the carb ratio requirement", () => {
    storage.saveProfile(readyProfile);
    storage.saveSettings({
      tdd: 40,
      correctionFactor: 3,
      targetBgLow: 4,
      targetBgHigh: 8,
      dinnerRatio: "10",
    });
    expect(storage.getSettingsCompletion().missing.some((m) => m.key === "carbRatio")).toBe(false);
    expect(storage.isSettingsComplete()).toBe(true);

    localStorage.clear();
    storage.saveProfile(readyProfile);
    storage.saveSettings({
      tdd: 40,
      correctionFactor: 3,
      targetBgLow: 4,
      targetBgHigh: 8,
      snackRatio: "12",
    });
    expect(storage.isSettingsComplete()).toBe(true);
  });

  it("names the one missing item when everything else is set", () => {
    storage.saveProfile(readyProfile);
    storage.saveSettings({
      tdd: 40,
      breakfastRatio: "10",
      correctionFactor: 3,
    });
    const completion = storage.getSettingsCompletion();
    expect(completion.completed).toBe(6);
    expect(completion.total).toBe(7);
    expect(completion.percentage).toBe(86);
    expect(completion.missing.map((m) => m.key)).toEqual(["targetRange"]);
    expect(completion.missing[0]?.href).toBe("/settings/ratios#settings-target");
    expect(storage.isSettingsComplete()).toBe(false);
  });

  it("is 100% once name, delivery, weight, and the insulin numbers are set", () => {
    storage.saveProfile(readyProfile);
    storage.saveSettings({
      tdd: 40,
      lunchRatio: "8",
      correctionFactor: 3,
      targetBgLow: 4,
      targetBgHigh: 8,
    });
    const completion = storage.getSettingsCompletion();
    expect(completion.percentage).toBe(100);
    expect(completion.missing).toHaveLength(0);
    expect(storage.isSettingsComplete()).toBe(true);
  });

  it("does not treat a blank name or an email as a finished name", () => {
    storage.saveProfile({ ...readyProfile, name: "alex@example.com" });
    expect(storage.getSettingsCompletion().missing.some((m) => m.key === "name")).toBe(true);
  });

  it("does not crash when a saved name is not text", () => {
    storage.saveProfile({ ...readyProfile, name: 12 as unknown as string });
    expect(() => storage.getSettingsCompletion()).not.toThrow();
    expect(storage.getSettingsCompletion().missing.some((m) => m.key === "name")).toBe(true);
  });

  it("accepts derived MDI total (short + long acting units) in place of an explicit TDD", () => {
    storage.saveProfile(readyProfile);
    storage.saveSettings({
      shortActingUnitsPerDay: 20,
      longActingUnitsPerDay: 15,
      lunchRatio: "8",
      correctionFactor: 3,
      targetBgLow: 4,
      targetBgHigh: 8,
    });
    expect(storage.getSettingsCompletion().missing.some((m) => m.key === "tdd")).toBe(false);
    expect(storage.isSettingsComplete()).toBe(true);
  });
});
