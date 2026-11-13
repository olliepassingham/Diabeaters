import { describe, expect, it } from "vitest";
import {
  buildCommunityFeedQueryKey,
  buildMainFeedScopeKey,
  getCommunityFeedNextPageParam,
} from "./community-feed-cache";
import type { CommunityPostRow } from "@/lib/community";

function stubPost(partial: Partial<CommunityPostRow> & Pick<CommunityPostRow, "id" | "created_at">): CommunityPostRow {
  return {
    author_id: "a",
    body: "",
    topic: "general",
    image_urls: [],
    image_alt_texts: [],
    video_url: null,
    video_poster_url: null,
    content_note: null,
    post_kind: "standard",
    audience: "everyone",
    post_extra: null,
    mention_map: {},
    mentioned_user_ids: [],
    is_reported: false,
    comment_count: 0,
    like_count: 0,
    liked_by_me: false,
    interested_count: 0,
    interested_by_me: false,
    saved_by_me: false,
    ...partial,
  };
}

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

  it("buildCommunityFeedQueryKey marks the saved lane", () => {
    const scope = buildMainFeedScopeKey({ savedOnly: true });
    expect(
      buildCommunityFeedQueryKey({
        scopeKey: scope,
        viewerId: "user-1",
        feedTab: "everyone",
        savedOnly: true,
      })[7],
    ).toBe("saved");
  });

  it("getCommunityFeedNextPageParam prefers save_created_at for bookmarks", () => {
    const page = [
      stubPost({ id: "p1", created_at: "2026-01-01T00:00:00.000Z", save_created_at: "2026-11-01T12:00:00.000Z" }),
      stubPost({ id: "p2", created_at: "2026-01-02T00:00:00.000Z", save_created_at: "2026-11-01T11:00:00.000Z" }),
    ];
    // Full page → more may exist; cursor must be bookmark time + post id.
    expect(getCommunityFeedNextPageParam(page, 2)).toEqual({
      created_at: "2026-11-01T11:00:00.000Z",
      id: "p2",
    });
  });
});
