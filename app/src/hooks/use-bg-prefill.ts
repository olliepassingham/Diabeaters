import { useCallback, useEffect, useState } from "react";
import { getBgPrefill, type BgPrefillResult } from "@/lib/cgm/prefill";
import { normalizeBgUnits } from "@/lib/alcohol-night-tool";
import { storage } from "@/lib/storage";

export function useBgPrefill(): {
  prefill: BgPrefillResult | null;
  loading: boolean;
  refresh: () => void;
} {
  const [prefill, setPrefill] = useState<BgPrefillResult | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const profile = storage.getProfile();
    const units = normalizeBgUnits(profile?.bgUnits);
    setLoading(true);
    try {
      const result = await getBgPrefill(units);
      setPrefill(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { prefill, loading, refresh: () => void load() };
}
