import { describe, expect, it } from "vitest";
import {
  getEffectiveTdd,
  hasConfiguredTdd,
  reconcileTddFromMdiComponents,
  sumMdiDailyInsulinUnits,
  withReconciledTdd,
} from "./tdd";

describe("tdd", () => {
  it("sums MDI short and long acting units", () => {
    expect(sumMdiDailyInsulinUnits(25, 15)).toBe(40);
    expect(sumMdiDailyInsulinUnits(25, undefined)).toBeNull();
    expect(sumMdiDailyInsulinUnits(0, 15)).toBeNull();
  });

  it("getEffectiveTdd prefers explicit tdd", () => {
    expect(getEffectiveTdd({ tdd: 42, shortActingUnitsPerDay: 25, longActingUnitsPerDay: 15 })).toBe(42);
  });

  it("getEffectiveTdd falls back to MDI sum when tdd missing", () => {
    expect(getEffectiveTdd({ shortActingUnitsPerDay: 25, longActingUnitsPerDay: 15 })).toBe(40);
    expect(getEffectiveTdd({})).toBeNull();
  });

  it("reconcileTddFromMdiComponents returns sum when both MDI fields set", () => {
    expect(reconcileTddFromMdiComponents({ shortActingUnitsPerDay: 30, longActingUnitsPerDay: 10 })).toBe(40);
    expect(reconcileTddFromMdiComponents({ tdd: 50, shortActingUnitsPerDay: 30, longActingUnitsPerDay: 10 })).toBe(40);
  });

  it("withReconciledTdd writes tdd from MDI components", () => {
    expect(withReconciledTdd({ shortActingUnitsPerDay: 22, longActingUnitsPerDay: 18 })).toEqual({
      shortActingUnitsPerDay: 22,
      longActingUnitsPerDay: 18,
      tdd: 40,
    });
  });

  it("hasConfiguredTdd is true when explicit or derived tdd exists", () => {
    expect(hasConfiguredTdd({ tdd: 35 })).toBe(true);
    expect(hasConfiguredTdd({ shortActingUnitsPerDay: 20, longActingUnitsPerDay: 15 })).toBe(true);
    expect(hasConfiguredTdd({})).toBe(false);
  });
});
