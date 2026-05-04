import { describe, expect, it } from "vitest";
import {
  EMPTY_LAST_FORTNIGHT,
  deriveServerAudience,
  serverPlaceholderLastFortnight,
} from "./serverInputs.ts";

describe("deriveServerAudience", () => {
  it("returns 'patient' when no carer link exists, even if the body asked for supporter", () => {
    expect(deriveServerAudience("supporter", false)).toBe("patient");
  });

  it("returns 'supporter' only when the body asked for it and a carer link exists", () => {
    expect(deriveServerAudience("supporter", true)).toBe("supporter");
  });

  it("never upgrades a 'patient' request to supporter", () => {
    expect(deriveServerAudience("patient", true)).toBe("patient");
    expect(deriveServerAudience("patient", false)).toBe("patient");
  });
});

describe("serverPlaceholderLastFortnight", () => {
  it("matches the canonical empty placeholder", () => {
    expect(serverPlaceholderLastFortnight()).toEqual(EMPTY_LAST_FORTNIGHT);
  });

  it("returns a fresh copy each call so callers cannot mutate the constant", () => {
    const a = serverPlaceholderLastFortnight();
    a.bgReadings = 999;
    const b = serverPlaceholderLastFortnight();
    expect(b.bgReadings).toBe(0);
  });

  it("zeros all counts and clears the TIR percent so the model sees no client-supplied history", () => {
    const lf = serverPlaceholderLastFortnight();
    expect(lf.bgReadings).toBe(0);
    expect(lf.hypoCount).toBe(0);
    expect(lf.severeHypoCount).toBe(0);
    expect(lf.highCount).toBe(0);
    expect(lf.exerciseSessions).toBe(0);
    expect(lf.estimatedTimeInRangePct).toBeNull();
    expect(lf.sickDayActive).toBe(false);
    expect(lf.travelModeActive).toBe(false);
  });
});
