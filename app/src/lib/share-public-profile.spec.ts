import { describe, expect, it } from "vitest";
import { buildPublicProfileShareUrl } from "@/lib/share-public-profile";

describe("buildPublicProfileShareUrl", () => {
  it("prefers handle URL when public handle is set", () => {
    expect(
      buildPublicProfileShareUrl({
        userId: "user-1",
        publicHandle: "@ollie",
        origin: "https://diabeaters.vercel.app",
      }),
    ).toBe("https://diabeaters.vercel.app/community/u/ollie");
  });

  it("falls back to profile id URL without handle", () => {
    expect(
      buildPublicProfileShareUrl({
        userId: "user-1",
        origin: "https://diabeaters.vercel.app",
      }),
    ).toBe("https://diabeaters.vercel.app/community/profile/user-1");
  });
});
