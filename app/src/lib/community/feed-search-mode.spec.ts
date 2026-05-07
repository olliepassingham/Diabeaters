import { describe, expect, it } from "vitest";
import { FEED_SERVER_SEARCH_MIN_LEN, shouldUseFeedServerSearch } from "./feed-search-mode";

describe("feed-search-mode", () => {
  it("uses threshold constant", () => {
    expect(FEED_SERVER_SEARCH_MIN_LEN).toBe(2);
  });

  it("does not server-search for short or empty queries", () => {
    expect(shouldUseFeedServerSearch("")).toBe(false);
    expect(shouldUseFeedServerSearch(" ")).toBe(false);
    expect(shouldUseFeedServerSearch("a")).toBe(false);
  });

  it("server-searches when trimmed length meets minimum", () => {
    expect(shouldUseFeedServerSearch("ab")).toBe(true);
    expect(shouldUseFeedServerSearch("  xy ")).toBe(true);
  });
});
