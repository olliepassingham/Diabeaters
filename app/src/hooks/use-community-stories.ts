import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchActiveStoriesForAuthors,
  storyRingStateForRow,
  type CommunityStoryRow,
  type StoryRingState,
} from "@/lib/community/stories-supabase";

export function useCommunityStories(viewerId: string | undefined, authorIds: string[]) {
  const [storiesByAuthor, setStoriesByAuthor] = useState<Map<string, CommunityStoryRow>>(new Map());
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);

  const authorKey = useMemo(() => [...new Set(authorIds.filter(Boolean))].sort().join(","), [authorIds]);

  const refresh = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    if (!viewerId || !authorKey) {
      setStoriesByAuthor(new Map());
      return;
    }
    let cancelled = false;
    setLoading(true);
    const ids = authorKey.split(",").filter(Boolean);
    void fetchActiveStoriesForAuthors(ids).then((res) => {
      if (cancelled) return;
      setLoading(false);
      const map = new Map<string, CommunityStoryRow>();
      for (const row of res.data ?? []) {
        map.set(row.author_id, row);
      }
      setStoriesByAuthor(map);
    });
    return () => {
      cancelled = true;
    };
  }, [viewerId, authorKey, revision]);

  const ringState = useCallback(
    (authorId: string): StoryRingState => storyRingStateForRow(storiesByAuthor.get(authorId)),
    [storiesByAuthor],
  );

  return { storiesByAuthor, loading, refresh, ringState };
}
