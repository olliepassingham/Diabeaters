import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_GLUCOSE_DAY_FILTERS,
  formatGlucoseDayFiltersSummary,
  glucoseDayFiltersToOverlayOptions,
  readGlucoseDayFilters,
  writeGlucoseDayFilters,
} from "./glucose-day-filters";

const STORAGE_KEY = "diabeater_glucose_day_filters_v1";

afterEach(() => {
  localStorage.removeItem(STORAGE_KEY);
});

describe("readGlucoseDayFilters / writeGlucoseDayFilters", () => {
  it("returns defaults when nothing is stored", () => {
    expect(readGlucoseDayFilters()).toEqual(DEFAULT_GLUCOSE_DAY_FILTERS);
  });

  it("round-trips a valid preference", () => {
    writeGlucoseDayFilters({ dayRange: 14, timeWindowId: "morning", dayKind: "weekdays" });
    expect(readGlucoseDayFilters()).toEqual({
      dayRange: 14,
      timeWindowId: "morning",
      dayKind: "weekdays",
    });
  });

  it("falls back field-by-field when stored JSON is partially invalid", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ dayRange: 99, timeWindowId: "morning", dayKind: "nope" }),
    );
    expect(readGlucoseDayFilters()).toEqual({
      dayRange: 7,
      timeWindowId: "morning",
      dayKind: "all",
    });
  });

  it("returns defaults for corrupt JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(readGlucoseDayFilters()).toEqual(DEFAULT_GLUCOSE_DAY_FILTERS);
  });
});

describe("formatGlucoseDayFiltersSummary", () => {
  it("shows only the day range for the default filters", () => {
    expect(formatGlucoseDayFiltersSummary(DEFAULT_GLUCOSE_DAY_FILTERS)).toBe("7 days");
  });

  it("includes time-of-day and day-kind when narrowed", () => {
    expect(
      formatGlucoseDayFiltersSummary({
        dayRange: 3,
        timeWindowId: "evening",
        dayKind: "weekends",
      }),
    ).toBe("3 days · Evening · Weekends");
  });
});

describe("glucoseDayFiltersToOverlayOptions", () => {
  it("maps morning window to minute bounds", () => {
    expect(
      glucoseDayFiltersToOverlayOptions({
        dayRange: 7,
        timeWindowId: "morning",
        dayKind: "weekdays",
      }),
    ).toEqual({
      days: 7,
      minuteStart: 6 * 60,
      minuteEnd: 12 * 60,
      dayKind: "weekdays",
    });
  });
});
