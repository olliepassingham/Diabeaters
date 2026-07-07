import { describe, expect, it } from "vitest";
import {
  FEED_POST_BODY_MAX_CHARS,
  FEED_POST_TEMPLATES,
  FEED_POST_TOPIC_IDS,
  clampFeedPostBody,
  dayOfYearUtc,
  selectFeedPostTemplateForUtcDate,
} from "./feedPostPrompt.ts";

describe("feedPostPrompt", () => {
  it("templates use valid topic ids", () => {
    const allowed = new Set<string>(FEED_POST_TOPIC_IDS);
    for (const t of FEED_POST_TEMPLATES) {
      expect(allowed.has(t.topic)).toBe(true);
      expect(t.body.trim().length).toBeGreaterThan(20);
    }
  });

  it("rotates templates by UTC day-of-year", () => {
    const d1 = new Date("2026-07-01T12:00:00.000Z");
    const d2 = new Date("2026-07-02T12:00:00.000Z");
    const t1 = selectFeedPostTemplateForUtcDate(d1);
    const t1Again = selectFeedPostTemplateForUtcDate(d1);
    const t2 = selectFeedPostTemplateForUtcDate(d2);
    expect(t1).toEqual(t1Again);
    expect(dayOfYearUtc(d1)).not.toBe(dayOfYearUtc(d2));
    expect(t1.body).not.toBe(t2.body);
  });

  it("clampFeedPostBody respects max length", () => {
    const long = "word ".repeat(200).trim();
    const out = clampFeedPostBody(long, 120);
    expect(out.length).toBeLessThanOrEqual(120);
    expect(clampFeedPostBody("Short post.", FEED_POST_BODY_MAX_CHARS)).toBe("Short post.");
  });
});
