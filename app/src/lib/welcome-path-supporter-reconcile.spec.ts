import { beforeEach, describe, expect, it, vi } from "vitest";

const getProfile = vi.fn();
const getLinkedPatientForCarer = vi.fn();

vi.mock("@/lib/profile", () => ({
  getProfile: (...args: unknown[]) => getProfile(...args),
}));

vi.mock("@/lib/carers", () => ({
  getLinkedPatientForCarer: () => getLinkedPatientForCarer(),
}));

describe("welcome-path-supporter-reconcile", () => {
  beforeEach(() => {
    vi.resetModules();
    sessionStorage.clear();
    localStorage.clear();
    getProfile.mockReset();
    getLinkedPatientForCarer.mockReset();
    getLinkedPatientForCarer.mockResolvedValue({ data: null, error: null });
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
      },
    });
  });

  it("reconciles linked supporters who tapped the User welcome path", async () => {
    const { setOnboardingAccountPath } = await import("@/lib/carer-session");
    setOnboardingAccountPath("supporter");
    setOnboardingAccountPath("patient");

    getLinkedPatientForCarer.mockResolvedValue({
      data: { linkId: "l1", patientId: "p1", carerId: "u1", scopes: {} },
      error: null,
    });

    const { reconcileSupporterWelcomeWithExistingAccount } = await import(
      "@/lib/welcome-path-supporter-reconcile"
    );
    const { getPrimaryAppRole, getOnboardingAccountPath, hasPendingCarer } = await import(
      "@/lib/carer-session"
    );

    const result = await reconcileSupporterWelcomeWithExistingAccount("u1");
    expect(result.reconciled).toBe(true);
    if (!result.reconciled) return;
    expect(result.destination).toBe("/carer-view");
    expect(getPrimaryAppRole()).toBe("carer");
    expect(getOnboardingAccountPath()).toBe("supporter");
    expect(hasPendingCarer()).toBe(true);
  });

  it("reconciles unlinked persisted supporters on the Community welcome path", async () => {
    const { markPersistedSupporterAccount } = await import("@/lib/carer-session");
    markPersistedSupporterAccount();
    const { setOnboardingAccountPath } = await import("@/lib/carer-session");
    setOnboardingAccountPath("community");

    const { reconcileSupporterWelcomeWithExistingAccount } = await import(
      "@/lib/welcome-path-supporter-reconcile"
    );

    const result = await reconcileSupporterWelcomeWithExistingAccount("u1");
    expect(result.reconciled).toBe(true);
    if (!result.reconciled) return;
    expect(result.destination).toBe("/carer-setup");
    expect(result.toast.title).toContain("supporter account");
  });

  it("does not reconcile dual-role patients who also support someone", async () => {
    const { setOnboardingAccountPath } = await import("@/lib/carer-session");
    setOnboardingAccountPath("patient");
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

    const { reconcileSupporterWelcomeWithExistingAccount } = await import(
      "@/lib/welcome-path-supporter-reconcile"
    );

    const result = await reconcileSupporterWelcomeWithExistingAccount("u1");
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

    const { reconcileSupporterWelcomeWithExistingAccount } = await import(
      "@/lib/welcome-path-supporter-reconcile"
    );

    const result = await reconcileSupporterWelcomeWithExistingAccount("u1");
    expect(result.reconciled).toBe(false);
  });
});
