import { isOnline } from "./offline";

const ONBOARDING_COMPLETE_LS_KEY = "diabeater_onboarding_completed";
/** Binds local onboarding completion to the auth user who finished — avoids cross-account skips. */
const ONBOARDING_COMPLETE_USER_KEY = "diabeater_onboarding_completed_user_id";

/** Read the device-local onboarding completion flag (survives offline launches). */
export function readOnboardingCompleteFromLocalStorage(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_COMPLETE_LS_KEY) === "true";
  } catch {
    return false;
  }
}

/** Auth user id that last marked onboarding complete on this device (if any). */
export function readOnboardingCompleteUserIdFromLocalStorage(): string | null {
  try {
    const raw = localStorage.getItem(ONBOARDING_COMPLETE_USER_KEY);
    return raw && raw.trim() ? raw.trim() : null;
  } catch {
    return null;
  }
}

/** Mark clinical/community onboarding complete locally, scoped to the signed-in user when known. */
export function markOnboardingCompleteLocally(userId?: string | null): void {
  try {
    localStorage.setItem(ONBOARDING_COMPLETE_LS_KEY, "true");
    if (userId && userId.trim()) {
      localStorage.setItem(ONBOARDING_COMPLETE_USER_KEY, userId.trim());
    }
  } catch {
    /* ignore */
  }
}

export function clearOnboardingCompleteLocally(): void {
  try {
    localStorage.removeItem(ONBOARDING_COMPLETE_LS_KEY);
    localStorage.removeItem(ONBOARDING_COMPLETE_USER_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Whether the authenticated shell may render without waiting for cloud gate queries.
 * When offline with a cached session, local data is authoritative for home/guides/tools.
 */
/** How long the signed-in shell may wait on cloud gate queries before painting from local data. */
export const APP_GATE_CLOUD_WAIT_MS = 5_000;

export function resolveAppGateReady(params: {
  authLoading: boolean;
  userId: string | undefined;
  online: boolean;
  linkQueryFetched: boolean;
  profileQueryFetched: boolean;
  skipProfileForGate: boolean;
  /** When true, do not wait for the carer-link query (patient/community accounts). */
  skipLinkForGate?: boolean;
  /**
   * This device already finished onboarding for the signed-in account.
   * Home can paint from local data while the profile request is still in flight.
   * A new signup has this flag cleared, so it still waits for the cloud profile.
   */
  localOnboardingComplete?: boolean;
  /**
   * Weak Wi‑Fi often leaves `navigator.onLine` true while fetches hang forever.
   * After {@link APP_GATE_CLOUD_WAIT_MS}, paint the shell from local data instead of
   * showing Loading indefinitely.
   */
  cloudWaitTimedOut?: boolean;
}): boolean {
  if (params.authLoading) return false;
  if (!params.userId) return true;
  if (!params.online) return true;
  if (params.cloudWaitTimedOut) return true;
  if (!params.skipLinkForGate && !params.linkQueryFetched) return false;
  if (params.skipProfileForGate) return true;
  if (params.localOnboardingComplete) return true;
  return params.profileQueryFetched;
}

/** Convenience wrapper for live `navigator.onLine` in non-React code paths. */
export function resolveAppGateReadyNow(
  params: Omit<Parameters<typeof resolveAppGateReady>[0], "online">,
): boolean {
  return resolveAppGateReady({ ...params, online: isOnline() });
}

/**
 * Patient onboarding gate: when offline, trust the local completion flag so users
 * are not redirected away from their saved home/guides/tools.
 */
export function isPatientOnboardingSatisfied(params: {
  userId: string | undefined;
  linkedCarer: boolean;
  carerPendingBlocksOnboarding: boolean;
  profileQueryFetched: boolean;
  onboardingCompleteFromDb: boolean;
  onboardingCompleteFromLocalStorage: boolean;
  online: boolean;
  /** Community Member accounts skip the clinical onboarding wizard. */
  isCommunityMemberAccount?: boolean;
  /**
   * User id that marked local onboarding complete. When it matches `userId`, online
   * mode may trust local completion even if the cloud profile upsert has not landed yet
   * (avoids / ↔ /onboarding Redirecting loops). A previous account's flag won't match.
   */
  onboardingCompleteLocalUserId?: string | null;
}): boolean {
  if (!params.userId) return true;
  if (params.isCommunityMemberAccount) return true;
  if (params.linkedCarer) return true;
  if (params.carerPendingBlocksOnboarding) return true;
  if (params.onboardingCompleteFromDb) return true;

  const localForThisUser =
    params.onboardingCompleteFromLocalStorage &&
    Boolean(params.onboardingCompleteLocalUserId) &&
    params.onboardingCompleteLocalUserId === params.userId;

  if (!params.online) {
    return params.onboardingCompleteFromLocalStorage || localForThisUser;
  }
  if (!params.profileQueryFetched) return true;
  // Online: prefer cloud. Also trust local when bound to this user (finish just wrote local
  // before/while cloud upsert; stale previous-account flags lack a matching user id).
  return localForThisUser;
}

export const OFFLINE_CLOUD_TOOL_IDS = new Set(["ai-coach"]);

export const OFFLINE_CLOUD_NAV_HREFS = new Set(["/community", "/community/messages", "/coach"]);

/** Hide Beatie / coach tiles from the tools hub when offline. */
export function filterOfflineCloudTools<T extends { id: string }>(tools: T[], offline: boolean): T[] {
  if (!offline) return tools;
  return tools.filter((t) => !OFFLINE_CLOUD_TOOL_IDS.has(t.id));
}

/** Hide Feed and Beatie bottom-nav tabs when offline. */
export function filterOfflineCloudNavTabs<T extends { href: string }>(tabs: T[], offline: boolean): T[] {
  if (!offline) return tabs;
  return tabs.filter((t) => !OFFLINE_CLOUD_NAV_HREFS.has(t.href));
}
