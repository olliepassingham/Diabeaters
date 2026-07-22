import { describe, expect, it, beforeEach, vi } from "vitest";

import {
  consumePendingOpenNotificationBell,
  isNotificationBellDeepLink,
  NOTIFICATION_BELL_DEEP_LINK,
  CLOSE_NOTIFICATION_BELL_EVENT,
  requestCloseNotificationBell,
  storePendingOpenNotificationBell,
} from "./notification-inbox-deep-link";

describe("notification-inbox-deep-link", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("recognises the notification bell deep link", () => {
    expect(isNotificationBellDeepLink(NOTIFICATION_BELL_DEEP_LINK)).toBe(true);
    expect(isNotificationBellDeepLink("/notifications?bell=1")).toBe(true);
    expect(isNotificationBellDeepLink("/notifications")).toBe(false);
    expect(isNotificationBellDeepLink("/carer-view")).toBe(false);
  });

  it("stores and consumes pending bell open", () => {
    storePendingOpenNotificationBell();
    expect(consumePendingOpenNotificationBell()).toBe(true);
    expect(consumePendingOpenNotificationBell()).toBe(false);
  });

  it("dispatches close event so stacked sheets can dismiss the bell", () => {
    const spy = vi.fn();
    window.addEventListener(CLOSE_NOTIFICATION_BELL_EVENT, spy);
    requestCloseNotificationBell();
    expect(spy).toHaveBeenCalledTimes(1);
    window.removeEventListener(CLOSE_NOTIFICATION_BELL_EVENT, spy);
  });
});
