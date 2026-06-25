import type { PushNotificationSchema } from "@capacitor/push-notifications";
import { describe, expect, it, beforeEach } from "vitest";

import {
  applyPushDeepLinkPath,
  consumePendingPushDeepLink,
  getPathForPushNotificationData,
  getPathFromPushNotification,
  isSafeInAppPath,
  storePendingPushDeepLink,
} from "./push-notification-deep-link";
import { HYPO_LOG_DEEP_LINK } from "@/lib/hypo-check-in-events";
import { NOTIFICATION_BELL_DEEP_LINK } from "./notification-inbox-deep-link";

const OPEN_NOTIFICATION_BELL_EVENT = "diabeaters:open-notification-bell";

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

  it("resolves notification bell deep link from push data", () => {
    expect(
      getPathForPushNotificationData({
        kind: "hypo_logged",
        deep_link: NOTIFICATION_BELL_DEEP_LINK,
      }),
    ).toBe(NOTIFICATION_BELL_DEEP_LINK);
  });

  it("opens notification bell instead of navigating", () => {
    let navigated: string | null = null;
    let bellOpened = false;
    window.addEventListener(OPEN_NOTIFICATION_BELL_EVENT, () => {
      bellOpened = true;
    });
    applyPushDeepLinkPath(NOTIFICATION_BELL_DEEP_LINK, (path) => {
      navigated = path;
    });
    expect(navigated).toBeNull();
    expect(bellOpened).toBe(true);
  });

  it("opens hypo log screen for hypo check-in deep link", async () => {
    let navigated: string | null = null;
    let hypoOpened = false;
    window.addEventListener("diabeater-open-hypo-dialog", () => {
      hypoOpened = true;
    });
    applyPushDeepLinkPath(HYPO_LOG_DEEP_LINK, (path) => {
      navigated = path;
    });
    expect(navigated).toBe(HYPO_LOG_DEEP_LINK);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(hypoOpened).toBe(true);
  });

  it("resolves hypo check-in push data to hypo log deep link", () => {
    expect(
      getPathForPushNotificationData({
        kind: "hypo_check_in",
        check_in_id: "abc-123",
        deep_link: "/",
      }),
    ).toBe(HYPO_LOG_DEEP_LINK);
  });
});
