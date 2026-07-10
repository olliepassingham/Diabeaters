import { useEffect, useRef } from "react";

import {
  registerExerciseCgmServerMonitor,
  shouldUseExerciseCgmServerMonitor,
  unregisterExerciseCgmServerMonitor,
} from "@/lib/exercise-cgm-server-monitor";
import { DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT, storage } from "@/lib/storage";

/**
 * Registers server-side Dexcom Share polling while exercise is active so low-BG
 * push alerts can fire when the app is backgrounded.
 */
export function ExerciseCgmServerMonitorSync() {
  const lastSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const sync = async () => {
      if (!mounted) return;
      const session = storage.getActiveExercise();

      if (!session || !shouldUseExerciseCgmServerMonitor(session)) {
        const prevId = lastSessionIdRef.current;
        if (prevId) {
          lastSessionIdRef.current = null;
          await unregisterExerciseCgmServerMonitor(prevId);
        }
        return;
      }

      if (lastSessionIdRef.current && lastSessionIdRef.current !== session.id) {
        await unregisterExerciseCgmServerMonitor(lastSessionIdRef.current);
      }

      lastSessionIdRef.current = session.id;
      await registerExerciseCgmServerMonitor(session);
    };

    void sync();
    const interval = window.setInterval(() => void sync(), 60_000);
    window.addEventListener(DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT, sync);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.removeEventListener(DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT, sync);
      const prevId = lastSessionIdRef.current;
      lastSessionIdRef.current = null;
      if (prevId) void unregisterExerciseCgmServerMonitor(prevId);
    };
  }, []);

  return null;
}
