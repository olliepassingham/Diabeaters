const CARER_INTENT_KEY = "diabeater_carer_intent";
const CARER_LINKED_BANNER_KEY = "diabeater_carer_linked_banner";
const PENDING_CARER_KEY = "diabeater_pending_carer";
const ACTIVE_CARER_PATIENT_ID_KEY = "diabeater_active_carer_patient_id";
const ACTIVE_APP_MODE_KEY = "diabeater_active_app_mode";

export type ActiveAppMode = "patient" | "carer";

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
  sessionStorage.removeItem(ACTIVE_CARER_PATIENT_ID_KEY);
  sessionStorage.removeItem(ACTIVE_APP_MODE_KEY);
  emitModeChanged(null);
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

export function setCarerLinkedBannerMessage(text: string): void {
  sessionStorage.setItem(CARER_LINKED_BANNER_KEY, text);
}

/** Returns the banner text once, then clears it. */
export function consumeCarerLinkedBannerMessage(): string | null {
  const v = sessionStorage.getItem(CARER_LINKED_BANNER_KEY);
  if (v) sessionStorage.removeItem(CARER_LINKED_BANNER_KEY);
  return v;
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
  if (raw === "patient" || raw === "carer") return raw;
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
