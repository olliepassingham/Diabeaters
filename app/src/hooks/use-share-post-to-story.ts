import { useCallback, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { fileFromPostMediaPath } from "@/lib/community/post-media-signed-urls";
import type { CommunityPostRow } from "@/lib/community";

export function useSharePostToStory() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [prefillFile, setPrefillFile] = useState<File | null>(null);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);

  const sharePostToStory = useCallback(
    async (post: CommunityPostRow) => {
      const path = post.image_urls[0];
      if (!path || busyPostId) return;
      setBusyPostId(post.id);
      try {
        const file = await fileFromPostMediaPath(path);
        if (!file) {
          toast({
            title: "Could not add to story",
            description: "Try again in a moment.",
            variant: "destructive",
          });
          return;
        }
        setPrefillFile(file);
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
    if (!next) setPrefillFile(null);
  }, []);

  return { sharePostToStory, busyPostId, open, prefillFile, onOpenChange };
}
