import { describe, expect, it } from "vitest";
import {
  authorMetaFromPreviewFields,
  authorIdsNeedingProfileFetch,
  COMMUNITY_MEMBER_DISPLAY_NAME,
  displayAuthorName,
} from "./feed-author-meta";

describe("feed-author-meta", () => {
  it("uses community member label instead of raw id in preview fallback", () => {
    const meta = authorMetaFromPreviewFields("4058093c-aaaa-bbbb-cccc-ddddeeeeffff", {
      full_name: null,
      public_handle: null,
      avatar_url: null,
    });
    expect(meta.name).toBe(COMMUNITY_MEMBER_DISPLAY_NAME);
  });

  it("never displays truncated uuid as author name", () => {
    const meta = {
      name: "4058093c…",
      avatar_url: null,
      public_handle: null,
    };
    expect(displayAuthorName(meta, "4058093c-aaaa-bbbb-cccc-ddddeeeeffff")).toBe(
      COMMUNITY_MEMBER_DISPLAY_NAME,
    );
  });

  it("skips profile fetch when post author_preview has a name", () => {
    const posts = [
      {
        author_id: "user-a",
        author_preview: { full_name: "Ollie", public_handle: "ollie", avatar_url: null },
      },
    ] as Parameters<typeof authorIdsNeedingProfileFetch>[1];
    const needed = authorIdsNeedingProfileFetch(["user-a"], posts);
    expect(needed).toEqual([]);
  });
});
