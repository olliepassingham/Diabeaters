import { describe, expect, it } from "vitest";
import { osSurfaceGlucoseFromHistory } from "./os-surface-glucose";

describe("osSurfaceGlucoseFromHistory", () => {
  it("returns null for empty history", () => {
    expect(osSurfaceGlucoseFromHistory([], "mmol/L")).toBeNull();
  });

  it("uses the newest point and converts mg/dL to mmol/L", () => {
    const snapshot = osSurfaceGlucoseFromHistory(
      [
        { recordedAtMs: Date.parse("2026-08-18T10:00:00.000Z"), valueMgDl: 90 },
        { recordedAtMs: Date.parse("2026-08-18T10:05:00.000Z"), valueMgDl: 108 },
      ],
      "mmol/L",
    );
    expect(snapshot?.glucoseValue).toBe(6);
    expect(snapshot?.glucoseUnits).toBe("mmol/L");
    expect(snapshot?.glucoseRecordedAt).toBe("2026-08-18T10:05:00.000Z");
    expect(snapshot?.glucoseTrend).toBeNull();
  });

  it("keeps mg/dL when that is the display unit", () => {
    const snapshot = osSurfaceGlucoseFromHistory(
      [{ recordedAtMs: Date.parse("2026-08-18T10:05:00.000Z"), valueMgDl: 142 }],
      "mg/dL",
    );
    expect(snapshot?.glucoseValue).toBe(142);
    expect(snapshot?.glucoseUnits).toBe("mg/dL");
  });

  it("returns null for non-positive readings", () => {
    expect(
      osSurfaceGlucoseFromHistory(
        [{ recordedAtMs: Date.parse("2026-08-18T10:05:00.000Z"), valueMgDl: 0 }],
        "mmol/L",
      ),
    ).toBeNull();
  });
});
