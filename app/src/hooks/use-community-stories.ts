import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchActiveStoriesForAuthors,
  sortStoriesChronologically,
  storyRingStateForStories,
  type CommunityStoryRow,
  type StoryRingState,
} from "@/lib/community/stories-supabase";

export function useCommunityStories(viewerId: string | undefined, authorIds: string[]) {
  const [storiesByAuthor, setStoriesByAuthor] = useState<Map<string, CommunityStoryRow[]>>(new Map());
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
        for (const id of ids) {
          next.set(id, []);
        }
        for (const row of res.data ?? []) {
          const list = next.get(row.author_id) ?? [];
          list.push(row);
          next.set(row.author_id, list);
        }
        for (const id of ids) {
          const list = next.get(id);
          if (list) next.set(id, sortStoriesChronologically(list));
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [viewerId, authorKey, revision]);

  const ringState = useCallback(
    (authorId: string): StoryRingState => storyRingStateForStories(storiesByAuthor.get(authorId)),
    [storiesByAuthor],
  );

  return { storiesByAuthor, loading, refresh, ringState };
}
