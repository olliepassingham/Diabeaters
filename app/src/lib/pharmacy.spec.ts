import { describe, expect, it } from "vitest";
import {
  describePharmacyStatus,
  isPharmacyOpenAt,
  latestPharmacyWindowEndingBefore,
  nextPharmacyOpeningAt,
  pharmacyDayKeyForDate,
  pharmacyHasAnyHours,
  pharmacyOpenIntervalsForDay,
} from "./pharmacy";
import {
  emptyPharmacyHours,
  type Pharmacy,
  type PharmacyDayKey,
  type PharmacyHoursDay,
} from "./storage";

function buildPharmacy(overrides: Partial<Record<PharmacyDayKey, PharmacyHoursDay>> = {}): Pharmacy {
  const hours = emptyPharmacyHours();
  for (const key of Object.keys(overrides) as PharmacyDayKey[]) {
    hours[key] = overrides[key]!;
  }
  return {
    name: "Test Pharmacy",
    hours,
    updatedAt: new Date().toISOString(),
  };
}

const STD_WEEKDAY: PharmacyHoursDay = { open: "09:00", close: "18:00" };

describe("pharmacyOpenIntervalsForDay", () => {
  it("returns one window for a normal day", () => {
    expect(pharmacyOpenIntervalsForDay(STD_WEEKDAY)).toEqual([{ start: 9 * 60, end: 18 * 60 }]);
  });

  it("returns no intervals when day is closed", () => {
    expect(pharmacyOpenIntervalsForDay({ closed: true })).toEqual([]);
    expect(pharmacyOpenIntervalsForDay(undefined)).toEqual([]);
  });

  it("ignores invalid times (close before open)", () => {
    expect(pharmacyOpenIntervalsForDay({ open: "18:00", close: "09:00" })).toEqual([]);
    expect(pharmacyOpenIntervalsForDay({ open: "garbage", close: "18:00" })).toEqual([]);
  });

  it("splits around a lunch break inside the window", () => {
    expect(
      pharmacyOpenIntervalsForDay({
        open: "09:00",
        close: "18:00",
        break: { start: "13:00", end: "14:00" },
      }),
    ).toEqual([
      { start: 9 * 60, end: 13 * 60 },
      { start: 14 * 60, end: 18 * 60 },
    ]);
  });

  it("ignores a malformed/outside-window break", () => {
    expect(
      pharmacyOpenIntervalsForDay({
        open: "09:00",
        close: "18:00",
        break: { start: "08:00", end: "09:30" },
      }),
    ).toEqual([{ start: 9 * 60, end: 18 * 60 }]);
  });
});

describe("isPharmacyOpenAt", () => {
  const p = buildPharmacy({
    mon: STD_WEEKDAY,
    tue: STD_WEEKDAY,
    wed: STD_WEEKDAY,
    thu: STD_WEEKDAY,
    fri: STD_WEEKDAY,
    sat: { open: "09:00", close: "13:00" },
    sun: { closed: true },
  });

  it("is open at 10:00 on Tuesday", () => {
    const tuesday10 = new Date(2026, 4, 5, 10, 0, 0); // 2026-05-05 is a Tuesday
    expect(pharmacyDayKeyForDate(tuesday10)).toBe("tue");
    expect(isPharmacyOpenAt(p, tuesday10)).toBe(true);
  });

  it("is closed exactly at the closing minute (closed-open interval)", () => {
    const tuesdayAtClose = new Date(2026, 4, 5, 18, 0, 0);
    expect(isPharmacyOpenAt(p, tuesdayAtClose)).toBe(false);
  });

  it("is open at the opening minute", () => {
    const tuesdayAtOpen = new Date(2026, 4, 5, 9, 0, 0);
    expect(isPharmacyOpenAt(p, tuesdayAtOpen)).toBe(true);
  });

  it("is closed all day on Sunday", () => {
    const sundayMid = new Date(2026, 4, 10, 12, 0, 0); // 2026-05-10 is a Sunday
    expect(pharmacyDayKeyForDate(sundayMid)).toBe("sun");
    expect(isPharmacyOpenAt(p, sundayMid)).toBe(false);
  });

  it("respects lunch break", () => {
    const lunch = buildPharmacy({
      tue: { open: "09:00", close: "18:00", break: { start: "13:00", end: "14:00" } },
    });
    const tuesday1330 = new Date(2026, 4, 5, 13, 30, 0);
    expect(isPharmacyOpenAt(lunch, tuesday1330)).toBe(false);
    const tuesday1430 = new Date(2026, 4, 5, 14, 30, 0);
    expect(isPharmacyOpenAt(lunch, tuesday1430)).toBe(true);
  });
});

