import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

import { ensureBedtimeInAppRemindersForUser } from "@/lib/bedtime-inapp-reminders";
import { rescheduleBedtimeReminders } from "@/lib/bedtime-reminders";
import { useAuth } from "@/lib/auth-context";

const POLL_MS = 5 * 60 * 1000;

async function runBedtimeReminderScan(userId: string | undefined): Promise<void> {
  await rescheduleBedtimeReminders();
  if (userId) await ensureBedtimeInAppRemindersForUser(userId);
}

export function BedtimeReminderPoller() {
  const { user } = useAuth();

  useEffect(() => {
    const userId = user?.id;
    void runBedtimeReminderScan(userId);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void runBedtimeReminderScan(userId);
      }
    }, POLL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void runBedtimeReminderScan(userId);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    let appListener: { remove: () => Promise<void> } | null = null;
    let removed = false;

    if (Capacitor.isNativePlatform?.()) {
      void App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) void runBedtimeReminderScan(userId);
      }).then((handle) => {
        if (removed) void handle.remove();
        else appListener = handle;
      });
    }

    return () => {
      removed = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      if (appListener) void appListener.remove();
    };
  }, [user?.id]);

  return null;
}
