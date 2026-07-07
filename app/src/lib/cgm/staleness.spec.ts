import { describe, expect, it } from "vitest";
import { assessReadingStaleness, formatAgeMinutes } from "@/lib/cgm/staleness";
import { CGM_PREFILL_STALE_AGE_MINUTES, CGM_PREFILL_WARN_AGE_MINUTES } from "@/lib/cgm/v1-scope";

describe("assessReadingStaleness", () => {
  const now = Date.parse("2026-07-07T12:00:00.000Z");

  it("marks fresh readings as not stale", () => {
    const recordedAt = new Date(now - 20 * 60_000).toISOString();
    const s = assessReadingStaleness(recordedAt, now);
    expect(s.isStale).toBe(false);
    expect(s.stalenessNote).toBeNull();
    expect(s.ageMinutes).toBe(20);
  });

  it("warns when older than warn threshold", () => {
    const age = CGM_PREFILL_WARN_AGE_MINUTES + 5;
    const recordedAt = new Date(now - age * 60_000).toISOString();
    const s = assessReadingStaleness(recordedAt, now);
    expect(s.isStale).toBe(false);
    expect(s.stalenessNote).toContain("Dexcom");
  });

  it("marks readings older than stale threshold as stale", () => {
    const age = CGM_PREFILL_STALE_AGE_MINUTES + 1;
    const recordedAt = new Date(now - age * 60_000).toISOString();
    const s = assessReadingStaleness(recordedAt, now);
    expect(s.isStale).toBe(true);
  });
});

describe("formatAgeMinutes", () => {
  it("formats sub-hour ages", () => {
    expect(formatAgeMinutes(12)).toBe("12 min");
  });

  it("formats hour buckets", () => {
    expect(formatAgeMinutes(90)).toBe("1h 30m");
  });
});
