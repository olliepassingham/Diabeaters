import { beforeEach, describe, expect, it, vi } from "vitest";

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

type AccountKind = "patient" | "patient-dual" | "community" | "supporter-linked" | "supporter-unlinked";
type WelcomePath = "user" | "community" | "supporter";

const patientProfile = {
  id: "u1",
  full_name: "Pat",
  avatar_url: null,
  bio: null,
  public_handle: null,
  is_public: false,
  onboarding_complete: true,
  account_type: "patient" as const,
};

const communityProfile = {
  ...patientProfile,
  full_name: "Sam",
  account_type: "community" as const,
};

const carerLink = {
  data: { linkId: "l1", patientId: "p1", carerId: "u1", scopes: {} },
  error: null,
};

function mockAccount(kind: AccountKind): void {
  getLinkedPatientForCarer.mockResolvedValue(
    kind === "supporter-linked" || kind === "patient-dual" ? carerLink : { data: null, error: null },
  );

  if (kind === "patient" || kind === "patient-dual") {
    getProfile.mockResolvedValue({
      profile: {
        ...patientProfile,
        primary_app_role: "patient" as const,
      },
    });
    localStorage.setItem("diabeater_onboarding_completed", "true");
    return;
  }

  if (kind === "community") {
    getProfile.mockResolvedValue({
      profile: { ...communityProfile, primary_app_role: "community" as const },
    });
    return;
  }

  getProfile.mockResolvedValue({
    profile: {
      id: "u1",
      full_name: "Sup",
      avatar_url: null,
      bio: null,
      public_handle: null,
      is_public: false,
      onboarding_complete: false,
      account_type: null,
      primary_app_role: "carer",
    },
  });
}

async function setWelcomePath(path: WelcomePath): Promise<void> {
  const {
    clearOnboardingAccountPath,
    setOnboardingAccountPath,
    setPendingCarer,
    setPendingCommunity,
    setPendingPatient,
    setPrimaryAppRole,
  } = await import("@/lib/carer-session");

  clearOnboardingAccountPath();
  if (path === "user") {
    setOnboardingAccountPath("patient");
    setPrimaryAppRole("patient");
    setPendingPatient();
    return;
  }
  if (path === "community") {
    setOnboardingAccountPath("community");
    setPrimaryAppRole("community");
    setPendingCommunity();
    return;
  }
  setOnboardingAccountPath("supporter");
  setPrimaryAppRole("carer");
  setPendingCarer();
}

async function seedAccountKind(kind: AccountKind): Promise<void> {
  const {
    markPersistedCommunityAccount,
    markPersistedSupporterAccount,
    setOnboardingAccountPath,
    setPrimaryAppRole,
  } = await import("@/lib/carer-session");

  if (kind === "patient" || kind === "patient-dual") {
    setOnboardingAccountPath("patient");
    setPrimaryAppRole("patient");
    if (kind === "patient-dual") {
      markPersistedSupporterAccount();
    }
    return;
  }
  if (kind === "community") {
    setOnboardingAccountPath("community");
    setPrimaryAppRole("community");
    markPersistedCommunityAccount();
    return;
  }
  setOnboardingAccountPath("supporter");
  setPrimaryAppRole("carer");
  markPersistedSupporterAccount();
}

async function runReconcile(): Promise<{ reconciled: boolean; destination?: string }> {
  const { reconcileWrongWelcomePathForSignedInUser } = await import("@/lib/welcome-path-reconcile");
  return reconcileWrongWelcomePathForSignedInUser("u1");
}

/** Mirrors post-login navigation without pulling in `react-dom` (Vitest env). */
async function runNavigateAfterReconcile(): Promise<string> {
  const destinations: string[] = [];
  const setLocation = (path: string) => {
    destinations.push(path);
  };
  const userId = "u1";

  const wrongPath = await runReconcile();
  if (wrongPath.reconciled && wrongPath.destination) {
    const { setActiveAppMode } = await import("@/lib/carer-session");
    const dest = wrongPath.destination;
    if (dest === "/carer-view" || dest === "/carer-setup") setActiveAppMode("carer");
    else if (dest === "/") setActiveAppMode("patient");
    else setActiveAppMode("community");
    setLocation(dest);
    return destinations[0] ?? "";
  }

  const { getLinkedPatientForCarer } = await import("@/lib/carers");
  const {
    getPrimaryAppRole,
    hasCarerIntent,
    hasPendingCarer,
    isCommunityOnlyAccount,
    isSupporterOnlyAccount,
    setActiveAppMode,
    cacheCloudPrimaryAppRoleFromProfile,
  } = await import("@/lib/carer-session");
  const { getCommunityMemberLandingPath } = await import("@/lib/community-landing");
  const { getProfile } = await import("@/lib/profile");
  const { resolveSupporterOnlyAccount } = await import("@/lib/profile-primary-role");

  const link = await getLinkedPatientForCarer();
  if (link.data) {
    const { profile } = await getProfile(userId);
    if (profile) cacheCloudPrimaryAppRoleFromProfile(profile);
    const supporterOnly = resolveSupporterOnlyAccount({
      profile,
      hasCarerLink: true,
      localIsSupporterOnly: isSupporterOnlyAccount(),
    });
    if (supporterOnly || getPrimaryAppRole() === "carer") {
      setActiveAppMode("carer");
      setLocation("/carer-view");
      return destinations[0] ?? "";
    }
    setActiveAppMode("patient");
    setLocation("/");
    return destinations[0] ?? "";
  }
  if (hasCarerIntent() || hasPendingCarer()) {
    setLocation("/carer-setup");
    return destinations[0] ?? "";
  }
  const role = getPrimaryAppRole();
  if (role === null) {
    setLocation("/welcome");
    return destinations[0] ?? "";
  }
  if (isCommunityOnlyAccount() || role === "community") {
    setActiveAppMode("community");
    setLocation(getCommunityMemberLandingPath());
    return destinations[0] ?? "";
  }
  setLocation("/");
  return destinations[0] ?? "";
}

