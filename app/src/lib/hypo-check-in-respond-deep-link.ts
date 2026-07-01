/** Programmatically open the hypo check-in respond bottom sheet. */
export const OPEN_HYPO_CHECK_IN_RESPOND_EVENT = "diabeaters:open-hypo-check-in-respond";

const PENDING_KEY = "diabeaters:pending_hypo_check_in_respond";

export type PendingHypoCheckInRespond = {
  checkInId: string;
  carerName: string;
};

export function storePendingHypoCheckInRespond(payload: PendingHypoCheckInRespond): void {
  const checkInId = payload.checkInId?.trim();
  if (!checkInId) return;
  try {
    sessionStorage.setItem(
      PENDING_KEY,
      JSON.stringify({
        checkInId,
        carerName: payload.carerName?.trim() || "Your supporter",
      }),
    );
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
    const checkInId = parsed?.checkInId?.trim();
    if (!checkInId) return null;
    return {
      checkInId,
      carerName: parsed.carerName?.trim() || "Your supporter",
    };
  } catch {
    return null;
  }
}

export function requestOpenHypoCheckInRespondSheet(payload: PendingHypoCheckInRespond): void {
  storePendingHypoCheckInRespond(payload);
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_HYPO_CHECK_IN_RESPOND_EVENT));
}
