import { beforeEach, describe, expect, it, vi } from "vitest";

import { notificationIdForPumpChange, upcomingPumpChangeReminderSlots } from "./pump-change-reminder-schedule";

const storageMock = vi.hoisted(() => ({
  getProfile: vi.fn(),
  getNotificationSettings: vi.fn(),
  getSupplies: vi.fn(),
  getActiveItemInfo: vi.fn(),
  getItemDuration: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  storage: storageMock,
}));

describe("pump-change-reminder-schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMock.getProfile.mockReturnValue({ insulinDeliveryMethod: "pump" });
    storageMock.getNotificationSettings.mockReturnValue({ enabled: true, pumpChangeReminders: true });
  });

  it("uses stable notification ids", () => {
    const a = notificationIdForPumpChange("supply-1", "2026-06-02");
    const b = notificationIdForPumpChange("supply-1", "2026-06-02");
    expect(a).toBe(b);
    expect(a).not.toBe(notificationIdForPumpChange("supply-2", "2026-06-02"));
  });

  it("schedules slots for tracked pump supplies", () => {
    const now = new Date("2026-06-02T08:00:00");
    storageMock.getSupplies.mockReturnValue([
      {
        id: "set-1",
        type: "infusion_set",
        activeItemStartDate: "2026-05-30T12:00:00.000Z",
      },
    ]);
    storageMock.getActiveItemInfo.mockReturnValue({ daysLeft: 1, isExpired: false, effectiveStartDate: "2026-05-30" });
    storageMock.getItemDuration.mockReturnValue(3);

    const slots = upcomingPumpChangeReminderSlots(now);
    expect(slots).toHaveLength(1);
    expect(slots[0]?.kind).toBe("infusion_set");
    expect(slots[0]?.title).toMatch(/infusion set/i);
  });
});
