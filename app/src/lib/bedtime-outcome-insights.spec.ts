import { describe, expect, it } from "vitest";
import {
  buildOutcomePatternTip,
  buildOvernightCheckinTakeaway,
  describeLastNightCheck,
  summarizeOutcomeAccuracy,
  type BedtimeOutcomeContext,
} from "@/lib/bedtime-outcome-insights";
import type { BedtimeLog, BedtimeOutcome } from "@/lib/storage";

function recentDate(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

function makeLog(overrides: Partial<BedtimeLog> = {}): BedtimeLog {
  return {
    id: `log-${Math.random()}`,
    date: recentDate(1),
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

function makeOutcome(overrides: Partial<BedtimeOutcome> = {}): BedtimeOutcome {
  return {
    reportedAt: recentDate(1),
    overnightFeel: "steady",
    ...overrides,
  };
}

const exerciseCorrectionContext: BedtimeOutcomeContext = {
  exercisedToday: true,
  hadAlcohol: false,
  recentHypos: false,
  actionSuggested: "correction",
  bgTrend: "steady",
};

describe("buildOutcomePatternTip", () => {
  it("returns null when there are fewer than 3 matching logged nights", () => {
    const logs = [
      makeLog({ exercisedToday: true, actionSuggested: "correction", outcome: makeOutcome({ overnightFeel: "went_low" }) }),
      makeLog({ exercisedToday: true, actionSuggested: "correction", outcome: makeOutcome({ overnightFeel: "went_low" }) }),
    ];
    expect(buildOutcomePatternTip(logs, exerciseCorrectionContext)).toBeNull();
  });

  it("surfaces a tip when a clear majority of matching nights went low", () => {
    const logs = [
      makeLog({ exercisedToday: true, actionSuggested: "correction", outcome: makeOutcome({ overnightFeel: "went_low" }) }),
      makeLog({ exercisedToday: true, actionSuggested: "correction", outcome: makeOutcome({ overnightFeel: "went_low" }) }),
      makeLog({ exercisedToday: true, actionSuggested: "correction", outcome: makeOutcome({ overnightFeel: "went_low" }) }),
      makeLog({ exercisedToday: true, actionSuggested: "correction", outcome: makeOutcome({ overnightFeel: "steady" }) }),
    ];
    const tip = buildOutcomePatternTip(logs, exerciseCorrectionContext);
    expect(tip).not.toBeNull();
    expect(tip).toMatch(/gone low 3 of 4/);
  });

  it("returns null when outcomes are mixed with no clear majority", () => {
    const logs = [
      makeLog({ exercisedToday: true, actionSuggested: "correction", outcome: makeOutcome({ overnightFeel: "went_low" }) }),
      makeLog({ exercisedToday: true, actionSuggested: "correction", outcome: makeOutcome({ overnightFeel: "went_high" }) }),
      makeLog({ exercisedToday: true, actionSuggested: "correction", outcome: makeOutcome({ overnightFeel: "steady" }) }),
    ];
    expect(buildOutcomePatternTip(logs, exerciseCorrectionContext)).toBeNull();
  });

  it("ignores logs that don't share tonight's key factors", () => {
    const logs = [
      makeLog({ exercisedToday: false, actionSuggested: "correction", outcome: makeOutcome({ overnightFeel: "went_low" }) }),
      makeLog({ exercisedToday: false, actionSuggested: "correction", outcome: makeOutcome({ overnightFeel: "went_low" }) }),
      makeLog({ exercisedToday: false, actionSuggested: "correction", outcome: makeOutcome({ overnightFeel: "went_low" }) }),
    ];
    expect(buildOutcomePatternTip(logs, exerciseCorrectionContext)).toBeNull();
  });

  it("ignores logs older than the lookback window", () => {
    const logs = [
      makeLog({ date: recentDate(120), exercisedToday: true, actionSuggested: "correction", outcome: makeOutcome({ overnightFeel: "went_low" }) }),
      makeLog({ date: recentDate(120), exercisedToday: true, actionSuggested: "correction", outcome: makeOutcome({ overnightFeel: "went_low" }) }),
      makeLog({ date: recentDate(120), exercisedToday: true, actionSuggested: "correction", outcome: makeOutcome({ overnightFeel: "went_low" }) }),
    ];
    expect(buildOutcomePatternTip(logs, exerciseCorrectionContext)).toBeNull();
  });
});

describe("summarizeOutcomeAccuracy", () => {
  it("returns null with fewer than 3 evaluable outcomes", () => {
    const logs = [
      makeLog({ readinessLevel: "steady", outcome: makeOutcome({ overnightFeel: "steady" }) }),
      makeLog({ readinessLevel: "alert", outcome: makeOutcome({ overnightFeel: "went_low" }) }),
    ];
    expect(summarizeOutcomeAccuracy(logs)).toBeNull();
  });

  it("counts a steady verdict matching a steady outcome as a match", () => {
    const logs = [
      makeLog({ readinessLevel: "steady", outcome: makeOutcome({ overnightFeel: "steady" }) }),
      makeLog({ readinessLevel: "alert", outcome: makeOutcome({ overnightFeel: "went_low" }) }),
      makeLog({ readinessLevel: "steady", outcome: makeOutcome({ overnightFeel: "went_high" }) }),
    ];
    // steady/steady -> match, alert/went_low -> match, steady/went_high -> mismatch
    expect(summarizeOutcomeAccuracy(logs)).toMatch(/3 nights went; 2 matched/);
  });

  it("ignores logs without an outcome or with an unsure result", () => {
    const logs = [
      makeLog({ readinessLevel: "steady" }),
      makeLog({ readinessLevel: "steady", outcome: makeOutcome({ overnightFeel: "not_sure" }) }),
      makeLog({ readinessLevel: "steady", outcome: makeOutcome({ overnightFeel: "steady" }) }),
    ];
    expect(summarizeOutcomeAccuracy(logs)).toBeNull();
  });
});

describe("describeLastNightCheck", () => {
  it("names the suggested correction and context chips", () => {
    const recap = describeLastNightCheck(
      makeLog({ currentBg: 15.4, actionSuggested: "correction", exercisedToday: true }),
    );
    expect(recap.bgLine).toMatch(/15\.4 mmol\/L/);
    expect(recap.actionLine).toMatch(/correction/i);
    expect(recap.contextChips).toContain("Exercise");
  });
});

describe("buildOvernightCheckinTakeaway", () => {
  it("recommends hypo treatment when a followed correction still went low", () => {
    const takeaway = buildOvernightCheckinTakeaway(
      makeLog({ actionSuggested: "correction" }),
      { overnightFeel: "went_low", followedAction: "yes" },
    );
    expect(takeaway.headline).toMatch(/still went low/i);
    expect(takeaway.recommendations.join(" ")).toMatch(/hypo treatment/i);
    expect(takeaway.nextCheckNote).toMatch(/never changes how a correction dose is calculated/i);
  });

  it("flags skipping a correction then waking high", () => {
    const takeaway = buildOvernightCheckinTakeaway(
      makeLog({ actionSuggested: "correction" }),
      { overnightFeel: "went_high", followedAction: "no" },
    );
    expect(takeaway.headline).toMatch(/skipping/i);
    expect(takeaway.body).toMatch(/woke high/i);
  });

  it("treats a followed correction that stayed steady as a positive pattern", () => {
    const takeaway = buildOvernightCheckinTakeaway(
      makeLog({ actionSuggested: "correction" }),
      { overnightFeel: "steady", followedAction: "yes" },
    );
    expect(takeaway.headline).toMatch(/worked/i);
    expect(takeaway.body).toMatch(/positive pattern/i);
  });

  it("counts prior similar nights in the recommendations", () => {
    const prior = makeLog({
      id: "older",
      date: recentDate(4),
      exercisedToday: true,
      actionSuggested: "correction",
      outcome: makeOutcome({ overnightFeel: "went_low" }),
    });
    const current = makeLog({ id: "tonight", exercisedToday: true, actionSuggested: "correction" });
    const takeaway = buildOvernightCheckinTakeaway(
      current,
      { overnightFeel: "went_low", followedAction: "yes" },
      [prior],
    );
    expect(takeaway.recommendations[0]).toMatch(/2 similar nights/i);
  });
});
