import { afterEach, describe, expect, it, vi } from "vitest";

const cancelMock = vi.fn(() => Promise.resolve());
const scheduleMock = vi.fn(() => Promise.resolve());

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => "ios",
  },
}));

vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    checkPermissions: vi.fn(() => Promise.resolve({ display: "granted" })),
    requestPermissions: vi.fn(() => Promise.resolve({ display: "granted" })),
    cancel: cancelMock,
    schedule: scheduleMock,
  },
}));

vi.mock("@/lib/storage", () => ({
  storage: {
    getNotificationSettings: vi.fn(() => ({
      enabled: true,
      helpfulCheckInsEnabled: true,
    })),
  },
}));

describe("ios-system-notifications helpful check-in", () => {
  afterEach(() => {
    cancelMock.mockClear();
    scheduleMock.mockClear();
  });

  it("scheduleHelpfulCheckIn cancels then schedules when opted in", async () => {
    const { scheduleHelpfulCheckIn, HELPFUL_CHECKIN_NOTIFICATION_ID } = await import("./ios-system-notifications");
    const when = new Date(Date.now() + 120_000);
    const res = await scheduleHelpfulCheckIn(when);
    expect(res.scheduled).toBe(true);
    expect(cancelMock).toHaveBeenCalledWith({
      notifications: [{ id: HELPFUL_CHECKIN_NOTIFICATION_ID }],
    });
    expect(scheduleMock).toHaveBeenCalled();
  });
});
