import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { resolveCommunityPushPromptAfterOnboarding } from "@/lib/community-push-prompt";

/** Shows {@link CommunityPushPromptDialog} once after community onboarding on native. */
export function useCommunityPushPromptAfterOnboarding(): {
  communityPushPromptOpen: boolean;
  setCommunityPushPromptOpen: (open: boolean) => void;
} {
  const { user } = useAuth();
  const [communityPushPromptOpen, setCommunityPushPromptOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void (async () => {
      const action = await resolveCommunityPushPromptAfterOnboarding(user.id);
      if (!cancelled && action === "show") setCommunityPushPromptOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { communityPushPromptOpen, setCommunityPushPromptOpen };
}
