import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

import { reschedulePumpChangeReminders } from "@/lib/pump-change-reminders";
import { DIABEATER_SETTINGS_CHANGED_EVENT } from "@/lib/storage";

const POLL_MS = 5 * 60 * 1000;

export function PumpChangeReminderPoller() {
  useEffect(() => {
    void reschedulePumpChangeReminders();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void reschedulePumpChangeReminders();
      }
    }, POLL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void reschedulePumpChangeReminders();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    const onSettings = () => {
      void reschedulePumpChangeReminders();
    };
    window.addEventListener(DIABEATER_SETTINGS_CHANGED_EVENT, onSettings);

    let appListener: { remove: () => Promise<void> } | null = null;
    if (Capacitor.isNativePlatform?.()) {
      void App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) void reschedulePumpChangeReminders();
      }).then((l) => {
        appListener = l;
      });
    }

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(DIABEATER_SETTINGS_CHANGED_EVENT, onSettings);
      void appListener?.remove();
    };
  }, []);

  return null;
}
