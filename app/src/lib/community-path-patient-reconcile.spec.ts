import { beforeEach, describe, expect, it, vi } from "vitest";

const getProfile = vi.fn();

vi.mock("@/lib/profile", () => ({
  getProfile: (...args: unknown[]) => getProfile(...args),
}));

describe("community-path-patient-reconcile", () => {
  beforeEach(() => {
    vi.resetModules();
    sessionStorage.clear();
    localStorage.clear();
    getProfile.mockReset();
  });

  it("detects community welcome path from onboarding markers", async () => {
    const { setOnboardingAccountPath, setPrimaryAppRole } = await import("@/lib/carer-session");
    const { isCommunityWelcomePathChosen } = await import("@/lib/community-path-patient-reconcile");

    setOnboardingAccountPath("community");
    expect(isCommunityWelcomePathChosen()).toBe(true);

    sessionStorage.clear();
    localStorage.clear();
    setPrimaryAppRole("community");
    expect(isCommunityWelcomePathChosen()).toBe(true);
  });

  it("treats completed patient profiles as existing patient accounts", async () => {
    const { profileIndicatesExistingPatientAccount } = await import(
      "@/lib/community-path-patient-reconcile"
    );

    expect(
      profileIndicatesExistingPatientAccount({
        id: "u1",
        full_name: "Pat",
        avatar_url: null,
        bio: null,
        public_handle: null,
        is_public: false,
        onboarding_complete: true,
        account_type: "patient",
      }),
    ).toBe(true);
    expect(
      profileIndicatesExistingPatientAccount({
        id: "u1",
        full_name: "Pat",
        avatar_url: null,
        bio: null,
        public_handle: null,
        is_public: false,
        onboarding_complete: true,
        account_type: "community",
      }),
    ).toBe(false);
    expect(
      profileIndicatesExistingPatientAccount({
        id: "u2",
        full_name: "Sam",
        avatar_url: null,
        bio: null,
        public_handle: null,
        is_public: false,
        onboarding_complete: true,
        account_type: null,
        primary_app_role: "community",
      }),
    ).toBe(false);
  });

  it("reconciles community welcome with an existing patient profile", async () => {
    const { setOnboardingAccountPath } = await import("@/lib/carer-session");
    setOnboardingAccountPath("community");
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

    const { reconcileCommunityWelcomeWithExistingPatient, stashExistingPatientOnCommunityPathToast } =
      await import("@/lib/community-path-patient-reconcile");
    const { consumePostLoginToast, POST_LOGIN_TOAST_STASHED_EVENT } = await import(
      "@/lib/post-login-toast-stash"
    );
    const { getPrimaryAppRole, getOnboardingAccountPath } = await import("@/lib/carer-session");

    const result = await reconcileCommunityWelcomeWithExistingPatient("u1");
    expect(result.reconciled).toBe(true);
    expect(getPrimaryAppRole()).toBe("patient");
    expect(getOnboardingAccountPath()).toBe("patient");

    const onStashed = vi.fn();
    window.addEventListener(POST_LOGIN_TOAST_STASHED_EVENT, onStashed);
    stashExistingPatientOnCommunityPathToast();
    expect(onStashed).toHaveBeenCalledTimes(1);
    expect(consumePostLoginToast()?.title).toContain("Already have a full account");
  });

  it("does not reconcile new community sign-ups without a patient profile", async () => {
    const { setOnboardingAccountPath } = await import("@/lib/carer-session");
    setOnboardingAccountPath("community");
    getProfile.mockResolvedValue({
      profile: {
        id: "u2",
        full_name: null,
        avatar_url: null,
        bio: null,
        public_handle: null,
        is_public: false,
        onboarding_complete: false,
        account_type: null,
      },
    });

    const { reconcileCommunityWelcomeWithExistingPatient } = await import(
      "@/lib/community-path-patient-reconcile"
    );
    const { getPrimaryAppRole } = await import("@/lib/carer-session");

    const result = await reconcileCommunityWelcomeWithExistingPatient("u2");
    expect(result.reconciled).toBe(false);
    expect(getPrimaryAppRole()).toBe("community");
  });
});
