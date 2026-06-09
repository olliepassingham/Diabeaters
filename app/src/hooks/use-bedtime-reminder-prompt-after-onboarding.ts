import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { resolveBedtimeReminderPromptAfterOnboarding } from "@/lib/bedtime-reminder-prompt";

const DEFER_MS = 500;

/** Shows {@link BedtimeReminderPromptDialog} once after patient onboarding. */
export function useBedtimeReminderPromptAfterOnboarding(enabled: boolean): {
  bedtimeReminderPromptOpen: boolean;
  setBedtimeReminderPromptOpen: (open: boolean) => void;
} {
  const { user } = useAuth();
  const [bedtimeReminderPromptOpen, setBedtimeReminderPromptOpen] = useState(false);

  useEffect(() => {
    if (!enabled || !user?.id) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const showIfNeeded = () => {
      const action = resolveBedtimeReminderPromptAfterOnboarding(user.id);
      if (!cancelled && action === "show") setBedtimeReminderPromptOpen(true);
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(
        () => {
          timeoutId = setTimeout(showIfNeeded, DEFER_MS);
        },
        { timeout: 1200 },
      );
      return () => {
        cancelled = true;
        window.cancelIdleCallback(idleId);
        if (timeoutId) clearTimeout(timeoutId);
      };
    }

    timeoutId = setTimeout(showIfNeeded, DEFER_MS);
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [enabled, user?.id]);

  return { bedtimeReminderPromptOpen, setBedtimeReminderPromptOpen };
}
