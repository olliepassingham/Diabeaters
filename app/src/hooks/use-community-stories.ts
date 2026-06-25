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

  const refresh = useCallback(() => {
    setLoading(true);
    setRevision((r) => r + 1);
  }, []);

  useEffect(() => {
    if (!viewerId || !authorKey) {
      setStoriesByAuthor(new Map());
      setLoading(false);
      return;
    }
    let cancelled = false;
    const ids = authorKey.split(",").filter(Boolean);
    void fetchActiveStoriesForAuthors(ids).then((res) => {
      if (cancelled) return;
      setLoading(false);
      setStoriesByAuthor((prev) => {
        const next = new Map(prev);
        for (const row of res.data ?? []) {
          next.set(row.author_id, row);
        }
        return next;
      });
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
