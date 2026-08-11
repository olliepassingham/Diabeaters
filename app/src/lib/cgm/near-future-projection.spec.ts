import { describe, expect, it } from "vitest";
import {
  arrowRateMgDlPerMin,
  CGM_ARROW_RATE_MGDL_PER_MIN,
  computeNearFutureProjection,
  estimateHistorySlopeMgDlPerMin,
  estimateRecentMotion,
  projectGlucoseMgDl,
} from "@/lib/cgm/near-future-projection";

function isoMinutesAgo(nowMs: number, minutesAgo: number): string {
  return new Date(nowMs - minutesAgo * 60_000).toISOString();
}

describe("arrowRateMgDlPerMin", () => {
  it("maps Dexcom-style tokens to documented rates", () => {
    expect(arrowRateMgDlPerMin("DoubleUp")).toBe(CGM_ARROW_RATE_MGDL_PER_MIN.doubleup);
    expect(arrowRateMgDlPerMin("singleUp")).toBe(2);
    expect(arrowRateMgDlPerMin("FortyFiveUp")).toBe(1);
    expect(arrowRateMgDlPerMin("Flat")).toBe(0);
    expect(arrowRateMgDlPerMin("FortyFiveDown")).toBe(-1);
    expect(arrowRateMgDlPerMin("SingleDown")).toBe(-2);
    expect(arrowRateMgDlPerMin("DoubleDown")).toBe(-3);
  });

  it("returns null for unknown or empty tokens", () => {
    expect(arrowRateMgDlPerMin(null)).toBeNull();
    expect(arrowRateMgDlPerMin("")).toBeNull();
    expect(arrowRateMgDlPerMin("unknown")).toBeNull();
  });

  it("accepts coarse rising/falling as single-step aliases", () => {
    expect(arrowRateMgDlPerMin("rising")).toBe(2);
    expect(arrowRateMgDlPerMin("falling")).toBe(-2);
  });
});

describe("estimateRecentMotion", () => {
  const now = Date.parse("2026-08-10T12:00:00.000Z");

  it("returns null with fewer than 2 points", () => {
    expect(
      estimateRecentMotion([{ valueMgDl: 120, recordedAt: isoMinutesAgo(now, 1) }], now),
    ).toBeNull();
  });

  it("returns null when span is under 5 minutes", () => {
    expect(
      estimateRecentMotion(
        [
          { valueMgDl: 100, recordedAt: isoMinutesAgo(now, 3) },
          { valueMgDl: 110, recordedAt: isoMinutesAgo(now, 0) },
        ],
        now,
      ),
    ).toBeNull();
  });

  it("estimates ~2 mg/dL per min rising over 10 minutes", () => {
    const result = estimateRecentMotion(
      [
        { valueMgDl: 100, recordedAt: isoMinutesAgo(now, 10) },
        { valueMgDl: 110, recordedAt: isoMinutesAgo(now, 5) },
        { valueMgDl: 120, recordedAt: isoMinutesAgo(now, 0) },
      ],
      now,
    );
    expect(result).not.toBeNull();
    expect(result!.rateMgDlPerMin).toBeCloseTo(2, 1);
    expect(result!.spanMinutes).toBe(10);
    expect(result!.pointCount).toBe(3);
  });

  it("weights recent segments more than older ones (angle follows current pace)", () => {
    // Early steep rise, then recent flattening — velocity should be well below the early 4 mg/dL/min.
    const result = estimateRecentMotion(
      [
        { valueMgDl: 80, recordedAt: isoMinutesAgo(now, 20) },
        { valueMgDl: 120, recordedAt: isoMinutesAgo(now, 10) }, // +4 /min early
        { valueMgDl: 122, recordedAt: isoMinutesAgo(now, 5) },
        { valueMgDl: 124, recordedAt: isoMinutesAgo(now, 0) }, // +0.4 /min recent
      ],
      now,
    );
    expect(result).not.toBeNull();
    expect(result!.rateMgDlPerMin).toBeLessThan(2.2);
    expect(result!.rateMgDlPerMin).toBeGreaterThan(0);
    // Acceleration should be negative (slowing while still rising).
    expect(result!.accelMgDlPerMin2).toBeLessThan(0);
  });

  it("ignores points outside the history window", () => {
    const result = estimateRecentMotion(
      [
        { valueMgDl: 50, recordedAt: isoMinutesAgo(now, 45) },
        { valueMgDl: 100, recordedAt: isoMinutesAgo(now, 10) },
        { valueMgDl: 110, recordedAt: isoMinutesAgo(now, 0) },
      ],
      now,
    );
    expect(result).not.toBeNull();
    expect(result!.rateMgDlPerMin).toBeCloseTo(1, 1);
    expect(result!.pointCount).toBe(2);
  });
});

