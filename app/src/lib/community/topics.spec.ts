import { describe, expect, it } from "vitest";
import { orderedCommunityTopicsForViewer } from "./topics";

describe("orderedCommunityTopicsForViewer", () => {
  it("puts Family & supporters first for supporter feed", () => {
    const o = orderedCommunityTopicsForViewer({
      supporterFeed: true,
      dateOfBirth: "2010-06-01",
    });
    expect(o[0]?.id).toBe("family-supporters");
    expect(o[1]?.id).toBe("mental-health");
  });

  it("prioritises supporter ordering over school age when both apply", () => {
    const o = orderedCommunityTopicsForViewer({
      supporterFeed: true,
      dateOfBirth: "2014-01-01",
    });
    expect(o[0]?.id).toBe("family-supporters");
    expect(o[0]?.id).not.toBe("school-college-life");
  });

  it("puts School & college first for viewers under 23", () => {
    const o = orderedCommunityTopicsForViewer({
      supporterFeed: false,
      dateOfBirth: "2008-03-15",
    });
    expect(o[0]?.id).toBe("school-college-life");
  });

  it("uses default order for adults 23+", () => {
    const o = orderedCommunityTopicsForViewer({
      supporterFeed: false,
      dateOfBirth: "1999-01-01",
    });
    expect(o[0]?.id).toBe("holidays-travel");
  });

  it("uses default order when DOB unknown", () => {
    const o = orderedCommunityTopicsForViewer({
      supporterFeed: false,
      dateOfBirth: null,
    });
    expect(o[0]?.id).toBe("holidays-travel");
  });
});
