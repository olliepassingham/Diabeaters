import { describe, expect, it } from "vitest";

import { commentNotificationPreview } from "@/lib/community/comment-preview";

describe("commentNotificationPreview", () => {
  it("uses the comment text when present", () => {
    expect(commentNotificationPreview("  nice  ", false)).toBe("nice");
  });

  it("falls back to a photo label when there is no text", () => {
    expect(commentNotificationPreview("  ", true)).toBe("sent a photo");
  });
});
