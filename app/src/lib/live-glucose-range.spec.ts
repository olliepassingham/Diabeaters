import { describe, expect, it } from "vitest";
import { computeGlucoseRangeStatus, percentGlucoseInRange } from "./live-glucose-range";

describe("computeGlucoseRangeStatus", () => {
  it("classifies against patient target range", () => {
    expect(computeGlucoseRangeStatus(3.5, 4, 10)).toBe("low");
    expect(computeGlucoseRangeStatus(9, 4, 10)).toBe("in_range");
    expect(computeGlucoseRangeStatus(13.9, 4, 10)).toBe("high");
  });

  it("computes percent in range for a window", () => {
    expect(percentGlucoseInRange([5, 6, 11, 7], 4, 10)).toBe(75);
    expect(percentGlucoseInRange([], 4, 10)).toBeNull();
  });
});
