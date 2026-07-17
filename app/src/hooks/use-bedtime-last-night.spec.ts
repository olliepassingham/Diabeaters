import { describe, expect, it } from "vitest";
import { bedtimeLogsContentKey } from "./use-bedtime-last-night";
import type { BedtimeLog } from "@/lib/storage";

function log(partial: Partial<BedtimeLog> & Pick<BedtimeLog, "id" | "date">): BedtimeLog {
  return {
    currentBg: 6,
    bgUnits: "mmol/L",
    readinessLevel: "steady",
    hoursUntilSleep: 0,
    hoursSinceMeal: 3,
    hoursSinceInsulin: 3,
    recentHypos: 0,
    exercisedToday: false,
    hadAlcohol: false,
    isTraveling: false,
    isSick: false,
    correctionGiven: false,
    ...partial,
  };
}

describe("bedtimeLogsContentKey", () => {
  it("is stable for equal content across new array instances", () => {
    const a = [log({ id: "1", date: "2026-07-16T22:00:00.000Z", hoursUntilSleep: 1 })];
    const b = [log({ id: "1", date: "2026-07-16T22:00:00.000Z", hoursUntilSleep: 1 })];
    expect(a).not.toBe(b);
    expect(bedtimeLogsContentKey(a)).toBe(bedtimeLogsContentKey(b));
  });

  it("changes when a log changes", () => {
    const a = [log({ id: "1", date: "2026-07-16T22:00:00.000Z" })];
    const b = [log({ id: "1", date: "2026-07-17T22:00:00.000Z" })];
    expect(bedtimeLogsContentKey(a)).not.toBe(bedtimeLogsContentKey(b));
  });
});
