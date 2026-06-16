import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { isPushTestUiEnabled, isProd } from "@/lib/flags";
import {
  ensureNativeLocalNotificationPermission,
} from "@/lib/native-local-notifications";
import { isNativePushPlatform, isNativeShellForPushTestUi, nativePlatformLabel } from "@/lib/native-platform";
import {
  NotificationSettings,
  notificationSettingsLookHealthy,
  type NotificationSettingsSnapshot,
} from "@/lib/notification-settings-native";
import { isPushTestUiUnlocked } from "@/lib/push-test-ui-unlock";
import { invokeNotifyPushTest } from "@/lib/invoke-notify-push-test";
import { getPushRegistrationDebugSnapshot, refreshPushTokenForDelivery } from "@/lib/push-tokens";

function noPushTokenHint(): string {
  return "No row in push_tokens for this user. On this device: turn on Enable notifications + Push in app settings, allow Diabeaters in system notification settings, then leave and reopen the app. If it persists, check Supabase → push_tokens for your user_id.";
}

function deliveryFailureHint(r: {
  detail?: string;
  http_status?: number;
  delivered_push?: number;
  tokens?: number;
  success?: boolean;
  apns_environment?: string;
  apns_bundle_id?: string;
  apns_host?: string;
  apns_topic?: string;
  token_probe?: { hex_length: number; hex_prefix_8: string };
}): string | null {
  if (!r.success || (r.delivered_push ?? 0) > 0 || (r.tokens ?? 0) < 1) return null;
  const d = r.detail ?? "";
  const bundle = r.apns_bundle_id ?? "com.passingtime.diabeaters";
  if (d.includes("BadDeviceToken") || d.includes("Unregistered")) {
    if (r.apns_environment === "sandbox") {
      return `\nSupabase is using **sandbox** APNs (host ${r.apns_host ?? "sandbox"}). TestFlight and App Store need **production**. Remove secret APNS_USE_SANDBOX or set it to false, redeploy notify_push_test, delete your push_tokens row, force-quit the app, reopen, then try again.`;
    }
    if (r.apns_environment === "production") {
      return `\nSupabase is using **production** APNs (topic ${bundle}). If this build is from **Xcode Run**, set APNS_USE_SANDBOX=true, redeploy, clear push_tokens, reopen. If **TestFlight/App Store**, confirm Apple App ID ${bundle} has Push, and APNS_TEAM_ID / APNS_KEY_ID / APNS_PRIVATE_KEY (.p8) belong to the **same** Apple Developer team as the app; fix any mismatch, redeploy, clear push_tokens, reopen.`;
    }
    return "\nAPNs rejected the device token. Check APNS_USE_SANDBOX vs install type (Xcode vs TestFlight), APNS_BUNDLE_ID, and Apple key/team; then delete push_tokens and reopen after redeploying notify_push_test.";
  }
  if (d.includes("TopicDisallowed") || d.includes("DeviceTokenNotForTopic")) {
    return "\nCheck APNS_BUNDLE_ID matches the app bundle id (default com.passingtime.diabeaters).";
  }
  if (r.http_status != null && r.http_status > 0) {
    return `\nAPNs or relay returned HTTP ${r.http_status}. Full JSON is in the detail line above; see Supabase → Edge Functions → notify_push_test → Logs.`;
  }
  return null;
}

