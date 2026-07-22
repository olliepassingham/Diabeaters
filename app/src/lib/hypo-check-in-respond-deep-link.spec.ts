import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  consumePendingHypoCheckInRespond,
  OPEN_HYPO_CHECK_IN_RESPOND_EVENT,
  requestOpenHypoCheckInRespondSheet,
  storePendingHypoCheckInRespond,
} from "./hypo-check-in-respond-deep-link";
import { CLOSE_NOTIFICATION_BELL_EVENT } from "./notification-inbox-deep-link";

describe("hypo-check-in-respond-deep-link", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("stores and consumes pending respond payload", () => {
    storePendingHypoCheckInRespond({ checkInId: "abc-123", carerName: "Neil" });
    expect(consumePendingHypoCheckInRespond()).toEqual({
      checkInId: "abc-123",
      carerName: "Neil",
    });
    expect(consumePendingHypoCheckInRespond()).toBeNull();
  });

  it("closes the notification bell before opening the respond sheet", () => {
    const closeSpy = vi.fn();
    const openSpy = vi.fn();
    window.addEventListener(CLOSE_NOTIFICATION_BELL_EVENT, closeSpy);
    window.addEventListener(OPEN_HYPO_CHECK_IN_RESPOND_EVENT, openSpy);

    requestOpenHypoCheckInRespondSheet({ checkInId: "abc-123", carerName: "Neil" });

    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledTimes(1);
    // Close must fire first so the popover is gone before the sheet mounts underneath it.
    expect(closeSpy.mock.invocationCallOrder[0]!).toBeLessThan(openSpy.mock.invocationCallOrder[0]!);
    expect(consumePendingHypoCheckInRespond()).toEqual({
      checkInId: "abc-123",
      carerName: "Neil",
    });

    window.removeEventListener(CLOSE_NOTIFICATION_BELL_EVENT, closeSpy);
    window.removeEventListener(OPEN_HYPO_CHECK_IN_RESPOND_EVENT, openSpy);
  });
});
