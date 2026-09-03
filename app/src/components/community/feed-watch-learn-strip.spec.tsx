import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FeedWatchLearnStrip } from "@/components/community/feed-watch-learn-strip";
import type { CommunityPostRow } from "@/lib/community";

function videoPost(id: string): CommunityPostRow {
  return {
    id,
    author_id: "author-1",
    body: "What my CGM looked like after pizza",
    topic: "tips-what-worked",
    image_urls: [],
    image_alt_texts: [],
    video_url: `author-1/${id}/video.mp4`,
    content_note: "experience-sharing",
    post_kind: "standard",
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
    created_at: new Date().toISOString(),
    author_preview: {
      full_name: "Alex",
      avatar_url: null,
      public_handle: "alex",
    },
  };
}

describe("FeedWatchLearnStrip", () => {
  it("renders recent video tips for watch and learn", () => {
    render(<FeedWatchLearnStrip posts={[videoPost("p1")]} loading={false} />);
    expect(screen.getByTestId("feed-watch-learn-strip")).not.toBeNull();
    expect(screen.getByText("Peer tips from the community")).not.toBeNull();
    expect(screen.getByTestId("watch-learn-item-p1")).not.toBeNull();
  });

  it("hides when there are no video posts", () => {
    const { container } = render(<FeedWatchLearnStrip posts={[]} loading={false} />);
    expect(container.firstChild).toBeNull();
  });
});
