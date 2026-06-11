import { flushSync } from "react-dom";
import type { Session } from "@supabase/supabase-js";
import { getLinkedPatientForCarer } from "@/lib/carers";
import {
  getPrimaryAppRole,
  hasCarerIntent,
  hasPendingCarer,
  isCommunityOnlyAccount,
  isSupporterOnlyAccount,
  setActiveAppMode,
} from "@/lib/carer-session";
import { getCommunityMemberLandingPath } from "@/lib/community-landing";
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
  }

  const link = await getLinkedPatientForCarer();
  if (link.data) {
    const next = new URLSearchParams(window.location.search).get("next");
    if (isSupporterOnlyAccount() || getPrimaryAppRole() === "carer") {
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
    setLocation(getCommunityMemberLandingPath());
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
  let welcomeReconcileDestination: string | undefined;
  // Reconcile before auth sync so PostLoginToast does not miss the message on first paint.
  if (userId) {
    const wrongPath = await reconcileWrongWelcomePathForSignedInUser(userId);
    if (wrongPath.reconciled) welcomeReconcileDestination = wrongPath.destination;
  }
  prepareAuthSessionBeforeNavigation(syncAuthSession, session);
  await navigateAfterLoginSuccess(setLocation, userId, welcomeReconcileDestination);
}
