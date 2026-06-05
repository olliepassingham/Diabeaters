import { useEffect } from "react";

import { getAchievementDefinition, type AchievementId } from "@/lib/achievements";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  DIABEATER_APP_CHECK_IN_CHANGED_EVENT,
  DIABEATER_EXERCISE_OUTCOMES_CHANGED_EVENT,
  storage,
} from "@/lib/storage";
import { mergeCloudAchievements, syncAchievementsFromActivity } from "@/lib/user-achievements";

function runAchievementSync(userId: string | null, showToasts: boolean): void {
  syncAchievementsFromActivity({ showToasts, userId });
  if (userId) void mergeCloudAchievements(userId);
}

function recordCheckInAndSync(userId: string | null, showToasts: boolean): void {
  storage.recordAppDailyCheckIn();
  runAchievementSync(userId, showToasts);
}

/** Keeps local achievements in sync with activity and shows unlock toasts. */
export function AchievementSync() {
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const onUnlock = (ev: Event) => {
      const ids = (ev as CustomEvent<{ ids?: AchievementId[] }>).detail?.ids ?? [];
      for (const id of ids) {
        const def = getAchievementDefinition(id);
        toast({
          title: "Achievement unlocked",
          description: def.title,
        });
      }
    };

    window.addEventListener("diabeater:achievement-unlocked", onUnlock);
    return () => window.removeEventListener("diabeater:achievement-unlocked", onUnlock);
  }, [toast]);

  useEffect(() => {
    recordCheckInAndSync(user?.id ?? null, true);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        recordCheckInAndSync(user?.id ?? null, true);
      }
    };

    const onExerciseOutcome = () => {
      runAchievementSync(user?.id ?? null, true);
    };

    const onAppCheckIn = () => {
      runAchievementSync(user?.id ?? null, true);
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(DIABEATER_EXERCISE_OUTCOMES_CHANGED_EVENT, onExerciseOutcome);
    window.addEventListener(DIABEATER_APP_CHECK_IN_CHANGED_EVENT, onAppCheckIn);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(DIABEATER_EXERCISE_OUTCOMES_CHANGED_EVENT, onExerciseOutcome);
      window.removeEventListener(DIABEATER_APP_CHECK_IN_CHANGED_EVENT, onAppCheckIn);
    };
  }, [user?.id]);

  return null;
}
