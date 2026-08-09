import { beforeEach, describe, expect, it, vi } from "vitest";

const getProfile = vi.fn();

vi.mock("@/lib/profile", async () => {
  const actual = await vi.importActual<typeof import("@/lib/profile")>("@/lib/profile");
  return {
    ...actual,
    getProfile: (...args: unknown[]) => getProfile(...args),
  };
});

vi.mock("@/lib/flags", () => ({
  isCommunityEnabled: true,
}));

describe("community-landing", () => {
  beforeEach(() => {
    vi.resetModules();
    getProfile.mockReset();
  });

  it("defaults to the feed when no profile context is provided", async () => {
    const { getCommunityMemberLandingPath } = await import("@/lib/community-landing");
    expect(getCommunityMemberLandingPath()).toBe("/community");
    expect(getCommunityMemberLandingPath(true)).toBe("/community");
  });

  it("sends incomplete or missing profiles to public profile setup", async () => {
    const { getCommunityMemberLandingPath } = await import("@/lib/community-landing");
    expect(getCommunityMemberLandingPath(false)).toBe("/community/setup");
    expect(getCommunityMemberLandingPath(null)).toBe("/community/setup");
    expect(
      getCommunityMemberLandingPath({
        full_name: null,
        public_handle: null,
        is_public: false,
      }),
    ).toBe("/community/setup");
    expect(
      getCommunityMemberLandingPath({
        full_name: "Sam",
        public_handle: null,
        is_public: true,
      }),
    ).toBe("/community/setup");
  });

  it("sends complete public profiles to the feed", async () => {
    const { getCommunityMemberLandingPath } = await import("@/lib/community-landing");
    expect(
      getCommunityMemberLandingPath({
        full_name: "Sam Example",
        public_handle: "sam_ex",
        is_public: true,
      }),
    ).toBe("/community");
  });

  it("resolves incomplete cloud profiles to community setup", async () => {
    getProfile.mockResolvedValue({
      profile: {
        id: "u1",
        full_name: null,
        public_handle: null,
        is_public: false,
      },
    });
    const { resolveCommunityMemberLandingPath } = await import("@/lib/community-landing");
    await expect(resolveCommunityMemberLandingPath("u1")).resolves.toBe("/community/setup");
  });

  it("resolves complete cloud profiles to the feed", async () => {
    getProfile.mockResolvedValue({
      profile: {
        id: "u1",
        full_name: "Sam Example",
        public_handle: "sam_ex",
        is_public: true,
      },
    });
    const { resolveCommunityMemberLandingPath } = await import("@/lib/community-landing");
    await expect(resolveCommunityMemberLandingPath("u1")).resolves.toBe("/community");
  });
});
