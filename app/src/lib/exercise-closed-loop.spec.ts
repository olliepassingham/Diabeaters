import { describe, expect, it } from "vitest";

import {
  closedLoopPumpTipsForIntensity,
  exerciseChecklistBasalLabel,
  resolveExercisePumpTips,
} from "@/lib/exercise-closed-loop";

describe("exercise-closed-loop", () => {
  it("returns loop-specific tips without temp basal language", () => {
    const tips = closedLoopPumpTipsForIntensity("moderate");
    const joined = [...tips.pre, ...tips.during, ...tips.post, ...tips.recovery].join(" ");
    expect(joined).not.toMatch(/temp basal|temporary basal|suspend pump/i);
    expect(joined).toMatch(/IOB|30–60 min/i);
  });

  it("replaces base pump tips when closed loop is on", () => {
    const base = closedLoopPumpTipsForIntensity("light");
    base.pre[0] = "Set a temporary basal at 50%";
    const resolved = resolveExercisePumpTips(base, "moderate", { usesClosedLoop: true });
    expect(resolved.pre[0]).toMatch(/IOB|meal bolus/i);
  });

  it("keeps base tips when closed loop is off", () => {
    const base = {
      pre: ["Set temp basal"],
      during: ["During tip"],
      post: ["Post tip"],
      recovery: ["Recovery tip"],
    };
    expect(resolveExercisePumpTips(base, "moderate", { usesClosedLoop: false })).toEqual(base);
  });

  it("uses loop-aware checklist basal label", () => {
    expect(exerciseChecklistBasalLabel(true)).toMatch(/loop/i);
    expect(exerciseChecklistBasalLabel(false, "Reduced basal rate")).toBe("Reduced basal rate");
  });
});
