import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  NotificationSettings,
  notificationSettingsLookHealthy,
  type NotificationSettingsSnapshot,
} from "@/lib/notification-settings-native";

/**
 * On iOS native builds with the NotificationSettings plugin, surfaces per-channel
 * issues (banners, sounds, lock screen). Hidden when the plugin is unavailable
 * (older app binary) or when channels already look healthy — PushSoundHint covers basics.
 */
export function IosNotificationDisplayCard() {
  const [settings, setSettings] = useState<NotificationSettingsSnapshot | null>(null);
  const [pluginSupported, setPluginSupported] = useState<boolean | null>(null);

  useEffect(() => {
    if (Capacitor.getPlatform() !== "ios") return;

    if (!Capacitor.isPluginAvailable("NotificationSettings")) {
      setPluginSupported(false);
      return;
    }

    setPluginSupported(true);

    const load = async () => {
      try {
        setSettings(await NotificationSettings.getSettings());
      } catch {
        setSettings(null);
        setPluginSupported(false);
      }
    };

    void load();

    let removeAppListener: (() => void) | undefined;
    void App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void load();
    }).then((handle) => {
      removeAppListener = () => void handle.remove();
    });

    return () => {
      removeAppListener?.();
    };
  }, []);

  if (Capacitor.getPlatform() !== "ios") return null;
  if (pluginSupported !== true || !settings) return null;

  const health = notificationSettingsLookHealthy(settings);
  if (health.ok) return null;

  return (
    <div className="space-y-2 rounded-xl border border-amber-600/40 bg-amber-950/15 p-4">
      <p className="text-sm font-semibold text-foreground">iPhone alert display</p>
      <ul className="list-disc space-y-0.5 pl-4 text-small text-muted-foreground">
        <li>Banners / alerts: {settings.alertSetting}</li>
        <li>Lock Screen: {settings.lockScreenSetting}</li>
        <li>Notification Centre: {settings.notificationCenterSetting}</li>
        <li>Sounds: {settings.soundSetting}</li>
      </ul>
      <p className="text-small leading-snug text-foreground">
        If alerts only appear in Notification Centre with no pop-up or sound, iOS usually has{" "}
        <span className="font-medium">Banners</span> or <span className="font-medium">Sounds</span> off for Diabeaters,
        or <span className="font-medium">Deliver Quietly</span> is on. In{" "}
        <span className="font-medium">Settings → Notifications → Diabeaters</span>, set Banners to Temporary or
        Persistent, turn Sounds on, and turn Lock Screen on.
      </p>
      <p className="text-small leading-snug text-muted-foreground">
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
    </div>
  );
}
