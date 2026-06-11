import { beforeEach, describe, expect, it, vi } from "vitest";

const getProfile = vi.fn();
const getLinkedPatientForCarer = vi.fn();

vi.mock("@/lib/profile", () => ({
  getProfile: (...args: unknown[]) => getProfile(...args),
}));

vi.mock("@/lib/carers", () => ({
  getLinkedPatientForCarer: () => getLinkedPatientForCarer(),
}));

describe("welcome-path-community-reconcile", () => {
  beforeEach(() => {
    vi.resetModules();
    sessionStorage.clear();
    localStorage.clear();
    getProfile.mockReset();
    getLinkedPatientForCarer.mockReset();
    getLinkedPatientForCarer.mockResolvedValue({ data: null, error: null });
  });

  it("reconciles community members who tapped the User welcome path", async () => {
    const { markPersistedCommunityAccount } = await import("@/lib/carer-session");
    markPersistedCommunityAccount();
    const { setOnboardingAccountPath } = await import("@/lib/carer-session");
    setOnboardingAccountPath("patient");

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
      },
    });

    const { reconcileUserWelcomeWithExistingCommunityAccount } = await import(
      "@/lib/welcome-path-community-reconcile"
    );
    const { getPrimaryAppRole, getOnboardingAccountPath } = await import("@/lib/carer-session");

    const result = await reconcileUserWelcomeWithExistingCommunityAccount("u1");
    expect(result.reconciled).toBe(true);
    if (!result.reconciled) return;
    expect(result.destination).toMatch(/^\/(community|tools)/);
    expect(getPrimaryAppRole()).toBe("community");
    expect(getOnboardingAccountPath()).toBe("community");
  });

  it("does not reconcile linked community members upgrading via supporter flow", async () => {
    const { setOnboardingAccountPath } = await import("@/lib/carer-session");
    setOnboardingAccountPath("patient");
    getLinkedPatientForCarer.mockResolvedValue({
      data: { linkId: "l1", patientId: "p1", carerId: "u1", scopes: {} },
      error: null,
    });
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
      },
    });

    const { reconcileUserWelcomeWithExistingCommunityAccount } = await import(
      "@/lib/welcome-path-community-reconcile"
    );

    const result = await reconcileUserWelcomeWithExistingCommunityAccount("u1");
    expect(result.reconciled).toBe(false);
  });

  it("does not reconcile patient accounts on the User welcome path", async () => {
    const { setOnboardingAccountPath } = await import("@/lib/carer-session");
    setOnboardingAccountPath("patient");
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
      },
    });

    const { reconcileUserWelcomeWithExistingCommunityAccount } = await import(
      "@/lib/welcome-path-community-reconcile"
    );

    const result = await reconcileUserWelcomeWithExistingCommunityAccount("u1");
    expect(result.reconciled).toBe(false);
  });
});
