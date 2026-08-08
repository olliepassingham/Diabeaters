import { format, startOfDay } from "date-fns";
import { afterEach, describe, expect, it } from "vitest";

import {
  hasBedtimeCheckToday,
  isBedtimeReminderDueNow,
  parseBedtimeReminderTime,
  reminderAtOnDay,
  upcomingBedtimeReminderSlots,
} from "@/lib/bedtime-reminder-schedule";
import { storage } from "@/lib/storage";

describe("bedtime-reminder-schedule", () => {
  afterEach(() => {
    localStorage.removeItem("diabeater_bedtime_logs");
  });

  it("parses HH:mm reminder times", () => {
    expect(parseBedtimeReminderTime("20:30")).toEqual({ hour: 20, minute: 30 });
    expect(parseBedtimeReminderTime("bad")).toBeNull();
  });

  it("detects when reminder is due and check not done", () => {
    const now = new Date(2026, 5, 9, 21, 0, 0);
    expect(isBedtimeReminderDueNow("20:30", now)).toBe(true);
  });

  it("skips reminder when bedtime check already logged today", () => {
    const now = new Date(2026, 5, 9, 21, 0, 0);
    storage.saveBedtimeLog({
      id: "log-1",
      date: now.toISOString(),
      currentBg: 6.2,
      bgUnits: "mmol/L",
      readinessLevel: "steady",
      hoursSinceFood: null,
      hoursSinceInsulin: null,
      exercisedToday: false,
      hadAlcohol: false,
      sickDayActive: false,
      travelModeActive: false,
      correctionGiven: null,
      notes: "",
    });
    expect(hasBedtimeCheckToday(now)).toBe(true);
    expect(isBedtimeReminderDueNow("20:30", now)).toBe(false);
  });

  it("treats a post-midnight check as completing the previous evening", () => {
    const evening = new Date(2026, 5, 9, 21, 0, 0);
    storage.saveBedtimeLog({
      id: "log-late",
      date: new Date(2026, 5, 10, 0, 40, 0).toISOString(),
      currentBg: 6.2,
      bgUnits: "mmol/L",
      readinessLevel: "steady",
      hoursSinceFood: null,
      hoursSinceInsulin: null,
      exercisedToday: false,
      hadAlcohol: false,
      sickDayActive: false,
      travelModeActive: false,
      correctionGiven: null,
      notes: "",
    });
    expect(hasBedtimeCheckToday(evening)).toBe(true);
    expect(hasBedtimeCheckToday(new Date(2026, 5, 10, 10, 0, 0))).toBe(false);
  });

  it("schedules future slots and skips today once checked in", () => {
    const now = new Date(2026, 5, 9, 18, 0, 0);
    const slots = upcomingBedtimeReminderSlots("20:30", now, 3);
    expect(slots.length).toBeGreaterThan(0);
    expect(format(slots[0]!.at, "yyyy-MM-dd")).toBe("2026-06-09");

    storage.saveBedtimeLog({
      id: "log-2",
      date: reminderAtOnDay(now, "20:30")!.toISOString(),
      currentBg: 5.8,
      bgUnits: "mmol/L",
      readinessLevel: "steady",
      hoursSinceFood: null,
      hoursSinceInsulin: null,
      exercisedToday: false,
      hadAlcohol: false,
      sickDayActive: false,
      travelModeActive: false,
      correctionGiven: null,
      notes: "",
    });

    const afterCheck = upcomingBedtimeReminderSlots("20:30", now, 3);
    expect(afterCheck.every((s) => s.dayKey !== format(startOfDay(now), "yyyy-MM-dd"))).toBe(true);
  });
});
