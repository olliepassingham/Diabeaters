import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { getLinkedPatientForCarer } from "@/lib/carers";
import type { LinkedPatientInfo } from "@/lib/carers.types";

export const linkedPatientQueryKey = (userId: string | undefined) =>
  ["carer", "linkedPatient", userId] as const;

export async function fetchLinkedPatientForUser(): Promise<LinkedPatientInfo | null> {
  const result = await getLinkedPatientForCarer();
  return result.data ?? null;
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

export function invalidateLinkedPatientQuery(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string | undefined,
): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: linkedPatientQueryKey(userId) });
}
