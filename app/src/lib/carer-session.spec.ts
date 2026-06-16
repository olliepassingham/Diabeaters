import { beforeEach, describe, expect, it } from "vitest";
import {
  applySupporterAccountRoleAfterLink,
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
  setOnboardingAccountPath,
  setPrimaryAppRole,
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

  it("restores primary role from localStorage after session clears", () => {
    setPrimaryAppRole("carer");
    setOnboardingAccountPath("supporter");
    clearCarerClientSessionKeys();
    expect(getPrimaryAppRole()).toBe("carer");
    expect(isSupporterOnlyAccount()).toBe(true);
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

  it("restores community role from localStorage after session clears", () => {
    setPrimaryAppRole("community");
    setOnboardingAccountPath("community");
    clearCarerClientSessionKeys();
    expect(getPrimaryAppRole()).toBe("community");
    expect(isCommunityOnlyAccount()).toBe(true);
    expect(isCommunitySessionMode(false, null)).toBe(true);
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
    expect(isSupporterOnlyAccount()).toBe(false);
    expect(canSwitchAppMode()).toBe(true);
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