describe("estimateHistorySlopeMgDlPerMin", () => {
  const now = Date.parse("2026-08-10T12:00:00.000Z");

  it("delegates to recent-motion velocity", () => {
    const result = estimateHistorySlopeMgDlPerMin(
      [
        { valueMgDl: 100, recordedAt: isoMinutesAgo(now, 10) },
        { valueMgDl: 110, recordedAt: isoMinutesAgo(now, 5) },
        { valueMgDl: 120, recordedAt: isoMinutesAgo(now, 0) },
      ],
      now,
    );
    expect(result).not.toBeNull();
    expect(result!.rateMgDlPerMin).toBeCloseTo(2, 1);
  });
});

describe("projectGlucoseMgDl", () => {
  it("is linear when acceleration is zero", () => {
    expect(projectGlucoseMgDl(100, 2, 0, 15)).toBe(130);
    expect(projectGlucoseMgDl(100, 2, 0, 30)).toBe(160);
  });

  it("curves upward with positive acceleration, dampened at longer horizons", () => {
    const at15 = projectGlucoseMgDl(100, 1, 0.08, 15);
    const at30Linear = 100 + 1 * 30;
    const at30 = projectGlucoseMgDl(100, 1, 0.08, 30);
    expect(at15).toBeGreaterThan(100 + 15);
    // Still above linear velocity, but dampening keeps +30 from exploding.
    expect(at30).toBeGreaterThan(at30Linear);
    expect(at30).toBeLessThan(at30Linear + 0.5 * 0.08 * 30 * 30);
  });
});

