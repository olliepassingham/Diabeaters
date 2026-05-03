import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

import { DIABEATER_SETTINGS_CHANGED_EVENT, storage } from "@/lib/storage";
import {
  cancelHelpfulCheckInOnForeground,
  rescheduleHelpfulCheckInOnBackground,
} from "@/lib/ios-system-notifications";

/**
 * When opted in, schedules one iOS local "helpful check-in" on background and cancels on foreground.
 */
export function HelpfulCheckInScheduler() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform?.()) return;

    let appListener: { remove: () => Promise<void> } | null = null;
    let removed = false;

    const onSettings = () => {
      const s = storage.getNotificationSettings();
      if (!s.enabled || !s.helpfulCheckInsEnabled) {
        void cancelHelpfulCheckInOnForeground();
      }
    };
    window.addEventListener(DIABEATER_SETTINGS_CHANGED_EVENT, onSettings);

    void App.addListener("appStateChange", ({ isActive }) => {
      const s = storage.getNotificationSettings();
      if (!s.enabled || !s.helpfulCheckInsEnabled) {
        void cancelHelpfulCheckInOnForeground();
        return;
      }
      if (isActive) {
        void cancelHelpfulCheckInOnForeground();
      } else {
        void rescheduleHelpfulCheckInOnBackground();
      }
    }).then((handle) => {
      if (removed) void handle.remove();
      else appListener = handle;
    });

    return () => {
      removed = true;
      window.removeEventListener(DIABEATER_SETTINGS_CHANGED_EVENT, onSettings);
      if (appListener) void appListener.remove();
      void cancelHelpfulCheckInOnForeground();
    };
  }, []);

  return null;
}
