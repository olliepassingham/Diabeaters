import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import type { LinkedPatientInfo } from "@/lib/carers.types";
import {
  invalidateLinkedPatientQuery,
  useLinkedPatientQuery,
} from "@/lib/carer-link-query";
import { getActiveAppMode } from "@/lib/carer-session";

/**
 * Source-of-truth link detection from backend (`public.carer_links`).
 * `data !== null` means this account can open Supporter Mode for a linked patient (when that mode is selected).
 */
export function useLinkedPatient(): {
  data: LinkedPatientInfo | null;
  loading: boolean;
  isFetched: boolean;
  refetch: () => Promise<void>;
} {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const linkQuery = useLinkedPatientQuery();
  const [activeMode, setActiveMode] = useState(() => getActiveAppMode());

  const refetch = useCallback(async () => {
    await invalidateLinkedPatientQuery(queryClient, user?.id);
  }, [queryClient, user?.id]);

  useEffect(() => {
    const onLink = () => {
      void refetch();
    };
    window.addEventListener("diabeater:carer-link-updated", onLink);
    return () => window.removeEventListener("diabeater:carer-link-updated", onLink);
  }, [refetch]);

  useEffect(() => {
    const onMode = (ev: Event) => {
      const ce = ev as CustomEvent<{ mode?: "patient" | "carer" | "community" | null }>;
      setActiveMode(ce.detail?.mode ?? getActiveAppMode());
    };
    window.addEventListener("diabeater:app-mode", onMode);
    return () => window.removeEventListener("diabeater:app-mode", onMode);
  }, []);

  return {
    data: activeMode === "carer" ? (linkQuery.data ?? null) : null,
    loading: authLoading || linkQuery.isLoading,
    isFetched: linkQuery.isFetched,
    refetch,
  };
}
