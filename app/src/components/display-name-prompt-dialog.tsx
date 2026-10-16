import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { snoozeDisplayNamePrompt, clearDisplayNamePromptSnooze } from "@/lib/display-name-prompt";
import { profileQueryKey, updateProfile } from "@/lib/profile";
import { applyDisplayNameToLocalProfile, isValidDisplayName } from "@/lib/user-display-name";
import { useQueryClient } from "@tanstack/react-query";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DisplayNamePromptDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setName("");
  }, [open]);

  async function handleSave() {
    if (!user?.id) return;
    const trimmed = name.trim();
    if (!isValidDisplayName(trimmed)) {
      toast({
        title: "Add your name",
        description: "Use at least 2 characters — not an email address.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const { error } = await updateProfile({ id: user.id, full_name: trimmed });
      if (error) {
        toast({
          title: "Couldn't save name",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      applyDisplayNameToLocalProfile(trimmed);
      clearDisplayNamePromptSnooze(user.id);
      void queryClient.invalidateQueries({ queryKey: profileQueryKey(user.id) });
      onOpenChange(false);
      toast({ title: "Name saved", description: "Thanks — this is how you show up in the app." });
    } finally {
      setBusy(false);
    }
  }

  function handleLater() {
    if (!user?.id || busy) return;
    snoozeDisplayNamePrompt(user.id);
    onOpenChange(false);
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next) handleLater();
        else onOpenChange(true);
      }}
    >
      <AlertDialogContent className="gap-4 sm:max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto mb-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <UserRound className="h-5 w-5" aria-hidden />
          </div>
          <AlertDialogTitle className="text-center">What should we call you?</AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            A display name helps on your profile, Help now, and the Feed. You can change it later in Settings.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="display-name-prompt-input">Your name</Label>
          <Input
            id="display-name-prompt-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your first name"
            autoComplete="nickname"
            maxLength={80}
            disabled={busy}
            data-testid="input-display-name-prompt"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSave();
              }
            }}
          />
        </div>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            className="h-11 w-full rounded-xl"
            disabled={busy || !isValidDisplayName(name)}
            data-testid="button-display-name-prompt-save"
            onClick={() => void handleSave()}
          >
            {busy ? "Saving…" : "Save name"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-10 w-full text-muted-foreground"
            disabled={busy}
            data-testid="button-display-name-prompt-later"
            onClick={handleLater}
          >
            Not now
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
