import { beforeEach, describe, expect, it, vi } from "vitest";

const getProfile = vi.fn();
const getLinkedPatientForCarer = vi.fn();

vi.mock("@/lib/profile", () => ({
  getProfile: (...args: unknown[]) => getProfile(...args),
}));

vi.mock("@/lib/carers", () => ({
  getLinkedPatientForCarer: () => getLinkedPatientForCarer(),
}));

describe("welcome-path-dual-role-reconcile", () => {
  beforeEach(() => {
    vi.resetModules();
    sessionStorage.clear();
    localStorage.clear();
    getProfile.mockReset();
    getLinkedPatientForCarer.mockReset();
  });

  it("heals dual-role sessions on the User welcome path", async () => {
    const { setOnboardingAccountPath, setPrimaryAppRole, markPersistedSupporterAccount } = await import(
      "@/lib/carer-session"
    );
    setOnboardingAccountPath("patient");
    setPrimaryAppRole("patient");
    markPersistedSupporterAccount();

    getLinkedPatientForCarer.mockResolvedValue({
      data: { linkId: "l1", patientId: "p1", carerId: "u1", scopes: {} },
      error: null,
    });
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

    const { healDualRolePatientSessionIfNeeded } = await import("@/lib/welcome-path-dual-role-reconcile");
    const { getOnboardingAccountPath, isPersistedSupporterAccount } = await import("@/lib/carer-session");

    const result = await healDualRolePatientSessionIfNeeded("u1");
    expect(result.healed).toBe(true);
    expect(getOnboardingAccountPath()).toBe("patient");
    expect(isPersistedSupporterAccount()).toBe(false);
  });
});
