import { useCallback, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { isProd } from "@/lib/flags";
import { isIosLikeUserAgent } from "@/lib/ios-user-agent";
import { isPushTestUiUnlocked, unlockPushTestUi } from "@/lib/push-test-ui-unlock";

/**
 * Lets testers enable “Send test push” when Capacitor mis-reports `web` under remote `server.url`.
 * Shown on iPhone/iPad user agents while not already unlocked.
 */
export function PushTestUnlockCallout({ className }: { className?: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const apply = useCallback(() => {
    setOpen(false);
    unlockPushTestUi();
    toast({
      title: "Push test tools enabled",
      description: "Reloading… Then open Settings → Notifications.",
    });
    window.setTimeout(() => {
      window.location.reload();
    }, 450);
  }, [toast]);

  if (isProd || !isIosLikeUserAgent() || isPushTestUiUnlocked()) return null;

  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">
        <button
          type="button"
          className="underline underline-offset-2 text-muted-foreground hover:text-foreground"
          data-testid="link-enable-push-test-tools"
          onClick={() => setOpen(true)}
        >
          Enable push test tools on this device…
        </button>
      </p>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enable push test tools?</AlertDialogTitle>
            <AlertDialogDescription>
              Adds &quot;Send test push&quot; under Settings → Notifications on this device (saved locally). Use it to
              verify APNs and your Supabase <code className="text-[11px]">push_tokens</code> row.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={apply}>Enable</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