/** “Send test push” — build-time flag, staging, per-device unlock, or seven taps on About → Version (native). */
export function DevPushNotificationTestPanel() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [pushDebugJson, setPushDebugJson] = useState<string>("");
  const [iosNotifSettings, setIosNotifSettings] = useState<NotificationSettingsSnapshot | null>(null);
  const [localCountdown, setLocalCountdown] = useState<number | null>(null);

  useEffect(() => {
    setUnlocked(isPushTestUiUnlocked());
  }, [location]);

  const nativeShell = isNativeShellForPushTestUi();
  /** Native-only, non-production: local dev, staging/TestFlight QA, or explicit build flag — never App Store / prod web. */
  const showPanel =
    !isProd && nativeShell && (import.meta.env.DEV || isPushTestUiEnabled || unlocked);

  useEffect(() => {
    if (!showPanel || !isNativePushPlatform()) return;
    const tick = async () => {
      try {
        const snap = await getPushRegistrationDebugSnapshot();
        setPushDebugJson(JSON.stringify(snap, null, 2));
      } catch {
        setPushDebugJson("{}");
      }
      if (Capacitor.getPlatform() === "ios") {
        try {
          setIosNotifSettings(await NotificationSettings.getSettings());
        } catch {
          setIosNotifSettings(null);
        }
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 2000);
    return () => clearInterval(id);
  }, [showPanel]);

  const iosHealth = notificationSettingsLookHealthy(iosNotifSettings);

  const copyPushDebug = useCallback(async () => {
    const text = pushDebugJson || "{}";
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: "Paste into Notes, Mail, or a message to share the JSON." });
    } catch {
      toast({
        title: "Copy blocked",
        description: "Scroll the box below, long-press the text, then Select All → Copy.",
        variant: "destructive",
      });
    }
  }, [pushDebugJson, toast]);

  const showPushResult = (r: Awaited<ReturnType<typeof invokeNotifyPushTest>>) => {
      const iosAttempt = r.attempts?.find((a) => a.platform === "ios");
      const iosOk = r.ios_delivered === true || iosAttempt?.success === true;
      const lines = [
        `success: ${r.success}`,
        r.ios_delivered != null ? `ios_delivered: ${r.ios_delivered}` : null,
        r.attempts?.length ? `attempts: ${JSON.stringify(r.attempts)}` : null,
        r.delivered_ok != null ? `delivered_ok: ${r.delivered_ok}` : null,
        r.error ? `error: ${r.error}` : null,
        r.failure_channel ? `failure_channel: ${r.failure_channel}` : null,
        r.apns_environment ? `apns_environment: ${r.apns_environment}` : null,
        r.apns_host ? `apns_host: ${r.apns_host}` : null,
        r.apns_topic ? `apns_topic: ${r.apns_topic}` : null,
        r.apns_bundle_id ? `apns_bundle_id: ${r.apns_bundle_id}` : null,
        r.token_probe
          ? `token_probe: ${JSON.stringify(r.token_probe)} (compare hex_prefix_8 to Copy JSON cachedTokenPrefix)`
          : null,
        r.http_status != null ? `http_status: ${r.http_status}` : null,
        r.detail ? `detail: ${r.detail}` : null,
        r.tokens != null ? `tokens: ${r.tokens}` : null,
        r.delivered_push != null ? `delivered_push: ${r.delivered_push}` : null,
        r.error === "no_push_token" ? `\n${noPushTokenHint()}` : null,
        deliveryFailureHint(r),
      ]
        .filter(Boolean)
        .join("\n");
    toast({
      title: iosOk ? "iOS APNs accepted" : r.success && (r.delivered_push ?? 0) > 0 ? "Push sent (check iOS)" : "Test push result",
      description: lines,
      variant: iosOk ? "default" : "destructive",
    });
  };

  const run = async () => {
    setBusy(true);
    try {
      showPushResult(await invokeNotifyPushTest());
    } finally {
      setBusy(false);
    }
  };

  const runLocalAfterDelay = (seconds: number) => {
    if (busy || localCountdown != null) return;
    void (async () => {
      const granted = await ensureNativeLocalNotificationPermission();
      if (!granted) {
        toast({
          title: "Local notification permission needed",
          description: "Enable notifications in app settings, then try again.",
          variant: "destructive",
        });
        return;
      }
      setBusy(true);
      toast({
        title: `Local alert in ${seconds}s`,
        description: "Press Home and lock the phone now. This tests iOS only (no server).",
      });
      let remaining = seconds;
      setLocalCountdown(remaining);
      const tick = window.setInterval(() => {
        remaining -= 1;
        if (remaining > 0) {
          setLocalCountdown(remaining);
          return;
        }
        window.clearInterval(tick);
        setLocalCountdown(null);
        void (async () => {
          try {
            await LocalNotifications.schedule({
              notifications: [
                {
                  id: 9_900_001,
                  title: "Diabeaters local test",
                  body: "If you see this on the lock screen, iOS alerts work on this phone.",
                  sound: "default",
                  schedule: { at: new Date(Date.now() + 250) },
                },
              ],
            });
            toast({
              title: "Local alert scheduled",
              description: "Check lock screen / Notification Centre in a moment.",
            });
          } catch (e) {
            toast({
              title: "Local alert failed",
              description: e instanceof Error ? e.message : String(e),
              variant: "destructive",
            });
          } finally {
            setBusy(false);
          }
        })();
      }, 1000);
    })();
  };

  const runAfterDelay = (seconds: number) => {
    if (busy || countdown != null) return;
    setBusy(true);
    toast({
      title: `Test push in ${seconds}s`,
      description:
        "Press Home (or lock your phone) now so Diabeaters is in the background when the alert arrives.",
    });
    let remaining = seconds;
    setCountdown(remaining);
    const tick = window.setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setCountdown(remaining);
        return;
      }
      window.clearInterval(tick);
      setCountdown(null);
      void (async () => {
        try {
          showPushResult(await invokeNotifyPushTest());
        } finally {
          setBusy(false);
        }
      })();
    }, 1000);
  };

  if (!showPanel) return null;

  return (
    <div className="rounded-xl border border-dashed border-amber-600/40 bg-amber-950/15 p-4 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">Developer</p>
      {unlocked && !isPushTestUiEnabled ? (
        <p className="text-xs text-muted-foreground leading-snug">
          Unlocked on this {nativePlatformLabel().toLowerCase()} via seven quick taps on{" "}
          <strong className="text-foreground/85">About → Version</strong>. Stored only on this device.
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground leading-snug">
        Calls the <code className="text-[11px]">notify_push_test</code> Edge Function with your session. Requires
        <strong className="text-foreground/85"> Enable notifications</strong> and{" "}
        <strong className="text-foreground/85">Push notifications</strong> above, a row in{" "}
        <code className="text-[11px]">push_tokens</code>, and APNs/FCM secrets on the project.
      </p>
      {Capacitor.getPlatform() === "ios" ? (
        <div
          className={`rounded-md border p-2 text-xs leading-snug ${
            iosHealth.ok
              ? "border-emerald-700/40 bg-emerald-950/20 text-muted-foreground"
              : "border-destructive/50 bg-destructive/10 text-foreground"
          }`}
        >
          <p className="font-semibold text-foreground/90">iOS notification channels</p>
          {iosNotifSettings ? (
            <ul className="mt-1 list-disc pl-4 space-y-0.5">
              <li>Authorization: {iosNotifSettings.authorizationStatus}</li>
              <li>Alerts/banners: {iosNotifSettings.alertSetting}</li>
              <li>Lock Screen: {iosNotifSettings.lockScreenSetting}</li>
              <li>Notification Centre: {iosNotifSettings.notificationCenterSetting}</li>
              <li>Sounds: {iosNotifSettings.soundSetting}</li>
            </ul>
          ) : (
            <p className="mt-1">Install TestFlight build <strong>1.0.5+</strong> to read channel settings here.</p>
          )}
          {!iosHealth.ok ? (
            <p className="mt-2 text-destructive font-medium">{iosHealth.issues.join(" ")}</p>
          ) : null}
          {!iosHealth.ok ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="mt-2 h-7 text-[10px]"
              onClick={() => void NotificationSettings.openAppSettings().catch(() => undefined)}
            >
              Open iOS Settings for Diabeaters
            </Button>
          ) : null}
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground leading-snug">
        <strong className="text-foreground/85">Step 1:</strong> tap <strong className="text-foreground/85">Local in 5s</strong>, press Home, wait — if nothing appears, fix iOS Settings (or delete &amp; reinstall the app).{" "}
        <strong className="text-foreground/85">Step 2:</strong> <strong className="text-foreground/85">Send in 5s (background)</strong> tests the server/APNs path. Build <strong className="text-foreground/85">1.0.5+</strong> removes the badge plugin that broke alerts.
      </p>
      <div className="rounded-md border border-amber-700/30 bg-black/25 p-2 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-amber-200/80">
            Push registration (this device)
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 shrink-0 text-[10px] px-2"
            onClick={() => void copyPushDebug()}
          >
            Copy JSON
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug">
          macOS <strong className="text-foreground/80">Console</strong> usually does not show JavaScript logs from the
          app WebView. Use this JSON instead (updates every 2s). Ensure Supabase migrations{" "}
          <code className="text-[10px]">register_ios_push_token</code> /{" "}
          <code className="text-[10px]">register_android_push_token</code> + grants are applied.
        </p>
        <pre
          className="text-[10px] leading-tight text-foreground/90 font-mono whitespace-pre-wrap break-all max-h-36 overflow-y-auto select-text"
          data-testid="push-registration-debug-json"
        >
          {pushDebugJson || "{}"}
        </pre>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void run()}>
          {busy && countdown == null && localCountdown == null ? "Sending…" : "Send test push"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => runLocalAfterDelay(5)}
        >
          {localCountdown != null ? `Local in ${localCountdown}s…` : "Local in 5s"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => runAfterDelay(5)}
        >
          {countdown != null ? `APNs in ${countdown}s…` : "Send in 5s (background)"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void (async () => {
              try {
                await refreshPushTokenForDelivery();
                toast({
                  title: "Push token refreshed",
                  description:
                    "Re-registered with Apple and saved the new token. Wait a few seconds, then try Send in 5s (background).",
                });
              } catch (e) {
                toast({
                  title: "Refresh failed",
                  description: e instanceof Error ? e.message : String(e),
                  variant: "destructive",
                });
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          Refresh push token
        </Button>
      </div>
    </div>
  );
}
