import { describe, expect, it } from "vitest";

import {
  RAPID_ACTION_HOURS,
  rapidRunsOutAt,
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
