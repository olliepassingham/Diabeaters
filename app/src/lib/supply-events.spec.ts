import { beforeEach, describe, expect, it, vi } from "vitest";
import { addLocalSupplyEvent, inferDailyUsageFromLocalEvents } from "./supply-events";

describe("supply events inference", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T12:00:00.000Z"));
  });

  it("infers daily usage from negative adjustments", () => {
    const supplyId = "s-1";
    addLocalSupplyEvent({
      supplyId,
      kind: "adjust",
      delta: -100,
      stockNow: 900,
      createdAt: new Date("2026-03-10T12:00:00.000Z").toISOString(),
      meta: {},
    });
    addLocalSupplyEvent({
      supplyId,
      kind: "adjust",
      delta: -50,
      stockNow: 850,
      createdAt: new Date("2026-03-09T12:00:00.000Z").toISOString(),
      meta: {},
    });
    addLocalSupplyEvent({
      supplyId,
      kind: "adjust",
      delta: -50,
      stockNow: 800,
      createdAt: new Date("2026-03-08T12:00:00.000Z").toISOString(),
      meta: {},
    });

    const res = inferDailyUsageFromLocalEvents(supplyId, 7);
    expect(res.usagePerDay).toBeGreaterThan(0);
    expect(res.confidence).toBe("high");
  });

  it("returns null usage when no consumption signals", () => {
    const supplyId = "s-2";
    addLocalSupplyEvent({
      supplyId,
      kind: "refill",
      delta: 300,
      stockNow: 300,
      createdAt: new Date().toISOString(),
      meta: {},
    });

    const res = inferDailyUsageFromLocalEvents(supplyId, 7);
    expect(res.usagePerDay).toBeNull();
    expect(res.confidence).toBe("low");
  });
});

