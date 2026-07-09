import { useEffect } from "react";

import { EXERCISE_CGM_ALERT_POLL_MS, runExerciseCgmAlertNotifier } from "@/lib/exercise-cgm-alerts";
import { DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT } from "@/lib/storage";

/**
 * Foreground poller for exercise-time CGM low alerts while an exercise session is active.
 * Uses live CGM reads and local notifications (native) or the Web Notifications API.
 */
export function ExerciseCgmAlertPoller() {
  useEffect(() => {
    let mounted = true;
    const tick = async () => {
      if (!mounted) return;
      await runExerciseCgmAlertNotifier();
    };

    void tick();
    const id = window.setInterval(() => void tick(), EXERCISE_CGM_ALERT_POLL_MS);

    const onVis = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener(DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT, tick);

    return () => {
      mounted = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener(DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT, tick);
    };
  }, []);

  return null;
}
