import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FeedWatchLearnPlayer } from "@/components/community/feed-watch-learn-player";
import type { CommunityPostRow } from "@/lib/community";

function videoPost(id: string, body: string): CommunityPostRow {
  return {
    id,
    author_id: "author-1",
    body,
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

describe("FeedWatchLearnPlayer", () => {
  it("opens a vertical reel of clips that can be closed", () => {
    const onOpenChange = vi.fn();
    render(
      <FeedWatchLearnPlayer
        open
        onOpenChange={onOpenChange}
        posts={[videoPost("p1", "After pizza"), videoPost("p2", "Pump bag")]}
        initialIndex={0}
      />,
    );

    expect(screen.getByTestId("feed-watch-learn-player")).not.toBeNull();
    expect(screen.getByTestId("watch-learn-slide-p1")).not.toBeNull();
    expect(screen.getByTestId("watch-learn-slide-p2")).not.toBeNull();

    fireEvent.click(screen.getByTestId("button-close-watch-learn"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes when pulling down on the first clip", () => {
    const onOpenChange = vi.fn();
    render(
      <FeedWatchLearnPlayer
        open
        onOpenChange={onOpenChange}
        posts={[videoPost("p1", "After pizza"), videoPost("p2", "Pump bag")]}
        initialIndex={0}
      />,
    );

    const scroller = screen.getByTestId("watch-learn-scroller");
    fireEvent.touchStart(scroller, { touches: [{ clientX: 100, clientY: 120 }] });
    fireEvent.touchMove(scroller, { touches: [{ clientX: 100, clientY: 220 }] });
    fireEvent.touchEnd(scroller, { changedTouches: [{ clientX: 100, clientY: 220 }] });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows an empty state when there are no clips", () => {
    const onOpenChange = vi.fn();
    render(<FeedWatchLearnPlayer open onOpenChange={onOpenChange} posts={[]} />);
    expect(screen.getByText("No clips yet")).not.toBeNull();
    fireEvent.click(screen.getByTestId("button-close-watch-learn"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
