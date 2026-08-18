import { beforeEach, describe, expect, it, vi } from "vitest";

const registerActionTypesMock = vi.fn(async () => {});
const respondHypoCheckInMock = vi.fn(async () => ({ data: null, error: null }));
const markMedTakenMock = vi.fn(async () => true);
const supportsNativeMock = vi.fn(() => true);

vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    registerActionTypes: (...args: unknown[]) => registerActionTypesMock(...args),
  },
}));

vi.mock("@/lib/native-platform", () => ({
  supportsNativeLocalNotifications: () => supportsNativeMock(),
}));

vi.mock("@/lib/hypo-check-ins", () => ({
  respondHypoCheckIn: (...args: unknown[]) => respondHypoCheckInMock(...args),
  fetchPendingHypoCheckIns: async () => ({ data: [], error: null }),
}));

vi.mock("@/lib/sick-day-med-actions", () => ({
  markSickDayMedicationTakenFromNotification: (...args: unknown[]) => markMedTakenMock(...args),
}));

async function freshModule() {
  vi.resetModules();
  return await import("./notification-actions");
}

beforeEach(() => {
  registerActionTypesMock.mockClear();
  respondHypoCheckInMock.mockClear();
  markMedTakenMock.mockClear();
  supportsNativeMock.mockReturnValue(true);
});

describe("registerNotificationActionTypes", () => {
  it("registers hypo check-in, med, and bedtime categories once", async () => {
    const mod = await freshModule();
    await mod.registerNotificationActionTypes();
    await mod.registerNotificationActionTypes();

    expect(registerActionTypesMock).toHaveBeenCalledTimes(1);
    const arg = registerActionTypesMock.mock.calls[0]![0] as { types: { id: string }[] };
    expect(arg.types.map((t) => t.id)).toEqual([
      "hypo_check_in",
      "sick_day_med_reminder",
      "bedtime_reminder",
      "exercise_cgm_alert",
    ]);
  });

  it("does nothing off native platforms", async () => {
    supportsNativeMock.mockReturnValue(false);
    const mod = await freshModule();
    await mod.registerNotificationActionTypes();
    expect(registerActionTypesMock).not.toHaveBeenCalled();
  });
});

describe("handleNotificationButtonAction", () => {
  it("responds OK to a hypo check-in when check_in_id is present", async () => {
    const mod = await freshModule();
    const handled = await mod.handleNotificationButtonAction("hypo_check_in_ok", {
      check_in_id: "abc-123",
    });
    expect(handled).toBe(true);
    expect(respondHypoCheckInMock).toHaveBeenCalledWith({ checkInId: "abc-123", response: "ok" });
  });

  it("falls back to deep link when check_in_id is missing", async () => {
    const mod = await freshModule();
    const handled = await mod.handleNotificationButtonAction("hypo_check_in_ok", {
      deep_link: "/",
    });
    expect(handled).toBe(false);
    expect(respondHypoCheckInMock).not.toHaveBeenCalled();
  });

  it("is handled even when responding fails (offline / already responded)", async () => {
    respondHypoCheckInMock.mockRejectedValueOnce(new Error("network"));
    const mod = await freshModule();
    const handled = await mod.handleNotificationButtonAction("hypo_check_in_ok", {
      check_in_id: "abc-123",
    });
    expect(handled).toBe(true);
  });

  it("logs a sick-day med dose with the fired due time", async () => {
    const mod = await freshModule();
    const handled = await mod.handleNotificationButtonAction("sick_day_med_taken", {
      reminder_id: "rem-1",
      due_at_iso: "2026-07-17T10:00:00.000Z",
    });
    expect(handled).toBe(true);
    expect(markMedTakenMock).toHaveBeenCalledWith("rem-1", "2026-07-17T10:00:00.000Z");
  });

  it("falls back to deep link when reminder_id is missing", async () => {
    const mod = await freshModule();
    const handled = await mod.handleNotificationButtonAction("sick_day_med_taken", {});
    expect(handled).toBe(false);
    expect(markMedTakenMock).not.toHaveBeenCalled();
  });

  it("treats exercise 'I've sorted it' as handled, and replies treating when a check-in is waiting", async () => {
    const mod = await freshModule();
    const handled = await mod.handleNotificationButtonAction("exercise_sorted_it", {
      deep_link: "/scenarios/exercise",
    });
    expect(handled).toBe(true);
  });

  it("does not handle default taps or foreground open actions", async () => {
    const mod = await freshModule();
    expect(await mod.handleNotificationButtonAction("tap", {})).toBe(false);
    expect(await mod.handleNotificationButtonAction("bedtime_open_guide", {})).toBe(false);
    expect(await mod.handleNotificationButtonAction("unknown_action", {})).toBe(false);
  });
});
