import { describe, expect, it, vi } from "vitest";

import {
  buildExerciseCgmAlertCopy,
  evaluateExerciseCgmAlert,
  markExerciseCgmAlertShown,
  resetExerciseCgmAlertCooldown,
  shouldSkipExerciseCgmAlertDueToCooldown,
} from "./exercise-cgm-alerts";
import { resolveExerciseCgmAlertAim, resolveExerciseCgmAlertThreshold } from "./exercise-cgm-alert-thresholds";

describe("resolveExerciseCgmAlertThreshold", () => {
  it("uses custom threshold when set", () => {
    expect(
      resolveExerciseCgmAlertThreshold({ enabled: true, pushNotifications: true, supplyAlerts: true, criticalThresholdDays: 3, lowThresholdDays: 7, appointmentReminders: true, exerciseCgmAlertThreshold: 6.0 }, "mmol/L"),
    ).toBe(6);
  });

  it("defaults to 5.6 mmol/L", () => {
    expect(
      resolveExerciseCgmAlertThreshold({ enabled: true, pushNotifications: true, supplyAlerts: true, criticalThresholdDays: 3, lowThresholdDays: 7, appointmentReminders: true }, "mmol/L"),
    ).toBe(5.6);
  });
});

describe("resolveExerciseCgmAlertAim", () => {
  const base = { enabled: true, pushNotifications: true, supplyAlerts: true, criticalThresholdDays: 3, lowThresholdDays: 7, appointmentReminders: true };

  it("defaults to 1.5 above the notify level", () => {
    expect(resolveExerciseCgmAlertAim(base, "mmol/L")).toBe(7.1);
  });

  it("keeps a saved aim above the notify level", () => {
    expect(resolveExerciseCgmAlertAim({ ...base, exerciseCgmAlertThreshold: 5, exerciseCgmAlertAimBg: 7 }, "mmol/L")).toBe(7);
  });
});

describe("evaluateExerciseCgmAlert", () => {
  const profile = {
    carbSourcePreferences: {
      favorites: [{ id: "g1", label: "Running gel", carbsPerServing: 22, unitLabel: "gel" }],
      defaultByScenario: { exercise_during: "g1" },
    },
    dateOfBirth: "1990-01-01",
    bodyWeightKg: 70,
  };

  it("alerts when BG is below threshold during active exercise", () => {
    const result = evaluateExerciseCgmAlert({
      bg: 5.2,
      bgUnits: "mmol/L",
      trend: "flat",
      threshold: 5.6,
      trendAware: true,
      userSettings: { targetBgLow: 3.9 },
      profile,
      carbsIfLow: 15,
    });
    expect(result.shouldAlert).toBe(true);
    expect(result.carbLine).toContain("gel");
  });

  it("sizes carbs to the chosen aim", () => {
    const result = evaluateExerciseCgmAlert({
      bg: 5.2,
      bgUnits: "mmol/L",
      trend: "flat",
      threshold: 5.6,
      trendAware: true,
      userSettings: { targetBgLow: 3.9 },
      profile,
      exerciseAimBg: 7,
    });
    expect(result.carbsGrams).toBe(8);
  });

  it("alerts when falling toward threshold", () => {
    const result = evaluateExerciseCgmAlert({
      bg: 6.0,
      bgUnits: "mmol/L",
      trend: "falling",
      threshold: 5.6,
      trendAware: true,
      userSettings: {},
      profile,
      carbsIfLow: 15,
    });
    expect(result.shouldAlert).toBe(true);
    expect(result.reason).toBe("falling_toward");
  });

  it("does not alert when stable above threshold", () => {
    const result = evaluateExerciseCgmAlert({
      bg: 7.5,
      bgUnits: "mmol/L",
      trend: "flat",
      threshold: 5.6,
      trendAware: true,
      userSettings: {},
      profile,
      carbsIfLow: 15,
    });
    expect(result.shouldAlert).toBe(false);
  });

  it("ignores falling trend when trend-aware is off", () => {
    const result = evaluateExerciseCgmAlert({
      bg: 6.0,
      bgUnits: "mmol/L",
      trend: "falling",
      threshold: 5.6,
      trendAware: false,
      userSettings: {},
      profile,
      carbsIfLow: 15,
    });
    expect(result.shouldAlert).toBe(false);
  });
});

describe("exercise CGM alert cooldown", () => {
  it("skips repeat alerts within cooldown window", () => {
    resetExerciseCgmAlertCooldown("sess-1");
    markExerciseCgmAlertShown("sess-1", 5.2, "below_threshold");
    expect(shouldSkipExerciseCgmAlertDueToCooldown("sess-1", 5.1, 5.6, "mmol/L")).toBe(true);
    resetExerciseCgmAlertCooldown("sess-1");
    expect(shouldSkipExerciseCgmAlertDueToCooldown("sess-1", 5.1, 5.6, "mmol/L")).toBe(false);
  });

  it("persists across a simulated app restart (module re-import) so a killed app doesn't re-fire a duplicate alert", async () => {
    resetExerciseCgmAlertCooldown();
    markExerciseCgmAlertShown("sess-restart", 5.0, "below_threshold");

    vi.resetModules();
    const restarted = await import("./exercise-cgm-alerts");
    expect(restarted.shouldSkipExerciseCgmAlertDueToCooldown("sess-restart", 5.1, 5.6, "mmol/L")).toBe(true);

    restarted.resetExerciseCgmAlertCooldown("sess-restart");
  });
});

describe("buildExerciseCgmAlertCopy", () => {
  it("keeps the watch alert to the reading and grams", () => {
    const copy = buildExerciseCgmAlertCopy({
      bg: 5.4,
      bgUnits: "mmol/L",
      trend: "falling",
      exerciseName: "Tennis",
      evaluation: {
        shouldAlert: true,
        reason: "below_threshold",
        carbsGrams: 11,
        carbLine: "about ½ Running gel",
      },
    });
    expect(copy.title).toBe("5.4 ↓");
    expect(copy.body).toBe("11g");
  });
});
