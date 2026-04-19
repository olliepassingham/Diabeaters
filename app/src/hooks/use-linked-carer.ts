import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getLinkedPatientForCarer } from "@/lib/carers";
import type { LinkedPatientInfo } from "@/lib/carers.types";

export function useLinkedCarer() {
  const { user, loading: authLoading } = useAuth();
  const [resolving, setResolving] = useState(true);
  const [linked, setLinked] = useState<LinkedPatientInfo | null>(null);

  const refetch = useCallback(async () => {
    if (!user?.id) {
      setLinked(null);
      setResolving(false);
      return;
    }
    setResolving(true);
    const r = await getLinkedPatientForCarer();
    setLinked(r.data ?? null);
    setResolving(false);
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    void refetch();
  }, [authLoading, refetch]);

  useEffect(() => {
    const onLink = () => {
      void refetch();
    };
    window.addEventListener("diabeater:carer-link-updated", onLink);
    return () => window.removeEventListener("diabeater:carer-link-updated", onLink);
  }, [refetch]);

  return {
    loading: authLoading || resolving,
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
