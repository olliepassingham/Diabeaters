import { describe, expect, it } from "vitest";

import { getPumpCareSnapshot, type PumpCareSnapshot } from "./pump-supplies";
import type { Supply } from "./storage";

function supply(partial: Partial<Supply> & Pick<Supply, "id" | "type" | "name">): Supply {
  return {
    currentQuantity: 10,
    dailyUsage: 0,
    ...partial,
  };
}

const readers = {
  getActiveItemInfo: (s: Supply) => {
    if (!s.activeItemStartDate) return null;
    const daysLeft = Number((s as Supply & { __daysLeft?: number }).__daysLeft ?? 2);
    return { daysLeft, isExpired: daysLeft <= 0 };
  },
  getAdjustedQuantity: (s: Supply) => s.currentQuantity,
  getSupplyIncrement: (type: Supply["type"]) =>
    type === "infusion_set" || type === "reservoir"
      ? { amount: 10, label: "box" }
      : { amount: 1, label: "unit" },
};

function withDays(s: Supply, daysLeft: number): Supply {
  return Object.assign(s, { __daysLeft: daysLeft, activeItemStartDate: "2026-10-01T12:00:00.000Z" });
}

describe("getPumpCareSnapshot", () => {
  it("marks setup incomplete when there are no set or reservoir rows", () => {
    const snap = getPumpCareSnapshot([], readers);
    expect(snap.setupIncomplete).toBe(true);
    expect(snap.set).toBeNull();
    expect(snap.reservoir).toBeNull();
    expect(snap.dueSoonKind).toBeNull();
    expect(snap.stockLine).toBeNull();
  });

  it("reports days left on an active set", () => {
    const snap = getPumpCareSnapshot(
      [withDays(supply({ id: "s1", type: "infusion_set", name: "Sets" }), 2)],
      readers,
    );
    expect(snap.setupIncomplete).toBe(false);
    expect(snap.set?.daysLeft).toBe(2);
    expect(snap.set?.dueToday).toBe(false);
    expect(snap.set?.dueCaption).toBe("2 days left");
    expect(snap.set?.changeButtonLabel).toBe("Changed early");
    expect(snap.dueSoonKind).toBeNull();
  });

  it("flags due today when a set has one day left", () => {
    const snap = getPumpCareSnapshot(
      [
        withDays(supply({ id: "s1", type: "infusion_set", name: "Sets" }), 1),
        withDays(supply({ id: "r1", type: "reservoir", name: "Reservoirs" }), 3),
      ],
      readers,
    );
    expect(snap.set?.dueToday).toBe(true);
    expect(snap.set?.changeButtonLabel).toBe("Changed set");
    expect(snap.set?.dueCaption).toBe("Change due today");
    expect(snap.dueSoonKind).toBe("infusion_set");
  });

  it("prefers the infusion set when both are due", () => {
    const snap: PumpCareSnapshot = getPumpCareSnapshot(
      [
        withDays(supply({ id: "s1", type: "infusion_set", name: "Sets" }), 0),
        withDays(supply({ id: "r1", type: "reservoir", name: "Reservoirs" }), 1),
      ],
      readers,
    );
    expect(snap.dueSoonKind).toBe("infusion_set");
    expect(snap.reservoir?.changeButtonLabel).toBe("Changed reservoir");
  });

  it("builds a stock line from box increments", () => {
    const snap = getPumpCareSnapshot(
      [
        withDays(supply({ id: "s1", type: "infusion_set", name: "Sets", currentQuantity: 20 }), 2),
        withDays(supply({ id: "r1", type: "reservoir", name: "Reservoirs", currentQuantity: 10 }), 2),
      ],
      readers,
    );
    expect(snap.stockLine).toBe("2 boxes of sets · 1 box of reservoirs");
  });
});
