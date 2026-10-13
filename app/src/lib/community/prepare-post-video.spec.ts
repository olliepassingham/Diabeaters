import { describe, expect, it } from "vitest";
import { defaultVideoTrimRange } from "@/lib/community/prepare-post-video";
import { GUIDED_POST_VIDEO_MAX_SECONDS, MAX_POST_VIDEO_SECONDS } from "@/lib/community/feed-video-limits";

describe("defaultVideoTrimRange", () => {
  it("keeps short clips whole", () => {
    expect(defaultVideoTrimRange(24)).toEqual({ startSec: 0, endSec: 24 });
  });

  it("keeps a clip that fits the upload limit whole", () => {
    expect(defaultVideoTrimRange(180)).toEqual({ startSec: 0, endSec: 180 });
    expect(defaultVideoTrimRange(MAX_POST_VIDEO_SECONDS + 40)).toEqual({
      startSec: 0,
      endSec: MAX_POST_VIDEO_SECONDS,
    });
    expect(GUIDED_POST_VIDEO_MAX_SECONDS).toBeLessThanOrEqual(MAX_POST_VIDEO_SECONDS);
  });
});
