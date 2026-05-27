import { useCallback, useEffect, useState } from "react";

import {
  collectCarerActivityEvents,
  type ActivityEvent,
} from "@/lib/activity-history";
import {
  collectCarerScenarioCalendarDays,
  type ScenarioCalendarDayMap,
} from "@/lib/scenario-calendar";
import {
  fetchAppointmentsForLinkedPatient,
  fetchHypoLogsForLinkedPatient,
  fetchScenariosForLinkedPatient,
} from "@/lib/carers";
import type { CarerScopes } from "@/lib/carers.types";

export function useCarerActivityHistory(patientId: string | null, scopes: CarerScopes | null) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [scenarioCalendarDays, setScenarioCalendarDays] = useState<ScenarioCalendarDayMap>(() => new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!patientId || !scopes) {
      setEvents([]);
      setScenarioCalendarDays(new Map());
      return;
    }

    const hasAny =
      scopes.hypo_alerts || scopes.scenarios || scopes.appointments;
    if (!hasAny) {
      setEvents([]);
      setScenarioCalendarDays(new Map());
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [hl, sc, ap] = await Promise.all([
        scopes.hypo_alerts
          ? fetchHypoLogsForLinkedPatient(patientId)
          : Promise.resolve({ data: [], error: null }),
        scopes.scenarios
          ? fetchScenariosForLinkedPatient(patientId)
          : Promise.resolve({ data: [], error: null }),
        scopes.appointments
          ? fetchAppointmentsForLinkedPatient(patientId)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const err = hl.error ?? sc.error ?? ap.error;
      if (err) {
        setError(err.message);
        setEvents([]);
        setScenarioCalendarDays(new Map());
        return;
      }

      const scenarioRows = sc.data ?? [];
      setEvents(
        collectCarerActivityEvents({
          hypoLogs: hl.data ?? [],
          scenarioRows,
          appointmentRows: ap.data ?? [],
          scopes,
        }),
      );
      setScenarioCalendarDays(
        scopes.scenarios ? collectCarerScenarioCalendarDays(scenarioRows) : new Map(),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load activity");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [patientId, scopes]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { events, scenarioCalendarDays, loading, error, refresh };
}
