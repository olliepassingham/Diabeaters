import { beforeEach, describe, expect, it } from "vitest";

import {
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
});
