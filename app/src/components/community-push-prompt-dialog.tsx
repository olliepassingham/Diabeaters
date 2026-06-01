import { useState } from "react";
import { Bell } from "lucide-react";

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
import { useAuth } from "@/lib/auth-context";
import {
  dismissCommunityPushPrompt,
  enableCommunityPushNotifications,
} from "@/lib/community-push-prompt";
import { nativePlatformLabel } from "@/lib/native-platform";
import { checkNativePushPermission } from "@/lib/push-tokens";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommunityPushPromptDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleDismiss = () => {
    if (user?.id) dismissCommunityPushPrompt(user.id);
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (busy) return;
    if (!next) handleDismiss();
    else onOpenChange(true);
  };

  const handleEnable = async () => {
    if (!user?.id) return;
    setBusy(true);
    try {
      await enableCommunityPushNotifications();
      const perm = await checkNativePushPermission();
      if (perm === "granted") {
        dismissCommunityPushPrompt(user.id);
        onOpenChange(false);
        toast({
          title: "Community alerts enabled",
          description: "You'll get notifications for likes, comments, mentions, new followers, and messages.",
        });
        return;
      }
      toast({
        title: "Allow notifications in Settings",
        description: `Open ${nativePlatformLabel()} Settings → Notifications → Diabeaters and turn alerts on, then return here.`,
        variant: "destructive",
      });
    } catch {
      toast({
        title: "Could not enable alerts",
        description: "Try again from Settings → Notifications.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary shrink-0" aria-hidden />
            Get community alerts on your phone?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-left space-y-3 text-sm text-muted-foreground">
              <p>Stay in the loop when people interact with you on the feed:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Likes and comments on your posts</li>
                <li>Mentions</li>
                <li>New followers</li>
                <li>Direct messages</li>
              </ul>
              <p>
                You&apos;ll also see activity under{" "}
                <span className="font-medium text-foreground">Notifications</span> in the app.
              </p>
              <p className="text-xs">You can change types anytime in Settings → Notifications.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel type="button" disabled={busy} onClick={handleDismiss}>
            Not now
          </AlertDialogCancel>
          <AlertDialogAction type="button" disabled={busy} onClick={() => void handleEnable()}>
            {busy ? "Enabling…" : "Enable alerts"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
