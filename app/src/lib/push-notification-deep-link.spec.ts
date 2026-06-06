import type { PushNotificationSchema } from "@capacitor/push-notifications";
import { describe, expect, it, beforeEach } from "vitest";

import {
  consumePendingPushDeepLink,
  getPathForPushNotificationData,
  getPathFromPushNotification,
  isSafeInAppPath,
  storePendingPushDeepLink,
} from "./push-notification-deep-link";

describe("push-notification-deep-link", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("isSafeInAppPath rejects unsafe paths", () => {
    expect(isSafeInAppPath("/community/messages/t1")).toBe(true);
    expect(isSafeInAppPath("//evil.com")).toBe(false);
    expect(isSafeInAppPath("")).toBe(false);
  });

  it("resolves dm_message deep_link from push data", () => {
    expect(
      getPathForPushNotificationData({
        kind: "dm_message",
        thread_id: "abc-123",
        deep_link: "/community/messages/abc-123",
      }),
    ).toBe("/community/messages/abc-123");
  });

  it("falls back to thread_id when deep_link missing", () => {
    expect(
      getPathForPushNotificationData({
        kind: "dm_message",
        thread_id: "abc-123",
      }),
    ).toBe("/community/messages/abc-123");
  });

  it("reads path from Capacitor notification.data", () => {
    const notification: PushNotificationSchema = {
      id: "1",
      data: {
        kind: "dm_message",
        deep_link: "/community/messages/thread-9",
      },
    };
    expect(getPathFromPushNotification(notification)).toBe("/community/messages/thread-9");
  });

  it("stores and consumes pending deep link", () => {
    storePendingPushDeepLink("/community/messages/x");
    expect(consumePendingPushDeepLink()).toBe("/community/messages/x");
    expect(consumePendingPushDeepLink()).toBeNull();
  });
});
