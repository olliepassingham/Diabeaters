import { describe, expect, it } from "vitest";

import { titleBodyFromPushNotification } from "@/lib/push-notification-present";

describe("titleBodyFromPushNotification", () => {
  it("uses notification title and body when present", () => {
    expect(
      titleBodyFromPushNotification({
        id: "abc",
        title: "Low supply",
        body: "Pen needles are running low",
      }),
    ).toEqual({ title: "Low supply", body: "Pen needles are running low" });
  });

  it("falls back to aps.alert in data", () => {
    expect(
      titleBodyFromPushNotification({
        id: "x",
        data: {
          aps: { alert: { title: "New message", body: "Hello there" } },
        },
      }),
    ).toEqual({ title: "New message", body: "Hello there" });
  });
});
