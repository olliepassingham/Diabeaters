import {
  EXISTING_PATIENT_ON_COMMUNITY_PATH_TOAST,
  reconcileCommunityWelcomeWithExistingPatient,
} from "@/lib/community-path-patient-reconcile";
import { stashPostLoginToast } from "@/lib/post-login-toast-stash";
import { reconcileUserWelcomeWithExistingCommunityAccount } from "@/lib/welcome-path-community-reconcile";
import { reconcileSupporterWelcomeWithExistingAccount } from "@/lib/welcome-path-supporter-reconcile";

export type WelcomePathReconcileResult = {
  reconciled: boolean;
  destination?: string;
};

/** Correct mistaken /welcome path choices for returning patient, community, or supporter accounts. */
export async function reconcileWrongWelcomePathForSignedInUser(
  userId: string,
): Promise<WelcomePathReconcileResult> {
  const patient = await reconcileCommunityWelcomeWithExistingPatient(userId);
  if (patient.reconciled) {
    stashPostLoginToast(EXISTING_PATIENT_ON_COMMUNITY_PATH_TOAST);
    return { reconciled: true, destination: "/" };
  }

  const community = await reconcileUserWelcomeWithExistingCommunityAccount(userId);
  if (community.reconciled) {
    stashPostLoginToast(community.toast);
    return { reconciled: true, destination: community.destination };
  }

  const supporter = await reconcileSupporterWelcomeWithExistingAccount(userId);
  if (supporter.reconciled) {
    stashPostLoginToast(supporter.toast);
    return { reconciled: true, destination: supporter.destination };
  }

  return { reconciled: false };
}
