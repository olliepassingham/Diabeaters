import { useState } from "react";
import { Moon } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  DEFAULT_BEDTIME_REMINDER_TIME,
  BEDTIME_REMINDER_TIME_OPTIONS,
  formatBedtimeReminderTimeLabel,
} from "@/lib/bedtime-reminder-schedule";
import {
  dismissBedtimeReminderOnboardingPrompt,
  dismissBedtimeReminderSecondChancePrompt,
  enableBedtimeCheckReminders,
} from "@/lib/bedtime-reminder-prompt";
import { storage } from "@/lib/storage";

export type BedtimeReminderPromptVariant = "onboarding" | "second_chance";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: BedtimeReminderPromptVariant;
};

export function BedtimeReminderPromptDialog({ open, onOpenChange, variant }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const defaultTime = storage.getNotificationSettings().bedtimeReminderTime || DEFAULT_BEDTIME_REMINDER_TIME;
  const [time, setTime] = useState(defaultTime);

  const handleDismiss = () => {
    if (!user?.id) {
      onOpenChange(false);
      return;
    }
    if (variant === "onboarding") {
      dismissBedtimeReminderOnboardingPrompt(user.id);
    } else {
      dismissBedtimeReminderSecondChancePrompt(user.id);
    }
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
      await enableBedtimeCheckReminders(time);
      if (variant === "onboarding") {
        dismissBedtimeReminderOnboardingPrompt(user.id);
      } else {
        dismissBedtimeReminderSecondChancePrompt(user.id);
      }
      onOpenChange(false);
      toast({
        title: "Bedtime reminder on",
        description: `We'll nudge you around ${formatBedtimeReminderTimeLabel(time)} if you haven't done a bedtime check yet.`,
      });
    } catch {
      toast({
        title: "Could not enable reminder",
        description: "Try again from Settings → Notifications.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const title =
    variant === "onboarding"
      ? "Want a bedtime check reminder?"
      : "Remind you for bedtime checks?";

  const lead =
    variant === "onboarding"
      ? "A gentle evening nudge to open your bedtime readiness check — only if you haven't already logged one that day."
      : "Nice work on your bedtime check. Want a reminder around the same time on evenings you haven't logged yet?";

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5 text-primary shrink-0" aria-hidden />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-left space-y-3 text-sm text-muted-foreground">
              <p>{lead}</p>
              <div className="space-y-2">
                <Label htmlFor="bedtime-prompt-time" className="text-xs font-medium text-muted-foreground">
                  Reminder time
                </Label>
                <Select value={time} onValueChange={setTime} disabled={busy}>
                  <SelectTrigger id="bedtime-prompt-time" className="h-10 rounded-xl">
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
              </div>
              <p className="text-xs">
                Skips the reminder if you already completed a bedtime check that day. Change anytime in Settings →
                Notifications.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel type="button" disabled={busy} onClick={handleDismiss}>
            Not now
          </AlertDialogCancel>
          <AlertDialogAction type="button" disabled={busy} onClick={() => void handleEnable()}>
            {busy ? "Enabling…" : "Remind me"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
