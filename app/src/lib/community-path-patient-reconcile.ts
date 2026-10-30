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

/**
 * Cloud profile shows a real patient account (not community/supporter-only).
 *
 * DB bootstrap rows default `account_type` to `'patient'` with no role/completion —
 * that alone must NOT count, or supporter/community signup metadata loses after email
 * verify on a fresh device.
 */
export function profileIndicatesExistingPatientAccount(profile: ProfileRow | null | undefined): boolean {
  if (!profile) return false;
  if (profile.account_type === "community") return false;
  if (profile.primary_app_role === "community") return false;
  /** Authoritative supporter-only persona — not a Type 1 user account for routing. */
  if (profile.primary_app_role === "carer") return false;

  const diabetesType = profile.diabetes_type;
  const hasClinicalDiabetesType = diabetesType === "type1" || diabetesType === "type2";
  const finishedPatientOnboarding = profile.onboarding_complete === true;
  const cloudPatientRole = profile.primary_app_role === "patient";

  // Bare default account_type=patient (bootstrap) is non-signal until role, completion, or diabetes type.
  if (profile.account_type === "patient") {
    return cloudPatientRole || finishedPatientOnboarding || hasClinicalDiabetesType;
  }
  if (cloudPatientRole && finishedPatientOnboarding) return true;
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
 * Signup metadata `community` wins unless the cloud row is a real patient account
 * ({@link profileIndicatesExistingPatientAccount}). That blocks poisoned incomplete
 * bootstrap rows from stealing a fresh Community Member signup.
 */
export async function reconcileCommunityWelcomeWithExistingPatient(
  userId: string,
  metadataAccountPath?: OnboardingAccountPath | null,
): Promise<{ reconciled: boolean }> {
  if (!userId.trim() || !isCommunityWelcomePathChosen()) {
    return { reconciled: false };
  }

  const { profile } = await getProfile(userId);
  // Bootstrap defaults account_type=patient; that alone is not enough (see helper).
  // Fresh community/supporter metadata therefore wins until the cloud row is a real patient.
  // `metadataAccountPath` is reserved for callers that still pass signup metadata.
  if (!profile || !profileIndicatesExistingPatientAccount(profile)) {
    return { reconciled: false };
  }
  if (metadataAccountPath === "community" && profile.account_type !== "patient") {
    // Explicit community cloud account — never force User mode.
    return { reconciled: false };
  }

  restorePatientSessionMarkersAfterCommunityMismatch();
  return { reconciled: true };
}
