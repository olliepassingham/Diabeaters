import {
  getPrimaryAppRole,
  isCommunityOnlyAccount,
  setActiveAppMode,
  setOnboardingAccountPath,
  setPrimaryAppRole,
} from "@/lib/carer-session";
import { getProfile, type ProfileRow } from "@/lib/profile";

const POST_LOGIN_TOAST_KEY = "diabeater:post_login_toast:v1";
const ONBOARDING_LS = "diabeater_onboarding_completed";

export const EXISTING_PATIENT_ON_COMMUNITY_PATH_TOAST = {
  title: "Already have a full account",
  description:
    "Community Member is for new sign-ups. You're signed in to User mode — you can open the community feed from the app anytime.",
} as const;

/** True when /welcome sent the user down the Community Member path on this device. */
export function isCommunityWelcomePathChosen(): boolean {
  return isCommunityOnlyAccount() || getPrimaryAppRole() === "community";
}

/** Cloud or local markers show a completed patient account (not community-only). */
export function profileIndicatesExistingPatientAccount(profile: ProfileRow | null | undefined): boolean {
  if (profile?.account_type === "community") return false;
  if (profile?.onboarding_complete === true) return true;
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(ONBOARDING_LS) === "true";
  } catch {
    return false;
  }
}

/** Undo a mistaken Community Member welcome tap for returning patient accounts. */
export function restorePatientSessionMarkersAfterCommunityMismatch(): void {
  setPrimaryAppRole("patient");
  setOnboardingAccountPath("patient");
  setActiveAppMode("patient");
}

export function stashExistingPatientOnCommunityPathToast(): void {
  try {
    sessionStorage.setItem(POST_LOGIN_TOAST_KEY, JSON.stringify(EXISTING_PATIENT_ON_COMMUNITY_PATH_TOAST));
  } catch {
    // ignore
  }
}

export function consumePostLoginToast(): { title: string; description: string } | null {
  try {
    const raw = sessionStorage.getItem(POST_LOGIN_TOAST_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(POST_LOGIN_TOAST_KEY);
    const parsed = JSON.parse(raw) as { title?: string; description?: string };
    if (!parsed.title || !parsed.description) return null;
    return { title: parsed.title, description: parsed.description };
  } catch {
    return null;
  }
}

/**
 * When someone with a completed patient account taps Community Member on /welcome,
 * keep their patient session and route to User mode instead of community-only.
 */
export async function reconcileCommunityWelcomeWithExistingPatient(
  userId: string,
): Promise<{ reconciled: boolean }> {
  if (!userId.trim() || !isCommunityWelcomePathChosen()) {
    return { reconciled: false };
  }

  const { profile } = await getProfile(userId);
  if (!profileIndicatesExistingPatientAccount(profile)) {
    return { reconciled: false };
  }

  restorePatientSessionMarkersAfterCommunityMismatch();
  return { reconciled: true };
}
