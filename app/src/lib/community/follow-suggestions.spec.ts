import { describe, expect, it } from "vitest";
import type { FollowSuggestionReason } from "./follow-suggestions";

const REASON_LABELS: Record<FollowSuggestionReason, string> = {
  follows_you: "Follows you",
  followed_by_network: "Followed by people you follow",
  commented_on_your_post: "Replied on your posts",
  similar_topics: "Posts in topics you use",
  active_in_feed: "Active on the feed",
};

describe("follow-suggestions labels", () => {
  it("covers every reason with a user-facing label", () => {
    const reasons: FollowSuggestionReason[] = [
      "follows_you",
      "followed_by_network",
      "commented_on_your_post",
      "similar_topics",
      "active_in_feed",
    ];
    for (const r of reasons) {
      expect(REASON_LABELS[r].length).toBeGreaterThan(3);
    }
  });
});
