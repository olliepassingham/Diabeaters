import { beforeEach, describe, expect, it } from "vitest";

import {
  getLongActingDoseHistory,
  getRapidInsulinDoseHistory,
  RAPID_ACTION_HOURS,
  rapidRunsOutAt,
  recordLongActingDose,
  recordRapidInsulinDose,
  remainingRapidUnits,
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
