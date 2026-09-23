import {
  getPrimaryAppRole,
  isCommunityOnlyAccount,
  setActiveAppMode,
  setOnboardingAccountPath,
  setPrimaryAppRole,
  type OnboardingAccountPath,
} from "@/lib/carer-session";
import { getProfile, type ProfileRow } from "@/lib/profile";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { isCommunityAccountProfile, storage } from "@/lib/storage";
import type { PostLoginToastMessage } from "@/lib/post-login-toast-stash";
import { stashPostLoginToast } from "@/lib/post-login-toast-stash";

const ONBOARDING_LS = "diabeater_onboarding_completed";

export const EXISTING_PATIENT_ON_COMMUNITY_PATH_TOAST: PostLoginToastMessage = {
  title: "Already have a full account",
  description:
    "You're signed in with Type 1 tools — open the community feed anytime from the app. Community Member is for new exploring accounts.",
};

/** True when /welcome sent the user down the Community Member path on this device. */
export function isCommunityWelcomePathChosen(): boolean {
  return isCommunityOnlyAccount() || getPrimaryAppRole() === "community";
}

/** Cloud profile shows a completed patient account (not community/supporter-only). */
export function profileIndicatesExistingPatientAccount(profile: ProfileRow | null | undefined): boolean {
  if (!profile) return false;
  if (profile.account_type === "community") return false;
  if (profile.primary_app_role === "community") return false;
  /** Authoritative supporter-only persona — not a Type 1 user account for routing. */
  if (profile.primary_app_role === "carer") return false;
  // Require an explicit patient signal — bare onboarding_complete is shared by community finalize
  // and must not hijack a Community Member into User mode.
  if (profile.account_type === "patient") return true;
  if (profile.primary_app_role === "patient" && profile.onboarding_complete === true) return true;
  return false;
}

/** Local device markers for a completed Type 1 / insulin user account (excludes community-only). */
export function localIndicatesPatientAccount(): boolean {
  if (isCommunityAccountProfile(storage.getProfile())) return false;
  try {
    if (localStorage.getItem(ONBOARDING_LS) !== "true") return false;
  } catch {
    return false;
  }
  const local = storage.getProfile();
  if (!local) return false;
  if (local.accountType === "community") return false;
  if (local.diabetesType && local.diabetesType !== "none") return true;
  if (local.usingInsulin === true) return true;
  if (local.insulinDeliveryMethod === "pen" || isPumpDeliveryMethod(local.insulinDeliveryMethod)) {
    return true;
  }
  return false;
}

/** Undo a mistaken Community Member welcome tap for returning patient accounts. */
export function restorePatientSessionMarkersAfterCommunityMismatch(): void {
  setPrimaryAppRole("patient");
  setOnboardingAccountPath("patient");
  setActiveAppMode("patient");
}

/** @deprecated Use {@link stashPostLoginToast} */
export function stashExistingPatientOnCommunityPathToast(): void {
  stashPostLoginToast(EXISTING_PATIENT_ON_COMMUNITY_PATH_TOAST);
}

/**
 * When someone with a completed patient account taps Community Member on /welcome,
 * keep their patient session and route to User mode instead of community-only.
 * Uses cloud profile only — leftover Type 1 localStorage from a previous account on this
 * device must not hijack a brand-new Community Member signup.
 *
 * Signup metadata `community` wins unless the cloud row is explicitly `account_type: patient`
 * (a real Type 1 account). That blocks poisoned `primary_app_role: patient` from stealing
 * a fresh Community Member signup.
 */
export async function reconcileCommunityWelcomeWithExistingPatient(
  userId: string,
  metadataAccountPath?: OnboardingAccountPath | null,
): Promise<{ reconciled: boolean }> {
  if (!userId.trim() || !isCommunityWelcomePathChosen()) {
    return { reconciled: false };
  }

  const { profile } = await getProfile(userId);
  if (!profile || !profileIndicatesExistingPatientAccount(profile)) {
    return { reconciled: false };
  }

  if (metadataAccountPath === "community" && profile.account_type !== "patient") {
    return { reconciled: false };
  }

  restorePatientSessionMarkersAfterCommunityMismatch();
  return { reconciled: true };
}
