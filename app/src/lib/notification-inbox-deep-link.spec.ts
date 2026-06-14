import { describe, expect, it, beforeEach } from "vitest";

import {
  consumePendingOpenNotificationBell,
  isNotificationBellDeepLink,
  NOTIFICATION_BELL_DEEP_LINK,
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
});
