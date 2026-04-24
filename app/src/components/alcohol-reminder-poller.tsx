import { useEffect } from "react";

import { runAlcoholReminderNotifier } from "@/lib/alcohol-reminder-poller";

/**
 * Foreground poller for Alcohol Mode reminder in-app notifications.
 * iOS local notifications are scheduled separately; this covers in-app + web notifications while the app is open.
 */
export function AlcoholReminderPoller() {
  useEffect(() => {
    let mounted = true;
    const tick = async () => {
      if (!mounted) return;
      await runAlcoholReminderNotifier();
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

