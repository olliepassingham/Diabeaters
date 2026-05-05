const CARER_INTENT_KEY = "diabeater_carer_intent";
const CARER_LINKED_BANNER_KEY = "diabeater_carer_linked_banner";
const PENDING_CARER_KEY = "diabeater_pending_carer";
const CARER_LINK_JUST_COMPLETED_AT_KEY = "diabeater_carer_link_just_completed_at";
const ACTIVE_CARER_PATIENT_ID_KEY = "diabeater_active_carer_patient_id";
const ACTIVE_APP_MODE_KEY = "diabeater_active_app_mode";
const PRIMARY_APP_ROLE_KEY = "diabeater_primary_app_role";
/** Chosen on /welcome: patient-only, supporter-only, or both (patient tools + supporter linking). */
const ONBOARDING_ACCOUNT_PATH_KEY = "diabeater_onboarding_account_path_v1";

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

export function clearCarerClientSessionKeys(): void {
  sessionStorage.removeItem(CARER_INTENT_KEY);
  sessionStorage.removeItem(CARER_LINKED_BANNER_KEY);
  sessionStorage.removeItem(PENDING_CARER_KEY);
  sessionStorage.removeItem(CARER_LINK_JUST_COMPLETED_AT_KEY);
  sessionStorage.removeItem(ACTIVE_CARER_PATIENT_ID_KEY);
  sessionStorage.removeItem(ACTIVE_APP_MODE_KEY);
  sessionStorage.removeItem(PRIMARY_APP_ROLE_KEY);
  try {
    localStorage.removeItem(ONBOARDING_ACCOUNT_PATH_KEY);
  } catch {
    // ignore
  }
  // Legacy location (older builds); safe to clear if present.
  try {
    sessionStorage.removeItem(ONBOARDING_ACCOUNT_PATH_KEY);
  } catch {
    // ignore
  }
  emitModeChanged(null);
}

export function setOnboardingAccountPath(path: OnboardingAccountPath): void {
  try {
    localStorage.setItem(ONBOARDING_ACCOUNT_PATH_KEY, path);
  } catch {
    // ignore
  }
}

export function getOnboardingAccountPath(): OnboardingAccountPath | null {
  try {
    const raw = localStorage.getItem(ONBOARDING_ACCOUNT_PATH_KEY);
    if (raw === "patient" || raw === "supporter" || raw === "both" || raw === "community") return raw;
  } catch {
    // ignore
  }
  try {
    const legacy = sessionStorage.getItem(ONBOARDING_ACCOUNT_PATH_KEY);
    if (legacy === "patient" || legacy === "supporter" || legacy === "both" || legacy === "community") return legacy;
  } catch {
    // ignore
  }
  return null;
}

export function clearOnboardingAccountPath(): void {
  try {
    localStorage.removeItem(ONBOARDING_ACCOUNT_PATH_KEY);
  } catch {
    // ignore
  }
  try {
    sessionStorage.removeItem(ONBOARDING_ACCOUNT_PATH_KEY);
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
  return null;
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