describe("computeNearFutureProjection", () => {
  const now = Date.parse("2026-08-10T12:00:00.000Z");

  it("uses recent history motion (not arrow alone) when history is dense enough", () => {
    const result = computeNearFutureProjection({
      points: [
        { valueMgDl: 100, recordedAt: isoMinutesAgo(now, 15) },
        { valueMgDl: 115, recordedAt: isoMinutesAgo(now, 7) },
        { valueMgDl: 130, recordedAt: isoMinutesAgo(now, 1) },
      ],
      latestRawTrend: "flat",
      units: "mg/dL",
      nowMs: now,
    });
    expect(result).not.toBeNull();
    expect(["history", "blended"]).toContain(result!.method);
    expect(result!.at15Min).toBeGreaterThan(130);
    expect(result!.at30Min).toBeGreaterThan(result!.at15Min);
    expect(result!.path.length).toBeGreaterThanOrEqual(3);
    expect(result!.note.toLowerCase()).toContain("direction");
    expect(result!.note.toLowerCase()).not.toContain("will be");
  });

  it("blends history with arrow when they disagree", () => {
    const result = computeNearFutureProjection({
      points: [
        { valueMgDl: 100, recordedAt: isoMinutesAgo(now, 15) },
        { valueMgDl: 115, recordedAt: isoMinutesAgo(now, 7) },
        { valueMgDl: 130, recordedAt: isoMinutesAgo(now, 1) },
      ],
      latestRawTrend: "doubledown",
      units: "mg/dL",
      nowMs: now,
    });
    expect(result).not.toBeNull();
    // Rising history (~2) vs doubledown (-3) → blended should be below pure history pace.
    const historyOnly = computeNearFutureProjection({
      points: [
        { valueMgDl: 100, recordedAt: isoMinutesAgo(now, 15) },
        { valueMgDl: 115, recordedAt: isoMinutesAgo(now, 7) },
        { valueMgDl: 130, recordedAt: isoMinutesAgo(now, 1) },
      ],
      latestRawTrend: null,
      units: "mg/dL",
      nowMs: now,
    });
    expect(historyOnly).not.toBeNull();
    expect(result!.rateMgDlPerMin).toBeLessThan(historyOnly!.rateMgDlPerMin);
    expect(result!.method).toBe("blended");
  });

  it("falls back to arrow when history span is too short", () => {
    const result = computeNearFutureProjection({
      points: [
        { valueMgDl: 140, recordedAt: isoMinutesAgo(now, 2) },
        { valueMgDl: 142, recordedAt: isoMinutesAgo(now, 1) },
      ],
      latestRawTrend: "SingleDown",
      units: "mg/dL",
      nowMs: now,
    });
    expect(result).not.toBeNull();
    expect(result!.method).toBe("arrow");
    expect(result!.rateMgDlPerMin).toBe(-2);
    expect(result!.at15Min).toBe(112); // 142 − 2×15
    expect(result!.at30Min).toBe(82); // 142 − 2×30
    expect(result!.note.toLowerCase()).toContain("trend arrow");
  });

  it("returns null when reading is older than the projection freshness window", () => {
    const result = computeNearFutureProjection({
      points: [{ valueMgDl: 120, recordedAt: isoMinutesAgo(now, 20) }],
      latestRawTrend: "flat",
      units: "mg/dL",
      nowMs: now,
    });
    expect(result).toBeNull();
  });

  it("still projects when the latest reading is within the freshness window", () => {
    const result = computeNearFutureProjection({
      points: [
        { valueMgDl: 120, recordedAt: isoMinutesAgo(now, 12) },
        { valueMgDl: 120, recordedAt: isoMinutesAgo(now, 5) },
      ],
      latestRawTrend: "Flat",
      units: "mg/dL",
      nowMs: now,
    });
    expect(result).not.toBeNull();
    expect(["history", "blended"]).toContain(result!.method);
  });

  it("returns null when isStale is forced true", () => {
    const result = computeNearFutureProjection({
      points: [{ valueMgDl: 120, recordedAt: isoMinutesAgo(now, 1) }],
      latestRawTrend: "flat",
      units: "mg/dL",
      nowMs: now,
      isStale: true,
    });
    expect(result).toBeNull();
  });

  it("returns null when sparse history and no usable arrow", () => {
    const result = computeNearFutureProjection({
      points: [{ valueMgDl: 120, recordedAt: isoMinutesAgo(now, 1) }],
      latestRawTrend: null,
      units: "mg/dL",
      nowMs: now,
    });
    expect(result).toBeNull();
  });

  it("converts projected values to mmol/L", () => {
    const result = computeNearFutureProjection({
      points: [
        { valueMgDl: 90, recordedAt: isoMinutesAgo(now, 2) },
        { valueMgDl: 90, recordedAt: isoMinutesAgo(now, 1) },
      ],
      latestRawTrend: "Flat",
      units: "mmol/L",
      nowMs: now,
    });
    expect(result).not.toBeNull();
    expect(result!.method).toBe("arrow");
    expect(result!.units).toBe("mmol/L");
    expect(result!.currentDisplay).toBeCloseTo(5.0, 1);
    expect(result!.at15Min).toBeCloseTo(5.0, 1);
    expect(result!.at30Min).toBeCloseTo(5.0, 1);
  });

  it("uses non-clinical projection wording", () => {
    const result = computeNearFutureProjection({
      points: [
        { valueMgDl: 100, recordedAt: isoMinutesAgo(now, 10) },
        { valueMgDl: 100, recordedAt: isoMinutesAgo(now, 0) },
      ],
      units: "mg/dL",
      nowMs: now,
    });
    expect(result).not.toBeNull();
    expect(result!.note.toLowerCase()).not.toMatch(/\bwill be\b/);
    expect(result!.note.toLowerCase()).not.toMatch(/\bpredict/);
  });

  it("projects a curved path when pace is slowing", () => {
    const result = computeNearFutureProjection({
      points: [
        { valueMgDl: 80, recordedAt: isoMinutesAgo(now, 20) },
        { valueMgDl: 120, recordedAt: isoMinutesAgo(now, 10) },
        { valueMgDl: 122, recordedAt: isoMinutesAgo(now, 5) },
        { valueMgDl: 124, recordedAt: isoMinutesAgo(now, 0) },
      ],
      latestRawTrend: null,
      units: "mg/dL",
      nowMs: now,
    });
    expect(result).not.toBeNull();
    expect(result!.accelMgDlPerMin2).toBeLessThan(0);
    // Path should not be a perfectly constant step between samples when accel ≠ 0.
    const mid = result!.path.find((p) => p.minutesAhead === 15)!;
    const end = result!.path.find((p) => p.minutesAhead === 30)!;
    const linear30 = result!.currentMgDl + result!.rateMgDlPerMin * 30;
    expect(end.value).toBeLessThan(Math.round(linear30) + 1);
    expect(mid.value).toBeGreaterThanOrEqual(result!.currentDisplay);
  });
});
