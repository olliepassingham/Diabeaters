import { describe, expect, it } from "vitest";
import {
  formatInsulinUnits,
  insulinRoundIncrement,
  PEN_INSULIN_INCREMENT,
  PUMP_INSULIN_INCREMENT,
  roundInsulinUnits,
} from "./insulin-rounding";

describe("insulinRoundIncrement", () => {
  it("uses whole units for pens and 0.05u for pumps", () => {
    expect(insulinRoundIncrement(false)).toBe(PEN_INSULIN_INCREMENT);
    expect(insulinRoundIncrement(true)).toBe(PUMP_INSULIN_INCREMENT);
  });
});

describe("roundInsulinUnits", () => {
  it("rounds pens to whole units by default", () => {
    expect(roundInsulinUnits(5.4)).toBe(5);
    expect(roundInsulinUnits(5.5)).toBe(6);
  });

  it("rounds pumps to 0.05u", () => {
    expect(roundInsulinUnits(5.12, PUMP_INSULIN_INCREMENT)).toBe(5.1);
    expect(roundInsulinUnits(5.13, PUMP_INSULIN_INCREMENT)).toBe(5.15);
    expect(roundInsulinUnits(2.375, PUMP_INSULIN_INCREMENT)).toBe(2.4);
    expect(roundInsulinUnits(0.02, PUMP_INSULIN_INCREMENT)).toBe(0);
    expect(roundInsulinUnits(0.04, PUMP_INSULIN_INCREMENT)).toBe(0.05);
  });
});

describe("formatInsulinUnits", () => {
  it("trims trailing zeros for pump increments", () => {
    expect(formatInsulinUnits(5, PUMP_INSULIN_INCREMENT)).toBe("5");
    expect(formatInsulinUnits(5.1, PUMP_INSULIN_INCREMENT)).toBe("5.1");
    expect(formatInsulinUnits(5.15, PUMP_INSULIN_INCREMENT)).toBe("5.15");
    expect(formatInsulinUnits(5.4, PEN_INSULIN_INCREMENT)).toBe("5");
  });
});
