import { useCallback, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { renderPostAsStoryFile, type StoryPostShareMeta } from "@/lib/community/story-post-share";
import type { CommunityPostRow } from "@/lib/community";

export type { StoryPostShareMeta };

export function useSharePostToStory() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [prefillFile, setPrefillFile] = useState<File | null>(null);
  const [sourcePostId, setSourcePostId] = useState<string | null>(null);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);

  const sharePostToStory = useCallback(
    async (post: CommunityPostRow, meta: StoryPostShareMeta) => {
      if (busyPostId) return;
      setBusyPostId(post.id);
      try {
        const file = await renderPostAsStoryFile(post, meta);
        if (!file) {
          toast({
            title: "Could not add to story",
            description: "Try again in a moment.",
            variant: "destructive",
          });
          return;
        }
        setPrefillFile(file);
        setSourcePostId(post.id);
        setOpen(true);
      } catch {
        toast({
          title: "Could not add to story",
          description: "Try again in a moment.",
          variant: "destructive",
        });
      } finally {
        setBusyPostId(null);
      }
    },
    [busyPostId, toast],
  );

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setPrefillFile(null);
      setSourcePostId(null);
    }
  }, []);

  return { sharePostToStory, busyPostId, open, prefillFile, sourcePostId, onOpenChange };
}
