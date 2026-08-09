import { beforeEach, describe, expect, it } from "vitest";
import { storage } from "@/lib/storage";
import {
  applyActiveCarerPatientFromNotification,
  applySupporterAccountRoleAfterLink,
  getActiveCarerPatientId,
  setActiveCarerPatientId,
  cacheCloudPrimaryAppRole,
  canSwitchAppMode,
  clearCarerClientSessionKeys,
  getPrimaryAppRole,
  isCarerSessionMode,
  isCommunityMemberAccount,
  isCommunityOnlyAccount,
  isCommunitySessionMode,
  isPersistedCommunityAccount,
  isPersistedSupporterAccount,
  isSupporterOnlyAccount,
  onboardingAccountPathFromUserMetadata,
  setOnboardingAccountPath,
  setPrimaryAppRole,
  getOnboardingAccountPath,
} from "@/lib/carer-session";

describe("carer-session supporter-only accounts", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("treats onboarding supporter path as supporter-only", () => {
    setOnboardingAccountPath("supporter");
    expect(isSupporterOnlyAccount()).toBe(true);
    expect(canSwitchAppMode()).toBe(false);
    expect(isCarerSessionMode(true, "patient")).toBe(true);
  });

  it("persists supporter account marker when onboarding path is supporter", () => {
    setOnboardingAccountPath("supporter");
    expect(isPersistedSupporterAccount()).toBe(true);
  });

  it("persists community account marker when onboarding path is community", () => {
    setOnboardingAccountPath("community");
    expect(isPersistedCommunityAccount()).toBe(true);
  });

  it("allows mode switching for patient onboarding with a carer link", () => {
    setOnboardingAccountPath("patient");
    setPrimaryAppRole("patient");
    expect(isSupporterOnlyAccount()).toBe(false);
    expect(canSwitchAppMode()).toBe(true);
    expect(isCarerSessionMode(true, "patient")).toBe(false);
    expect(isCarerSessionMode(true, "carer")).toBe(true);
  });

  it("clears session role markers on logout", () => {
    setPrimaryAppRole("carer");
    setOnboardingAccountPath("supporter");
    clearCarerClientSessionKeys();
    expect(getPrimaryAppRole()).toBeNull();
    expect(getOnboardingAccountPath()).toBeNull();
    expect(isSupporterOnlyAccount()).toBe(false);
  });

  it("treats onboarding supporter path as supporter-only even when cloud role is patient", () => {
    setOnboardingAccountPath("supporter");
    cacheCloudPrimaryAppRole("patient");
    expect(isSupporterOnlyAccount()).toBe(true);
    expect(canSwitchAppMode()).toBe(false);
    expect(isCarerSessionMode(true, "patient")).toBe(true);
  });
});

