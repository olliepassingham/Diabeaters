import { useEffect, useMemo, useState } from "react";
import { orderedCommunityTopicsForViewer, type CommunityTopicRow } from "@/lib/community/topics";
import { getActiveAppMode, isCarerSessionMode } from "@/lib/carer-session";
import { useLinkedCarer } from "@/hooks/use-linked-carer";
import { useProfile } from "@/lib/profile";
import { storage } from "@/lib/storage";
import { normalizeDateOfBirthInput } from "@/lib/user-age";

/**
 * Feed/composer topic lists: supporter lens vs school/college-first for younger viewers.
 */
export function useCommunityTopicOrder(): readonly CommunityTopicRow[] {
  const { profile } = useProfile();
  const { isCarer: hasCarerLink } = useLinkedCarer();
  const [activeMode, setActiveMode] = useState(() => getActiveAppMode());

  useEffect(() => {
    const onMode = () => setActiveMode(getActiveAppMode());
    window.addEventListener("diabeater:app-mode", onMode);
    return () => window.removeEventListener("diabeater:app-mode", onMode);
  }, []);

  const supporterFeed = isCarerSessionMode(hasCarerLink, activeMode);

  return useMemo(() => {
    const localDob = normalizeDateOfBirthInput(storage.getProfile()?.dateOfBirth ?? null);
    const dob = profile?.date_of_birth ?? localDob;
    return orderedCommunityTopicsForViewer({
      supporterFeed,
      dateOfBirth: dob,
    });
  }, [supporterFeed, profile?.date_of_birth]);
}
