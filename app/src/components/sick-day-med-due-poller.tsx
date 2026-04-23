import { useEffect } from "react";
import { bootstrapSickDayMedRemindersOnForeground, runSickDayMedDueNotifier } from "@/lib/sick-day-med-due-poller";

const POLL_MS = 30_000;

/**
 * Fires due-time sick day medication in-app notifications while the app is open (and on a coarse interval).
 * Also re-attaches native local notifications after resume. Skipped in supporter-only carer mode by parent.
 */
export function SickDayMedDuePoller() {
  useEffect(() => {
    void bootstrapSickDayMedRemindersOnForeground();

    const interval = window.setInterval(() => {
      void runSickDayMedDueNotifier();
    }, POLL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void bootstrapSickDayMedRemindersOnForeground();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