describe("carer-session community-only accounts", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("treats onboarding community path as community-only", () => {
    setOnboardingAccountPath("community");
    expect(isCommunityOnlyAccount()).toBe(true);
    expect(isCommunitySessionMode(false, "patient")).toBe(true);
    expect(isCommunitySessionMode(true, "community")).toBe(false);
  });

  it("does not treat patient onboarding as community-only", () => {
    setOnboardingAccountPath("patient");
    setPrimaryAppRole("patient");
    expect(isCommunityOnlyAccount()).toBe(false);
    expect(isCommunitySessionMode(false, null)).toBe(false);
    expect(isCommunitySessionMode(false, "community")).toBe(true);
  });

  it("clears community session markers on logout", () => {
    setPrimaryAppRole("community");
    setOnboardingAccountPath("community");
    clearCarerClientSessionKeys();
    expect(getPrimaryAppRole()).toBeNull();
    expect(isCommunityOnlyAccount()).toBe(false);
    expect(isCommunitySessionMode(false, null)).toBe(false);
  });

  it("clears device-global role markers on logout so the next account is not affected", () => {
    setPrimaryAppRole("community");
    setOnboardingAccountPath("community");
    localStorage.setItem("diabeater_primary_app_role_v1", "community");
    localStorage.setItem("diabeater_onboarding_account_path_v1", "community");
    localStorage.setItem("diabeater_community_account_v1", "1");
    clearCarerClientSessionKeys();
    expect(localStorage.getItem("diabeater_primary_app_role_v1")).toBeNull();
    expect(localStorage.getItem("diabeater_onboarding_account_path_v1")).toBeNull();
    expect(localStorage.getItem("diabeater_community_account_v1")).toBeNull();
    expect(getPrimaryAppRole()).toBeNull();
  });

  it("converts community members to supporter-only after linking", () => {
    setOnboardingAccountPath("community");
    setPrimaryAppRole("community");
    expect(isCommunityMemberAccount()).toBe(true);
    expect(isPersistedCommunityAccount()).toBe(true);

    applySupporterAccountRoleAfterLink();

    expect(isPersistedCommunityAccount()).toBe(false);
    expect(isCommunityOnlyAccount()).toBe(false);
    expect(isCommunityMemberAccount()).toBe(false);
    expect(isSupporterOnlyAccount()).toBe(true);
    expect(canSwitchAppMode()).toBe(false);
    expect(isCarerSessionMode(true, "patient")).toBe(true);
  });

  it("does not overwrite patient dual-role accounts when linking", () => {
    setOnboardingAccountPath("patient");
    setPrimaryAppRole("patient");

    applySupporterAccountRoleAfterLink();

    expect(getPrimaryAppRole()).toBe("patient");
    expect(getOnboardingAccountPath()).toBe("both");
    expect(isSupporterOnlyAccount()).toBe(false);
    expect(canSwitchAppMode()).toBe(true);
  });

  it("promotes local patient accounts to dual-role when linking without welcome path", () => {
    localStorage.setItem("diabeater_onboarding_completed", "true");
    storage.saveProfile({
      name: "Pat",
      email: "",
      bgUnits: "mmol/L",
      carbUnits: "grams",
      diabetesType: "type1",
      insulinDeliveryMethod: "pen",
      usingInsulin: true,
      hasAcceptedDisclaimer: true,
      dateOfBirth: "2000-01-01",
      region: "UK",
      weightDisplayUnit: "kg",
    });

    applySupporterAccountRoleAfterLink();

    expect(getPrimaryAppRole()).toBe("patient");
    expect(getOnboardingAccountPath()).toBe("both");
    expect(isSupporterOnlyAccount()).toBe(false);
  });

  it("stays dual-role when cloud role was wrongly set to carer", () => {
    setOnboardingAccountPath("patient");
    setPrimaryAppRole("patient");
    cacheCloudPrimaryAppRole("carer");

    expect(isSupporterOnlyAccount()).toBe(false);
    expect(canSwitchAppMode()).toBe(true);
    expect(isCarerSessionMode(true, "patient")).toBe(false);
    expect(isCarerSessionMode(true, "carer")).toBe(true);
  });
});

describe("onboardingAccountPathFromUserMetadata", () => {
  it("reads a valid onboarding_account_path from user_metadata", () => {
    expect(
      onboardingAccountPathFromUserMetadata({ user_metadata: { onboarding_account_path: "community" } }),
    ).toBe("community");
  });

  it("returns null for missing, unrecognised, or absent metadata", () => {
    expect(onboardingAccountPathFromUserMetadata(null)).toBeNull();
    expect(onboardingAccountPathFromUserMetadata({ user_metadata: {} })).toBeNull();
    expect(
      onboardingAccountPathFromUserMetadata({ user_metadata: { onboarding_account_path: "not-a-path" } }),
    ).toBeNull();
  });
});

describe("applyActiveCarerPatientFromNotification", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("selects the alerting patient for supporter-mode deep links", () => {
    setActiveCarerPatientId("patient-a");
    applyActiveCarerPatientFromNotification(
      { kind: "live_glucose_check_in", patient_user_id: "patient-b" },
      "/carer-view/glucose",
    );
    expect(getActiveCarerPatientId()).toBe("patient-b");
  });

  it("ignores notifications without a supporter-mode path", () => {
    setActiveCarerPatientId("patient-a");
    applyActiveCarerPatientFromNotification({ patient_user_id: "patient-b" }, "/tools/hypo-history");
    expect(getActiveCarerPatientId()).toBe("patient-a");
  });

  it("ignores notifications without a patient id", () => {
    setActiveCarerPatientId("patient-a");
    applyActiveCarerPatientFromNotification({ kind: "hypo_logged" }, "/carer-view");
    expect(getActiveCarerPatientId()).toBe("patient-a");
  });

  it("dispatches a change event when the active patient changes", () => {
    let fired = 0;
    const onChange = () => {
      fired += 1;
    };
    window.addEventListener("diabeater:carer-active-patient", onChange);
    try {
      setActiveCarerPatientId("patient-a");
      setActiveCarerPatientId("patient-a");
      setActiveCarerPatientId("patient-b");
      expect(fired).toBe(2);
    } finally {
      window.removeEventListener("diabeater:carer-active-patient", onChange);
    }
  });
});
