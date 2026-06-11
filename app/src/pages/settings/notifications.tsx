import type { ReactNode } from "react";
import { useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { NotificationSettings } from "@/lib/storage";
import { storage } from "@/lib/storage";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { IosNotificationDisplayCard } from "@/components/ios-notification-display-card";
import { ensureNativePushRegistered, syncRememberedPushTokenToSupabase } from "@/lib/push-tokens";
import { isNativePushPlatform, nativePlatformLabel } from "@/lib/native-platform";
import { BEDTIME_REMINDER_TIME_OPTIONS, DEFAULT_BEDTIME_REMINDER_TIME } from "@/lib/bedtime-reminder-schedule";
import { DevPushNotificationTestPanel } from "@/components/dev-push-notification-test";
import {
  SettingsGroup,
  SettingsGroupLabel,
  SettingsPanel,
  SettingsPanelBody,
  SettingsSubPageShell,
  SettingsToggleRow,
} from "./shared";

function PushSoundHint() {
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      For audible alerts, open {nativePlatformLabel()} Settings → Notifications → Diabeaters and turn on{" "}
      <span className="font-medium text-foreground">Sounds</span>,{" "}
      <span className="font-medium text-foreground">Banners</span>, and{" "}
      <span className="font-medium text-foreground">Lock Screen</span>. On iPhone, turn off{" "}
      <span className="font-medium text-foreground">Deliver Quietly</span> for Diabeaters and make sure the side mute
      switch is off (no orange visible).
    </p>
  );
}

