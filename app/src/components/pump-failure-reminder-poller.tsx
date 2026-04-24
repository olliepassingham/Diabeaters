import { useEffect } from "react";

import { runPumpFailureReminderNotifier } from "@/lib/pump-failure-reminder-poller";

export function PumpFailureReminderPoller() {
  useEffect(() => {
    let mounted = true;
    const tick = async () => {
      if (!mounted) return;
      await runPumpFailureReminderNotifier();
    };

    void tick();
    const id = window.setInterval(() => void tick(), 30_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      mounted = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return null;
}

