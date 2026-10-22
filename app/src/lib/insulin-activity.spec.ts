import { beforeEach, describe, expect, it } from "vitest";

import {
  deleteInsulinDose,
  getLongActingDoseHistory,
  getLongActingDoses,
  getRapidInsulinDoseHistory,
  getRapidInsulinDoses,
  RAPID_ACTION_HOURS,
  rapidRunsOutAt,
  recordLongActingDose,
  recordRapidInsulinDose,
  remainingRapidUnits,
  updateInsulinDose,
  type RapidInsulinDose,
} from "@/lib/insulin-activity";

function dose(units: number, takenAtIso: string): RapidInsulinDose {
  return { id: takenAtIso, takenAtIso, units };
}

describe("remainingRapidUnits", () => {
  const taken = "2026-10-15T08:00:00.000Z";
  const at = new Date(taken).getTime();

  it("starts at the full dose and reaches zero at the end of the action window", () => {
    const doses = [dose(6, taken)];
    expect(remainingRapidUnits(doses, at)).toBeCloseTo(6);
    expect(remainingRapidUnits(doses, at + 2 * 3_600_000)).toBeCloseTo(3);
    expect(remainingRapidUnits(doses, at + RAPID_ACTION_HOURS * 3_600_000)).toBe(0);
  });

  it("adds overlapping doses", () => {
    const doses = [dose(4, taken), dose(2, new Date(at + 3_600_000).toISOString())];
    expect(remainingRapidUnits(doses, at + 3_600_000)).toBeCloseTo(3 + 2);
  });

  it("reports when the latest active dose runs out", () => {
    const doses = [dose(4, taken)];
    expect(rapidRunsOutAt(doses, at + 3_600_000)).toBe(at + RAPID_ACTION_HOURS * 3_600_000);
    expect(rapidRunsOutAt(doses, at + RAPID_ACTION_HOURS * 3_600_000)).toBeNull();
  });
});

describe("dose history for patterns", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps recorded doses in history beyond the graph's live window", () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 3_600_000).toISOString();
    recordRapidInsulinDose({ units: 6, takenAtIso: tenDaysAgo });
    recordLongActingDose({ units: 12, takenAtIso: tenDaysAgo });

    const rapid = getRapidInsulinDoseHistory();
    expect(rapid).toHaveLength(1);
    expect(rapid[0]?.units).toBe(6);
    expect(getLongActingDoseHistory()).toHaveLength(1);
  });

  it("drops history older than the retention window and honours withinDays", () => {
    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 3_600_000).toISOString();
    recordRapidInsulinDose({ units: 5, takenAtIso: fortyDaysAgo });
    recordRapidInsulinDose({ units: 7 });

    expect(getRapidInsulinDoseHistory().map((d) => d.units)).toEqual([7]);
    expect(getRapidInsulinDoseHistory(0)).toEqual([]);
  });

  it("seeds history from doses already on the graph store", () => {
    const yesterday = new Date(Date.now() - 24 * 3_600_000).toISOString();
    localStorage.setItem(
      "diabeater_insulin_activity_v1",
      JSON.stringify({ rapid: [dose(4, yesterday)], longActing: [] }),
    );
    expect(getRapidInsulinDoseHistory().map((d) => d.units)).toEqual([4]);
  });
});

describe("editing and deleting doses", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("updates units and time in the chart store and history together", () => {
    const takenAtIso = new Date(Date.now() - 2 * 3_600_000).toISOString();
    const saved = recordRapidInsulinDose({ units: 6, takenAtIso });
    expect(saved).not.toBeNull();
    const newTime = new Date(Date.now() - 90 * 60_000).toISOString();
    expect(updateInsulinDose("rapid", saved!.id, { units: 4.5, takenAtIso: newTime })).toBe(true);

    expect(getRapidInsulinDoses()).toEqual([{ id: saved!.id, takenAtIso: newTime, units: 4.5 }]);
    expect(getRapidInsulinDoseHistory().map((d) => [d.units, d.takenAtIso])).toEqual([[4.5, newTime]]);
  });

  it("updates long-acting doses too", () => {
    const takenAtIso = new Date(Date.now() - 10 * 3_600_000).toISOString();
    const newTime = new Date(Date.now() - 9 * 3_600_000).toISOString();
    const saved = recordLongActingDose({ units: 12, takenAtIso });
    expect(updateInsulinDose("longActing", saved!.id, { units: 14, takenAtIso: newTime })).toBe(true);
    expect(getLongActingDoses()[0]?.units).toBe(14);
    expect(getLongActingDoseHistory()[0]?.units).toBe(14);
  });

  it("deletes from the chart store and history together", () => {
    const rapid = recordRapidInsulinDose({ units: 5 });
    const long = recordLongActingDose({ units: 10 });
    expect(deleteInsulinDose("rapid", rapid!.id)).toBe(true);
    expect(deleteInsulinDose("longActing", long!.id)).toBe(true);
    expect(getRapidInsulinDoses()).toEqual([]);
    expect(getLongActingDoses()).toEqual([]);
    expect(getRapidInsulinDoseHistory()).toEqual([]);
    expect(getLongActingDoseHistory()).toEqual([]);
  });

  it("rejects invalid edits and unknown ids", () => {
    const saved = recordRapidInsulinDose({ units: 5 });
    expect(updateInsulinDose("rapid", saved!.id, { units: 0, takenAtIso: new Date().toISOString() })).toBe(false);
    expect(updateInsulinDose("rapid", saved!.id, { units: 5, takenAtIso: "not-a-date" })).toBe(false);
    expect(updateInsulinDose("rapid", "missing-id", { units: 5, takenAtIso: new Date().toISOString() })).toBe(false);
    expect(deleteInsulinDose("rapid", "missing-id")).toBe(false);
    expect(getRapidInsulinDoses()).toHaveLength(1);
  });
});
