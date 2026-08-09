import {
  cacheCloudPrimaryAppRoleFromProfile,
  getActiveAppMode,
  markPersistedCommunityAccount,
  markPersistedSupporterAccount,
  setActiveAppMode,
  setOnboardingAccountPath,
  setPrimaryAppRole,
  type OnboardingAccountPath,
  type PrimaryAppRole,
} from "@/lib/carer-session";
import { applyClinicalPrefsFromCloudRow } from "@/lib/clinical-prefs-cloud-sync";
import { profileIndicatesExistingPatientAccount } from "@/lib/community-path-patient-reconcile";
import { getLinkedPatientForCarer } from "@/lib/carers";
import {
  cloudPrimaryAppRoleFromProfile,
  resolveSupporterOnlyAccount,
} from "@/lib/profile-primary-role";
import { getProfile, type ProfileRow } from "@/lib/profile";

function onboardingPathForProfile(
  profile: ProfileRow | null | undefined,
  hasCarerLink: boolean,
  metadataAccountPath: OnboardingAccountPath | null,
): OnboardingAccountPath | null {
  if (profile?.account_type === "community") return "community";

  const cloudRole = cloudPrimaryAppRoleFromProfile(profile);
  const isPatient = profileIndicatesExistingPatientAccount(profile);

  if (cloudRole === "community" && !isPatient) return "community";
  if (
    resolveSupporterOnlyAccount({
      profile,
      hasCarerLink,
      localIsSupporterOnly: false,
    })
  ) {
    return "supporter";
  }
  if (hasCarerLink && isPatient) return "both";
  if (cloudRole === "carer" && hasCarerLink) return "supporter";
  if (isPatient || cloudRole === "patient") return "patient";
  // No cloud signal yet (brand-new profile row) — fall back to the durable signup-time
  // intent so a lost session doesn't misroute a new Community Member into patient onboarding.
  if (metadataAccountPath && !isPatient) return metadataAccountPath;
  return null;
}

function primaryRoleForProfile(
  profile: ProfileRow | null | undefined,
  hasCarerLink: boolean,
  metadataAccountPath: OnboardingAccountPath | null,
): PrimaryAppRole | null {
  const path = onboardingPathForProfile(profile, hasCarerLink, metadataAccountPath);
  if (path === "community") return "community";
  if (path === "supporter") return "carer";
  if (path === "both" || path === "patient") return "patient";
  return cloudPrimaryAppRoleFromProfile(profile);
}

function applySessionMarkersFromProfile(
  profile: ProfileRow | null | undefined,
  hasCarerLink: boolean,
  metadataAccountPath: OnboardingAccountPath | null,
): void {
  const path = onboardingPathForProfile(profile, hasCarerLink, metadataAccountPath);
  const role = primaryRoleForProfile(profile, hasCarerLink, metadataAccountPath);

  if (path) setOnboardingAccountPath(path);
  if (role) setPrimaryAppRole(role);

  if (path === "community") markPersistedCommunityAccount();
  else if (path === "supporter") markPersistedSupporterAccount();

  cacheCloudPrimaryAppRoleFromProfile(profile);

  const supporterOnly = resolveSupporterOnlyAccount({
    profile,
    hasCarerLink,
    localIsSupporterOnly: path === "supporter",
  });
  const communityOnly = path === "community";

  if (supporterOnly) {
    setActiveAppMode("carer");
    return;
  }
  if (communityOnly) {
    setActiveAppMode("community");
    return;
  }
  if (!getActiveAppMode()) {
    if (hasCarerLink && role === "patient") {
      setActiveAppMode("patient");
    } else if (role) {
      setActiveAppMode(role === "carer" ? "carer" : role === "community" ? "community" : "patient");
    }
  }
}

/**
 * Apply patient / supporter / community session markers from the signed-in account's cloud profile.
 * Call after login and on session restore — not from device-local role persistence.
 *
 * `metadataAccountPath` (from Supabase auth `user_metadata`) is used only when the cloud
 * profile has no role signal yet — e.g. right after email verification, before the account's
 * first `finalizeCommunityMemberSession` cloud write has happened.
 */
export async function restoreAccountSessionFromCloud(
  userId: string,
  metadataAccountPath?: OnboardingAccountPath | null,
): Promise<void> {
  if (!userId.trim()) return;

  const [{ profile }, link] = await Promise.all([getProfile(userId), getLinkedPatientForCarer()]);
  applySessionMarkersFromProfile(profile, Boolean(link.data), metadataAccountPath ?? null);
  if (profile) applyClinicalPrefsFromCloudRow(profile);
}
