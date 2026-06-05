import { useEffect } from "react";

import { getAchievementDefinition, type AchievementId } from "@/lib/achievements";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { DIABEATER_EXERCISE_OUTCOMES_CHANGED_EVENT } from "@/lib/storage";
import { mergeCloudAchievements, syncAchievementsFromActivity } from "@/lib/user-achievements";

function runAchievementSync(userId: string | null, showToasts: boolean): void {
  syncAchievementsFromActivity({ showToasts, userId });
  if (userId) void mergeCloudAchievements(userId);
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
    runAchievementSync(user?.id ?? null, true);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        runAchievementSync(user?.id ?? null, true);
      }
    };

    const onExerciseOutcome = () => {
      runAchievementSync(user?.id ?? null, true);
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(DIABEATER_EXERCISE_OUTCOMES_CHANGED_EVENT, onExerciseOutcome);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(DIABEATER_EXERCISE_OUTCOMES_CHANGED_EVENT, onExerciseOutcome);
    };
  }, [user?.id]);

  return null;
}
