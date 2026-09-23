import { describe, expect, it } from "vitest";
import {
  buildHba1cHistory,
  clampHba1cInput,
  formatOutcomeSummary,
  normalizeAppointmentOutcome,
  parseAppointmentOutcome,
} from "./appointment-outcomes";
import type { Appointment } from "./storage";

function appt(partial: Partial<Appointment> & Pick<Appointment, "id" | "date">): Appointment {
  return {
    title: "Clinic",
    type: "clinic",
    isCompleted: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("appointment-outcomes", () => {
  it("parses and normalizes HbA1c + screening fields", () => {
    const o = parseAppointmentOutcome({
      hba1cPercent: "7.25",
      eyeResult: "clear",
      footResult: "follow_up",
      outcomeNote: "  ask about pump  ",
    });
    expect(o?.hba1cPercent).toBe(7.3);
    expect(o?.eyeResult).toBe("clear");
    expect(normalizeAppointmentOutcome({ hba1cPercent: 99 })).toBeUndefined();
  });

  it("clamps HbA1c input", () => {
    expect(clampHba1cInput("7.2")).toBe(7.2);
    expect(clampHba1cInput("2")).toBeUndefined();
    expect(clampHba1cInput("")).toBeUndefined();
  });

  it("builds sorted HbA1c history", () => {
    const points = buildHba1cHistory([
      appt({ id: "b", date: "2026-06-01", outcome: { hba1cPercent: 7.1 } }),
      appt({ id: "a", date: "2026-01-01", outcome: { hba1cPercent: 7.8, resultDate: "2025-12-15" } }),
      appt({ id: "c", date: "2026-03-01", outcome: { eyeResult: "clear" } }),
    ]);
    expect(points.map((p) => p.date)).toEqual(["2025-12-15", "2026-06-01"]);
    expect(points[0]!.hba1cPercent).toBe(7.8);
  });

  it("formats outcome summary", () => {
    const s = formatOutcomeSummary(
      appt({
        id: "1",
        date: "2026-01-01",
        outcome: { hba1cPercent: 6.9, eyeResult: "clear" },
      }),
    );
    expect(s).toMatch(/HbA1c 6.9%/);
    expect(s).toMatch(/Eyes/);
  });
});
