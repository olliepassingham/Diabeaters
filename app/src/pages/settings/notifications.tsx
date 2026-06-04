import type { ReactNode } from "react";
import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { NotificationSettings } from "@/lib/storage";
import { Bell } from "lucide-react";
import { FaceLogoWatermark } from "@/components/face-logo";
import { PageHeader, PageShell } from "@/components/layout";
import { DevPushNotificationTestPanel } from "@/components/dev-push-notification-test";
import { IosNotificationDisplayCard } from "@/components/ios-notification-display-card";
import { PushTestUnlockCallout } from "@/components/push-test-unlock-callout";
import { ensureNativePushRegistered, syncRememberedPushTokenToSupabase } from "@/lib/push-tokens";
import { isNativePushPlatform, nativePlatformLabel } from "@/lib/native-platform";
import { SettingsBackLink } from "./shared";

export function NotificationsTab({
  notifSettings,
  onToggle,
  onThreshold,
  embedded = false,
  supporterMode = false,
}: {
  notifSettings: NotificationSettings;
  onToggle: (key: keyof NotificationSettings, value: boolean) => void;
  onThreshold: (key: "criticalThresholdDays" | "lowThresholdDays", value: string) => void;
  embedded?: boolean;
  /** Supporter Mode: alerts from the linked person + this account’s community/DM. */
  supporterMode?: boolean;
}) {
  const hypoOn = notifSettings.hypoAlerts !== false;
  const supplyOn = notifSettings.supplyAlerts !== false;
  const scenarioOn = notifSettings.scenarioAlerts !== false;
  const communityFeedOn = notifSettings.communityFeedAlerts !== false;
  const communityDmOn = notifSettings.communityDmAlerts !== false;

  const inner = (
    <div className="space-y-6">
      <div className="flex items-center justify-between py-3 border-b border-border">
        <div className="space-y-0.5 pr-4">
          <Label className="text-small text-muted-foreground">Enable notifications</Label>
          <p className="text-small text-muted-foreground">Master switch for in-app alerts</p>
        </div>
        <Switch
          checked={notifSettings.enabled}
          onCheckedChange={(checked) => onToggle("enabled", checked)}
          data-testid="switch-notifications-enabled"
        />
      </div>

      <div className="flex items-center justify-between py-3 border-b border-border">
        <div className="space-y-0.5 pr-4">
          <Label className="text-small text-muted-foreground">Push notifications</Label>
          <p className="text-small text-muted-foreground">
            {supporterMode
              ? "Lock-screen alerts for hypos, supplies, and travel/sick-day updates from the person you support, plus your community and messages."
              : "Receive alerts when the app is in the background"}
          </p>
          {isNativePushPlatform() && notifSettings.pushNotifications ? (
            <p className="text-small text-muted-foreground pt-1">
              For audible alerts, open {nativePlatformLabel()} Settings → Notifications → Diabeaters and turn on{" "}
              <span className="font-medium text-foreground">Sounds</span>,{" "}
              <span className="font-medium text-foreground">Banners</span>, and{" "}
              <span className="font-medium text-foreground">Lock Screen</span>. On iPhone, turn off{" "}
              <span className="font-medium text-foreground">Deliver Quietly</span> for Diabeaters and make sure the
              side mute switch is off (no orange visible).
            </p>
          ) : null}
        </div>
        <Switch
          checked={notifSettings.pushNotifications}
          onCheckedChange={(checked) => onToggle("pushNotifications", checked)}
          disabled={!notifSettings.enabled}
          data-testid="switch-push-notifications"
        />
      </div>

      {isNativePushPlatform() && notifSettings.pushNotifications ? (
        <IosNotificationDisplayCard />
      ) : null}

      {/*
        Push diagnostics intentionally removed for App Store review.
        Push can still be enabled via the switch above.
      */}

      {supporterMode ? (
        <div className="space-y-1 border-b border-border pb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1">
            From the person you support
          </p>
          <p className="text-small text-muted-foreground pb-2">
            Only sent when they allow it in Family &amp; supporters. In-app items also appear under Notifications.
          </p>
          <div className="flex items-center justify-between py-3 border-t border-border">
            <div className="space-y-0.5 pr-4">
              <Label className="text-small text-muted-foreground">Hypo treated</Label>
              <p className="text-small text-muted-foreground">When they log a treated hypo</p>
            </div>
            <Switch
              checked={hypoOn}
              onCheckedChange={(checked) => onToggle("hypoAlerts", checked)}
              disabled={!notifSettings.enabled}
              data-testid="switch-hypo-alerts"
            />
          </div>
          <div className="flex items-center justify-between py-3 border-t border-border">
            <div className="space-y-0.5 pr-4">
              <Label className="text-small text-muted-foreground">Supply alerts</Label>
              <p className="text-small text-muted-foreground">When their shared supplies run low or critical</p>
            </div>
            <Switch
              checked={supplyOn}
              onCheckedChange={(checked) => onToggle("supplyAlerts", checked)}
              disabled={!notifSettings.enabled}
              data-testid="switch-supply-alerts"
            />
          </div>
          <div className="flex items-center justify-between py-3 border-t border-border">
            <div className="space-y-0.5 pr-4">
              <Label className="text-small text-muted-foreground">Travel &amp; sick-day</Label>
              <p className="text-small text-muted-foreground">When they start sick day or travel mode</p>
            </div>
            <Switch
              checked={scenarioOn}
              onCheckedChange={(checked) => onToggle("scenarioAlerts", checked)}
              disabled={!notifSettings.enabled}
              data-testid="switch-scenario-alerts"
            />
          </div>
        </div>
      ) : null}

      {!supporterMode && (
        <>
          <div id="notif-hypo" className="scroll-mt-28 flex items-center justify-between py-3 border-b border-border">
            <div className="space-y-0.5 pr-4">
              <Label className="text-small text-muted-foreground">Hypo alerts</Label>
              <p className="text-small text-muted-foreground">Reminders related to low glucose and hypo treatment</p>
            </div>
            <Switch
              checked={hypoOn}
              onCheckedChange={(checked) => onToggle("hypoAlerts", checked)}
              disabled={!notifSettings.enabled}
              data-testid="switch-hypo-alerts"
            />
          </div>

          <div className="flex items-center justify-between py-3 border-b border-border">
            <div className="space-y-0.5 pr-4">
              <Label className="text-small text-muted-foreground">Quick hypo log</Label>
              <p className="text-small text-muted-foreground">
                When on, the dashboard &quot;Treated a Hypo&quot; button logs a hypo and notifies linked supporters without
                asking for glucose or treatment first. Turn off to enter details each time.
              </p>
            </div>
            <Switch
              checked={notifSettings.hypoDashboardQuickNotify === true}
              onCheckedChange={(checked) => onToggle("hypoDashboardQuickNotify", checked)}
              data-testid="switch-hypo-dashboard-quick"
            />
          </div>

          <div id="notif-trends" className="scroll-mt-28 space-y-4 border-b border-border pb-6">
            <div className="flex items-center justify-between py-3">
              <div className="space-y-0.5 pr-4">
                <Label className="text-small text-muted-foreground">Trend alerts</Label>
                <p className="text-small text-muted-foreground">Supply levels and depletion forecasts</p>
              </div>
              <Switch
                checked={notifSettings.supplyAlerts}
                onCheckedChange={(checked) => onToggle("supplyAlerts", checked)}
                disabled={!notifSettings.enabled}
                data-testid="switch-supply-alerts"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="critical-days" className="text-small text-muted-foreground">
                  Critical alert (days)
                </Label>
                <Select
                  value={notifSettings.criticalThresholdDays.toString()}
                  onValueChange={(v) => onThreshold("criticalThresholdDays", v)}
                  disabled={!notifSettings.enabled || !notifSettings.supplyAlerts}
                >
                  <SelectTrigger id="critical-days" data-testid="select-critical-days">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 day</SelectItem>
                    <SelectItem value="2">2 days</SelectItem>
                    <SelectItem value="3">3 days</SelectItem>
                    <SelectItem value="5">5 days</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-small text-muted-foreground">Urgent when supply estimate falls below this</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="low-days" className="text-small text-muted-foreground">
                  Low alert (days)
                </Label>
                <Select
                  value={notifSettings.lowThresholdDays.toString()}
                  onValueChange={(v) => onThreshold("lowThresholdDays", v)}
                  disabled={!notifSettings.enabled || !notifSettings.supplyAlerts}
                >
                  <SelectTrigger id="low-days" data-testid="select-low-days">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 days</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="10">10 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-small text-muted-foreground">Reminder to reorder</p>
              </div>
            </div>
          </div>

          <div id="notif-scenario" className="scroll-mt-28 flex items-center justify-between py-3 border-b border-border">
            <div className="space-y-0.5 pr-4">
              <Label className="text-small text-muted-foreground">Travel &amp; sick-day guide alerts</Label>
              <p className="text-small text-muted-foreground">Sick day, travel, and similar prompts</p>
            </div>
            <Switch
              checked={scenarioOn}
              onCheckedChange={(checked) => onToggle("scenarioAlerts", checked)}
              disabled={!notifSettings.enabled}
              data-testid="switch-scenario-alerts"
            />
          </div>
        </>
      )}

      {supporterMode ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1">
          Your supporter account
        </p>
      ) : null}

      <div id="notif-community" className="scroll-mt-28 flex items-center justify-between py-3 border-b border-border">
        <div className="space-y-0.5 pr-4">
          <Label className="text-small text-muted-foreground">Community feed</Label>
          <p className="text-small text-muted-foreground">When someone likes or comments on your posts</p>
        </div>
        <Switch
          checked={communityFeedOn}
          onCheckedChange={(checked) => onToggle("communityFeedAlerts", checked)}
          disabled={!notifSettings.enabled}
          data-testid="switch-community-feed-alerts"
        />
      </div>

      <div className="flex items-center justify-between py-3 border-b border-border">
        <div className="space-y-0.5 pr-4">
          <Label className="text-small text-muted-foreground">Direct messages</Label>
          <p className="text-small text-muted-foreground">When someone sends you a private message</p>
        </div>
        <Switch
          checked={communityDmOn}
          onCheckedChange={(checked) => onToggle("communityDmAlerts", checked)}
          disabled={!notifSettings.enabled}
          data-testid="switch-community-dm-alerts"
        />
      </div>

      {!supporterMode && (
        <div className="flex items-center justify-between py-3 border-b border-border">
          <div className="space-y-0.5 pr-4">
            <Label className="text-small text-muted-foreground">Appointment reminders</Label>
            <p className="text-small text-muted-foreground">
              The evening before (6pm) and again about 2 hours before each appointment
            </p>
          </div>
          <Switch
            checked={notifSettings.appointmentReminders}
            onCheckedChange={(checked) => onToggle("appointmentReminders", checked)}
            disabled={!notifSettings.enabled}
            data-testid="switch-appointment-reminders"
          />
        </div>
      )}
    </div>
  );

  if (embedded) {
    return <div data-testid="card-notification-settings">{inner}</div>;
  }

  return (
    <Card data-testid="card-notification-settings">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" aria-hidden />
          <CardTitle className="text-h3 font-semibold">Notifications</CardTitle>
        </div>
        <CardDescription className="text-body text-muted-foreground">
          {supporterMode
            ? "Hypos, supplies, and travel/sick-day from the person you support, plus community and messages on your account."
            : "Control alerts for hypos, supplies, travel and sick-day guides, community, and messages."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">{inner}</CardContent>
    </Card>
  );
}

