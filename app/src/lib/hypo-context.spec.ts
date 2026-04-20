import { describe, expect, it } from "vitest";
import {
  formatTargetBgInput,
  hypoTreatmentsInRollingHours,
  lastHypoWithDetail,
  suggestedRecoveryTargetBg,
} from "./hypo-context";
import type { HypoTreatment } from "./storage";

describe("hypo-context", () => {
  it("filters hypo treatments by rolling hours", () => {
    const now = Date.now();
    const treatments: HypoTreatment[] = [
      {
        id: "1",
        timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        carerNotified: false,
      },
      {
        id: "2",
        timestamp: new Date(now - 100 * 60 * 60 * 1000).toISOString(),
        carerNotified: false,
      },
    ];
    expect(hypoTreatmentsInRollingHours(treatments, 48)).toHaveLength(1);
  });

  it("picks last hypo with treatment or notes", () => {
    const treatments: HypoTreatment[] = [
      { id: "a", timestamp: "2020-01-02T00:00:00.000Z", carerNotified: false },
      { id: "b", timestamp: "2020-01-03T00:00:00.000Z", carerNotified: false, treatment: "15g juice" },
    ];
    expect(lastHypoWithDetail(treatments)?.label).toBe("15g juice");
  });

  it("suggests midpoint of target range in mmol", () => {
    expect(suggestedRecoveryTargetBg({ targetBgLow: 4, targetBgHigh: 8 }, "mmol/L")).toBe(6);
  });

  it("formats target input strings", () => {
    expect(formatTargetBgInput(6.2, "mmol/L")).toBe("6.2");
    expect(formatTargetBgInput(117.4, "mg/dL")).toBe("117");
  });
});
