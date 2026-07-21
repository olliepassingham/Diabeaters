import { beforeEach, describe, expect, it } from "vitest";
import {
  dismissBedtimeOutcomePrompt,
  findLogNeedingOutcome,
  isBedtimeOutcomePromptDismissed,
} from "@/lib/bedtime-outcome-prompt";
import type { BedtimeLog } from "@/lib/storage";

function makeLog(overrides: Partial<BedtimeLog> = {}): BedtimeLog {
  return {
    id: "log-1",
    date: "2026-07-08T22:00:00.000Z",
    currentBg: 7.2,
    bgUnits: "mmol/L",
    readinessLevel: "monitor",
    hoursSinceFood: 3,
    hoursSinceInsulin: 2,
    hoursUntilSleep: 1,
    exercisedToday: false,
    hadAlcohol: false,
    sickDayActive: false,
    travelModeActive: false,
    correctionGiven: null,
    notes: "",
    ...overrides,
  };
}

describe("bedtime-outcome-prompt", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when the sleep window has not ended yet", () => {
    const now = new Date("2026-07-08T23:00:00.000Z").getTime();
    const logs = [makeLog()];
    expect(findLogNeedingOutcome(logs, now)).toBeNull();
  });

  it("finds the most recent log whose sleep window has ended and has no outcome yet", () => {
    const now = new Date("2026-07-09T10:00:00.000Z").getTime();
    const logs = [
      makeLog({ id: "older", date: "2026-07-07T22:00:00.000Z" }),
      makeLog({ id: "last-night", date: "2026-07-08T22:00:00.000Z" }),
    ];
    expect(findLogNeedingOutcome(logs, now)?.id).toBe("last-night");
  });

  it("skips logs that already have an outcome", () => {
    const now = new Date("2026-07-09T10:00:00.000Z").getTime();
    const logs = [
      makeLog({
        id: "last-night",
        date: "2026-07-08T22:00:00.000Z",
        outcome: { reportedAt: now.toString(), overnightFeel: "steady" },
      }),
    ];
    expect(findLogNeedingOutcome(logs, now)).toBeNull();
  });

  it("skips logs whose window ended more than 48h ago", () => {
    const now = new Date("2026-07-12T10:00:00.000Z").getTime();
    const logs = [makeLog({ id: "stale", date: "2026-07-08T22:00:00.000Z" })];
    expect(findLogNeedingOutcome(logs, now)).toBeNull();
  });

  it("skips logs that have been dismissed", () => {
    const now = new Date("2026-07-09T10:00:00.000Z").getTime();
    const logs = [makeLog({ id: "last-night", date: "2026-07-08T22:00:00.000Z" })];
    expect(isBedtimeOutcomePromptDismissed("last-night")).toBe(false);
    dismissBedtimeOutcomePrompt("last-night");
    expect(isBedtimeOutcomePromptDismissed("last-night")).toBe(true);
    expect(findLogNeedingOutcome(logs, now)).toBeNull();
  });

  it("falls back to an earlier eligible log when the most recent one is dismissed", () => {
    const now = new Date("2026-07-09T10:00:00.000Z").getTime();
    const logs = [
      makeLog({ id: "older", date: "2026-07-07T22:00:00.000Z" }),
      makeLog({ id: "last-night", date: "2026-07-08T22:00:00.000Z" }),
    ];
    dismissBedtimeOutcomePrompt("last-night");
    expect(findLogNeedingOutcome(logs, now)?.id).toBe("older");
  });
});
