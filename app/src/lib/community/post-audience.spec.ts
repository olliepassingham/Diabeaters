import { describe, expect, it } from "vitest";
import { isCommunityPostAudience, readPostAudiencePreference, writePostAudiencePreference } from "./post-audience";

describe("post audience preference", () => {
  it("accepts the two audiences", () => {
    expect(isCommunityPostAudience("everyone")).toBe(true);
    expect(isCommunityPostAudience("followers")).toBe(true);
    expect(isCommunityPostAudience("private")).toBe(false);
  });

  it("remembers the last choice and falls back to everyone", () => {
    window.localStorage.removeItem("diabeaters_post_audience_v1");
    expect(readPostAudiencePreference()).toBe("everyone");
    writePostAudiencePreference("followers");
    expect(readPostAudiencePreference()).toBe("followers");
    window.localStorage.setItem("diabeaters_post_audience_v1", "nope");
    expect(readPostAudiencePreference()).toBe("everyone");
  });
});
