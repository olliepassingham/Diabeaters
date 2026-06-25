import { describe, expect, it } from "vitest";

import {
  buildBedtimePersonalizedCopy,
  resolveBedtimeSnack,
  resolveBedtimeReadinessLevel,
  isOvernightRiseLikely,
} from "./bedtime-readiness";

const baseCtx = {
  bgDisplay: "7.0 mmol/L",
  bgMmol: 7,
  targetLowMmol: 5,
  targetHighMmol: 8,
  bgTrend: "steady" as const,
  recentHypos: false,
  exercisedToday: false,
  hadAlcohol: false,
  foodPhrase: null,
  foodHours: null,
  foodSelected: false,
  bolusPhrase: null,
  insulinHours: null,
  insulinSelected: false,
  carbs: null,
  sleepHours: null,
  concernCount: 0,
  cautionCount: 0,
  concernLabels: [] as string[],
  cautionLabels: [] as string[],
  isPumpUser: false,
  sickDayActive: false,
  travelModeActive: false,
  mdiBasalForBed: null,
  basalClockSummary: null,
  overnightUsualTrend: "not_sure" as const,
};

describe("bedtime-readiness", () => {
  it("recent hypo alone with in-range steady BG does not suggest a snack", () => {
    const snack = resolveBedtimeSnack({ ...baseCtx, recentHypos: true });
    expect(snack).toBeNull();
  });

  it("does not recap user inputs in guidance bullets", () => {
    const copy = buildBedtimePersonalizedCopy({
      ...baseCtx,
      level: "alert",
      recentHypos: true,
      exercisedToday: true,
      foodSelected: true,
      foodPhrase: "about 3 hours",
      foodHours: 3,
      insulinSelected: true,
      bolusPhrase: "about 3 hours",
      insulinHours: 3,
      sleepHours: 1.5,
      concernCount: 1,
      cautionCount: 2,
      concernLabels: ["Recent hypos"],
      cautionLabels: ["Exercise today", "Time to sleep"],
    });
    expect(copy.guidance.some((g) => g.startsWith("From what you told us"))).toBe(false);
    expect(copy.guidance.some((g) => g.includes("Recent hypos and Exercise"))).toBe(false);
    expect(copy.guidance.length).toBeGreaterThan(0);
    expect(copy.bgGlance.display).toBe("7.0 mmol/L");
  });

  it("monitor with recent hypo only gives actionable guidance", () => {
    const copy = buildBedtimePersonalizedCopy({
      ...baseCtx,
      level: "monitor",
      recentHypos: true,
      concernCount: 1,
      cautionCount: 0,
      concernLabels: ["Recent hypos"],
      cautionLabels: [],
    });
    expect(copy.headline).toMatch(/recent hypo/i);
    expect(copy.guidance.some((g) => /treatment within reach/i.test(g))).toBe(true);
    expect(copy.snack).toBeNull();
  });

  it("recent hypo with falling trend suggests snack", () => {
    const snack = resolveBedtimeSnack({ ...baseCtx, recentHypos: true, bgTrend: "falling" });
    expect(snack?.grams).toBe(5);
    expect(snack?.reason).toBe("Falling trend overnight");
  });

  it("above-target BG alone is at least monitor, not steady", () => {
    const level = resolveBedtimeReadinessLevel({
      concernCount: 0,
      cautionCount: 0,
      bgMmol: 12.4,
      targetHighMmol: 10,
      bgTrend: "steady",
      mdiBasalForBed: null,
      overnightUsualTrend: "not_sure",
      isPumpUser: false,
    });
    expect(level).toBe("monitor");
  });

  it("morning MDI with well-above BG and stable trend escalates to alert", () => {
    const level = resolveBedtimeReadinessLevel({
      concernCount: 0,
      cautionCount: 1,
      bgMmol: 12.4,
      targetHighMmol: 8,
      bgTrend: "steady",
      mdiBasalForBed: "morning",
      overnightUsualTrend: "not_sure",
      isPumpUser: false,
    });
    expect(level).toBe("alert");
  });

  it("monitor copy for high BG mentions planning before sleep", () => {
    const copy = buildBedtimePersonalizedCopy({
      ...baseCtx,
      level: "monitor",
      bgMmol: 12.4,
      bgDisplay: "12.4 mmol/L",
      targetHighMmol: 10,
      bgTrend: "steady",
      mdiBasalForBed: "morning",
      overnightUsualTrend: "not_sure",
      cautionCount: 2,
      cautionLabels: ["Blood glucose", "Long-acting timing"],
    });
    expect(copy.headline).toMatch(/above target/i);
    expect(copy.guidance.some((g) => /plan/i.test(g))).toBe(true);
    expect(copy.title).toMatch(/above target/i);
  });

  it("detects overnight rise likelihood from morning MDI", () => {
    expect(
      isOvernightRiseLikely({
        bgMmol: 12,
        targetHighMmol: 10,
        bgTrend: "steady",
        overnightUsualTrend: "not_sure",
        mdiBasalForBed: "morning",
        isPumpUser: false,
      }),
    ).toBe(true);
  });
});
