import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProfileRow } from "@/lib/profile";

const getProfile = vi.fn();
const getLinkedPatientForCarer = vi.fn();
const updateProfile = vi.fn();

vi.mock("@/lib/profile", () => ({
  getProfile: (...args: unknown[]) => getProfile(...args),
  updateProfile: (...args: unknown[]) => updateProfile(...args),
}));

vi.mock("@/lib/carers", () => ({
  getLinkedPatientForCarer: () => getLinkedPatientForCarer(),
}));

function supporterProfile(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: "u1",
    full_name: "Sup",
    avatar_url: null,
    bio: null,
    public_handle: null,
    is_public: false,
    onboarding_complete: false,
    primary_app_role: "carer",
    ...overrides,
  };
}

describe("profile-primary-role", () => {
  beforeEach(() => {
    vi.resetModules();
    sessionStorage.clear();
    localStorage.clear();
    getProfile.mockReset();
    getLinkedPatientForCarer.mockReset();
    updateProfile.mockReset();
    updateProfile.mockResolvedValue({ data: null, error: null });
    getLinkedPatientForCarer.mockResolvedValue({
      data: { linkId: "l1", patientId: "p1", carerId: "u1", scopes: {} },
      error: null,
    });
  });

  it("resolveSupporterOnlyAccount trusts cloud carer role without local markers", async () => {
    const { resolveSupporterOnlyAccount } = await import("@/lib/profile-primary-role");
    expect(
      resolveSupporterOnlyAccount({
        profile: supporterProfile(),
        hasCarerLink: true,
        localIsSupporterOnly: false,
      }),
    ).toBe(true);
  });

  it("resolveSupporterOnlyAccount rejects cloud patient role even with a carer link", async () => {
    const { resolveSupporterOnlyAccount } = await import("@/lib/profile-primary-role");
    expect(
      resolveSupporterOnlyAccount({
        profile: supporterProfile({ primary_app_role: "patient", onboarding_complete: true }),
        hasCarerLink: true,
        localIsSupporterOnly: false,
      }),
    ).toBe(false);
  });

  it("reconcileSupporterSessionFromCloudProfile routes linked supporters on a fresh device", async () => {
    getProfile.mockResolvedValue({ profile: supporterProfile() });

    const { reconcileSupporterSessionFromCloudProfile } = await import("@/lib/profile-primary-role");
    const { isSupporterOnlyAccount, getOnboardingAccountPath } = await import("@/lib/carer-session");

    const result = await reconcileSupporterSessionFromCloudProfile("u1");
    expect(result).toEqual({ reconciled: true, destination: "/carer-view" });
    expect(isSupporterOnlyAccount()).toBe(true);
    expect(getOnboardingAccountPath()).toBe("supporter");
  });

  it("finalizeSupporterLinkCloudSync keeps patient dual-role accounts on patient in cloud", async () => {
    const { setOnboardingAccountPath, setPrimaryAppRole } = await import("@/lib/carer-session");
    setOnboardingAccountPath("patient");
    setPrimaryAppRole("patient");

    const { finalizeSupporterLinkCloudSync } = await import("@/lib/profile-primary-role");
    await finalizeSupporterLinkCloudSync("u1");

    expect(updateProfile).toHaveBeenCalledWith({ id: "u1", primary_app_role: "patient" });
  });
});
