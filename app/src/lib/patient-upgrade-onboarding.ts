import type { OnboardingAccountPath } from "@/lib/carer-session";

export function isPatientUpgradeOnboarding(search: string): boolean {
  return new URLSearchParams(search).get("upgrade") === "1";
}

/**
 * After clinical upgrade onboarding, community members become patients;
 * supporters (who keep their carer link) become dual-role.
 */
export function resolveAccountPathAfterPatientUpgrade(input: {
  previousPath: OnboardingAccountPath | null;
  hadSupporterMarkers: boolean;
}): "patient" | "both" {
  if (
    input.previousPath === "supporter" ||
    input.previousPath === "both" ||
    input.hadSupporterMarkers
  ) {
    return "both";
  }
  return "patient";
}
