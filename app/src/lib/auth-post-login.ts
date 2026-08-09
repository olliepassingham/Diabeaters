import { flushSync } from "react-dom";
import type { Session } from "@supabase/supabase-js";
import { getLinkedPatientForCarer } from "@/lib/carers";
import {
  getPrimaryAppRole,
  hasCarerIntent,
  hasPendingCarer,
  isCommunityOnlyAccount,
  isSupporterOnlyAccount,
  onboardingAccountPathFromUserMetadata,
  setActiveAppMode,
} from "@/lib/carer-session";
import { resolveCommunityMemberLandingPath } from "@/lib/community-landing";
import { ensureCommunityMemberSessionReady } from "@/lib/community-member-session";
import { restoreAccountSessionFromCloud } from "@/lib/account-session-restore";
import { cacheCloudPrimaryAppRoleFromProfile } from "@/lib/carer-session";
import { getProfile } from "@/lib/profile";
import { resolveSupporterOnlyAccount, syncLocalPrimaryAppRoleToCloud } from "@/lib/profile-primary-role";
import { reconcileWrongWelcomePathForSignedInUser } from "@/lib/welcome-path-reconcile";

/** Commit Supabase session to React auth state before entering protected routes. */
export function prepareAuthSessionBeforeNavigation(
  syncAuthSession: (session: Session | null) => void,
  session: Session | null | undefined,
): void {
  if (!session) return;
  flushSync(() => {
    syncAuthSession(session);
  });
}

function applyWelcomeReconcileDestination(
  setLocation: (path: string) => void,
  destination: string,
): void {
  if (destination === "/carer-view" || destination === "/carer-setup") {
    setActiveAppMode("carer");
  } else if (destination === "/") {
    setActiveAppMode("patient");
  } else {
    setActiveAppMode("community");
  }
  setLocation(destination);
}

/**
 * Shared navigation after a successful password or OAuth session (login or signup when confirmations are off).
 */
export async function navigateAfterLoginSuccess(
  setLocation: (path: string) => void,
  userId?: string | null,
  welcomeReconcileDestination?: string,
): Promise<void> {
  if (welcomeReconcileDestination) {
    applyWelcomeReconcileDestination(setLocation, welcomeReconcileDestination);
    return;
  }

  if (userId) {
    const wrongPath = await reconcileWrongWelcomePathForSignedInUser(userId);
    if (wrongPath.reconciled && wrongPath.destination) {
      applyWelcomeReconcileDestination(setLocation, wrongPath.destination);
      return;
    }
    await ensureCommunityMemberSessionReady(userId);
  }

  const link = await getLinkedPatientForCarer();
  if (link.data) {
    const next = new URLSearchParams(window.location.search).get("next");
    const profile = userId ? (await getProfile(userId)).profile : null;
    if (profile) cacheCloudPrimaryAppRoleFromProfile(profile);
    const supporterOnly = resolveSupporterOnlyAccount({
      profile,
      hasCarerLink: true,
      localIsSupporterOnly: isSupporterOnlyAccount(),
    });
    if (supporterOnly || getPrimaryAppRole() === "carer") {
      setActiveAppMode("carer");
      setLocation("/carer-view");
      return;
    }
    setActiveAppMode("patient");
    if (next?.startsWith("/") && !next.startsWith("//")) {
      setLocation(next);
      return;
    }
    setLocation("/");
    return;
  }
  if (hasCarerIntent() || hasPendingCarer()) {
    setLocation("/carer-setup");
    return;
  }
  const next = new URLSearchParams(window.location.search).get("next");
  if (next?.startsWith("/") && !next.startsWith("//")) {
    setLocation(next);
    return;
  }
  const role = getPrimaryAppRole();
  if (role === null) {
    setLocation("/welcome");
    return;
  }
  if (isCommunityOnlyAccount() || role === "community") {
    setActiveAppMode("community");
    setLocation(await resolveCommunityMemberLandingPath(userId));
    return;
  }
  setLocation("/");
}

export async function completeAuthAndNavigate(
  setLocation: (path: string) => void,
  syncAuthSession: (session: Session | null) => void,
  session: Session | null | undefined,
): Promise<void> {
  const userId = session?.user?.id ?? null;
  const metadataAccountPath = onboardingAccountPathFromUserMetadata(session?.user);
  let welcomeReconcileDestination: string | undefined;
  // Reconcile before auth sync so PostLoginToast does not miss the message on first paint.
  if (userId) {
    const wrongPath = await reconcileWrongWelcomePathForSignedInUser(userId);
    if (wrongPath.reconciled) welcomeReconcileDestination = wrongPath.destination;
    else await restoreAccountSessionFromCloud(userId, metadataAccountPath);
    const { profile } = await getProfile(userId);
    cacheCloudPrimaryAppRoleFromProfile(profile);
    await ensureCommunityMemberSessionReady(userId, {
      email: session?.user?.email ?? undefined,
      metadataAccountPath,
    });
    void syncLocalPrimaryAppRoleToCloud(userId);
  }
  prepareAuthSessionBeforeNavigation(syncAuthSession, session);
  await navigateAfterLoginSuccess(setLocation, userId, welcomeReconcileDestination);
}
