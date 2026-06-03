import { describe, expect, it } from "vitest";

import type { InAppNotificationRow } from "@/lib/carer-notify-types";
import {
  countUnreadInAppExcludingDmFromRows,
  nativeAppBadgeCountFromParts,
} from "@/lib/native-app-badge-count";

function row(partial: Partial<InAppNotificationRow> & { id: string }): InAppNotificationRow {
  return {
    id: partial.id,
    user_id: "u1",
    title: "t",
    body: "b",
    data: partial.data ?? {},
    created_at: "2026-01-01T00:00:00Z",
    read: partial.read ?? false,
  };
}

describe("nativeAppBadgeCountFromParts", () => {
  it("sums in-app and DM thread unread", () => {
    expect(nativeAppBadgeCountFromParts(2, 1)).toBe(3);
  });

  it("never returns negative totals", () => {
    expect(nativeAppBadgeCountFromParts(-1, -2)).toBe(0);
  });
});

describe("countUnreadInAppExcludingDmFromRows", () => {
  it("excludes read and dm_message rows", () => {
    const rows = [
      row({ id: "1", read: false, data: { kind: "feed_post_like" } }),
      row({ id: "2", read: true, data: { kind: "feed_post_comment" } }),
      row({ id: "3", read: false, data: { kind: "dm_message" } }),
    ];
    expect(countUnreadInAppExcludingDmFromRows(rows)).toBe(1);
  });
});
