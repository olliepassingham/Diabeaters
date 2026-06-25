import { getLinkedPatientForCarer } from "@/lib/carers";
import {
  clearPersistedSupporterAccount,
  cacheCloudPrimaryAppRole,
  getOnboardingAccountPath,
  getPrimaryAppRole,
  isPersistedSupporterAccount,
  isSupporterOnlyAccount,
  setActiveAppMode,
  setOnboardingAccountPath,
  setPrimaryAppRole,
} from "@/lib/carer-session";
import { localIndicatesPatientAccount, profileIndicatesExistingPatientAccount } from "@/lib/community-path-patient-reconcile";
import { getProfile } from "@/lib/profile";
import { cloudPrimaryAppRoleFromProfile, syncPrimaryAppRoleToCloud } from "@/lib/profile-primary-role";

/** Patient + linked supporter: keep User markers and clear mistaken supporter-only flags. */
export function restoreDualRolePatientSessionMarkers(): void {
  setOnboardingAccountPath("both");
  setPrimaryAppRole("patient");
  setActiveAppMode("patient");
  clearPersistedSupporterAccount();
  cacheCloudPrimaryAppRole("patient");
}

async function isDualRolePatientSupporter(userId: string): Promise<boolean> {
  const link = await getLinkedPatientForCarer();
  if (!link.data) return false;
  const { profile } = await getProfile(userId);
  /** Cloud `carer` is authoritative supporter-only — do not heal back to dual-role patient. */
  if (cloudPrimaryAppRoleFromProfile(profile) === "carer") return false;
  if (localIndicatesPatientAccount()) return true;
  const path = getOnboardingAccountPath();
  if (path === "patient" || path === "both") return true;
  if (profileIndicatesExistingPatientAccount(profile)) return true;
  if (cloudPrimaryAppRoleFromProfile(profile) === "patient") return true;
  return false;
}

/** Undo supporter-only markers wrongly applied to a dual-role patient account. */
export async function repairDualRoleMarkersIfCorrupted(userId: string): Promise<void> {
  if (!userId.trim()) return;
  if (!(await isDualRolePatientSupporter(userId))) return;
  const needsHeal =
    isSupporterOnlyAccount() ||
    getOnboardingAccountPath() === "supporter" ||
    getPrimaryAppRole() === "carer" ||
    isPersistedSupporterAccount();
  if (!needsHeal) return;
  restoreDualRolePatientSessionMarkers();
  await syncPrimaryAppRoleToCloud(userId, "patient");
  cacheCloudPrimaryAppRole("patient");
}

/**
 * Dual-role accounts logging in via User path must land in User mode — not supporter-only reconcile.
 */
export async function healDualRolePatientSessionIfNeeded(
  userId: string,
): Promise<{ healed: boolean }> {
  if (!userId.trim()) return { healed: false };
  if (!(await isDualRolePatientSupporter(userId))) {
    return { healed: false };
  }
  const needsHeal =
    isSupporterOnlyAccount() ||
    getOnboardingAccountPath() === "supporter" ||
    getPrimaryAppRole() === "carer" ||
    isPersistedSupporterAccount();
  if (!needsHeal) {
    return { healed: false };
  }
  restoreDualRolePatientSessionMarkers();
  await syncPrimaryAppRoleToCloud(userId, "patient");
  cacheCloudPrimaryAppRole("patient");
  return { healed: true };
}

/** Run on signed-in sessions to undo mistaken supporter-only classification for dual-role patients. */
export async function repairMisclassifiedDualRolePatientOnSession(userId: string): Promise<boolean> {
  if (!userId.trim()) return false;
  const before = isSupporterOnlyAccount();
  await repairDualRoleMarkersIfCorrupted(userId);
  return before && !isSupporterOnlyAccount();
}
