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
import { nativePlatformLabel } from "@/lib/native-platform";
import { checkNativePushPermission } from "@/lib/push-tokens";
import {
  dismissSupporterPushPrompt,
  enableSupporterPushNotifications,
} from "@/lib/supporter-push-prompt";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientName: string;
};

export function SupporterPushPromptDialog({ open, onOpenChange, patientName }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleDismiss = () => {
    if (user?.id) dismissSupporterPushPrompt(user.id);
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
      await enableSupporterPushNotifications();
      const perm = await checkNativePushPermission();
      if (perm === "granted") {
        dismissSupporterPushPrompt(user.id);
        onOpenChange(false);
        toast({
          title: "Supporter alerts enabled",
          description: `You'll be notified when ${patientName} shares hypos, supplies, or travel/sick-day updates with you.`,
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
            Get supporter alerts on your phone?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-left space-y-3 text-sm text-muted-foreground">
              <p>
                When <span className="font-medium text-foreground">{patientName}</span> shares updates with you, we can
                send lock-screen alerts for:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Treated hypo</li>
                <li>Supplies running low or critical</li>
                <li>Sick day or travel mode started</li>
              </ul>
              <p>
                You&apos;ll also see items in the app under <span className="font-medium text-foreground">Notifications</span>.
                What you receive still follows what they allow in Family &amp; supporters.
              </p>
              <p className="text-xs">This is separate from medication reminder pop-ups on your device.</p>
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

/** @deprecated Use {@link SupporterPushPromptDialog} */
export const SupporterHypoPushPromptDialog = SupporterPushPromptDialog;