export function NotificationsTab({
  notifSettings,
  onToggle,
  onThreshold,
  onBedtimeReminderTimeChange,
  embedded = false,
  supporterMode = false,
}: {
  notifSettings: NotificationSettings;
  onToggle: (key: keyof NotificationSettings, value: boolean) => void;
  onThreshold: (key: "criticalThresholdDays" | "lowThresholdDays", value: string) => void;
  onBedtimeReminderTimeChange?: (time: string) => void;
  embedded?: boolean;
  supporterMode?: boolean;
}) {
  const hypoOn = notifSettings.hypoAlerts !== false;
  const supplyOn = notifSettings.supplyAlerts !== false;
  const scenarioOn = notifSettings.scenarioAlerts !== false;
  const isPumpUser = isPumpDeliveryMethod(storage.getProfile()?.insulinDeliveryMethod);
  const communityFeedOn = notifSettings.communityFeedAlerts !== false;
  const communityDmOn = notifSettings.communityDmAlerts !== false;
  const supporterApptOn = notifSettings.supporterAppointmentReminders !== false;
  const appointmentAlertsOn = notifSettings.appointmentAlerts !== false;
  const masterOff = !notifSettings.enabled;

  const inner = (
    <div className="space-y-5">
      <div>
        <SettingsGroupLabel>General</SettingsGroupLabel>
        <SettingsGroup>
          <SettingsToggleRow
            id="notif-enabled"
            label="Enable notifications"
            description="Master switch for in-app alerts"
            checked={notifSettings.enabled}
            onCheckedChange={(checked) => onToggle("enabled", checked)}
            testId="switch-notifications-enabled"
          />
          <SettingsToggleRow
            id="notif-push"
            label="Push notifications"
            description={
              supporterMode
                ? "Lock-screen alerts for hypos, supplies, appointments, and travel/sick-day updates from the person you support, plus your community and messages."
                : "Receive alerts when the app is in the background"
            }
            checked={notifSettings.pushNotifications}
            onCheckedChange={(checked) => onToggle("pushNotifications", checked)}
            disabled={masterOff}
            testId="switch-push-notifications"
          />
        </SettingsGroup>
      </div>

      {isNativePushPlatform() && notifSettings.pushNotifications ? (
        <div className="space-y-2">
          <IosNotificationDisplayCard />
          <PushSoundHint />
        </div>
      ) : null}

      {supporterMode ? (
        <div>
          <SettingsGroupLabel>From the person you support</SettingsGroupLabel>
          <p className="mb-2 px-0.5 text-xs text-muted-foreground">
            Only sent when they allow it in Family &amp; supporters. In-app items also appear under Notifications.
          </p>
          <SettingsGroup>
            <SettingsToggleRow
              label="Hypo treated"
              description="When they log a treated hypo"
              checked={hypoOn}
              onCheckedChange={(checked) => onToggle("hypoAlerts", checked)}
              disabled={masterOff}
              testId="switch-hypo-alerts"
            />
            <SettingsToggleRow
              label="Supply alerts"
              description="When their shared supplies run low or critical"
              checked={supplyOn}
              onCheckedChange={(checked) => onToggle("supplyAlerts", checked)}
              disabled={masterOff}
              testId="switch-supply-alerts"
            />
            <SettingsToggleRow
              label="Travel & sick-day"
              description="When they start sick day or travel mode"
              checked={scenarioOn}
              onCheckedChange={(checked) => onToggle("scenarioAlerts", checked)}
              disabled={masterOff}
              testId="switch-scenario-alerts"
            />
            <SettingsToggleRow
              label="Appointment reminders"
              description="The evening before and about 2 hours before their shared appointments"
              checked={appointmentAlertsOn}
              onCheckedChange={(checked) => onToggle("appointmentAlerts", checked)}
              disabled={masterOff}
              testId="switch-supporter-appointment-alerts"
            />
          </SettingsGroup>
        </div>
      ) : (
        <>
          <div>
            <SettingsGroupLabel>Health & guides</SettingsGroupLabel>
            <SettingsGroup>
              <SettingsToggleRow
                label="Hypo alerts"
                description="Reminders related to low glucose and hypo treatment"
                checked={hypoOn}
                onCheckedChange={(checked) => onToggle("hypoAlerts", checked)}
                disabled={masterOff}
                testId="switch-hypo-alerts"
                className="scroll-mt-28"
              />
              <SettingsToggleRow
                label="Quick hypo log"
                description='When on, the dashboard "Treated a Hypo" button logs a hypo and notifies linked supporters without asking for glucose or treatment first.'
                checked={notifSettings.hypoDashboardQuickNotify === true}
                onCheckedChange={(checked) => onToggle("hypoDashboardQuickNotify", checked)}
                testId="switch-hypo-dashboard-quick"
              />
              <SettingsToggleRow
                label="Trend alerts"
                description="Supply levels and depletion forecasts"
                checked={notifSettings.supplyAlerts}
                onCheckedChange={(checked) => onToggle("supplyAlerts", checked)}
                disabled={masterOff}
                testId="switch-supply-alerts"
              />
              <SettingsToggleRow
                label="Travel & sick-day guides"
                description="Sick day, travel, and similar prompts"
                checked={scenarioOn}
                onCheckedChange={(checked) => onToggle("scenarioAlerts", checked)}
                disabled={masterOff}
                testId="switch-scenario-alerts"
              />
              <SettingsToggleRow
                label="Bedtime check"
                description="A gentle evening nudge to open your bedtime readiness check"
                checked={notifSettings.bedtimeCheckReminders !== false}
                onCheckedChange={(checked) => onToggle("bedtimeCheckReminders", checked)}
                disabled={masterOff}
                testId="switch-bedtime-check-reminders"
              />
              {notifSettings.bedtimeCheckReminders !== false ? (
                <div className="space-y-2 px-3.5 py-3 sm:px-4">
                  <Label htmlFor="bedtime-reminder-time" className="text-xs font-medium text-muted-foreground">
                    Reminder time
                  </Label>
                  <Select
                    value={notifSettings.bedtimeReminderTime || DEFAULT_BEDTIME_REMINDER_TIME}
                    onValueChange={(v) => onBedtimeReminderTimeChange?.(v)}
                    disabled={masterOff}
                  >
                    <SelectTrigger
                      id="bedtime-reminder-time"
                      className="h-10 rounded-xl"
                      data-testid="select-bedtime-reminder-time"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BEDTIME_REMINDER_TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Skips the reminder if you already completed a bedtime check that day.
                  </p>
                </div>
              ) : null}
              {isPumpUser ? (
                <SettingsToggleRow
                  label="Pump site & reservoir changes"
                  description="Reminder when your infusion set or reservoir is due (based on Supply Tracker dates)"
                  checked={notifSettings.pumpChangeReminders !== false}
                  onCheckedChange={(checked) => onToggle("pumpChangeReminders", checked)}
                  disabled={masterOff}
                  testId="switch-pump-change-reminders"
                />
              ) : null}
              <SettingsToggleRow
                label="Notify supporters about appointments"
                description="Evening before and about 2 hours before each appointment — for linked supporters who can see appointments"
                checked={supporterApptOn}
                onCheckedChange={(checked) => onToggle("supporterAppointmentReminders", checked)}
                disabled={masterOff}
                testId="switch-supporter-appointment-reminders"
              />
            </SettingsGroup>
          </div>

          <div id="notif-trends" className="scroll-mt-28">
            <SettingsGroupLabel>Supply thresholds</SettingsGroupLabel>
            <SettingsGroup>
              <div className="grid grid-cols-1 gap-4 px-3.5 py-3.5 sm:grid-cols-2 sm:px-4">
                <div className="space-y-2">
                  <Label htmlFor="critical-days" className="text-xs font-medium text-muted-foreground">
                    Critical alert (days)
                  </Label>
                  <Select
                    value={notifSettings.criticalThresholdDays.toString()}
                    onValueChange={(v) => onThreshold("criticalThresholdDays", v)}
                    disabled={masterOff || !notifSettings.supplyAlerts}
                  >
                    <SelectTrigger id="critical-days" className="h-10 rounded-xl" data-testid="select-critical-days">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 day</SelectItem>
                      <SelectItem value="2">2 days</SelectItem>
                      <SelectItem value="3">3 days</SelectItem>
                      <SelectItem value="5">5 days</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">Urgent when supply estimate falls below this</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="low-days" className="text-xs font-medium text-muted-foreground">
                    Low alert (days)
                  </Label>
                  <Select
                    value={notifSettings.lowThresholdDays.toString()}
                    onValueChange={(v) => onThreshold("lowThresholdDays", v)}
                    disabled={masterOff || !notifSettings.supplyAlerts}
                  >
                    <SelectTrigger id="low-days" className="h-10 rounded-xl" data-testid="select-low-days">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 days</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="10">10 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">Reminder to reorder</p>
                </div>
              </div>
            </SettingsGroup>
          </div>
        </>
      )}

      <div id="notif-community" className="scroll-mt-28">
        <SettingsGroupLabel>{supporterMode ? "Your supporter account" : "Community"}</SettingsGroupLabel>
        <SettingsGroup>
          <SettingsToggleRow
            label="Community feed"
            description="When someone likes or comments on your posts"
            checked={communityFeedOn}
            onCheckedChange={(checked) => onToggle("communityFeedAlerts", checked)}
            disabled={masterOff}
            testId="switch-community-feed-alerts"
          />
          <SettingsToggleRow
            label="Direct messages"
            description="When someone sends you a private message"
            checked={communityDmOn}
            onCheckedChange={(checked) => onToggle("communityDmAlerts", checked)}
            disabled={masterOff}
            testId="switch-community-dm-alerts"
          />
          {!supporterMode ? (
            <SettingsToggleRow
              label="Appointment reminders"
              description="The evening before (6pm) and again about 2 hours before each appointment"
              checked={notifSettings.appointmentReminders}
              onCheckedChange={(checked) => onToggle("appointmentReminders", checked)}
              disabled={masterOff}
              testId="switch-appointment-reminders"
            />
          ) : null}
        </SettingsGroup>
      </div>
    </div>
  );

  if (embedded) {
    return <div data-testid="card-notification-settings">{inner}</div>;
  }

  return inner;
}

