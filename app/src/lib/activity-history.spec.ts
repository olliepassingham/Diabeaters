import { addDays, format } from "date-fns";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  collectAllActivityEvents,
  collectCarerActivityEvents,
  filterActivityEvents,
  getActivityDayKeys,
  getActivityWeekSummary,
  groupActivityEventsByDay,
  loadStoredActivityFilter,
  parseActivityTimestamp,
  saveStoredActivityFilter,
  toActivityDayKey,
} from "./activity-history";
import { DEFAULT_CARER_SCOPES } from "./carers.types";
import { setActiveUserIdForLocalStorage, storage } from "./storage";

describe("activity-history", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("parseActivityTimestamp rejects invalid dates", () => {
    expect(parseActivityTimestamp("not-a-date")).toBeNull();
    expect(parseActivityTimestamp("2025-03-15T10:00:00.000Z")).not.toBeNull();
  });

  it("toActivityDayKey uses local calendar day", () => {
    const key = toActivityDayKey("2025-03-15T23:30:00.000Z");
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("maps hypo treatments with cloud source when synced", () => {
    storage.addHypoTreatment({
      timestamp: "2025-03-10T14:00:00.000Z",
      treatment: "Juice",
      glucoseLevel: 3.2,
      carerNotified: true,
      supabaseHypoLogId: "cloud-1",
    });

    const events = collectAllActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("hypo_treated");
    expect(events[0].source).toBe("cloud");
    expect(events[0].subtitle).toContain("Juice");
  });

  it("deduplicates by event id", () => {
    storage.addHypoTreatment({
      timestamp: "2025-03-10T14:00:00.000Z",
      carerNotified: false,
    });
    const events = collectAllActivityEvents();
    expect(events).toHaveLength(1);
  });

  it("maps scenario history start and end", () => {
    storage.addScenarioHistory({
      id: "sc-1",
      type: "sick_day",
      startDate: "2025-02-01T08:00:00.000Z",
      endDate: "2025-02-03T18:00:00.000Z",
      severity: "moderate",
      notes: "",
      journalEntryCount: 2,
    });

    const events = collectAllActivityEvents();
    expect(events.map((e) => e.kind)).toEqual(["scenario_ended", "scenario_started"]);
  });

  it("groups events by day newest-first within day", () => {
    storage.addHypoTreatment({
      timestamp: "2025-03-15T08:00:00.000Z",
      carerNotified: false,
    });
    storage.addHypoTreatment({
      timestamp: "2025-03-15T18:00:00.000Z",
      carerNotified: false,
    });

    const grouped = groupActivityEventsByDay(collectAllActivityEvents());
    const dayKey = toActivityDayKey("2025-03-15T12:00:00.000Z");
    expect(dayKey).not.toBeNull();
    const dayEvents = grouped.get(dayKey!);
    expect(dayEvents).toHaveLength(2);
    expect(parseActivityTimestamp(dayEvents![0].at)!.getUTCHours()).toBe(18);
  });

  it("filterActivityEvents groups scenario end with scenario filter", () => {
    const events = collectAllActivityEvents();
    const scenarios = filterActivityEvents(events, "scenario_started");
    expect(scenarios.every((e) => e.kind === "scenario_started" || e.kind === "scenario_ended")).toBe(true);
  });

  it("getActivityWeekSummary counts last 7 days", () => {
    storage.addHypoTreatment({
      timestamp: new Date().toISOString(),
      carerNotified: false,
    });
    const summary = getActivityWeekSummary(collectAllActivityEvents());
    expect(summary.countLast7Days).toBeGreaterThanOrEqual(1);
  });

  it("persists filter in sessionStorage", () => {
    saveStoredActivityFilter("hypo_treated");
    expect(loadStoredActivityFilter()).toBe("hypo_treated");
    saveStoredActivityFilter("all");
  });

  it("collectCarerActivityEvents maps hypos when scoped", () => {
    const events = collectCarerActivityEvents({
      scopes: { ...DEFAULT_CARER_SCOPES, hypo_alerts: true, scenarios: false, appointments: false },
      hypoLogs: [
        {
          id: "h1",
          user_id: "p1",
          blood_glucose: 3.1,
          treatment: "Juice",
          notes: null,
          created_at: "2025-04-01T10:00:00.000Z",
        },
      ],
    });
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("cloud");
  });

  it("includes upcoming and past appointments on the calendar", () => {
    setActiveUserIdForLocalStorage("activity-test-user");
    const upcomingDate = format(addDays(new Date(), 14), "yyyy-MM-dd");
    const pastDate = format(addDays(new Date(), -14), "yyyy-MM-dd");

    storage.addAppointment({
      title: "Pump review",
      type: "pump_review",
      date: upcomingDate,
      time: "10:30",
      isCompleted: false,
    });
    storage.addAppointment({
      title: "Annual clinic",
      type: "clinic",
      date: pastDate,
      isCompleted: true,
    });

    const events = collectAllActivityEvents().filter((e) => e.kind === "appointment");
    expect(events).toHaveLength(2);
    expect(events.find((e) => e.title === "Pump review")?.subtitle).toContain("Upcoming");
    expect(events.find((e) => e.title === "Annual clinic")?.subtitle).toContain("Completed");
  });

  it("maps legacy appointment_past filter to appointment", () => {
    saveStoredActivityFilter("appointment_past" as never);
    expect(loadStoredActivityFilter()).toBe("appointment");
    saveStoredActivityFilter("all");
  });

  it("getActivityDayKeys returns unique days", () => {
    storage.addHypoTreatment({
      timestamp: "2025-03-10T10:00:00.000Z",
      carerNotified: false,
    });
    storage.addHypoTreatment({
      timestamp: "2025-03-11T10:00:00.000Z",
      carerNotified: false,
    });
    const keys = getActivityDayKeys(collectAllActivityEvents());
    expect(keys.size).toBe(2);
  });
});
