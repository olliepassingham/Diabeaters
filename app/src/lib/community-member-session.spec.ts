import { beforeEach, describe, expect, it, vi } from "vitest";

const getProfile = vi.fn();
const upsertProfile = vi.fn();
const syncAccountTypeToCloud = vi.fn();

vi.mock("@/lib/profile", () => ({
  getProfile: (...args: unknown[]) => getProfile(...args),
  upsertProfile: (...args: unknown[]) => upsertProfile(...args),
}));

vi.mock("@/lib/carers", () => ({
  getLinkedPatientForCarer: () => Promise.resolve({ data: null, error: null }),
}));

vi.mock("@/lib/clinical-prefs-cloud-sync", () => ({
  syncAccountTypeToCloud: (...args: unknown[]) => syncAccountTypeToCloud(...args),
}));

describe("community-member-session", () => {
  beforeEach(() => {
    vi.resetModules();
    sessionStorage.clear();
    localStorage.clear();
    getProfile.mockReset();
    upsertProfile.mockReset();
    syncAccountTypeToCloud.mockReset();
    upsertProfile.mockResolvedValue({ data: null, error: null });
    syncAccountTypeToCloud.mockResolvedValue({ error: null });
  });

  it("marks local onboarding complete for community intent", async () => {
    const { setOnboardingAccountPath, setPrimaryAppRole } = await import("@/lib/carer-session");
    setOnboardingAccountPath("community");
    setPrimaryAppRole("community");

    getProfile.mockResolvedValue({
      profile: {
        id: "u1",
        full_name: null,
        avatar_url: null,
        bio: null,
        public_handle: null,
        is_public: false,
        onboarding_complete: false,
        account_type: null,
        primary_app_role: null,
      },
    });

    const { finalizeCommunityMemberSession } = await import("@/lib/community-member-session");
    const { storage } = await import("@/lib/storage");

    const result = await finalizeCommunityMemberSession("u1", { email: "sam@example.com" });
    expect(result.error).toBeNull();
    expect(localStorage.getItem("diabeater_onboarding_completed")).toBe("true");
    expect(storage.getProfile()?.accountType).toBe("community");
    expect(storage.getProfile()?.hasAcceptedDisclaimer).toBe(true);
    expect(upsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "u1",
        onboarding_complete: true,
        account_type: "community",
        primary_app_role: "community",
      }),
    );
  });

  it("restores community session from cloud profile on a new device", async () => {
    getProfile.mockResolvedValue({
      profile: {
        id: "u1",
        full_name: "Sam",
        avatar_url: null,
        bio: null,
        public_handle: null,
        is_public: false,
        onboarding_complete: true,
        account_type: "community",
        primary_app_role: "community",
      },
    });

    const { ensureCommunityMemberSessionReady } = await import("@/lib/community-member-session");
    const { getPrimaryAppRole, getOnboardingAccountPath } = await import("@/lib/carer-session");

    await ensureCommunityMemberSessionReady("u1");
    expect(getPrimaryAppRole()).toBe("community");
    expect(getOnboardingAccountPath()).toBe("community");
    expect(localStorage.getItem("diabeater_onboarding_completed")).toBe("true");
  });

  it("does not finalize when profile is an existing patient account", async () => {
    getProfile.mockResolvedValue({
      profile: {
        id: "u1",
        full_name: "Pat",
        avatar_url: null,
        bio: null,
        public_handle: null,
        is_public: false,
        onboarding_complete: true,
        account_type: "patient",
        primary_app_role: "patient",
      },
    });

    const { setOnboardingAccountPath, setPrimaryAppRole } = await import("@/lib/carer-session");
    setOnboardingAccountPath("community");
    setPrimaryAppRole("community");

    const { ensureCommunityMemberSessionReady } = await import("@/lib/community-member-session");
    await ensureCommunityMemberSessionReady("u1");
    expect(upsertProfile).not.toHaveBeenCalled();
  });
});
