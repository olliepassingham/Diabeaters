import { describe, expect, it } from "vitest";

import { buildRatiosPageSnapshot, buildUsagePageSnapshot } from "./settings-page-snapshots";

describe("settings-page-snapshots", () => {
  it("detects usage page changes", () => {
    const baseline = buildUsagePageSnapshot({
      userDisplayName: "Ollie",
      appRegion: "UK",
      emergencyNumber: "999",
      bgUnits: "mmol/L",
      carbUnits: "grams",
      deliveryMethod: "pen",
      bodyWeightInput: "70",
      weightDisplayUnit: "kg",
      dateOfBirth: "",
      shortActingUnitsPerDay: "20",
      longActingUnitsPerDay: "10",
      shortActingInjectionsPerDay: "4",
      longActingInjectionsPerDay: "1",
      primingUnits: "",
      basalInjectionTime: "22:00",
      basalInjectionTime2: "",
      cgmDays: "10",
      siteChangeDays: "3",
      reservoirChangeDays: "3",
      reservoirCapacity: "300",
      unitsPerInsulinPen: "100",
      needlesPerBox: "100",
      infusionSetsPerBox: "",
      reservoirsPerBox: "",
      insulinCartridgeUnits: "",
      suppliesSmarterForecastEnabled: false,
      usesClosedLoop: false,
    });

    const changed = buildUsagePageSnapshot({
      userDisplayName: "Ollie",
      appRegion: "UK",
      emergencyNumber: "999",
      bgUnits: "mmol/L",
      carbUnits: "grams",
      deliveryMethod: "pen",
      bodyWeightInput: "71",
      weightDisplayUnit: "kg",
      dateOfBirth: "",
      shortActingUnitsPerDay: "20",
      longActingUnitsPerDay: "10",
      shortActingInjectionsPerDay: "4",
      longActingInjectionsPerDay: "1",
      primingUnits: "",
      basalInjectionTime: "22:00",
      basalInjectionTime2: "",
      cgmDays: "10",
      siteChangeDays: "3",
      reservoirChangeDays: "3",
      reservoirCapacity: "300",
      unitsPerInsulinPen: "100",
      needlesPerBox: "100",
      infusionSetsPerBox: "",
      reservoirsPerBox: "",
      insulinCartridgeUnits: "",
      suppliesSmarterForecastEnabled: false,
      usesClosedLoop: false,
    });

    expect(baseline).not.toBe(changed);
  });

  it("normalizes whitespace in ratio snapshots", () => {
    expect(
      buildRatiosPageSnapshot({
        tdd: " 40 ",
        breakfastRatio: "1.5",
        lunchRatio: "",
        dinnerRatio: "",
        snackRatio: "",
        correctionFactor: "",
        targetBgLow: "",
        targetBgHigh: "",
        ratioFormat: "per10g",
        carbPortionSize: "10",
      }),
    ).toBe(
      buildRatiosPageSnapshot({
        tdd: "40",
        breakfastRatio: "1.5",
        lunchRatio: "",
        dinnerRatio: "",
        snackRatio: "",
        correctionFactor: "",
        targetBgLow: "",
        targetBgHigh: "",
        ratioFormat: "per10g",
        carbPortionSize: "10",
      }),
    );
  });
});
