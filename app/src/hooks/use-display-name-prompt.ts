import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { isDisplayNamePromptSnoozed } from "@/lib/display-name-prompt";
import { useProfile, updateProfile } from "@/lib/profile";
import { storage } from "@/lib/storage";
import {
  applyDisplayNameToLocalProfile,
  isValidDisplayName,
  needsDisplayName,
} from "@/lib/user-display-name";

/**
 * Soft-prompts signed-in users who still have no display name in cloud/local.
 * Also backfills cloud when local already has a valid name.
 */
export function useDisplayNamePrompt(enabled: boolean): {
  open: boolean;
  setOpen: (open: boolean) => void;
} {
  const { user } = useAuth();
  const { profile, loading } = useProfile();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled || loading || !user?.id) {
      setOpen(false);
      return;
    }

    const localName = storage.getProfile()?.name ?? null;
    const cloudName = profile?.full_name ?? null;

    // Local has a name but cloud is empty — sync quietly instead of nagging.
    if (isValidDisplayName(localName) && !isValidDisplayName(cloudName)) {
      const trimmed = localName!.trim();
      void updateProfile({ id: user.id, full_name: trimmed }).then(({ error }) => {
        if (!error) applyDisplayNameToLocalProfile(trimmed);
      });
      setOpen(false);
      return;
    }

    if (!needsDisplayName({ cloudFullName: cloudName, localName })) {
      setOpen(false);
      return;
    }

    if (isDisplayNamePromptSnoozed(user.id)) {
      setOpen(false);
      return;
    }

    setOpen(true);
  }, [enabled, loading, user?.id, profile?.full_name]);

  return { open, setOpen };
}
