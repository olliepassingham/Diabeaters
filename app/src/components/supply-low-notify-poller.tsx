import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

import { runSupplyLowInAppNotifyScan } from "@/lib/supply-inapp-notify-scan";

/** Re-scan supply thresholds periodically while open; days-left can cross without editing stock. */
const POLL_MS = 15 * 60 * 1000;

/**
 * Runs low/critical supply cloud notifications when the app foregrounds or on a coarse timer.
 * Mirrors behaviour previously only triggered from edits on the Supplies page.
 */
export function SupplyLowNotifyPoller() {
  useEffect(() => {
    void runSupplyLowInAppNotifyScan();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void runSupplyLowInAppNotifyScan();
      }
    }, POLL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void runSupplyLowInAppNotifyScan();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    let appListener: { remove: () => Promise<void> } | null = null;
    let removed = false;

    if (Capacitor.isNativePlatform?.()) {
      void App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) void runSupplyLowInAppNotifyScan();
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
  }, []);

  return null;
}