type SettingsNotificationsRouteProps = {
  settingsInfoDialog: ReactNode;
  notifSettings: NotificationSettings;
  onToggle: (key: keyof NotificationSettings, value: boolean) => void;
  onThreshold: (key: "criticalThresholdDays" | "lowThresholdDays", value: string) => void;
  onBedtimeReminderTimeChange?: (time: string) => void;
  supporterMode?: boolean;
};

export function SettingsNotificationsRoute({
  settingsInfoDialog,
  notifSettings,
  onToggle,
  onThreshold,
  onBedtimeReminderTimeChange,
  supporterMode = false,
}: SettingsNotificationsRouteProps) {
  useEffect(() => {
    const t = window.setTimeout(() => {
      void (async () => {
        await ensureNativePushRegistered();
        await syncRememberedPushTokenToSupabase();
      })();
    }, 300);
    const t2 = window.setTimeout(() => void syncRememberedPushTokenToSupabase(), 2500);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, []);

  return (
    <SettingsSubPageShell
      title="Notifications"
      description={
        supporterMode
          ? "Alerts from the person you support and for your own community activity."
          : "Hypo alerts, supply trends, travel and sick-day guides, and community."
      }
      actions={settingsInfoDialog}
    >
      <SettingsPanel>
        <SettingsPanelBody className="space-y-5">
          <NotificationsTab
            notifSettings={notifSettings}
            onToggle={onToggle}
            onThreshold={onThreshold}
            onBedtimeReminderTimeChange={onBedtimeReminderTimeChange}
            embedded
            supporterMode={supporterMode}
          />
          <DevPushNotificationTestPanel />
        </SettingsPanelBody>
      </SettingsPanel>
    </SettingsSubPageShell>
  );
}
