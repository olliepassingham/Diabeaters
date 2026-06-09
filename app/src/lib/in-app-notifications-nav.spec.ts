import { describe, expect, it } from "vitest";
import { getPathForInAppNotification } from "./in-app-notifications-nav";
import type { InAppNotificationRow } from "./carer-notify-types";

function row(partial: Partial<InAppNotificationRow> & Pick<InAppNotificationRow, "id" | "user_id">): InAppNotificationRow {
  return {
    title: "",
    body: "",
    data: {},
    created_at: new Date().toISOString(),
    read: false,
    ...partial,
  };
}

describe("getPathForInAppNotification", () => {
  it("uses deep_link when present", () => {
    const path = getPathForInAppNotification(
      row({
        id: "1",
        user_id: "u",
        data: { kind: "anything", deep_link: "/community/post/abc" },
      }),
    );
    expect(path).toBe("/community/post/abc");
  });

  it("trims deep_link whitespace", () => {
    expect(
      getPathForInAppNotification(
        row({ id: "1", user_id: "u", data: { deep_link: "  /supplies  " } }),
      ),
    ).toBe("/supplies");
  });

  it("maps bedtime_reminder to bedtime tool", () => {
    expect(
      getPathForInAppNotification(row({ id: "1", user_id: "u", data: { kind: "bedtime_reminder" } })),
    ).toBe("/scenarios/bedtime");
  });

  it("maps supplies_low without deep_link", () => {
    expect(getPathForInAppNotification(row({ id: "1", user_id: "u", data: { kind: "supplies_low" } }))).toBe(
      "/supplies",
    );
  });

  it("maps hypo_logged_self and hypo_logged", () => {
    expect(getPathForInAppNotification(row({ id: "1", user_id: "u", data: { kind: "hypo_logged_self" } }))).toBe(
      "/tools/hypo-history",
    );
    expect(
      getPathForInAppNotification(
        row({ id: "1", user_id: "u", data: { kind: "hypo_logged_self", deep_link: "/" } }),
      ),
    ).toBe("/tools/hypo-history");
    expect(getPathForInAppNotification(row({ id: "1", user_id: "u", data: { kind: "hypo_logged" } }))).toBe(
      "/carer-view",
    );
  });

  it("maps scenario_started to carer view", () => {
    expect(getPathForInAppNotification(row({ id: "1", user_id: "u", data: { kind: "scenario_started" } }))).toBe(
      "/carer-view",
    );
  });

  it("maps appointment_reminder_support to carer view", () => {
    expect(
      getPathForInAppNotification(row({ id: "1", user_id: "u", data: { kind: "appointment_reminder_support" } })),
    ).toBe("/carer-view");
  });

  it("maps feed kinds to post or community hub", () => {
    expect(
      getPathForInAppNotification(row({ id: "1", user_id: "u", data: { kind: "feed_post_like", post_id: "p1" } })),
    ).toBe("/community/post/p1");
    expect(
      getPathForInAppNotification(row({ id: "1", user_id: "u", data: { kind: "feed_post_comment", post_id: "p2" } })),
    ).toBe("/community/post/p2");
    expect(
      getPathForInAppNotification(row({ id: "1", user_id: "u", data: { kind: "feed_post_mention", post_id: "p3" } })),
    ).toBe("/community/post/p3");
    expect(
      getPathForInAppNotification(row({ id: "1", user_id: "u", data: { kind: "feed_post_like" } })),
    ).toBe("/community");
  });

  it("maps dm_message to thread or messages hub", () => {
    expect(
      getPathForInAppNotification(row({ id: "1", user_id: "u", data: { kind: "dm_message", thread_id: "t1" } })),
    ).toBe("/community/messages/t1");
    expect(getPathForInAppNotification(row({ id: "1", user_id: "u", data: { kind: "dm_message" } }))).toBe(
      "/community/messages",
    );
  });

  it("returns null for unknown kind without deep_link", () => {
    expect(getPathForInAppNotification(row({ id: "1", user_id: "u", data: { kind: "future_kind" } }))).toBeNull();
  });
});
