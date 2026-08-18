import { describe, expect, it } from "vitest";
import type { HypoTreatment } from "./storage";
import {
  buildHypoHistoryMonths,
  classifyHypoTreatment,
  countTypes,
  currentHypoMonthKey,
  groupHypoEntriesByDay,
  isOvernightHypo,
  previousHypoMonthKey,
} from "./hypo-treatment-history";

function row(partial: Partial<HypoTreatment> & { timestamp: string }): HypoTreatment {
  return {
    id: partial.id ?? partial.timestamp,
    timestamp: partial.timestamp,
    carerNotified: partial.carerNotified ?? false,
    treatment: partial.treatment,
    notes: partial.notes,
    glucoseLevel: partial.glucoseLevel,
  };
}

describe("classifyHypoTreatment", () => {
  it("maps dashboard log labels to known types", () => {
    expect(classifyHypoTreatment({ treatment: "Glucose tablets" }).id).toBe("glucose_tablets");
    expect(classifyHypoTreatment({ treatment: "Juice" }).id).toBe("juice");
    expect(classifyHypoTreatment({ treatment: "Sweets" }).id).toBe("sweets");
    expect(classifyHypoTreatment({ treatment: "Gel" }).id).toBe("gel");
    expect(classifyHypoTreatment({ treatment: "Sugary drink" }).id).toBe("sugary_drink");
  });

  it("groups custom favourite labels together", () => {
    const a = classifyHypoTreatment({ treatment: "Running gel" });
    const b = classifyHypoTreatment({ treatment: "running  gel" });
    expect(a.id).toBe("gel");
    expect(b.id).toBe("gel");
  });

  it("keeps unknown named treatments as their own type", () => {
    const classified = classifyHypoTreatment({ treatment: "Skittles" });
    expect(classified.id).toBe("custom:skittles");
    expect(classified.label).toBe("Skittles");
  });

  it("labels CGM trend logs and empty quick logs", () => {
    expect(
      classifyHypoTreatment({
        notes: "Logged from glucose trends (possible low · ~18 min below target)",
      }).id,
    ).toBe("from_trends");
    expect(classifyHypoTreatment({}).id).toBe("quick_log");
  });
});

describe("buildHypoHistoryMonths", () => {
  it("counts treatments per month and type", () => {
    const now = new Date(2026, 7, 18, 12, 0, 0);
    const months = buildHypoHistoryMonths(
      [
        row({ timestamp: "2026-08-17T16:28:00.000Z", treatment: "Juice", glucoseLevel: 2.7 }),
        row({ timestamp: "2026-08-12T08:10:00.000Z", treatment: "Juice" }),
        row({
          timestamp: "2026-08-03T09:00:00.000Z",
          notes: "Logged from glucose trends (possible low · ~12 min below target)",
        }),
        row({ timestamp: "2026-07-02T10:00:00.000Z", treatment: "Glucose tablets" }),
      ],
      now,
    );

    expect(currentHypoMonthKey(now)).toBe("2026-08");
    expect(months[0]?.key).toBe("2026-08");
    expect(months[0]?.count).toBe(3);
    expect(months[0]?.types[0]).toMatchObject({ id: "juice", count: 2 });
    expect(months.find((m) => m.key === "2026-07")?.count).toBe(1);
  });

  it("includes the current month even when it is empty if older logs exist", () => {
    const now = new Date(2026, 7, 18, 12, 0, 0);
    const months = buildHypoHistoryMonths(
      [row({ timestamp: "2026-06-02T10:00:00.000Z", treatment: "Juice" })],
      now,
    );
    expect(months.some((m) => m.key === "2026-08" && m.count === 0)).toBe(true);
    expect(months.some((m) => m.key === "2026-06" && m.count === 1)).toBe(true);
  });
});

describe("countTypes / grouping helpers", () => {
  it("sorts types by count then label", () => {
    const types = countTypes([
      row({ timestamp: "2026-08-01T10:00:00.000Z", treatment: "Juice" }),
      row({ timestamp: "2026-08-02T10:00:00.000Z", treatment: "Juice" }),
      row({ timestamp: "2026-08-03T10:00:00.000Z", treatment: "Gel" }),
    ]);
    expect(types.map((t) => t.id)).toEqual(["juice", "gel"]);
  });

  it("groups entries by local calendar day", () => {
    const groups = groupHypoEntriesByDay([
      row({ timestamp: "2026-08-17T16:28:00.000Z", treatment: "Juice" }),
      row({ timestamp: "2026-08-17T08:00:00.000Z", treatment: "Gel" }),
      row({ timestamp: "2026-08-12T08:10:00.000Z", treatment: "Juice" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.entries).toHaveLength(2);
  });

  it("flags overnight hours", () => {
    expect(isOvernightHypo("2026-08-17T23:10:00")).toBe(true);
    expect(isOvernightHypo("2026-08-17T06:50:00")).toBe(true);
    expect(isOvernightHypo("2026-08-17T12:00:00")).toBe(false);
  });

  it("steps back one calendar month", () => {
    expect(previousHypoMonthKey("2026-01")).toBe("2025-12");
    expect(previousHypoMonthKey("2026-08")).toBe("2026-07");
  });
});
