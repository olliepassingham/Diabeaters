import { describe, expect, it } from "vitest";

import { filterPumpTipsForClosedLoop, closedLoopSafetyNote, usesClosedLoop } from "./closed-loop";

describe("closed-loop helpers", () => {
  it("detects closed loop setting", () => {
    expect(usesClosedLoop({ usesClosedLoop: true })).toBe(true);
    expect(usesClosedLoop({})).toBe(false);
  });

  it("softens temp basal tips when closed loop is on", () => {
    const tips = ["Set a temporary basal rate at 50%", "Keep glucose tabs handy"];
    const out = filterPumpTipsForClosedLoop(tips, { usesClosedLoop: true });
    expect(out.some((t) => /closed-loop|automation/i.test(t))).toBe(true);
    expect(out.some((t) => /temporary basal/i.test(t))).toBe(false);
    expect(out.some((t) => /glucose tabs/i.test(t))).toBe(true);
  });

  it("returns surface-specific safety notes only when closed loop is on", () => {
    expect(closedLoopSafetyNote("meal", {})).toBeNull();
    expect(closedLoopSafetyNote("meal", { usesClosedLoop: true })).toMatch(/don't stack/i);
    expect(closedLoopSafetyNote("correction", { usesClosedLoop: true })).toMatch(/stacking/i);
    expect(closedLoopSafetyNote("bedtime", { usesClosedLoop: true })).toMatch(/sleep activity/i);
    expect(closedLoopSafetyNote("sickDay", { usesClosedLoop: true })).toMatch(/infusion site/i);
  });
});
