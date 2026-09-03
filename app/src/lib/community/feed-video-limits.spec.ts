import { describe, expect, it } from "vitest";

import { formatVideoDurationSeconds, GUIDED_POST_VIDEO_MAX_SECONDS, MAX_POST_VIDEO_SECONDS } from "@/lib/community/feed-video-limits";

describe("feed video limits", () => {
  it("keeps short-form guidance under a hard mobile-friendly cap", () => {
    expect(GUIDED_POST_VIDEO_MAX_SECONDS).toBe(60);
    expect(MAX_POST_VIDEO_SECONDS).toBe(90);
    expect(MAX_POST_VIDEO_SECONDS).toBeGreaterThan(GUIDED_POST_VIDEO_MAX_SECONDS);
  });

  it("formats durations for composer feedback", () => {
    expect(formatVideoDurationSeconds(45)).toBe("45s");
    expect(formatVideoDurationSeconds(75)).toBe("1:15");
  });
});