describe("welcome path matrix — wrong-path login behaviour", () => {
  beforeEach(() => {
    vi.resetModules();
    sessionStorage.clear();
    localStorage.clear();
    getProfile.mockReset();
    getLinkedPatientForCarer.mockReset();
    updateProfile.mockReset();
    updateProfile.mockResolvedValue({ data: null, error: null });
  });

  const cases: Array<{
    account: AccountKind;
    welcome: WelcomePath;
    label: string;
    expectReconcile: boolean;
    expectedDestination: string;
    expectedToast?: string;
  }> = [
    // Patient (User) account
    {
      account: "patient",
      welcome: "user",
      label: "Patient → User (correct path)",
      expectReconcile: false,
      expectedDestination: "/",
    },
    {
      account: "patient",
      welcome: "community",
      label: "Patient → Community",
      expectReconcile: true,
      expectedDestination: "/",
      expectedToast: "Already have a full account",
    },
    {
      account: "patient",
      welcome: "supporter",
      label: "Patient → Supporter",
      expectReconcile: false,
      expectedDestination: "/carer-setup",
    },

    // Dual-role: Type 1 user who also supports someone (linked)
    {
      account: "patient-dual",
      welcome: "user",
      label: "Dual role (patient + supporter) → User",
      expectReconcile: true,
      expectedDestination: "/",
    },
    {
      account: "patient-dual",
      welcome: "community",
      label: "Dual role (patient + supporter) → Community",
      expectReconcile: true,
      expectedDestination: "/",
      expectedToast: "Already have a full account",
    },
    {
      account: "patient-dual",
      welcome: "supporter",
      label: "Dual role (patient + supporter) → Supporter",
      expectReconcile: false,
      expectedDestination: "/carer-view",
    },

    // Community Member account
    {
      account: "community",
      welcome: "user",
      label: "Community → User",
      expectReconcile: true,
      expectedDestination: "/community",
      expectedToast: "Community Member account",
    },
    {
      account: "community",
      welcome: "community",
      label: "Community → Community (correct path)",
      expectReconcile: false,
      expectedDestination: "/community",
    },
    {
      account: "community",
      welcome: "supporter",
      label: "Community → Supporter (upgrade path)",
      expectReconcile: false,
      expectedDestination: "/carer-setup",
    },

    // Supporter account (linked)
    {
      account: "supporter-linked",
      welcome: "user",
      label: "Supporter (linked) → User",
      expectReconcile: true,
      expectedDestination: "/carer-view",
      expectedToast: "supporter account",
    },
    {
      account: "supporter-linked",
      welcome: "community",
      label: "Supporter (linked) → Community",
      expectReconcile: true,
      expectedDestination: "/carer-view",
      expectedToast: "supporter account",
    },
    {
      account: "supporter-linked",
      welcome: "supporter",
      label: "Supporter (linked) → Supporter (correct path)",
      expectReconcile: false,
      expectedDestination: "/carer-view",
    },

    // Supporter account (not linked yet)
    {
      account: "supporter-unlinked",
      welcome: "user",
      label: "Supporter (unlinked) → User",
      expectReconcile: true,
      expectedDestination: "/carer-setup",
      expectedToast: "supporter account",
    },
    {
      account: "supporter-unlinked",
      welcome: "community",
      label: "Supporter (unlinked) → Community",
      expectReconcile: true,
      expectedDestination: "/carer-setup",
      expectedToast: "supporter account",
    },
    {
      account: "supporter-unlinked",
      welcome: "supporter",
      label: "Supporter (unlinked) → Supporter (correct path)",
      expectReconcile: false,
      expectedDestination: "/carer-setup",
    },
  ];

  it.each(cases)("$label", async (tc) => {
    await seedAccountKind(tc.account);
    mockAccount(tc.account === "patient-dual" ? "patient-dual" : tc.account);
    await setWelcomePath(tc.welcome);

    const reconcile = await runReconcile();
    expect(reconcile.reconciled).toBe(tc.expectReconcile);

    if (tc.expectReconcile) {
      expect(reconcile.destination).toBe(tc.expectedDestination);
      if (tc.expectedToast) {
        const { consumePostLoginToast } = await import("@/lib/post-login-toast-stash");
        const toast = consumePostLoginToast();
        expect(toast?.title).toContain(tc.expectedToast);
      }
    }

    vi.resetModules();
    await seedAccountKind(tc.account);
    mockAccount(tc.account);
    await setWelcomePath(tc.welcome);
    if (tc.expectReconcile) {
      await runReconcile();
    }

    const landed = await runNavigateAfterReconcile();
    expect(landed).toBe(tc.expectedDestination);
  });
});
