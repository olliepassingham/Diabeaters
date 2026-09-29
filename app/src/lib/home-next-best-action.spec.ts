import { describe, expect, it } from "vitest";

import {
  buildHomeHeroNarrative,
  pickNextUpcomingAppointment,
  resolveHomeNextBestAction,
} from "./home-next-best-action";

const quietTravel = {
  promoted: false,
  label: null,
  reason: "quiet" as const,
};

describe("resolveHomeNextBestAction", () => {
  const base = {
    healthStatus: "stable" as const,
    sickDayActive: false,
    pumpFailureActive: false,
    exerciseActive: false,
    travelPromote: quietTravel,
    travelModeActive: false,
    bedtimeDue: false,
    nextAppointment: null,
    mealMoment: null,
    mealDismissed: false,
    hasCriticalSupply: false,
    showCoach: true,
  };

  it("prioritises help when health is action", () => {
    const a = resolveHomeNextBestAction({ ...base, healthStatus: "action" });
    expect(a.id).toBe("help_now");
  });

  it("prioritises exercise over meal", () => {
    const a = resolveHomeNextBestAction({
      ...base,
      exerciseActive: true,
      mealMoment: { slot: "lunch", title: "Planning lunch?", timeLabel: "Midday" },
    });
    expect(a.id).toBe("exercise");
  });

  it("promotes travel insulin shift over meal", () => {
    const a = resolveHomeNextBestAction({
      ...base,
      travelModeActive: true,
      travelPromote: { promoted: true, label: "Insulin", reason: "insulin_shift" },
      mealMoment: { slot: "dinner", title: "Planning dinner?", timeLabel: "Evening" },
    });
    expect(a.id).toBe("travel");
    expect(a.label.toLowerCase()).toMatch(/insulin/);
  });

  it("uses the next appointment before a meal", () => {
    const a = resolveHomeNextBestAction({
      ...base,
      nextAppointment: { title: "Clinic review", whenLabel: "Thu 1 Oct · 15:10" },
      mealMoment: { slot: "dinner", title: "Planning dinner?", timeLabel: "Evening" },
    });
    expect(a.id).toBe("appointment");
    expect(a.href).toBe("/appointments");
    expect(a.subline).toMatch(/Clinic review/);
  });

  it("keeps bedtime ahead of the next appointment", () => {
    const a = resolveHomeNextBestAction({
      ...base,
      bedtimeDue: true,
      nextAppointment: { title: "Clinic review", whenLabel: "Thu 1 Oct" },
    });
    expect(a.id).toBe("bedtime");
  });

  it("uses meal moment when calm", () => {
    const a = resolveHomeNextBestAction({
      ...base,
      mealMoment: { slot: "breakfast", title: "Planning breakfast?", timeLabel: "Morning" },
    });
    expect(a.id).toBe("meal");
    expect(a.label).toBe("Plan breakfast");
  });

  it("falls back to coach when calm and no meal", () => {
    expect(resolveHomeNextBestAction(base).id).toBe("coach");
  });
});

describe("pickNextUpcomingAppointment", () => {
  const now = new Date(2026, 8, 29, 12, 0, 0);

  it("uses a visit that is today", () => {
    const next = pickNextUpcomingAppointment(
      [
        { title: "Done", date: "2026-09-29", isCompleted: true },
        { title: "Clinic review", date: "2026-09-29", time: "15:10", isCompleted: false },
        { title: "Later", date: "2026-10-01", time: "09:00", isCompleted: false },
      ],
      now,
    );
    expect(next?.title).toBe("Clinic review");
    expect(next?.whenLabel).toMatch(/15:10/);
  });

  it("leaves a visit two days away off the home action", () => {
    const next = pickNextUpcomingAppointment(
      [{ title: "Flu jab", date: "2026-10-01", time: "15:10", isCompleted: false }],
      now,
    );
    expect(next).toBeNull();
  });
});

describe("buildHomeHeroNarrative", () => {
  it("leads with BG when available", () => {
    const n = buildHomeHeroNarrative({
      healthStatus: "stable",
      bgValue: "6.2",
      bgUnits: "mmol/L",
      trendLabel: "flat",
      nextActionSubline: "Steady stretch — ask if anything feels off.",
    });
    expect(n.primary).toBe("6.2");
    expect(n.primarySuffix).toBe("mmol/L");
    expect(n.supporting).toMatch(/Steady/);
  });

  it("uses Steady word without BG", () => {
    const n = buildHomeHeroNarrative({
      healthStatus: "stable",
      bgValue: null,
      bgUnits: null,
      trendLabel: null,
      nextActionSubline: "Open the adviser when you eat.",
    });
    expect(n.primary).toBe("Steady");
  });
});
