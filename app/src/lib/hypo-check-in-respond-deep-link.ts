import { requestCloseNotificationBell } from "@/lib/notification-inbox-deep-link";
import { parseGlucoseConcern, type GlucoseConcern } from "@/lib/hypo-check-in-copy";

/** Programmatically open the hypo check-in respond bottom sheet. */
export const OPEN_HYPO_CHECK_IN_RESPOND_EVENT = "diabeaters:open-hypo-check-in-respond";

const PENDING_KEY = "diabeaters:pending_hypo_check_in_respond";

export type PendingHypoCheckInRespond = {
  checkInId: string;
  carerName: string;
  glucoseConcern: GlucoseConcern;
};

function normalizePayload(payload: {
  checkInId?: string;
  carerName?: string;
  glucoseConcern?: unknown;
}): PendingHypoCheckInRespond | null {
  const checkInId = payload.checkInId?.trim();
  if (!checkInId) return null;
  return {
    checkInId,
    carerName: payload.carerName?.trim() || "Your supporter",
    glucoseConcern: parseGlucoseConcern(payload.glucoseConcern),
  };
}

export function storePendingHypoCheckInRespond(payload: {
  checkInId: string;
  carerName?: string;
  glucoseConcern?: GlucoseConcern;
}): void {
  const normalized = normalizePayload(payload);
  if (!normalized) return;
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(normalized));
  } catch {
    // ignore
  }
}

export function consumePendingHypoCheckInRespond(): PendingHypoCheckInRespond | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_KEY);
    const parsed = JSON.parse(raw) as PendingHypoCheckInRespond;
    return normalizePayload(parsed);
  } catch {
    return null;
  }
}

export function requestOpenHypoCheckInRespondSheet(payload: {
  checkInId: string;
  carerName?: string;
  glucoseConcern?: GlucoseConcern;
}): void {
  storePendingHypoCheckInRespond(payload);
  if (typeof window === "undefined") return;
  // Respond is often started from the notification bell; that popover sits above the
  // bottom sheet (higher z-index), so close it first or the actions stay trapped underneath.
  requestCloseNotificationBell();
  window.dispatchEvent(new CustomEvent(OPEN_HYPO_CHECK_IN_RESPOND_EVENT));
}
