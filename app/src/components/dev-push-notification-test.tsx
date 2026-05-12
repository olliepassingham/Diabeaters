import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { isPushTestUiEnabled } from "@/lib/flags";
import { isIosLikeUserAgent } from "@/lib/ios-user-agent";
import { isPushTestUiUnlocked } from "@/lib/push-test-ui-unlock";
import { invokeNotifyPushTest } from "@/lib/invoke-notify-push-test";

function noPushTokenHint(): string {
  return "No row in push_tokens for this user. On this iPhone: turn on Enable notifications + Push (iOS) in app settings, allow Diabeaters in iOS Settings → Notifications, then leave and reopen the app. If it persists, check Supabase → push_tokens for your user_id.";
}

/** “Send test push” — build-time flag, staging, or per-device unlock (see About → Version taps on iOS). */
export function DevPushNotificationTestPanel() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    setUnlocked(isPushTestUiUnlocked());
  }, []);

  const iosLike = isIosLikeUserAgent();
  const showPanel = isPushTestUiEnabled || (iosLike && unlocked);

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

  const run = async () => {
    setBusy(true);
    try {
      const r = await invokeNotifyPushTest();
      const lines = [
        `success: ${r.success}`,
        r.error ? `error: ${r.error}` : null,
        r.detail ? `detail: ${r.detail}` : null,
        r.tokens != null ? `tokens: ${r.tokens}` : null,
        r.delivered_push != null ? `delivered_push: ${r.delivered_push}` : null,
        r.error === "no_push_token" ? `\n${noPushTokenHint()}` : null,
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
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void run()}>
        {busy ? "Sending…" : "Send test push"}
      </Button>
    </div>
  );
}
