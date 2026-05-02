import { describe, expect, it, vi } from "vitest";

const mockSettings = {
  breakfastRatio: "",
  lunchRatio: "",
  dinnerRatio: "",
  snackRatio: "",
};

vi.mock("@/lib/storage", () => ({
  storage: {
    getHypoTreatments: vi.fn(() => []),
    getExerciseOutcomes: vi.fn(() => []),
    getScenarioState: vi.fn(() => ({ sickDayActive: false, travelModeActive: false })),
    getSettings: vi.fn(() => mockSettings),
    getProfile: vi.fn(() => ({ bgUnits: "mmol/L" })),
  },
}));

describe("buildAiCoachClientPayload", () => {
  it("returns zeros when no local logs", async () => {
    const { buildAiCoachClientPayload } = await import("./contextSummary");
    const p = buildAiCoachClientPayload();
    expect(p.lastFortnight.bgReadings).toBe(0);
    expect(p.lastFortnight.hypoCount).toBe(0);
    expect(p.lastFortnight.exerciseSessions).toBe(0);
    expect(p.ratiosAreSet).toBe(false);
    expect(p.bgUnits).toBe("mmol/L");
  });
});
