import { afterEach, describe, expect, it, vi } from "vitest";

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
    schedule: scheduleMock,
  },
}));

vi.mock("@/lib/storage", () => ({
  storage: {
    getNotificationSettings: vi.fn(() => ({
      enabled: true,
    })),
  },
}));

describe("ios-system-notifications showIosSystemNotificationNow", () => {
  afterEach(() => {
    scheduleMock.mockClear();
  });

  it("schedules an immediate local notification when notifications are enabled", async () => {
    const { showIosSystemNotificationNow } = await import("./ios-system-notifications");
    const res = await showIosSystemNotificationNow({ title: "Test", body: "Hello", tag: "unit-test" });
    expect(res.shown).toBe(true);
    expect(scheduleMock).toHaveBeenCalledTimes(1);
    const arg = scheduleMock.mock.calls[0]![0] as { notifications: Array<{ title: string; body: string }> };
    expect(arg.notifications[0]?.title).toBe("Test");
    expect(arg.notifications[0]?.body).toBe("Hello");
  });
});
