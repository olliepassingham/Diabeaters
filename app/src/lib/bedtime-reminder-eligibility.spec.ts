import { beforeEach, describe, expect, it } from "vitest";

import {
  cacheCloudPrimaryAppRole,
  clearActiveAppMode,
  clearCarerClientSessionKeys,
  setActiveAppMode,
  setOnboardingAccountPath,
  setPrimaryAppRole,
} from "@/lib/carer-session";
import { shouldReceiveBedtimeCheckReminders } from "@/lib/bedtime-reminder-eligibility";
import { storage } from "@/lib/storage";

describe("shouldReceiveBedtimeCheckReminders", () => {
  beforeEach(() => {
    clearCarerClientSessionKeys();
    clearActiveAppMode();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("allows User Mode patients", () => {
    setOnboardingAccountPath("patient");
    setPrimaryAppRole("patient");
    setActiveAppMode("patient");
    expect(shouldReceiveBedtimeCheckReminders()).toBe(true);
  });

  it("blocks supporter-only accounts even without a link", () => {
    setOnboardingAccountPath("supporter");
    setPrimaryAppRole("carer");
    expect(shouldReceiveBedtimeCheckReminders()).toBe(false);
  });

  it("blocks supporter-only accounts when cloud primary role is patient", () => {
    setOnboardingAccountPath("supporter");
    cacheCloudPrimaryAppRole("patient");
    expect(shouldReceiveBedtimeCheckReminders()).toBe(false);
  });

  it("blocks dual-role users in Supporter Mode", () => {
    setOnboardingAccountPath("both");
    setPrimaryAppRole("patient");
    setActiveAppMode("carer");
    expect(shouldReceiveBedtimeCheckReminders({ hasCarerLink: true })).toBe(false);
  });

  it("allows dual-role users in User Mode", () => {
    setOnboardingAccountPath("both");
    setPrimaryAppRole("patient");
    setActiveAppMode("patient");
    expect(shouldReceiveBedtimeCheckReminders({ hasCarerLink: true })).toBe(true);
  });

  it("blocks community-only accounts", () => {
    setOnboardingAccountPath("community");
    setPrimaryAppRole("community");
    setActiveAppMode("community");
    expect(shouldReceiveBedtimeCheckReminders()).toBe(false);
  });

  it("blocks community session mode from profile", () => {
    setOnboardingAccountPath("patient");
    setPrimaryAppRole("patient");
    storage.saveProfile({ accountType: "community" });
    expect(shouldReceiveBedtimeCheckReminders()).toBe(false);
  });

  it("blocks when active mode is community even with patient onboarding path", () => {
    setOnboardingAccountPath("patient");
    setPrimaryAppRole("patient");
    setActiveAppMode("community");
    expect(shouldReceiveBedtimeCheckReminders()).toBe(false);
  });

  it("blocks when cloud profile is community", () => {
    setOnboardingAccountPath("patient");
    setPrimaryAppRole("patient");
    expect(shouldReceiveBedtimeCheckReminders({ cloudCommunityProfile: true })).toBe(false);
  });

  it("blocks ambiguous sessions without a clear User Mode marker", () => {
    expect(shouldReceiveBedtimeCheckReminders()).toBe(false);
  });

  it("allows patient path when session mode is unset", () => {
    setOnboardingAccountPath("patient");
    setPrimaryAppRole("patient");
    expect(shouldReceiveBedtimeCheckReminders()).toBe(true);
  });
});
