import { describe, expect, it } from "vitest";

import { getActiveMentionAtCursor, insertMentionAtCursor } from "@/lib/mention-text";

describe("mention-text", () => {
  it("detects mention query at end of text", () => {
    expect(getActiveMentionAtCursor("hello @oll", 10)).toEqual({ start: 6, query: "oll" });
  });

  it("returns null when no @ segment", () => {
    expect(getActiveMentionAtCursor("hello world", 11)).toBeNull();
  });

  it("inserts normalized handle with trailing space", () => {
    const r = insertMentionAtCursor("Hey @ol", 4, 8, "Ollie_1");
    expect(r.text).toBe("Hey @ollie_1 ");
    expect(r.cursor).toBe(13);
  });
});
