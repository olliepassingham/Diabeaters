import { localIndicatesPatientAccount } from "@/lib/community-path-patient-reconcile";

const CARER_INTENT_KEY = "diabeater_carer_intent";
const CARER_LINKED_BANNER_KEY = "diabeater_carer_linked_banner";
const PENDING_CARER_KEY = "diabeater_pending_carer";
const CARER_LINK_JUST_COMPLETED_AT_KEY = "diabeater_carer_link_just_completed_at";
const ACTIVE_CARER_PATIENT_ID_KEY = "diabeater_active_carer_patient_id";
const ACTIVE_APP_MODE_KEY = "diabeater_active_app_mode";
const PRIMARY_APP_ROLE_KEY = "diabeater_primary_app_role";
/** Legacy device-global keys — cleared on logout; role comes from cloud when signed in. */
const PRIMARY_APP_ROLE_PERSIST_KEY = "diabeater_primary_app_role_v1";
/** Chosen on /welcome before auth, or derived from cloud profile after login. */
const ONBOARDING_ACCOUNT_PATH_KEY = "diabeater_onboarding_account_path_v1";
/** Session marker for supporter-only accounts (current login session). */
const SUPPORTER_ACCOUNT_SESSION_KEY = "diabeater_supporter_account_session";
/** Session marker for community-only accounts (current login session). */
const COMMUNITY_ACCOUNT_SESSION_KEY = "diabeater_community_account_session";
/** @deprecated Cleared on logout — do not write. */
const SUPPORTER_ACCOUNT_PERSIST_KEY = "diabeater_supporter_account_v1";
/** @deprecated Cleared on logout — do not write. */
const COMMUNITY_ACCOUNT_PERSIST_KEY = "diabeater_community_account_v1";
/** Session cache of `profiles.primary_app_role` — survives navigation within a login session. */
const CLOUD_PRIMARY_APP_ROLE_KEY = "diabeater_cloud_primary_app_role";

/** Remove legacy device-global role markers so the next login uses the account's cloud profile. */
export function clearPersistedAccountRoleMarkers(): void {
  try {
    localStorage.removeItem(PRIMARY_APP_ROLE_PERSIST_KEY);
    localStorage.removeItem(ONBOARDING_ACCOUNT_PATH_KEY);
    localStorage.removeItem(SUPPORTER_ACCOUNT_PERSIST_KEY);
    localStorage.removeItem(COMMUNITY_ACCOUNT_PERSIST_KEY);
  } catch {
    // ignore
  }
  try {
    sessionStorage.removeItem(SUPPORTER_ACCOUNT_SESSION_KEY);
    sessionStorage.removeItem(COMMUNITY_ACCOUNT_SESSION_KEY);
  } catch {
    // ignore
  }
}

function primaryRoleFromOnboardingPath(path: OnboardingAccountPath): PrimaryAppRole | null {
  if (path === "supporter") return "carer";
  if (path === "community") return "community";
  if (path === "patient" || path === "both") return "patient";
  return null;
}

export type ActiveAppMode = "patient" | "carer" | "community";

/** Chosen on /welcome: drives default session mode when the account can use both User and Supporter. */
export type PrimaryAppRole = "patient" | "carer" | "community";

export type OnboardingAccountPath = "patient" | "supporter" | "both" | "community";

function emitModeChanged(mode: ActiveAppMode | null) {
  try {
    window.dispatchEvent(new CustomEvent("diabeater:app-mode", { detail: { mode } }));
  } catch {
    // ignore
  }
}

export function cacheCloudPrimaryAppRole(role: PrimaryAppRole | null): void {
  try {
    if (role === null) sessionStorage.removeItem(CLOUD_PRIMARY_APP_ROLE_KEY);
    else sessionStorage.setItem(CLOUD_PRIMARY_APP_ROLE_KEY, role);
  } catch {
    // ignore
  }
}

