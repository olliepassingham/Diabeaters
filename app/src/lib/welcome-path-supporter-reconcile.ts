import { getLinkedPatientForCarer } from "@/lib/carers";
import {
  getOnboardingAccountPath,
  getPrimaryAppRole,
  isPersistedSupporterAccount,
  markPersistedSupporterAccount,
  setActiveAppMode,
  setOnboardingAccountPath,
  setPendingCarer,
  setPrimaryAppRole,
} from "@/lib/carer-session";
import { isCommunityWelcomePathChosen, profileIndicatesExistingPatientAccount } from "@/lib/community-path-patient-reconcile";
import { getProfile } from "@/lib/profile";
import type { PostLoginToastMessage } from "@/lib/post-login-toast-stash";

export const EXISTING_SUPPORTER_ON_USER_PATH_TOAST: PostLoginToastMessage = {
  title: "You have a supporter account",
  description:
    "The User path is for people with Type 1 diabetes. You're signed in to Supporter mode — link to or view someone you support.",
};

export const EXISTING_SUPPORTER_ON_COMMUNITY_PATH_TOAST: PostLoginToastMessage = {
  title: "You have a supporter account",
  description:
    "Community Member is for new sign-ups. Use Supporter mode to link to someone with Type 1 or view their shared essentials.",
};

/** True when /welcome sent the user down the User (patient) path on this device. */
export function isUserWelcomePathChosen(): boolean {
  const path = getOnboardingAccountPath();
  if (path === "patient" || path === "both") return true;
  return getPrimaryAppRole() === "patient";
}

/** User or Community welcome paths — not the supporter path. */
export function isWrongWelcomePathForSupporterAccount(): boolean {
  return isUserWelcomePathChosen() || isCommunityWelcomePathChosen();
}

export function restoreSupporterSessionMarkers(): void {
  setPrimaryAppRole("carer");
  setOnboardingAccountPath("supporter");
  setActiveAppMode("carer");
  setPendingCarer();
  markPersistedSupporterAccount();
}

async function indicatesExistingSupporterAccount(userId: string): Promise<boolean> {
  const link = await getLinkedPatientForCarer();
  if (link.data) {
    markPersistedSupporterAccount();
    return true;
  }

  if (isPersistedSupporterAccount()) return true;

  const { profile } = await getProfile(userId);
  if (profileIndicatesExistingPatientAccount(profile)) return false;

  return false;
}

export type SupporterWelcomeReconcileResult =
  | { reconciled: false }
  | {
      reconciled: true;
      destination: "/carer-view" | "/carer-setup";
      toast: PostLoginToastMessage;
    };

/**
 * When someone with a supporter account taps User or Community Member on /welcome,
 * restore Supporter mode and route to carer-view or carer-setup.
 */
export async function reconcileSupporterWelcomeWithExistingAccount(
  userId: string,
): Promise<SupporterWelcomeReconcileResult> {
  if (!userId.trim() || !isWrongWelcomePathForSupporterAccount()) {
    return { reconciled: false };
  }

  if (!(await indicatesExistingSupporterAccount(userId))) {
    return { reconciled: false };
  }

  restoreSupporterSessionMarkers();

  const link = await getLinkedPatientForCarer();
  const onUserPath = isUserWelcomePathChosen();
  return {
    reconciled: true,
    destination: link.data ? "/carer-view" : "/carer-setup",
    toast: onUserPath ? EXISTING_SUPPORTER_ON_USER_PATH_TOAST : EXISTING_SUPPORTER_ON_COMMUNITY_PATH_TOAST,
  };
}
