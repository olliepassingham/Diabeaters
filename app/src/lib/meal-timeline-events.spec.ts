import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  confirmMealTimelineEvent,
  getMealTimelineEvents,
  savePlannedMealEvent,
} from "@/lib/meal-timeline-events";

describe("meal timeline events", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("stores a planned meal and confirms the same event", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T12:30:00.000Z"));

    const planned = savePlannedMealEvent({
      mealType: "lunch",
      carbsGrams: 48,
      compositionLabel: "Balanced plate",
    });
    expect(planned.status).toBe("planned");

    const confirmed = confirmMealTimelineEvent(planned.id);
    expect(confirmed?.status).toBe("confirmed");
    expect(getMealTimelineEvents(Date.parse("2026-09-03T00:00:00.000Z"))).toEqual([confirmed]);
  });

  it("updates an existing planned event rather than duplicating recalculations", () => {
    const first = savePlannedMealEvent({
      mealType: "dinner",
      carbsGrams: 60,
      compositionLabel: "Starchy",
    });
    const updated = savePlannedMealEvent(
      {
        mealType: "dinner",
        carbsGrams: 70,
        compositionLabel: "Starchy + fat",
      },
      first.id,
    );

    expect(updated.id).toBe(first.id);
    expect(updated.carbsGrams).toBe(70);
    expect(getMealTimelineEvents(0)).toHaveLength(1);
  });
});
