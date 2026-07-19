import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActiveExerciseSession } from "./storage";

const scheduleMock = vi.fn(async () => {});
const cancelMock = vi.fn(async () => {});

vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    schedule: (...args: unknown[]) => scheduleMock(...args),
    cancel: (...args: unknown[]) => cancelMock(...args),
  },
}));

vi.mock("@/lib/native-platform", () => ({
  supportsNativeLocalNotifications: () => true,
  androidNotificationChannel: () => ({}),
}));

vi.mock("@/lib/native-local-notifications", () => ({
  ensureNativeLocalNotificationPermission: async () => true,
}));

async function freshModule() {
  vi.resetModules();
  return await import("./exercise-reminders");
}

function baseSession(overrides: Partial<ActiveExerciseSession> = {}): ActiveExerciseSession {
  return {
    id: "session-1",
    exerciseName: "Run",
    exerciseType: "cardio",
    intensity: "moderate",
    durationMinutes: 30,
    phase: "active",
    startedAt: new Date().toISOString(),
    exerciseStartedAt: new Date().toISOString(),
    recoveryMinutes: 60,
    midCheckDone: false,
    preChecklist: { bgChecked: false, carbsConsidered: false, basalAdjusted: false },
    ...overrides,
  };
}

beforeEach(() => {
  scheduleMock.mockClear();
  cancelMock.mockClear();
});

describe("scheduleExerciseActiveReminders", () => {
  it("cancels any previous mid/finish/recovery reminders before scheduling new ones (idempotent)", async () => {
    const mod = await freshModule();
    const session = baseSession({ durationMinutes: 60 });
    await mod.scheduleExerciseActiveReminders(session);
    expect(cancelMock).toHaveBeenCalledTimes(1);
    expect(scheduleMock).toHaveBeenCalledTimes(1);
  });
});

describe("scheduleExerciseRecoveryReminder", () => {
  it("anchors the recovery check 30 minutes after the real end time", async () => {
    const mod = await freshModule();
    const session = baseSession({ phase: "recovery" });
    const endedAtMs = Date.now();
    await mod.scheduleExerciseRecoveryReminder(session, endedAtMs);

    expect(scheduleMock).toHaveBeenCalledTimes(1);
    const arg = scheduleMock.mock.calls[0]![0] as { notifications: Array<{ schedule: { at: Date } }> };
    const scheduledAt = arg.notifications[0]!.schedule.at.getTime();
    expect(scheduledAt).toBeGreaterThanOrEqual(endedAtMs + 29 * 60_000);
    expect(scheduledAt).toBeLessThanOrEqual(endedAtMs + 31 * 60_000);
  });

  it("pulls the recovery check in when bedtime is sooner than 30 minutes away", async () => {
    const mod = await freshModule();
    const session = baseSession({ phase: "recovery" });
    const endedAtMs = Date.now();
    await mod.scheduleExerciseRecoveryReminder(session, endedAtMs, 0.25);

    expect(scheduleMock).toHaveBeenCalledTimes(1);
    const arg = scheduleMock.mock.calls[0]![0] as { notifications: Array<{ schedule: { at: Date } }> };
    const scheduledAt = arg.notifications[0]!.schedule.at.getTime();
    expect(scheduledAt).toBeLessThan(endedAtMs + 20 * 60_000);
  });

  it("cancels the stale recovery reminder before scheduling the re-anchored one", async () => {
    const mod = await freshModule();
    const session = baseSession({ phase: "recovery" });
    await mod.scheduleExerciseRecoveryReminder(session, Date.now());
    expect(cancelMock).toHaveBeenCalledTimes(1);
  });
});

describe("cancelExerciseActiveReminders vs cancelExerciseReminders", () => {
  it("cancelExerciseActiveReminders cancels fewer notification ids than the full cancel", async () => {
    const mod = await freshModule();
    await mod.cancelExerciseActiveReminders("session-1");
    const activeCallArg = cancelMock.mock.calls[0]![0] as { notifications: unknown[] };
    cancelMock.mockClear();

    await mod.cancelExerciseReminders("session-1");
    const fullCallArg = cancelMock.mock.calls[0]![0] as { notifications: unknown[] };

    expect(activeCallArg.notifications.length).toBeLessThan(fullCallArg.notifications.length);
  });
});
