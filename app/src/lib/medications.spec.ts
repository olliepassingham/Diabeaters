import { beforeEach, describe, expect, it } from "vitest";
import {
  addMedication,
  deleteMedication,
  listMedications,
  medicationAdherence,
  setDoseTaken,
  toLocalDateKey,
  todaysDoses,
  updateMedication,
} from "@/lib/medications";

describe("medications", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("adds, updates, and deletes medications with cleaned times", () => {
    const med = addMedication({ name: " Metformin ", dose: "500mg", times: ["20:00", "08:00", "08:00", "bad"] });
    expect(med?.name).toBe("Metformin");
    expect(med?.times).toEqual(["08:00", "20:00"]);
    expect(updateMedication(med!.id, { name: "Metformin", dose: "850mg", times: ["09:00"] })).toBe(true);
    expect(listMedications()[0]?.dose).toBe("850mg");
    expect(deleteMedication(med!.id)).toBe(true);
    expect(listMedications()).toEqual([]);
  });

  it("rejects a medication with no name or no times", () => {
    expect(addMedication({ name: " ", dose: "", times: ["08:00"] })).toBeNull();
    expect(addMedication({ name: "Metformin", dose: "", times: [] })).toBeNull();
  });

  it("builds today's schedule with due and taken states", () => {
    const med = addMedication({ name: "Metformin", dose: "500mg", times: ["08:00", "20:00"] });
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    const today = todaysDoses(now);
    expect(today.map((d) => [d.time, d.due, d.taken])).toEqual([
      ["08:00", true, false],
      ["20:00", false, false],
    ]);
    setDoseTaken(med!.id, toLocalDateKey(now), "08:00", true);
    expect(todaysDoses(now)[0]?.taken).toBe(true);
    setDoseTaken(med!.id, toLocalDateKey(now), "08:00", false);
    expect(todaysDoses(now)[0]?.taken).toBe(false);
  });

  it("computes adherence over the last week counting only due doses", () => {
    const med = addMedication({ name: "Metformin", dose: "500mg", times: ["08:00"] });
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    for (let d = 0; d < 7; d++) {
      const day = new Date(now);
      day.setDate(now.getDate() - d);
      if (d % 2 === 0) setDoseTaken(med!.id, toLocalDateKey(day), "08:00", true);
    }
    const result = medicationAdherence(7, now);
    expect(result.scheduled).toBe(7);
    expect(result.taken).toBe(4);
    expect(result.pct).toBe(57);
  });
});
