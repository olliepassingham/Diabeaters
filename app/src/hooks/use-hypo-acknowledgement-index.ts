import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchHypoLogAcknowledgements,
  groupHypoAcknowledgementsByLogId,
  type HypoLogAcknowledgementRow,
} from "@/lib/hypo-log-acknowledgements";

export function useHypoAcknowledgementIndex(hypoLogIds: string[], userId: string | undefined) {
  const [byHypoId, setByHypoId] = useState<Map<string, HypoLogAcknowledgementRow[]>>(new Map());
  const [loading, setLoading] = useState(false);

  const idKey = useMemo(
    () =>
      [...new Set(hypoLogIds.map((id) => id.trim()).filter(Boolean))]
        .sort()
        .join(","),
    [hypoLogIds],
  );

  const refresh = useCallback(async () => {
    const ids = idKey ? idKey.split(",") : [];
    if (!userId || ids.length === 0) {
      setByHypoId(new Map());
      return;
    }
    setLoading(true);
    const res = await fetchHypoLogAcknowledgements(ids);
    setLoading(false);
    if (res.data) {
      setByHypoId(groupHypoAcknowledgementsByLogId(res.data));
    }
  }, [idKey, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasAcked = useCallback(
    (hypoLogId: string) => (byHypoId.get(hypoLogId) ?? []).some((row) => row.carer_id === userId),
    [byHypoId, userId],
  );

  return { byHypoId, hasAcked, loading, refresh };
}
