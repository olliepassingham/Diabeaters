import { afterEach, describe, expect, it, vi } from "vitest";
import { clearLastInteraction, readLastInteraction, recordLastInteraction } from "./last-interaction";

describe("last-interaction", () => {
  afterEach(() => {
    clearLastInteraction();
    vi.useRealTimers();
  });

  it("round-trips coach", () => {
    recordLastInteraction("coach");
    const r = readLastInteraction();
    expect(r?.kind).toBe("coach");
    expect(r?.at).toBeTruthy();
  });

  it("returns null for stale entries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    recordLastInteraction("ratios");
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
    expect(readLastInteraction()).toBeNull();
  });

  it("returns null for corrupted JSON", () => {
    localStorage.setItem("diabeater_last_interaction_v1", "{not json");
    expect(readLastInteraction()).toBeNull();
  });
});
