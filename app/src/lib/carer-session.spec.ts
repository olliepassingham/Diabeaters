import { beforeEach, describe, expect, it } from "vitest";
import {
  canSwitchAppMode,
  clearCarerClientSessionKeys,
  getPrimaryAppRole,
  isCarerSessionMode,
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
});
