import { useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import {
  invalidateCarerLinkQueries,
  useLinkedPatientQuery,
} from "@/lib/carer-link-query";

export function useLinkedCarer() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const linkQuery = useLinkedPatientQuery();

  const refetch = useCallback(async () => {
    await invalidateCarerLinkQueries(queryClient, user?.id);
  }, [queryClient, user?.id]);

  useEffect(() => {
    const onLink = () => {
      void refetch();
    };
    window.addEventListener("diabeater:carer-link-updated", onLink);
    return () => window.removeEventListener("diabeater:carer-link-updated", onLink);
  }, [refetch]);

  const linked = linkQuery.data ?? null;

  return {
    loading: authLoading || linkQuery.isLoading,
    linked,
    isCarer: Boolean(linked),
    refetch,
  };
}

/** @deprecated Prefer useLinkedCarer — kept for call sites that only need patientId. */
export function useLinkedCarerPatient() {
  const { loading, linked, isCarer } = useLinkedCarer();
  return { loading, isCarer, patientId: linked?.patientId ?? null };
}
