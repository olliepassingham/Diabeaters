import { useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

import { ensureBedtimeInAppRemindersForUser } from "@/lib/bedtime-inapp-reminders";
import { rescheduleBedtimeReminders } from "@/lib/bedtime-reminders";
import { useAuth } from "@/lib/auth-context";
import { useLinkedCarer } from "@/hooks/use-linked-carer";
import { useProfile } from "@/lib/profile";
import { getActiveAppMode } from "@/lib/carer-session";

const POLL_MS = 5 * 60 * 1000;

async function runBedtimeReminderScan(
  userId: string | undefined,
  hasCarerLink: boolean,
  cloudCommunityProfile: boolean,
): Promise<void> {
  await rescheduleBedtimeReminders({ hasCarerLink, cloudCommunityProfile });
  if (userId) await ensureBedtimeInAppRemindersForUser(userId, { hasCarerLink, cloudCommunityProfile });
}

export function BedtimeReminderPoller() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { isCarer: hasCarerLink } = useLinkedCarer();
  const [activeMode, setActiveMode] = useState(() => getActiveAppMode());
  const cloudCommunityProfile = profile?.account_type === "community";

  useEffect(() => {
    const onMode = (ev: Event) => {
      const ce = ev as CustomEvent<{ mode?: "patient" | "carer" | "community" | null }>;
      setActiveMode(ce.detail?.mode ?? getActiveAppMode());
    };
    window.addEventListener("diabeater:app-mode", onMode);
    return () => window.removeEventListener("diabeater:app-mode", onMode);
  }, []);

  useEffect(() => {
    const userId = user?.id;
    void runBedtimeReminderScan(userId, hasCarerLink, cloudCommunityProfile);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void runBedtimeReminderScan(userId, hasCarerLink, cloudCommunityProfile);
      }
    }, POLL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void runBedtimeReminderScan(userId, hasCarerLink, cloudCommunityProfile);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    let appListener: { remove: () => Promise<void> } | null = null;
    let removed = false;

    if (Capacitor.isNativePlatform?.()) {
      void App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) void runBedtimeReminderScan(userId, hasCarerLink, cloudCommunityProfile);
      }).then((handle) => {
        if (removed) void handle.remove();
        else appListener = handle;
      });
    }

    return () => {
      removed = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      if (appListener) void appListener.remove();
    };
  }, [user?.id, hasCarerLink, activeMode, cloudCommunityProfile]);

  return null;
}