describe("nextPharmacyOpeningAt", () => {
  const sundayClosed = buildPharmacy({
    mon: STD_WEEKDAY,
    tue: STD_WEEKDAY,
    wed: STD_WEEKDAY,
    thu: STD_WEEKDAY,
    fri: STD_WEEKDAY,
    sat: { open: "09:00", close: "13:00" },
    sun: { closed: true },
  });

  it("returns same-day open time when before opening hours", () => {
    const tuesday7am = new Date(2026, 4, 5, 7, 0, 0);
    const next = nextPharmacyOpeningAt(sundayClosed, tuesday7am);
    expect(next?.getDay()).toBe(2);
    expect(next?.getHours()).toBe(9);
    expect(next?.getMinutes()).toBe(0);
  });

  it("rolls forward over Sunday to Monday", () => {
    const sunday2pm = new Date(2026, 4, 10, 14, 0, 0);
    const next = nextPharmacyOpeningAt(sundayClosed, sunday2pm);
    expect(next?.getDay()).toBe(1);
    expect(next?.getHours()).toBe(9);
  });

  it("returns null when no hours are configured", () => {
    const empty = buildPharmacy();
    expect(nextPharmacyOpeningAt(empty, new Date(2026, 4, 5, 10))).toBeNull();
  });
});

describe("latestPharmacyWindowEndingBefore", () => {
  const sundayClosed = buildPharmacy({
    mon: STD_WEEKDAY,
    tue: STD_WEEKDAY,
    wed: STD_WEEKDAY,
    thu: STD_WEEKDAY,
    fri: STD_WEEKDAY,
    sat: { open: "09:00", close: "13:00" },
    sun: { closed: true },
  });

  it("returns Saturday's window when deadline is Sunday", () => {
    const sundayEvening = new Date(2026, 4, 10, 18, 0, 0);
    const w = latestPharmacyWindowEndingBefore(sundayClosed, sundayEvening);
    expect(w).not.toBeNull();
    expect(w!.start.getDay()).toBe(6);
    expect(w!.end.getHours()).toBe(13);
  });

  it("returns same-day partial window if deadline cuts during opening", () => {
    const tuesday1100 = new Date(2026, 4, 5, 11, 0, 0);
    const w = latestPharmacyWindowEndingBefore(sundayClosed, tuesday1100);
    expect(w).not.toBeNull();
    expect(w!.start.getHours()).toBe(9);
    expect(w!.end.getHours()).toBe(11);
  });

  it("returns null when no hours configured anywhere", () => {
    const empty = buildPharmacy();
    expect(latestPharmacyWindowEndingBefore(empty, new Date(2026, 4, 10, 18))).toBeNull();
  });
});

describe("describePharmacyStatus", () => {
  const p = buildPharmacy({
    mon: STD_WEEKDAY,
    tue: STD_WEEKDAY,
    wed: STD_WEEKDAY,
    thu: STD_WEEKDAY,
    fri: STD_WEEKDAY,
    sat: { open: "09:00", close: "13:00" },
    sun: { closed: true },
  });

  it("reports Open until <close> during open hours", () => {
    expect(describePharmacyStatus(p, new Date(2026, 4, 5, 10, 0, 0))).toEqual({
      open: true,
      line: "Open until 18:00",
    });
  });

  it("reports Closed — opens <next> on a closed day", () => {
    const sunday = new Date(2026, 4, 10, 12, 0, 0);
    expect(describePharmacyStatus(p, sunday)).toEqual({
      open: false,
      line: "Closed — opens tomorrow 09:00",
    });
  });

  it("returns null when no hours are configured", () => {
    expect(describePharmacyStatus(buildPharmacy(), new Date())).toBeNull();
    expect(describePharmacyStatus(null, new Date())).toBeNull();
  });
});

describe("pharmacyHasAnyHours", () => {
  it("false for null / fully empty", () => {
    expect(pharmacyHasAnyHours(null)).toBe(false);
    expect(pharmacyHasAnyHours(buildPharmacy())).toBe(false);
  });

  it("true once one valid day exists", () => {
    expect(pharmacyHasAnyHours(buildPharmacy({ mon: STD_WEEKDAY }))).toBe(true);
  });
});
