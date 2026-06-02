import { describe, expect, it } from "vitest";
import { buildDrivingReadinessOutcome, type DrivingReadinessInput } from "./driving-readiness-tool";

const baseInput = (overrides: Partial<DrivingReadinessInput> = {}): DrivingReadinessInput => ({
  bgSkipped: false,
  bgValue: 6,
  bgTrend: "flat",
  recentHypoOrSymptoms: false,
  alertEnough: true,
  treatmentInReach: true,
  longJourney: false,
  ...overrides,
});

describe("buildDrivingReadinessOutcome", () => {
  it("returns not_ready when not alert", () => {
    const o = buildDrivingReadinessOutcome(baseInput({ alertEnough: false }), "mmol/L");
    expect(o.kind).toBe("not_ready");
    expect(o.doNow.length).toBeGreaterThan(0);
    expect(o.links.helpNow).toBe(true);
  });

  it("returns not_ready after recent hypo", () => {
    const o = buildDrivingReadinessOutcome(baseInput({ recentHypoOrSymptoms: true }), "mmol/L");
    expect(o.kind).toBe("not_ready");
    expect(o.beforeYouGo.some((b) => b.includes("45–60"))).toBe(true);
  });

  it("returns not_ready when BG is low", () => {
    const o = buildDrivingReadinessOutcome(baseInput({ bgValue: 3.2 }), "mmol/L", {
      primaryHypoTreatment: "glucose_tablets",
    });
    expect(o.kind).toBe("not_ready");
    expect(o.doNow.some((b) => b.includes("glucose tablets"))).toBe(true);
  });

  it("caps at caution when BG is skipped", () => {
    const o = buildDrivingReadinessOutcome(baseInput({ bgSkipped: true, bgValue: null }), "mmol/L");
    expect(o.kind).toBe("caution");
    expect(o.headline).toMatch(/Check glucose/i);
  });

  it("returns caution when falling in range", () => {
    const o = buildDrivingReadinessOutcome(baseInput({ bgValue: 7, bgTrend: "falling" }), "mmol/L");
    expect(o.kind).toBe("caution");
    expect(o.readingSummary).toContain("falling");
  });

  it("returns caution when below user target low", () => {
    const o = buildDrivingReadinessOutcome(baseInput({ bgValue: 5.5, bgTrend: "flat" }), "mmol/L", {
      settings: { targetBgLow: 6, targetBgHigh: 10 },
    });
    expect(o.kind).toBe("caution");
    expect(o.headline).toMatch(/target range/i);
  });

  it("returns likely_ok when inputs are favourable", () => {
    const o = buildDrivingReadinessOutcome(baseInput({ bgValue: 7.5, bgTrend: "flat" }), "mmol/L");
    expect(o.kind).toBe("likely_ok");
    if (o.kind === "likely_ok") {
      expect(o.disclaimer).toBeTruthy();
    }
    expect(o.detailsForInfo.some((d) => d.includes("legal"))).toBe(true);
  });

  it("includes pump guidance in info details", () => {
    const o = buildDrivingReadinessOutcome(baseInput(), "mmol/L", { isPump: true });
    expect(o.detailsForInfo.some((d) => d.toLowerCase().includes("pump"))).toBe(true);
  });
});