export function cacheCloudPrimaryAppRoleFromProfile(
  profile: { primary_app_role?: PrimaryAppRole | null } | null | undefined,
): void {
  const raw = profile?.primary_app_role;
  if (raw === "patient" || raw === "carer" || raw === "community") {
    cacheCloudPrimaryAppRole(raw);
  }
}

export function getCachedCloudPrimaryAppRole(): PrimaryAppRole | null {
  try {
    const raw = sessionStorage.getItem(CLOUD_PRIMARY_APP_ROLE_KEY);
    if (raw === "patient" || raw === "carer" || raw === "community") return raw;
  } catch {
    // ignore
  }
  return null;
}

export function clearCarerClientSessionKeys(): void {
  sessionStorage.removeItem(CARER_INTENT_KEY);
  sessionStorage.removeItem(CARER_LINKED_BANNER_KEY);
  sessionStorage.removeItem(PENDING_CARER_KEY);
  sessionStorage.removeItem(CARER_LINK_JUST_COMPLETED_AT_KEY);
  sessionStorage.removeItem(ACTIVE_CARER_PATIENT_ID_KEY);
  sessionStorage.removeItem(ACTIVE_APP_MODE_KEY);
  sessionStorage.removeItem(PRIMARY_APP_ROLE_KEY);
  sessionStorage.removeItem(CLOUD_PRIMARY_APP_ROLE_KEY);
  sessionStorage.removeItem(ONBOARDING_ACCOUNT_PATH_KEY);
  clearPersistedAccountRoleMarkers();
  emitModeChanged(null);
}

export function markPersistedSupporterAccount(): void {
  try {
    sessionStorage.setItem(SUPPORTER_ACCOUNT_SESSION_KEY, "1");
  } catch {
    // ignore
  }
}

export function clearPersistedSupporterAccount(): void {
  try {
    sessionStorage.removeItem(SUPPORTER_ACCOUNT_SESSION_KEY);
    localStorage.removeItem(SUPPORTER_ACCOUNT_PERSIST_KEY);
  } catch {
    // ignore
  }
}

export function isPersistedSupporterAccount(): boolean {
  try {
    if (sessionStorage.getItem(SUPPORTER_ACCOUNT_SESSION_KEY) === "1") return true;
    return getOnboardingAccountPath() === "supporter";
  } catch {
    return false;
  }
}

export function markPersistedCommunityAccount(): void {
  try {
    sessionStorage.setItem(COMMUNITY_ACCOUNT_SESSION_KEY, "1");
  } catch {
    // ignore
  }
}

export function clearPersistedCommunityAccount(): void {
  try {
    sessionStorage.removeItem(COMMUNITY_ACCOUNT_SESSION_KEY);
    localStorage.removeItem(COMMUNITY_ACCOUNT_PERSIST_KEY);
  } catch {
    // ignore
  }
}

export function isPersistedCommunityAccount(): boolean {
  try {
    if (sessionStorage.getItem(COMMUNITY_ACCOUNT_SESSION_KEY) === "1") return true;
    return getOnboardingAccountPath() === "community";
  } catch {
    return false;
  }
}

export function setOnboardingAccountPath(path: OnboardingAccountPath): void {
  try {
    sessionStorage.setItem(ONBOARDING_ACCOUNT_PATH_KEY, path);
    if (path === "supporter") markPersistedSupporterAccount();
    if (path === "community") markPersistedCommunityAccount();
  } catch {
    // ignore
  }
}

export function getOnboardingAccountPath(): OnboardingAccountPath | null {
  try {
    const raw = sessionStorage.getItem(ONBOARDING_ACCOUNT_PATH_KEY);
    if (raw === "patient" || raw === "supporter" || raw === "both" || raw === "community") return raw;
  } catch {
    // ignore
  }
  return null;
}

export function clearOnboardingAccountPath(): void {
  try {
    sessionStorage.removeItem(ONBOARDING_ACCOUNT_PATH_KEY);
    localStorage.removeItem(ONBOARDING_ACCOUNT_PATH_KEY);
  } catch {
    // ignore
  }
}

