import { describe, expect, it } from "vitest";
import { objectCoverSourceRect } from "@/lib/community/story-frame";

describe("objectCoverSourceRect", () => {
  it("crops the sides of a wide photo to fill a tall story", () => {
    const crop = objectCoverSourceRect(4000, 3000, 9, 16);
    expect(crop.sy).toBe(0);
    expect(crop.sh).toBe(3000);
    expect(crop.sw).toBeCloseTo(3000 * (9 / 16));
    expect(crop.sx).toBeCloseTo((4000 - crop.sw) / 2);
  });

  it("crops the top and bottom of a tall photo to fill a wide box", () => {
    const crop = objectCoverSourceRect(1080, 1920, 16, 9);
    expect(crop.sx).toBe(0);
    expect(crop.sw).toBe(1080);
    expect(crop.sh).toBeCloseTo(1080 * (9 / 16));
    expect(crop.sy).toBeCloseTo((1920 - crop.sh) / 2);
  });
});
