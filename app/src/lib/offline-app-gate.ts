import { isOnline } from "./offline";

const ONBOARDING_COMPLETE_LS_KEY = "diabeater_onboarding_completed";

/** Read the device-local onboarding completion flag (survives offline launches). */
export function readOnboardingCompleteFromLocalStorage(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_COMPLETE_LS_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Whether the authenticated shell may render without waiting for cloud gate queries.
 * When offline with a cached session, local data is authoritative for home/guides/tools.
 */
export function resolveAppGateReady(params: {
  authLoading: boolean;
  userId: string | undefined;
  online: boolean;
  linkQueryFetched: boolean;
  profileQueryFetched: boolean;
  skipProfileForGate: boolean;
  /** When true, do not wait for the carer-link query (patient/community accounts). */
  skipLinkForGate?: boolean;
}): boolean {
  if (params.authLoading) return false;
  if (!params.userId) return true;
  if (!params.online) return true;
  if (!params.skipLinkForGate && !params.linkQueryFetched) return false;
  if (params.skipProfileForGate) return true;
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
}): boolean {
  if (!params.userId) return true;
  if (params.isCommunityMemberAccount) return true;
  if (params.linkedCarer) return true;
  if (params.carerPendingBlocksOnboarding) return true;
  if (!params.online) {
    return params.onboardingCompleteFromLocalStorage || params.onboardingCompleteFromDb;
  }
  if (!params.profileQueryFetched) return true;
  return params.onboardingCompleteFromDb || params.onboardingCompleteFromLocalStorage;
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