export function setPrimaryAppRole(role: PrimaryAppRole): void {
  sessionStorage.setItem(PRIMARY_APP_ROLE_KEY, role);
}

export function getPrimaryAppRole(): PrimaryAppRole | null {
  const raw = sessionStorage.getItem(PRIMARY_APP_ROLE_KEY);
  if (raw === "patient" || raw === "carer" || raw === "community") return raw;

  const cloud = getCachedCloudPrimaryAppRole();
  if (cloud) {
    sessionStorage.setItem(PRIMARY_APP_ROLE_KEY, cloud);
    return cloud;
  }

  const path = getOnboardingAccountPath();
  if (path) {
    const derived = primaryRoleFromOnboardingPath(path);
    if (derived) {
      sessionStorage.setItem(PRIMARY_APP_ROLE_KEY, derived);
      return derived;
    }
  }

  return null;
}

/** Account created as supporter-only on /welcome — no User Mode or mode switcher. */
export function isSupporterOnlyAccount(): boolean {
  const path = getOnboardingAccountPath();
  if (path === "patient" || path === "both") return false;
  if (localIndicatesPatientAccount()) return false;
  if (getPrimaryAppRole() === "patient") return false;
  if (path === "supporter") return true;
  if (isPersistedSupporterAccount()) return true;

  const cloud = getCachedCloudPrimaryAppRole();
  if (cloud === "patient" || cloud === "community") return false;
  if (cloud === "carer") return true;

  if (getPrimaryAppRole() === "carer") return true;
  return false;
}

/** Patient who also supports someone — keep User Mode and clear mistaken supporter-only flags. */
export function markDualRolePatientAfterLink(): void {
  setOnboardingAccountPath("both");
  setPrimaryAppRole("patient");
  clearPersistedSupporterAccount();
}

/** Dual-role accounts (patient + linked supporter) can swap User / Supporter mode. */
export function canSwitchAppMode(): boolean {
  const path = getOnboardingAccountPath();
  if (path === "patient" || path === "both") return true;
  return !isSupporterOnlyAccount();
}

/** Account created as community-only on /welcome — learn/feed session, not full patient tools. */
export function isCommunityOnlyAccount(): boolean {
  const path = getOnboardingAccountPath();
  if (path === "community") return true;
  if (path === "patient" || path === "both" || path === "supporter") return false;
  return getPrimaryAppRole() === "community";
}

/** Community Member path before linking as a supporter (local onboarding role/path). */
export function isCommunityMemberAccount(): boolean {
  return isCommunityOnlyAccount() || getPrimaryAppRole() === "community";
}

/** After a successful invite redeem, turn a community-only account into supporter-only. */
export function promoteCommunityMemberToSupporterAccount(): void {
  clearPersistedCommunityAccount();
  setPrimaryAppRole("carer");
  setOnboardingAccountPath("supporter");
  markPersistedSupporterAccount();
}

/**
 * Set supporter-only onboarding markers after linking.
 * Community members become supporter-only; fresh accounts with no role get the same defaults.
 */
export function applySupporterAccountRoleAfterLink(): void {
  if (isCommunityMemberAccount()) {
    promoteCommunityMemberToSupporterAccount();
    return;
  }
  if (localIndicatesPatientAccount()) {
    markDualRolePatientAfterLink();
    return;
  }
  const path = getOnboardingAccountPath();
  if (path === "patient" || path === "both") {
    if (path === "patient") setOnboardingAccountPath("both");
    if (getPrimaryAppRole() == null) setPrimaryAppRole("patient");
    clearPersistedSupporterAccount();
    return;
  }
  if (getPrimaryAppRole() === "patient") {
    setOnboardingAccountPath("both");
    clearPersistedSupporterAccount();
    return;
  }
  if (getPrimaryAppRole() == null) {
    setPrimaryAppRole("carer");
    if (getOnboardingAccountPath() == null) setOnboardingAccountPath("supporter");
  }
}

export type CommunitySessionModeOptions = {
  localCommunityProfile?: boolean;
  cloudCommunityProfile?: boolean;
};

