import { useCallback, useEffect, useState } from "react";
import { Flag, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  fetchActiveStoryForAuthor,
  getStoryMediaSignedUrl,
  markStoryViewed,
  type CommunityStoryRow,
} from "@/lib/community/stories-supabase";
import { submitContentReport } from "@/lib/community";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Load story by author when story row is not provided. */
  authorId?: string | null;
  story?: CommunityStoryRow | null;
  authorDisplayName?: string;
  onViewed?: () => void;
};

export function StoryViewerDialog({
  open,
  onOpenChange,
  authorId,
  story: storyProp,
  authorDisplayName,
  onViewed,
}: Props) {
  const { toast } = useToast();
  const [story, setStory] = useState<CommunityStoryRow | null>(storyProp ?? null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);

  const loadStory = useCallback(async () => {
    if (storyProp) {
      setStory(storyProp);
      return;
    }
    if (!authorId) {
      setStory(null);
      return;
    }
    setLoading(true);
    setFailed(false);
    const res = await fetchActiveStoryForAuthor(authorId);
    setLoading(false);
    if (res.error || !res.data) {
      setStory(null);
      setFailed(true);
      return;
    }
    setStory(res.data);
  }, [authorId, storyProp]);

  useEffect(() => {
    if (!open) {
      setMediaUrl(null);
      setFailed(false);
      return;
    }
    void loadStory();
  }, [open, loadStory]);

  useEffect(() => {
    if (!open || !story) return;
    let cancelled = false;
    setMediaUrl(null);
    void getStoryMediaSignedUrl(story.media_path).then((url) => {
      if (cancelled) return;
      if (url) setMediaUrl(url);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [open, story]);

  useEffect(() => {
    if (!open || !story) return;
    void markStoryViewed(story.id).then(({ error }) => {
      if (!error) onViewed?.();
    });
  }, [open, story, onViewed]);

  async function handleReport() {
    if (!story || reportBusy) return;
    setReportBusy(true);
    const res = await submitContentReport({ targetType: "story", targetId: story.id });
    setReportBusy(false);
    if (res.error) {
      toast({ title: "Could not report", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Report submitted", description: "Thanks — we'll review this story." });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[100dvh] max-w-[100vw] flex-col gap-0 overflow-hidden border-0 bg-black p-0 sm:max-w-lg sm:rounded-xl"
        aria-describedby={undefined}
      >
        <div className="relative flex min-h-[min(100dvh,720px)] flex-1 flex-col bg-black">
          <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <p className="truncate text-sm font-semibold text-white drop-shadow">
              {authorDisplayName?.trim() || "Story"}
            </p>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-white hover:bg-white/15 hover:text-white"
                disabled={reportBusy || !story}
                onClick={() => void handleReport()}
                aria-label="Report story"
              >
                <Flag className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-white hover:bg-white/15 hover:text-white"
                onClick={() => onOpenChange(false)}
                aria-label="Close story"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center">
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-white/70" aria-hidden />
            ) : failed || !story ? (
              <p className="px-6 text-center text-sm text-white/70">This story is no longer available.</p>
            ) : !mediaUrl ? (
              <Loader2 className="h-8 w-8 animate-spin text-white/70" aria-hidden />
            ) : story.media_kind === "image" ? (
              <img src={mediaUrl} alt="" className="max-h-[100dvh] w-full object-contain" />
            ) : (
              <video
                src={mediaUrl}
                className={cn("max-h-[100dvh] w-full object-contain")}
                controls={false}
                playsInline
                autoPlay
                muted
                loop
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
