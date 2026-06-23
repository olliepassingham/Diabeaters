import { describe, expect, it } from "vitest";

import { isPatientUpgradeOnboarding } from "@/lib/patient-upgrade-onboarding";

describe("patient upgrade onboarding", () => {
  it("detects community upgrade to patient onboarding", () => {
    expect(isPatientUpgradeOnboarding("?upgrade=1")).toBe(true);
    expect(isPatientUpgradeOnboarding("")).toBe(false);
  });
});
