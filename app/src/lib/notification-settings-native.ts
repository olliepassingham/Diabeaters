import { registerPlugin } from "@capacitor/core";

export type NotificationChannelSetting = "enabled" | "disabled" | "notSupported" | "unknown";

export interface NotificationSettingsSnapshot {
  authorizationStatus: string;
  alertSetting: NotificationChannelSetting;
  soundSetting: NotificationChannelSetting;
  badgeSetting: NotificationChannelSetting;
  lockScreenSetting: NotificationChannelSetting;
  notificationCenterSetting: NotificationChannelSetting;
  scheduledDeliverySetting?: NotificationChannelSetting;
}

export interface NotificationSettingsPlugin {
  getSettings(): Promise<NotificationSettingsSnapshot>;
  openAppSettings(): Promise<void>;
}

export const NotificationSettings = registerPlugin<NotificationSettingsPlugin>("NotificationSettings");

export function notificationSettingsLookHealthy(s: NotificationSettingsSnapshot | null): {
  ok: boolean;
  issues: string[];
} {
  if (!s) return { ok: false, issues: ["Could not read iOS notification settings (needs app build 1.0.5+)."] };
  const issues: string[] = [];
  if (s.authorizationStatus === "denied") {
    issues.push("Notifications are denied for Diabeaters.");
  }
  if (s.alertSetting !== "enabled") {
    issues.push("Banners/alerts are off (often caused by badge-only permission).");
  }
  if (s.lockScreenSetting !== "enabled") {
    issues.push("Lock Screen is off for Diabeaters.");
  }
  if (s.notificationCenterSetting !== "enabled") {
    issues.push("Notification Centre is off for Diabeaters.");
  }
  if (s.soundSetting !== "enabled") {
    issues.push("Sounds are off for Diabeaters.");
  }
  if (s.scheduledDeliverySetting === "enabled") {
    issues.push("Scheduled Summary is on — alerts may be delayed or bundled.");
  }
  return { ok: issues.length === 0, issues };
}
