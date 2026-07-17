import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import type { LinkedPatientWithProfile } from "@/lib/carers.types";
import {
  invalidateLinkedPatientQuery,
  linkedPatientInfoToWithProfile,
  useLinkedPatientQuery,
  useLinkedPatientsForCarerQuery,
} from "@/lib/carer-link-query";
import {
  ACTIVE_CARER_PATIENT_CHANGED_EVENT,
  getActiveAppMode,
  getActiveCarerPatientId,
  isCarerSessionMode,
} from "@/lib/carer-session";

/**
 * Source-of-truth link detection from backend (`public.carer_links`).
 * `data !== null` means this account can open Supporter Mode for a linked patient (when that mode is selected).
 * Multi-patient carers: resolves to the person selected on the supporter home
 * (`getActiveCarerPatientId`), falling back to the most recently linked patient.
 */
export function useLinkedPatient(): {
  data: LinkedPatientWithProfile | null;
  loading: boolean;
  isFetched: boolean;
  refetch: () => Promise<void>;
} {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const linkQuery = useLinkedPatientQuery();
  const patientsQuery = useLinkedPatientsForCarerQuery();
  const [activeMode, setActiveMode] = useState(() => getActiveAppMode());
  const [activePatientId, setActivePatientId] = useState(() => getActiveCarerPatientId());

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

  useEffect(() => {
    const onActivePatient = () => setActivePatientId(getActiveCarerPatientId());
    window.addEventListener(ACTIVE_CARER_PATIENT_CHANGED_EVENT, onActivePatient);
    return () => window.removeEventListener(ACTIVE_CARER_PATIENT_CHANGED_EVENT, onActivePatient);
  }, []);

  const hasLink = Boolean(linkQuery.data) || (patientsQuery.data?.length ?? 0) > 0;
  const inCarerMode = isCarerSessionMode(hasLink, activeMode);

  const resolved = useMemo<LinkedPatientWithProfile | null>(() => {
    const rows = patientsQuery.data ?? [];
    if (rows.length > 0) {
      return rows.find((r) => r.patientId === activePatientId) ?? rows[0]!;
    }
    return linkQuery.data ? linkedPatientInfoToWithProfile(linkQuery.data) : null;
  }, [patientsQuery.data, activePatientId, linkQuery.data]);

  return {
    data: inCarerMode ? resolved : null,
    loading: authLoading || linkQuery.isLoading,
    isFetched: linkQuery.isFetched,
    refetch,
  };
}
