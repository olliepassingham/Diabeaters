import { beforeEach, describe, expect, it, vi } from "vitest";

const getProfile = vi.fn();
const getLinkedPatientForCarer = vi.fn();

vi.mock("@/lib/profile", () => ({
  getProfile: (...args: unknown[]) => getProfile(...args),
}));

vi.mock("@/lib/carers", () => ({
  getLinkedPatientForCarer: () => getLinkedPatientForCarer(),
}));

describe("account-session-restore", () => {
  beforeEach(() => {
    vi.resetModules();
    sessionStorage.clear();
    localStorage.clear();
    getProfile.mockReset();
    getLinkedPatientForCarer.mockReset();
    getLinkedPatientForCarer.mockResolvedValue({ data: null, error: null });
  });

  it("restores community mode from cloud profile after login", async () => {
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

    const { restoreAccountSessionFromCloud } = await import("@/lib/account-session-restore");
    const { getPrimaryAppRole, getOnboardingAccountPath, getActiveAppMode } = await import(
      "@/lib/carer-session"
    );

    await restoreAccountSessionFromCloud("u1");
    expect(getPrimaryAppRole()).toBe("community");
    expect(getOnboardingAccountPath()).toBe("community");
    expect(getActiveAppMode()).toBe("community");
  });

  it("restores patient mode from cloud profile after login", async () => {
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

    const { restoreAccountSessionFromCloud } = await import("@/lib/account-session-restore");
    const { getPrimaryAppRole, getOnboardingAccountPath } = await import("@/lib/carer-session");

    await restoreAccountSessionFromCloud("u1");
    expect(getPrimaryAppRole()).toBe("patient");
    expect(getOnboardingAccountPath()).toBe("patient");
  });

  it("does not keep the previous account's welcome path after logout", async () => {
    const { setOnboardingAccountPath, setPrimaryAppRole, clearCarerClientSessionKeys } = await import(
      "@/lib/carer-session"
    );
    setOnboardingAccountPath("community");
    setPrimaryAppRole("community");
    localStorage.setItem("diabeater_onboarding_account_path_v1", "community");

    clearCarerClientSessionKeys();

    getProfile.mockResolvedValue({
      profile: {
        id: "u2",
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

    const { restoreAccountSessionFromCloud } = await import("@/lib/account-session-restore");
    const { getPrimaryAppRole, getOnboardingAccountPath } = await import("@/lib/carer-session");

    await restoreAccountSessionFromCloud("u2");
    expect(getPrimaryAppRole()).toBe("patient");
    expect(getOnboardingAccountPath()).toBe("patient");
  });
});
