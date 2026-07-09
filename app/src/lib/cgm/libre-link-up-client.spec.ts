import { describe, expect, it } from "vitest";
import { libreTrendToExerciseTrend, mapLibreLinkUpTrend } from "@/lib/cgm/libre-link-up-client";

describe("mapLibreLinkUpTrend", () => {
  it("maps trend arrow indices to tokens", () => {
    expect(mapLibreLinkUpTrend(3)).toBe("flat");
    expect(mapLibreLinkUpTrend(5)).toBe("singleup");
    expect(mapLibreLinkUpTrend(2)).toBe("fortyfivedown");
  });

  it("returns null for invalid arrows", () => {
    expect(mapLibreLinkUpTrend(undefined)).toBeNull();
    expect(mapLibreLinkUpTrend(99)).toBeNull();
  });
});

describe("libreTrendToExerciseTrend", () => {
  it("maps libre tokens to exercise trends", () => {
    expect(libreTrendToExerciseTrend("singleup")).toBe("rising");
    expect(libreTrendToExerciseTrend("fortyfivedown")).toBe("falling");
    expect(libreTrendToExerciseTrend("flat")).toBe("flat");
  });

  it("returns null for unknown trends", () => {
    expect(libreTrendToExerciseTrend(null)).toBeNull();
    expect(libreTrendToExerciseTrend("notreal")).toBeNull();
  });
});
