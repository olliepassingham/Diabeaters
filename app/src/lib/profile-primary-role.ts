import type { PrimaryAppRole } from "@/lib/carer-session";
import {
  applySupporterAccountRoleAfterLink,
  cacheCloudPrimaryAppRole,
  getOnboardingAccountPath,
  getPrimaryAppRole,
  setPrimaryAppRole,
} from "@/lib/carer-session";
import { isMissingProfileColumnSchemaError } from "@/lib/clinical-prefs-cloud-sync";
import { profileIndicatesExistingPatientAccount, localIndicatesPatientAccount } from "@/lib/community-path-patient-reconcile";
import { getLinkedPatientForCarer } from "@/lib/carers";
import { getProfile, updateProfile, type ProfileRow } from "@/lib/profile";

export type CloudPrimaryAppRole = PrimaryAppRole;

export function cloudPrimaryAppRoleFromProfile(
  profile: ProfileRow | null | undefined,
): CloudPrimaryAppRole | null {
  const raw = profile?.primary_app_role;
  if (raw === "patient" || raw === "carer" || raw === "community") return raw;
  return null;
}

export function profileIsSupporterOnlyRole(profile: ProfileRow | null | undefined): boolean {
  return cloudPrimaryAppRoleFromProfile(profile) === "carer";
}

/** Linked carer without a completed patient account — legacy inference when cloud role is unset. */
export function inferSupporterOnlyFromLegacySignals(
  profile: ProfileRow | null | undefined,
  hasCarerLink: boolean,
): boolean {
  if (!hasCarerLink) return false;
  return !profileIndicatesExistingPatientAccount(profile);
}

export function resolveSupporterOnlyAccount(opts: {
  profile: ProfileRow | null | undefined;
  hasCarerLink: boolean;
  localIsSupporterOnly: boolean;
}): boolean {
  const cloud = cloudPrimaryAppRoleFromProfile(opts.profile);
  if (cloud === "carer") return true;
  if (cloud === "patient" || cloud === "community") return false;
  if (profileIndicatesExistingPatientAccount(opts.profile) || localIndicatesPatientAccount()) {
    return false;
  }
  if (opts.localIsSupporterOnly) return true;
  return inferSupporterOnlyFromLegacySignals(opts.profile, opts.hasCarerLink);
}

export async function syncPrimaryAppRoleToCloud(
  userId: string,
  role: PrimaryAppRole,
): Promise<{ error: Error | null; skipped?: boolean }> {
  const { error } = await updateProfile({ id: userId, primary_app_role: role });
  if (!error) return { error: null };
  if (isMissingProfileColumnSchemaError(error.message, "primary_app_role")) {
    return { error: null, skipped: true };
  }
  return { error };
}

/** After redeeming a supporter invite: keep dual-role patients on `patient`, sync role to cloud. */
export async function finalizeSupporterLinkCloudSync(userId: string | undefined): Promise<void> {
  applySupporterAccountRoleAfterLink();

  const path = getOnboardingAccountPath();
  if ((path === "patient" || path === "both") && getPrimaryAppRole() !== "patient") {
    setPrimaryAppRole("patient");
  }

  if (!userId) return;
  const role = getPrimaryAppRole();
  if (!role) return;

  await syncPrimaryAppRoleToCloud(userId, role);
  cacheCloudPrimaryAppRole(role);
}

/** Push local primary role to cloud when the column exists (no-op if migration pending). */
export async function syncLocalPrimaryAppRoleToCloud(userId: string): Promise<void> {
  const { getPrimaryAppRole } = await import("@/lib/carer-session");
  const role = getPrimaryAppRole();
  if (!role) return;
  await syncPrimaryAppRoleToCloud(userId, role);
}

/**
 * When cloud role is unset but signals say supporter-only, persist `carer` for future logins.
 */
export async function backfillSupporterRoleToCloudIfNeeded(
  userId: string,
  profile: ProfileRow | null | undefined,
  hasCarerLink: boolean,
): Promise<ProfileRow | null> {
  if (!userId.trim() || cloudPrimaryAppRoleFromProfile(profile)) return profile;
  if (!inferSupporterOnlyFromLegacySignals(profile, hasCarerLink)) return profile;
  const { error } = await syncPrimaryAppRoleToCloud(userId, "carer");
  if (error) return profile;
  const { profile: refreshed } = await getProfile(userId);
  return refreshed ?? { ...profile!, primary_app_role: "carer" };
}

export type CloudSupporterSessionReconcileResult =
  | { reconciled: false }
  | { reconciled: true; destination: "/carer-view" | "/carer-setup" };

/**
 * Restore supporter session from cloud profile (e.g. new device, direct login).
 * Does not show a toast — unlike mistaken welcome-path reconcile.
 */
export async function reconcileSupporterSessionFromCloudProfile(
  userId: string,
): Promise<CloudSupporterSessionReconcileResult> {
  if (!userId.trim()) return { reconciled: false };

  const { getOnboardingAccountPath, isSupporterOnlyAccount, cacheCloudPrimaryAppRoleFromProfile } =
    await import("@/lib/carer-session");
  const onboardingPath = getOnboardingAccountPath();
  if (onboardingPath === "supporter" && isSupporterOnlyAccount()) {
    return { reconciled: false };
  }

  const [{ profile }, link] = await Promise.all([getProfile(userId), getLinkedPatientForCarer()]);
  const hasCarerLink = Boolean(link.data);
  const { restoreSupporterSessionMarkers } = await import("@/lib/welcome-path-supporter-reconcile");

  const refreshed = await backfillSupporterRoleToCloudIfNeeded(userId, profile, hasCarerLink);
  const effectiveProfile = refreshed ?? profile;

  if (
    !resolveSupporterOnlyAccount({
      profile: effectiveProfile,
      hasCarerLink,
      localIsSupporterOnly: isSupporterOnlyAccount(),
    })
  ) {
    return { reconciled: false };
  }

  restoreSupporterSessionMarkers();
  cacheCloudPrimaryAppRoleFromProfile(effectiveProfile);

  return {
    reconciled: true,
    destination: hasCarerLink ? "/carer-view" : "/carer-setup",
  };
}
