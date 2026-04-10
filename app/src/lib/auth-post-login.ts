import { getLinkedPatientForCarer } from "@/lib/carers";
import {
  getPrimaryAppRole,
  hasCarerIntent,
  hasPendingCarer,
  setActiveAppMode,
} from "@/lib/carer-session";

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
  setLocation("/");
}
