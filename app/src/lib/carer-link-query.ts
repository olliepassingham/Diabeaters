import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { getLinkedPatientForCarer, listLinkedPatientsForCarer } from "@/lib/carers";
import { getCarerLinkJustCompletedAt } from "@/lib/carer-session";
import type { LinkedPatientInfo, LinkedPatientWithProfile } from "@/lib/carers.types";

export const linkedPatientQueryKey = (userId: string | undefined) =>
  ["carer", "linkedPatient", userId] as const;

export const linkedPatientsQueryKey = (userId: string | undefined) =>
  ["carer", "linkedPatients", userId] as const;

export function linkedPatientInfoToWithProfile(info: LinkedPatientInfo): LinkedPatientWithProfile {
  return {
    ...info,
    patient_full_name: null,
    patient_avatar_url: null,
  };
}

export async function fetchLinkedPatientForUser(): Promise<LinkedPatientInfo | null> {
  const result = await getLinkedPatientForCarer();
  return result.data ?? null;
}

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Full linked-patient list with profile names; retries briefly after a fresh link. */
export async function fetchLinkedPatientsForUser(): Promise<LinkedPatientWithProfile[]> {
  const justLinkedAt = getCarerLinkJustCompletedAt();
  const linkingGraceMs = 20_000;
  const shouldRetry =
    typeof justLinkedAt === "number" &&
    Date.now() - justLinkedAt >= 0 &&
    Date.now() - justLinkedAt < linkingGraceMs;
  const delays = shouldRetry ? [200, 500, 1000] : [];

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    const res = await listLinkedPatientsForCarer();
    lastErr = res.error;
    const rows = res.data ?? [];
    if (!lastErr && rows.length > 0) return rows;
    if (attempt < delays.length) await sleep(delays[attempt]!);
  }

  if (lastErr) throw lastErr;

  const fallback = await getLinkedPatientForCarer();
  if (fallback.data && !fallback.error) {
    return [linkedPatientInfoToWithProfile(fallback.data)];
  }
  return [];
}

/** Shared React Query cache for carer link lookups (dedupes App gate + ProtectedLayout + hooks). */
export function useLinkedPatientQuery() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: linkedPatientQueryKey(userId),
    queryFn: fetchLinkedPatientForUser,
    enabled: !authLoading && Boolean(userId),
    staleTime: 60_000,
  });
}

/** Enriched linked patients for Supporter Mode (names/avatars + scopes). */
export function useLinkedPatientsForCarerQuery() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const cachedLinkQuery = useLinkedPatientQuery();

  const placeholderPatients =
    cachedLinkQuery.data != null ? [linkedPatientInfoToWithProfile(cachedLinkQuery.data)] : undefined;

  return useQuery({
    queryKey: linkedPatientsQueryKey(userId),
    queryFn: fetchLinkedPatientsForUser,
    enabled: !authLoading && Boolean(userId),
    staleTime: 60_000,
    placeholderData: (previousData) => previousData ?? placeholderPatients,
  });
}

export function invalidateLinkedPatientQuery(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string | undefined,
): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: linkedPatientQueryKey(userId) });
}

export function invalidateLinkedPatientsQuery(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string | undefined,
): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: linkedPatientsQueryKey(userId) });
}

/** Invalidate all carer link caches after link/unlink. */
export async function invalidateCarerLinkQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string | undefined,
): Promise<void> {
  await Promise.all([
    invalidateLinkedPatientQuery(queryClient, userId),
    invalidateLinkedPatientsQuery(queryClient, userId),
  ]);
}

/** Warm supporter link list while the user is on other tabs in Supporter Mode. */
export function prefetchLinkedPatientsQuery(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string | undefined,
): void {
  if (!userId) return;
  void queryClient.prefetchQuery({
    queryKey: linkedPatientsQueryKey(userId),
    queryFn: fetchLinkedPatientsForUser,
    staleTime: 60_000,
  });
}
