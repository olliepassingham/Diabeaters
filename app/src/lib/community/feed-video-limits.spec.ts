import { describe, expect, it } from "vitest";

import { feedVideoTooLargeMessage, formatVideoDurationSeconds, GUIDED_POST_VIDEO_MAX_SECONDS, isLikelyVideoFile, MAX_FEED_VIDEO_BYTES, MAX_POST_VIDEO_SECONDS } from "@/lib/community/feed-video-limits";

describe("feed video limits", () => {
  it("accepts influencer-length clips up to 10 minutes and 500MB", () => {
    expect(GUIDED_POST_VIDEO_MAX_SECONDS).toBe(180);
    expect(MAX_POST_VIDEO_SECONDS).toBe(600);
    expect(MAX_POST_VIDEO_SECONDS).toBeGreaterThanOrEqual(GUIDED_POST_VIDEO_MAX_SECONDS);
    expect(MAX_FEED_VIDEO_BYTES).toBe(524288000);
    expect(feedVideoTooLargeMessage(new File([new Uint8Array(8)], "clip.mp4", { type: "video/mp4" }))).toBeNull();
  });

  it("formats durations for composer feedback", () => {
    expect(formatVideoDurationSeconds(45)).toBe("45s");
    expect(formatVideoDurationSeconds(75)).toBe("1:15");
  });

  it("treats iOS camera clips without a MIME type as video", () => {
    expect(isLikelyVideoFile(new File([""], "clip.mov", { type: "" }))).toBe(true);
    expect(isLikelyVideoFile(new File([""], "clip", { type: "application/octet-stream" }))).toBe(true);
    expect(isLikelyVideoFile(new File([""], "notes.pdf", { type: "" }))).toBe(false);
  });
});
