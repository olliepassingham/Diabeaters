import { useCallback, useEffect, useState } from "react";
import { listPatientCarers } from "@/lib/carers-table";
import type { CarerRow } from "@/lib/carer-notify-types";

/**
 * Loads `public.carers` for the signed-in patient (hypo notify list).
 */
export function useCarers() {
  const [carers, setCarers] = useState<CarerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await listPatientCarers();
    if (err) {
      setError(err);
      setCarers([]);
    } else {
      setCarers(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { carers, loading, error, refresh };
}
