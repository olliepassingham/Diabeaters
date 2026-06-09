import { flushSync } from "react-dom";
import type { Session } from "@supabase/supabase-js";
import { getLinkedPatientForCarer } from "@/lib/carers";
import {
  getPrimaryAppRole,
  hasCarerIntent,
  hasPendingCarer,
  setActiveAppMode,
} from "@/lib/carer-session";
import { getCommunityMemberLandingPath } from "@/lib/community-landing";

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

/**
 * Shared navigation after a successful password or OAuth session (login or signup when confirmations are off).
 */
export async function navigateAfterLoginSuccess(setLocation: (path: string) => void): Promise<void> {
  const link = await getLinkedPatientForCarer();
  if (link.data) {
    const next = new URLSearchParams(window.location.search).get("next");
    if (getPrimaryAppRole() === "carer") {
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
  if (role === "community") {
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
  prepareAuthSessionBeforeNavigation(syncAuthSession, session);
  await navigateAfterLoginSuccess(setLocation);
}
