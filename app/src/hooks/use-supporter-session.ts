import { useEffect, useState } from "react";
import { getActiveAppMode, isCarerSessionMode } from "@/lib/carer-session";
import { useLinkedCarer } from "@/hooks/use-linked-carer";

/**
 * Supporter link vs active session mode.
 * Use `hasCarerLink` for eligibility that depends on having a link in the database.
 * Use `inSupporterSession` for UI and routes that should only apply while Supporter Mode is active.
 */
export function useSupporterSession() {
  const { isCarer: hasCarerLink, loading } = useLinkedCarer();
  const [activeMode, setActiveMode] = useState(() => getActiveAppMode());

  useEffect(() => {
    const onMode = (ev: Event) => {
      const ce = ev as CustomEvent<{ mode?: "patient" | "carer" | "community" | null }>;
      setActiveMode(ce.detail?.mode ?? getActiveAppMode());
    };
    window.addEventListener("diabeater:app-mode", onMode);
    return () => window.removeEventListener("diabeater:app-mode", onMode);
  }, []);

  const inSupporterSession = isCarerSessionMode(hasCarerLink, activeMode);

  return { hasCarerLink, activeMode, inSupporterSession, loading };
}
