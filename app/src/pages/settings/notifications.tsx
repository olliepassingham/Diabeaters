import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import type { NotificationSettings } from "@/lib/storage";
import { Bell } from "lucide-react";
import { FaceLogoWatermark } from "@/components/face-logo";
import { PageHeader, PageShell } from "@/components/layout";
import { SettingsBackLink } from "./shared";
import { Capacitor } from "@capacitor/core";
import { readPushDiag } from "@/lib/push-tokens";
import { invokeNotifyPushTest } from "@/lib/invoke-notify-push-test";
import { useToast } from "@/hooks/use-toast";

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
  /** Supporter Mode: only alerts for the supporter’s own account (e.g. feed and messages), not the person they support. */
  supporterMode?: boolean;
}) {
  const hypoOn = notifSettings.hypoAlerts !== false;
  const scenarioOn = notifSettings.scenarioAlerts !== false;
  const communityFeedOn = notifSettings.communityFeedAlerts !== false;
  const communityDmOn = notifSettings.communityDmAlerts !== false;

  const pushDiag = readPushDiag();
  const isIosNative = Capacitor.isNativePlatform?.() && Capacitor.getPlatform?.() === "ios";
  const { toast } = useToast();

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
          <Label className="text-small text-muted-foreground">Push notifications (iOS)</Label>
          <p className="text-small text-muted-foreground">Receive alerts when the app is in the background</p>
        </div>
        <Switch
          checked={notifSettings.pushNotifications}
          onCheckedChange={(checked) => onToggle("pushNotifications", checked)}
          disabled={!notifSettings.enabled}
          data-testid="switch-push-notifications"
        />
      </div>

      {isIosNative ? (
        <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-small text-muted-foreground">Push diagnostics</Label>
            <span className="text-xs text-muted-foreground">iOS</span>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-muted-foreground">
            <div>State: {typeof pushDiag?.state === "string" ? pushDiag.state : "unknown"}</div>
            <div>Token: {typeof pushDiag?.tokenPrefix === "string" ? pushDiag.tokenPrefix : "—"}</div>
            <div>Save: {typeof pushDiag?.saveError === "string" && pushDiag.saveError ? pushDiag.saveError : "ok/unknown"}</div>
            <div>
              Error: {typeof pushDiag?.error === "string" && pushDiag.error ? pushDiag.error : "—"}
            </div>
            <div>Updated: {typeof pushDiag?.updatedAt === "string" ? pushDiag.updatedAt : "—"}</div>
          </div>
          <div className="mt-3 flex items-center justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!notifSettings.enabled || !notifSettings.pushNotifications}
              onClick={() => {
                void (async () => {
                  const res = await invokeNotifyPushTest();
                  if (!res.success) {
                    toast({
                      title: "Test push failed",
                      description: [res.error, res.detail].filter(Boolean).join(" · ") || "Unknown error",
                      variant: "destructive",
                    });
                    return;
                  }
                  toast({
                    title: "Test push sent",
                    description:
                      typeof res.delivered_push === "number"
                        ? `Delivered to ${res.delivered_push} device${res.delivered_push === 1 ? "" : "s"}.`
                        : "Sent.",
                  });
                })();
              }}
              data-testid="button-test-push"
            >
              Send test push
            </Button>
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
              <Label className="text-small text-muted-foreground">Scenario alerts</Label>
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
            <p className="text-small text-muted-foreground">Reminders before upcoming appointments</p>
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
            ? "Alerts for your supporter account: community and messages. The person you support manages their own clinical alerts."
            : "Control alerts for hypos, supplies, scenarios, community, and messages."}
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
  return (
    <PageShell variant="standard" className="relative space-y-6 bg-muted/20 text-foreground">
      <FaceLogoWatermark />
      <SettingsBackLink />
      <PageHeader
        className="mb-2"
        title="Notifications"
        description={
          supporterMode
            ? "Feed, messages, and device alerts for your supporter account."
            : "Hypo alerts, trend alerts, scenario alerts, and community feed."
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
        </CardContent>
      </Card>
    </PageShell>
  );
}
