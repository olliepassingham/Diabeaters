import { useCallback, useEffect, useRef, useState } from "react";
import { cloudLiveGlucoseToPrefill } from "@/lib/cgm/live-glucose-sync";
import type { BgPrefillResult } from "@/lib/cgm/prefill";
import { fetchLiveGlucoseForLinkedPatient } from "@/lib/carers";
import type { CloudPatientLiveGlucoseRow } from "@/lib/carers.types";

const SUPPORTER_LIVE_POLL_MS = 5 * 60_000;

export function useSupporterLiveBg(patientId: string | null, enabled: boolean): {
  prefill: BgPrefillResult | null;
  row: CloudPatientLiveGlucoseRow | null;
  loading: boolean;
  refresh: () => void;
} {
  const [prefill, setPrefill] = useState<BgPrefillResult | null>(null);
  const [row, setRow] = useState<CloudPatientLiveGlucoseRow | null>(null);
  const [loading, setLoading] = useState(false);
  const loadIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!enabled || !patientId) {
      setPrefill(null);
      setRow(null);
      setLoading(false);
      return;
    }

    const requestId = ++loadIdRef.current;
    setLoading(true);
    try {
      const { data, error } = await fetchLiveGlucoseForLinkedPatient(patientId);
      if (requestId !== loadIdRef.current) return;
      if (error || !data) {
        setPrefill(null);
        setRow(null);
        return;
      }
      setRow(data);
      setPrefill(cloudLiveGlucoseToPrefill(data));
    } finally {
      if (requestId === loadIdRef.current) setLoading(false);
    }
  }, [enabled, patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!enabled || !patientId) return;
    const id = window.setInterval(() => void load(), SUPPORTER_LIVE_POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled, load, patientId]);

  return { prefill, row, loading, refresh: () => void load() };
}