type SettingsNotificationsRouteProps = {
  settingsInfoDialog: ReactNode;
  notifSettings: NotificationSettings;
  onToggle: (key: keyof NotificationSettings, value: boolean) => void;
  onThreshold: (key: "criticalThresholdDays" | "lowThresholdDays", value: string) => void;
  supporterMode?: boolean;
};

export function SettingsNotificationsRoute({
  settingsInfoDialog,
  notifSettings,
  onToggle,
  onThreshold,
  supporterMode = false,
}: SettingsNotificationsRouteProps) {
  useEffect(() => {
    /** One chained pass avoids overlapping getSession / auth locks with AuthProvider + Capacitor. */
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
    <PageShell variant="standard" className="relative space-y-6 bg-muted/20 text-foreground">
      <FaceLogoWatermark />
      <SettingsBackLink />
      <PageHeader
        className="mb-2"
        title="Notifications"
        description={
          supporterMode
            ? "Alerts from the person you support and for your own community activity."
            : "Hypo alerts, trend alerts, travel and sick-day guide alerts, and community feed."
        }
        actions={settingsInfoDialog}
      />
      <Card className="overflow-hidden rounded-2xl border-border/60 bg-card/80 shadow-sm ring-1 ring-border/40">
        <CardContent className="pt-6 pb-6">
          <NotificationsTab
            notifSettings={notifSettings}
            onToggle={onToggle}
            onThreshold={onThreshold}
            embedded
            supporterMode={supporterMode}
          />
          <PushTestUnlockCallout className="pt-2" />
          <DevPushNotificationTestPanel />
        </CardContent>
      </Card>
    </PageShell>
  );
}