/** Whether the UI should treat this session as Community Member mode. */
export function isCommunitySessionMode(
  hasCarerLink: boolean,
  activeMode: ActiveAppMode | null,
  options: CommunitySessionModeOptions = {},
): boolean {
  if (hasCarerLink) return false;
  if (isCommunityOnlyAccount()) return true;
  if (activeMode === "patient" || activeMode === "carer") return false;
  if (activeMode === "community") return true;
  return Boolean(options.localCommunityProfile || options.cloudCommunityProfile);
}

/** Whether the UI should treat this session as Supporter Mode. */
export function isCarerSessionMode(hasCarerLink: boolean, activeMode: ActiveAppMode | null): boolean {
  if (!hasCarerLink) return false;
  if (isSupporterOnlyAccount()) return true;
  return activeMode === "carer";
}

export function setCarerIntent(): void {
  sessionStorage.setItem(CARER_INTENT_KEY, "1");
}

export function hasCarerIntent(): boolean {
  return sessionStorage.getItem(CARER_INTENT_KEY) === "1";
}

export function clearCarerIntent(): void {
  sessionStorage.removeItem(CARER_INTENT_KEY);
}

/** Carer path chosen on /welcome; cleared after logout or successful redeem. */
export function setPendingCarer(): void {
  sessionStorage.setItem(PENDING_CARER_KEY, "true");
  sessionStorage.setItem(CARER_INTENT_KEY, "1");
}

export function clearPendingCarer(): void {
  sessionStorage.removeItem(PENDING_CARER_KEY);
}

export function hasPendingCarer(): boolean {
  return sessionStorage.getItem(PENDING_CARER_KEY) === "true";
}

export function setPendingPatient(): void {
  clearPendingCarer();
  clearCarerIntent();
}

/** Community-member path from /welcome: clears supporter intent (same as patient). */
export function setPendingCommunity(): void {
  clearPendingCarer();
  clearCarerIntent();
}

export function setCarerLinkedBannerMessage(text: string): void {
  sessionStorage.setItem(CARER_LINKED_BANNER_KEY, text);
}

/** Returns the banner text once, then clears it. */
export function consumeCarerLinkedBannerMessage(): string | null {
  const v = sessionStorage.getItem(CARER_LINKED_BANNER_KEY);
  if (v) sessionStorage.removeItem(CARER_LINKED_BANNER_KEY);
  return v;
}

/** Used to avoid bouncing back to /carer-setup while the new link propagates. */
export function markCarerLinkJustCompleted(): void {
  sessionStorage.setItem(CARER_LINK_JUST_COMPLETED_AT_KEY, String(Date.now()));
}

export function clearCarerLinkJustCompleted(): void {
  sessionStorage.removeItem(CARER_LINK_JUST_COMPLETED_AT_KEY);
}

export function getCarerLinkJustCompletedAt(): number | null {
  const raw = sessionStorage.getItem(CARER_LINK_JUST_COMPLETED_AT_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function setActiveCarerPatientId(patientId: string): void {
  sessionStorage.setItem(ACTIVE_CARER_PATIENT_ID_KEY, patientId);
}

export function getActiveCarerPatientId(): string | null {
  return sessionStorage.getItem(ACTIVE_CARER_PATIENT_ID_KEY);
}

export function clearActiveCarerPatientId(): void {
  sessionStorage.removeItem(ACTIVE_CARER_PATIENT_ID_KEY);
}

export function getActiveAppMode(): ActiveAppMode | null {
  const raw = sessionStorage.getItem(ACTIVE_APP_MODE_KEY);
  if (raw === "patient" || raw === "carer" || raw === "community") return raw;
  return null;
}

export function setActiveAppMode(mode: ActiveAppMode): void {
  sessionStorage.setItem(ACTIVE_APP_MODE_KEY, mode);
  emitModeChanged(mode);
}

export function clearActiveAppMode(): void {
  sessionStorage.removeItem(ACTIVE_APP_MODE_KEY);
  emitModeChanged(null);
}
