import { Capacitor } from "@capacitor/core";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  NotificationSettings,
  notificationSettingsLookHealthy,
  type NotificationSettingsSnapshot,
} from "@/lib/notification-settings-native";

/**
 * Shows iOS per-channel notification settings (lock screen, banners, sounds) and links to Settings.
 */
export function IosNotificationDisplayCard() {
  const [settings, setSettings] = useState<NotificationSettingsSnapshot | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (Capacitor.getPlatform() !== "ios") return;
    const load = async () => {
      try {
        setSettings(await NotificationSettings.getSettings());
        setLoadError(false);
      } catch {
        setSettings(null);
        setLoadError(true);
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 3000);
    return () => clearInterval(id);
  }, []);

  if (Capacitor.getPlatform() !== "ios") return null;

  const health = notificationSettingsLookHealthy(settings);

  return (
    <div
      className={`rounded-xl border p-4 space-y-2 ${
        health.ok ? "border-border/60 bg-muted/15" : "border-amber-600/40 bg-amber-950/15"
      }`}
    >
      <p className="text-sm font-semibold text-foreground">iPhone alert display</p>
      {loadError ? (
        <p className="text-small text-muted-foreground">
          Could not read notification settings. Update to the latest TestFlight build and reopen the app.
        </p>
      ) : settings ? (
        <ul className="text-small text-muted-foreground list-disc pl-4 space-y-0.5">
          <li>Banners / alerts: {settings.alertSetting}</li>
          <li>Lock Screen: {settings.lockScreenSetting}</li>
          <li>Notification Centre: {settings.notificationCenterSetting}</li>
          <li>Sounds: {settings.soundSetting}</li>
        </ul>
      ) : (
        <p className="text-small text-muted-foreground">Loading…</p>
      )}
      {!health.ok ? (
        <>
          <p className="text-small text-foreground leading-snug">
            If alerts only appear in Notification Centre with no pop-up or sound, iOS usually has{" "}
            <span className="font-medium">Banners</span> or <span className="font-medium">Sounds</span> off for
            Diabeaters, or <span className="font-medium">Deliver Quietly</span> is on. In{" "}
            <span className="font-medium">Settings → Notifications → Diabeaters</span>, set Banners to Temporary or
            Persistent, turn Sounds on, and turn Lock Screen on.
          </p>
          <p className="text-small text-muted-foreground leading-snug">
            Also check the side mute switch (no orange showing), turn off Focus / Do Not Disturb, and disable Scheduled
            Summary for Diabeaters if it is on.
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-1"
            onClick={() => void NotificationSettings.openAppSettings().catch(() => undefined)}
          >
            Open Diabeaters in iOS Settings
          </Button>
        </>
      ) : (
        <p className="text-small text-muted-foreground">
          Display channels look enabled. If you still have no sound, check the mute switch and Focus modes.
        </p>
      )}
    </div>
  );
}
