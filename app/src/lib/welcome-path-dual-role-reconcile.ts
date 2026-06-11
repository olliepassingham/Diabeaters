import { getLinkedPatientForCarer } from "@/lib/carers";
import {
  clearPersistedSupporterAccount,
  getOnboardingAccountPath,
  isSupporterOnlyAccount,
  setActiveAppMode,
  setOnboardingAccountPath,
  setPrimaryAppRole,
} from "@/lib/carer-session";
import {
  isCommunityWelcomePathChosen,
  profileIndicatesExistingPatientAccount,
} from "@/lib/community-path-patient-reconcile";
import { getProfile } from "@/lib/profile";
import { isUserWelcomePathChosen } from "@/lib/welcome-path-supporter-reconcile";

/** Patient + linked supporter: keep User markers and clear mistaken supporter-only flags. */
export function restoreDualRolePatientSessionMarkers(): void {
  const path = getOnboardingAccountPath();
  setOnboardingAccountPath(path === "both" ? "both" : "patient");
  setPrimaryAppRole("patient");
  setActiveAppMode("patient");
  clearPersistedSupporterAccount();
}

async function isDualRolePatientSupporter(userId: string): Promise<boolean> {
  const link = await getLinkedPatientForCarer();
  if (!link.data) return false;
  const { profile } = await getProfile(userId);
  return profileIndicatesExistingPatientAccount(profile);
}

/** Undo supporter-only markers wrongly applied to a dual-role patient account. */
export async function repairDualRoleMarkersIfCorrupted(userId: string): Promise<void> {
  if (!userId.trim() || !isSupporterOnlyAccount()) return;
  if (!isUserWelcomePathChosen() && !isCommunityWelcomePathChosen()) return;
  if (!(await isDualRolePatientSupporter(userId))) return;
  restoreDualRolePatientSessionMarkers();
}

/**
 * Dual-role accounts logging in via User path must land in User mode — not supporter-only reconcile.
 */
export async function healDualRolePatientSessionIfNeeded(
  userId: string,
): Promise<{ healed: boolean }> {
  if (!userId.trim() || !isUserWelcomePathChosen()) {
    return { healed: false };
  }
  if (!(await isDualRolePatientSupporter(userId))) {
    return { healed: false };
  }
  restoreDualRolePatientSessionMarkers();
  return { healed: true };
}
