import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { isProd, isPushTestUiEnabled } from "@/lib/flags";
import { isIosLikeUserAgent } from "@/lib/ios-user-agent";
import { isPushTestUiUnlocked } from "@/lib/push-test-ui-unlock";
import { invokeNotifyPushTest } from "@/lib/invoke-notify-push-test";
import { getPushRegistrationDebugSnapshot } from "@/lib/push-tokens";

function noPushTokenHint(): string {
  return "No row in push_tokens for this user. On this iPhone: turn on Enable notifications + Push (iOS) in app settings, allow Diabeaters in iOS Settings → Notifications, then leave and reopen the app. If it persists, check Supabase → push_tokens for your user_id.";
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

/** “Send test push” — build-time flag, staging, or per-device unlock (see About → Version taps on iOS). */
export function DevPushNotificationTestPanel() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [pushDebugJson, setPushDebugJson] = useState<string>("");

  useEffect(() => {
    setUnlocked(isPushTestUiUnlocked());
  }, []);

  const iosLike = isIosLikeUserAgent();
  const showPanel = !isProd && (isPushTestUiEnabled || (iosLike && unlocked));

  useEffect(() => {
    if (!showPanel || !iosLike) return;
    const tick = async () => {
      try {
        const snap = await getPushRegistrationDebugSnapshot();
        setPushDebugJson(JSON.stringify(snap, null, 2));
      } catch {
        setPushDebugJson("{}");
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 2000);
    return () => clearInterval(id);
  }, [showPanel, iosLike]);

  if (!showPanel) return null;

  if (!iosLike) {
    return (
      <div className="mt-6 rounded-xl border border-dashed border-amber-600/40 bg-amber-950/15 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">Developer</p>
        <p className="text-xs text-muted-foreground leading-snug">
          <strong className="text-foreground/90">Test push only runs on the native iOS app.</strong> In Safari or
          Chrome (Vite dev), the app never registers with APNs, so Supabase has no{" "}
          <code className="text-[11px]">push_tokens</code> row — you will always see{" "}
          <code className="text-[11px]">no_push_token</code>. Open Diabeaters from the home screen or TestFlight on
          an iPhone, enable Push in Notifications settings, then use Send test push there.
        </p>
      </div>
    );
  }

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

  const run = async () => {
    setBusy(true);
    try {
      const r = await invokeNotifyPushTest();
      const lines = [
        `success: ${r.success}`,
        r.error ? `error: ${r.error}` : null,
        r.failure_channel ? `failure_channel: ${r.failure_channel}` : null,
        r.apns_environment ? `apns_environment: ${r.apns_environment}` : null,
        r.apns_host ? `apns_host: ${r.apns_host}` : null,
        r.apns_bundle_id ? `apns_bundle_id: ${r.apns_bundle_id}` : null,
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
        title: r.success && (r.delivered_push ?? 0) > 0 ? "Test push delivered" : "Test push result",
        description: lines,
        variant: r.success && (r.delivered_push ?? 0) > 0 ? "default" : "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-dashed border-amber-600/40 bg-amber-950/15 p-4 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">Developer</p>
      {unlocked && !isPushTestUiEnabled ? (
        <p className="text-xs text-muted-foreground leading-snug">
          Unlocked on this iPhone from <strong className="text-foreground/85">About</strong> (link “Enable push test
          tools…” or seven quick taps on the version). Stored only on this device.
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground leading-snug">
        Calls the <code className="text-[11px]">notify_push_test</code> Edge Function with your session. Requires
        <strong className="text-foreground/85"> Enable notifications</strong> and{" "}
        <strong className="text-foreground/85">Push notifications (iOS)</strong> above, a row in{" "}
        <code className="text-[11px]">push_tokens</code>, and APNs secrets on the project.
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
          <code className="text-[10px]">register_ios_push_token</code> + grants are applied.
        </p>
        <pre
          className="text-[10px] leading-tight text-foreground/90 font-mono whitespace-pre-wrap break-all max-h-36 overflow-y-auto select-text"
          data-testid="push-registration-debug-json"
        >
          {pushDebugJson || "{}"}
        </pre>
      </div>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void run()}>
        {busy ? "Sending…" : "Send test push"}
      </Button>
    </div>
  );
}
