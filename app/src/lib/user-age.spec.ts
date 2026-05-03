import { describe, expect, it } from "vitest";
import {
  ageInWholeYearsUtc,
  canShowAlcoholScenarios,
  canShowDrivingReadiness,
  getAgeBand,
  hypoCalculatorRequiresExplicitWeight,
  normalizeDateOfBirthInput,
} from "./user-age";

const FIXED = new Date("2026-05-01T12:00:00Z");

describe("normalizeDateOfBirthInput", () => {
  it("accepts YYYY-MM-DD", () => {
    expect(normalizeDateOfBirthInput(" 2001-03-09 ")).toBe("2001-03-09");
  });

  it("rejects non-ISO strings", () => {
    expect(normalizeDateOfBirthInput("01/03/2001")).toBeNull();
    expect(normalizeDateOfBirthInput("")).toBeNull();
  });
});

describe("ageInWholeYearsUtc", () => {
  it("counts birthdays in UTC", () => {
    expect(ageInWholeYearsUtc("1990-06-15", FIXED)).toBe(35);
    expect(ageInWholeYearsUtc("2000-01-01", FIXED)).toBe(26);
    expect(ageInWholeYearsUtc("2012-06-15", FIXED)).toBe(13);
  });

  it("returns null when DOB missing", () => {
    expect(ageInWholeYearsUtc("", FIXED)).toBeNull();
    expect(ageInWholeYearsUtc(null, FIXED)).toBeNull();
  });
});

describe("getAgeBand", () => {
  it("maps age ranges", () => {
    expect(getAgeBand("2016-01-01", FIXED)).toBe("child");
    expect(getAgeBand("2010-01-01", FIXED)).toBe("teen");
    expect(getAgeBand("2000-01-01", FIXED)).toBe("adult");
    expect(getAgeBand("", FIXED)).toBeNull();
  });
});

describe("scenario gates", () => {
  it("hides alcohol under 18", () => {
    expect(canShowAlcoholScenarios("2010-01-01", FIXED)).toBe(false);
    expect(canShowAlcoholScenarios("2000-01-01", FIXED)).toBe(true);
    expect(canShowAlcoholScenarios("", FIXED)).toBe(true);
  });

  it("hides driving under 17", () => {
    expect(canShowDrivingReadiness("2010-05-02", FIXED)).toBe(false);
    expect(canShowDrivingReadiness("2009-05-01", FIXED)).toBe(true);
    expect(canShowDrivingReadiness("", FIXED)).toBe(true);
  });
});

describe("hypoCalculatorRequiresExplicitWeight", () => {
  it("is true only for known minors", () => {
    expect(hypoCalculatorRequiresExplicitWeight("2010-01-01", FIXED)).toBe(true);
    expect(hypoCalculatorRequiresExplicitWeight("2000-01-01", FIXED)).toBe(false);
    expect(hypoCalculatorRequiresExplicitWeight("", FIXED)).toBe(false);
  });
});
