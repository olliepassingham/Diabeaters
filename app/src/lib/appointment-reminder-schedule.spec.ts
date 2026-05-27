import { describe, expect, it } from "vitest";

import {
  APPOINTMENT_EVENING_REMINDER_HOUR,
  appointmentReminderTimes,
  eveningBeforeReminderAt,
  parseAppointmentScheduledAt,
  twoHoursBeforeReminderAt,
} from "@/lib/appointment-reminder-schedule";

describe("appointment-reminder-schedule", () => {
  it("parses local date and time", () => {
    const d = parseAppointmentScheduledAt("2026-05-21", "14:30");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(4);
    expect(d!.getDate()).toBe(21);
    expect(d!.getHours()).toBe(14);
    expect(d!.getMinutes()).toBe(30);
  });

  it("defaults missing time to 09:00", () => {
    const d = parseAppointmentScheduledAt("2026-05-21");
    expect(d!.getHours()).toBe(9);
    expect(d!.getMinutes()).toBe(0);
  });

  it("evening before is 18:00 on the previous calendar day", () => {
    const scheduled = parseAppointmentScheduledAt("2026-05-21", "10:00")!;
    const evening = eveningBeforeReminderAt(scheduled);
    expect(evening.getFullYear()).toBe(2026);
    expect(evening.getMonth()).toBe(4);
    expect(evening.getDate()).toBe(20);
    expect(evening.getHours()).toBe(APPOINTMENT_EVENING_REMINDER_HOUR);
    expect(evening.getMinutes()).toBe(0);
  });

  it("two hours before subtracts exactly 2h", () => {
    const scheduled = parseAppointmentScheduledAt("2026-05-21", "14:30")!;
    const twoH = twoHoursBeforeReminderAt(scheduled);
    expect(twoH.getTime()).toBe(scheduled.getTime() - 2 * 60 * 60 * 1000);
  });

  it("returns both reminder instants", () => {
    const scheduled = parseAppointmentScheduledAt("2026-05-21", "09:00")!;
    const times = appointmentReminderTimes(scheduled);
    expect(times.eveningBefore.getTime()).toBeLessThan(times.twoHoursBefore.getTime());
    expect(times.twoHoursBefore.getTime()).toBeLessThan(scheduled.getTime());
  });
});
