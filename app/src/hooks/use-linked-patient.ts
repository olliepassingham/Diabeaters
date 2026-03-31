import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import type { LinkedPatientInfo } from "@/lib/carers.types";
import { getLinkedPatientForCarer } from "@/lib/carers";
import { getActiveAppMode } from "@/lib/carer-session";

/**
 * Source-of-truth mode detection from backend (`public.carer_links`).
 * `data !== null` means the current user is in carer mode.
 */
export function useLinkedPatient(): {
  data: LinkedPatientInfo | null;
  loading: boolean;
  refetch: () => Promise<void>;
} {
  const { user, loading: authLoading } = useAuth();
  const [resolving, setResolving] = useState(true);
  const [linkedPatient, setLinkedPatient] = useState<LinkedPatientInfo | null>(null);
  const [activeMode, setActiveMode] = useState(() => getActiveAppMode());

  const refetch = useCallback(async () => {
    if (!user?.id) {
      setLinkedPatient(null);
      setResolving(false);
      return;
    }
    setResolving(true);
    const result = await getLinkedPatientForCarer();
    setLinkedPatient(result.data ?? null);
    setResolving(false);
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    void refetch();
  }, [authLoading, refetch]);

  useEffect(() => {
    const onMode = (ev: Event) => {
      const ce = ev as CustomEvent<{ mode?: "patient" | "carer" | null }>;
      setActiveMode(ce.detail?.mode ?? getActiveAppMode());
    };
    window.addEventListener("diabeater:app-mode", onMode);
    return () => window.removeEventListener("diabeater:app-mode", onMode);
  }, []);

  return {
    data: activeMode === "carer" ? linkedPatient : null,
    loading: authLoading || resolving,
    refetch,
  };
}
