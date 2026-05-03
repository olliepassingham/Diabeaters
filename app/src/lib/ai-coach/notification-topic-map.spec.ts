import { describe, expect, it } from "vitest";
import { coachTopicForInAppNotification } from "./notification-topic-map";
import type { InAppNotificationRow } from "@/lib/carer-notify-types";

function row(data: Record<string, unknown>): InAppNotificationRow {
  return {
    id: "1",
    user_id: "u",
    title: "t",
    body: "b",
    data,
    created_at: new Date().toISOString(),
    read: false,
  };
}

describe("coachTopicForInAppNotification", () => {
  it("maps feed kinds to general", () => {
    expect(coachTopicForInAppNotification(row({ kind: "feed_post_like" }))).toBe("general");
    expect(coachTopicForInAppNotification(row({ kind: "feed_post_mention" }))).toBe("general");
  });

  it("maps dm to general", () => {
    expect(coachTopicForInAppNotification(row({ kind: "dm_message" }))).toBe("general");
  });

  it("maps hypo to hypo", () => {
    expect(coachTopicForInAppNotification(row({ kind: "hypo_logged" }))).toBe("hypo");
  });

  it("maps unknown to general", () => {
    expect(coachTopicForInAppNotification(row({}))).toBe("general");
  });
});
