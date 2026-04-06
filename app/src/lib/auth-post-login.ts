import { getLinkedPatientForCarer } from "@/lib/carers";
import { hasCarerIntent, hasPendingCarer } from "@/lib/carer-session";

/**
 * Shared navigation after a successful password or OAuth session (login or signup when confirmations are off).
 */
export async function navigateAfterLoginSuccess(setLocation: (path: string) => void): Promise<void> {
  const link = await getLinkedPatientForCarer();
  if (link.data) {
    setLocation("/carer-view");
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
