import { describe, expect, it } from "vitest";

import {
  countUnreadInAppExcludingDmFromRows,
  isDmMessageKind,
  nativeAppBadgeCountFromParts,
  notificationKindFromData,
} from "./native-app-badge-count.ts";

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
      { read: false, data: { kind: "feed_post_like" } },
      { read: true, data: { kind: "feed_post_comment" } },
      { read: false, data: { kind: "dm_message" } },
    ];
    expect(countUnreadInAppExcludingDmFromRows(rows)).toBe(1);
  });
});

describe("isDmMessageKind", () => {
  it("detects dm_message kind", () => {
    expect(isDmMessageKind({ kind: "dm_message" })).toBe(true);
    expect(isDmMessageKind({ kind: "feed_post_like" })).toBe(false);
    expect(notificationKindFromData({ kind: "hypo_logged" })).toBe("hypo_logged");
  });
});
