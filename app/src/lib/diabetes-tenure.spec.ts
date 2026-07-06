import { describe, expect, it } from "vitest";

import {
  computeTenureDaysSinceOnset,
  formatTenureBadgeLabel,
  resolveTenureHolders,
} from "./diabetes-tenure";

describe("diabetes-tenure", () => {
  const today = new Date("2026-07-06T12:00:00");

  it("computes tenure days from onset date", () => {
    expect(computeTenureDaysSinceOnset("2021-07-06", today)).toBeGreaterThanOrEqual(1825);
  });

  it("formats tenure badge labels", () => {
    expect(formatTenureBadgeLabel(4000)).toBe("~10y");
    expect(formatTenureBadgeLabel(45)).toBe("~1mo");
  });

  it("awards longest and shortest among distinct public profiles", () => {
    const result = resolveTenureHolders(
      [
        { id: "a", diabetes_onset_date: "1990-01-01", is_public: true },
        { id: "b", diabetes_onset_date: "2024-06-01", is_public: true },
        { id: "c", diabetes_onset_date: "2010-03-15", is_public: true },
      ],
      today,
    );
    expect(result.awardsActive).toBe(true);
    expect(result.longestUserIds).toEqual(["a"]);
    expect(result.shortestUserIds).toEqual(["b"]);
  });

  it("does not award when fewer than two eligible profiles", () => {
    expect(
      resolveTenureHolders([{ id: "a", diabetes_onset_date: "2010-01-01", is_public: true }], today)
        .awardsActive,
    ).toBe(false);
  });

  it("does not award when all onset dates are identical", () => {
    expect(
      resolveTenureHolders(
        [
          { id: "a", diabetes_onset_date: "2010-01-01", is_public: true },
          { id: "b", diabetes_onset_date: "2010-01-01", is_public: true },
        ],
        today,
      ).awardsActive,
    ).toBe(false);
  });

  it("allows ties for the same onset date", () => {
    const result = resolveTenureHolders(
      [
        { id: "a", diabetes_onset_date: "1990-01-01", is_public: true },
        { id: "b", diabetes_onset_date: "1990-01-01", is_public: true },
        { id: "c", diabetes_onset_date: "2024-01-01", is_public: true },
      ],
      today,
    );
    expect(result.longestUserIds.sort()).toEqual(["a", "b"]);
    expect(result.shortestUserIds).toEqual(["c"]);
  });
});
