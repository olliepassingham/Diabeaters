import { describe, expect, it } from "vitest";
import { buildCommunityFeedQueryKey, buildMainFeedScopeKey } from "./community-feed-cache";

describe("community-feed-cache", () => {
  it("buildMainFeedScopeKey matches default everyone feed", () => {
    expect(buildMainFeedScopeKey({})).toBe("main:everyone:_:a::0");
  });

  it("buildCommunityFeedQueryKey matches FeedPostList defaults", () => {
    const scope = buildMainFeedScopeKey({});
    expect(
      buildCommunityFeedQueryKey({
        scopeKey: scope,
        viewerId: "user-1",
        feedTab: "everyone",
      }),
    ).toEqual(["community-feed", scope, "user-1", "everyone", "", "", "", "all"]);
  });
});
