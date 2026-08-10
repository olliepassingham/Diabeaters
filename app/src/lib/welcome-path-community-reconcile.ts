import { getLinkedPatientForCarer } from "@/lib/carers";
import {
  isPersistedCommunityAccount,
  markPersistedCommunityAccount,
  setActiveAppMode,
  setOnboardingAccountPath,
  setPrimaryAppRole,
} from "@/lib/carer-session";
import { getCommunityMemberLandingPath } from "@/lib/community-landing";
import { profileIndicatesExistingPatientAccount } from "@/lib/community-path-patient-reconcile";
import { getProfile, type ProfileRow } from "@/lib/profile";
import type { PostLoginToastMessage } from "@/lib/post-login-toast-stash";
import { isUserWelcomePathChosen } from "@/lib/welcome-path-supporter-reconcile";

export const EXISTING_COMMUNITY_ON_USER_PATH_TOAST: PostLoginToastMessage = {
  title: "You have a Community Member account",
  description:
    "The User path is for people with Type 1 diabetes. You're signed in to Community Member mode — set up your public profile, then join the feed.",
};

/** Cloud or local markers show a completed community-only account. */
export function profileIndicatesExistingCommunityAccount(profile: ProfileRow | null | undefined): boolean {
  if (profileIndicatesExistingPatientAccount(profile)) return false;
  if (profile?.account_type === "community") return true;
  if (profile?.primary_app_role === "community") return true;
  return isPersistedCommunityAccount();
}

export function restoreCommunitySessionMarkers(): void {
  setPrimaryAppRole("community");
  setOnboardingAccountPath("community");
  setActiveAppMode("community");
  markPersistedCommunityAccount();
  // Community members skip clinical onboarding — mark complete so AppContent does not
  // trap them on "Redirecting…" while bouncing /onboarding ↔ /community/setup.
  try {
    localStorage.setItem("diabeater_onboarding_completed", "true");
  } catch {
    /* ignore */
  }
}

export type CommunityUserWelcomeReconcileResult =
  | { reconciled: false }
  | {
      reconciled: true;
      destination: string;
      toast: PostLoginToastMessage;
    };

/**
 * When someone with a community-only account taps User (Type 1) on /welcome,
 * restore Community Member mode instead of the full patient dashboard.
 */
export async function reconcileUserWelcomeWithExistingCommunityAccount(
  userId: string,
): Promise<CommunityUserWelcomeReconcileResult> {
  if (!userId.trim() || !isUserWelcomePathChosen()) {
    return { reconciled: false };
  }

  const link = await getLinkedPatientForCarer();
  if (link.data) {
    // Linked community members who upgraded to supporter are handled by supporter reconcile.
    return { reconciled: false };
  }

  const { profile } = await getProfile(userId);
  if (!profileIndicatesExistingCommunityAccount(profile)) {
    return { reconciled: false };
  }

  restoreCommunitySessionMarkers();
  return {
    reconciled: true,
    destination: getCommunityMemberLandingPath(profile ?? null),
    toast: EXISTING_COMMUNITY_ON_USER_PATH_TOAST,
  };
}
