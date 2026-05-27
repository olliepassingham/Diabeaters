import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

import { ensureAppointmentInAppRemindersForUser } from "@/lib/appointment-inapp-reminders";
import { rescheduleAppointmentReminders } from "@/lib/appointment-reminders";
import { useAuth } from "@/lib/auth-context";
import { storage } from "@/lib/storage";

const POLL_MS = 5 * 60 * 1000;

async function runAppointmentReminderScan(userId: string): Promise<void> {
  await ensureAppointmentInAppRemindersForUser(userId);
  await rescheduleAppointmentReminders(storage.getAppointmentsForUser(userId));
}

/**
 * Keeps iOS local appointment reminders in sync and delivers in-app reminders when
 * the user opens the app inside the evening-before or 2-hours-before windows.
 */
export function AppointmentReminderPoller() {
  const { user } = useAuth();

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    void runAppointmentReminderScan(userId);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void runAppointmentReminderScan(userId);
      }
    }, POLL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void runAppointmentReminderScan(userId);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    let appListener: { remove: () => Promise<void> } | null = null;
    let removed = false;

    if (Capacitor.isNativePlatform?.()) {
      void App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) void runAppointmentReminderScan(userId);
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
