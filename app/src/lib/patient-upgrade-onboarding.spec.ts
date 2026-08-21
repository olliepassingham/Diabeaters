import { describe, expect, it } from "vitest";

import {
  isPatientUpgradeOnboarding,
  resolveAccountPathAfterPatientUpgrade,
} from "@/lib/patient-upgrade-onboarding";

describe("patient upgrade onboarding", () => {
  it("detects upgrade to patient onboarding", () => {
    expect(isPatientUpgradeOnboarding("?upgrade=1")).toBe(true);
    expect(isPatientUpgradeOnboarding("")).toBe(false);
  });

  it("keeps community upgrades on the patient path", () => {
    expect(
      resolveAccountPathAfterPatientUpgrade({
        previousPath: "community",
        hadSupporterMarkers: false,
      }),
    ).toBe("patient");
  });

  it("promotes supporter upgrades to dual-role", () => {
    expect(
      resolveAccountPathAfterPatientUpgrade({
        previousPath: "supporter",
        hadSupporterMarkers: false,
      }),
    ).toBe("both");
    expect(
      resolveAccountPathAfterPatientUpgrade({
        previousPath: null,
        hadSupporterMarkers: true,
      }),
    ).toBe("both");
    expect(
      resolveAccountPathAfterPatientUpgrade({
        previousPath: "both",
        hadSupporterMarkers: false,
      }),
    ).toBe("both");
  });
});
