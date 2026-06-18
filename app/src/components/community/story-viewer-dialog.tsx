import { useCallback, useEffect, useMemo, useState } from "react";
import { Flag, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  fetchActiveStoryForAuthor,
  getStoryMediaSignedUrl,
  markStoryViewed,
  type CommunityStoryRow,
} from "@/lib/community/stories-supabase";
import { submitContentReport } from "@/lib/community";
import { cn } from "@/lib/utils";

export type StoryViewerEntry = {
  authorId: string;
  story?: CommunityStoryRow | null;
  authorDisplayName?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries?: StoryViewerEntry[];
  initialIndex?: number;
  /** @deprecated Prefer `entries`. Single-story fallback. */
  authorId?: string | null;
  /** @deprecated Prefer `entries`. */
  story?: CommunityStoryRow | null;
  /** @deprecated Prefer `entries`. */
  authorDisplayName?: string;
  onViewed?: () => void;
};

export function buildStoryViewerQueue(
  self: { id: string; name: string } | null,
  people: { id: string; name: string }[],
  storiesByAuthor: Map<string, CommunityStoryRow>,
): StoryViewerEntry[] {
  const out: StoryViewerEntry[] = [];
  if (self) {
    const story = storiesByAuthor.get(self.id);
    if (story) out.push({ authorId: self.id, story, authorDisplayName: self.name });
  }
  const others = people
    .map((person) => ({ person, story: storiesByAuthor.get(person.id) }))
    .filter((x): x is { person: (typeof people)[0]; story: CommunityStoryRow } => Boolean(x.story))
    .sort((a, b) => {
      if (a.story.viewed_by_me !== b.story.viewed_by_me) {
        return a.story.viewed_by_me ? 1 : -1;
      }
      return a.person.name.localeCompare(b.person.name);
    });
  for (const { person, story } of others) {
    out.push({ authorId: person.id, story, authorDisplayName: person.name });
  }
  return out;
}

export function StoryViewerDialog({
  open,
  onOpenChange,
  entries: entriesProp,
  initialIndex = 0,
  authorId,
  story: storyProp,
  authorDisplayName,
  onViewed,
}: Props) {
  const { toast } = useToast();
  const queue = useMemo(() => {
    if (entriesProp && entriesProp.length > 0) return entriesProp;
    if (authorId) {
      return [{ authorId, story: storyProp, authorDisplayName }];
    }
    return [];
  }, [entriesProp, authorId, storyProp, authorDisplayName]);

  const [index, setIndex] = useState(initialIndex);
  const [resolvedStory, setResolvedStory] = useState<CommunityStoryRow | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);

  const current = queue[index];
  const isLast = index >= queue.length - 1;
  const displayName = current?.authorDisplayName?.trim() || "Story";

  useEffect(() => {
    if (!open) {
      setMediaUrl(null);
      setFailed(false);
      setResolvedStory(null);
      return;
    }
    setIndex(Math.min(Math.max(initialIndex, 0), Math.max(queue.length - 1, 0)));
  }, [open, initialIndex, queue.length]);

  useEffect(() => {
    if (!open || !current) {
      setResolvedStory(null);
      return;
    }
    if (current.story) {
      setResolvedStory(current.story);
      setFailed(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setResolvedStory(null);
    void fetchActiveStoryForAuthor(current.authorId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.error || !res.data) {
        setFailed(true);
        return;
      }
      setResolvedStory(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, current?.authorId, current?.story]);

  useEffect(() => {
    if (!open || !resolvedStory) return;
    let cancelled = false;
    setMediaUrl(null);
    void getStoryMediaSignedUrl(resolvedStory.media_path).then((url) => {
      if (cancelled) return;
      if (url) setMediaUrl(url);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [open, resolvedStory]);

  useEffect(() => {
    if (!open || !resolvedStory) return;
    void markStoryViewed(resolvedStory.id).then(({ error }) => {
      if (!error) onViewed?.();
    });
  }, [open, resolvedStory?.id, onViewed]);

  const advance = useCallback(() => {
    if (index < queue.length - 1) {
      setIndex((i) => i + 1);
      return;
    }
    onOpenChange(false);
  }, [index, queue.length, onOpenChange]);

  async function handleReport() {
    if (!resolvedStory || reportBusy) return;
    setReportBusy(true);
    const res = await submitContentReport({ targetType: "story", targetId: resolvedStory.id });
    setReportBusy(false);
    if (res.error) {
      toast({ title: "Could not report", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Report submitted", description: "Thanks — we'll review this story." });
    onOpenChange(false);
  }

  if (!current && open) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[100dvh] max-w-[100vw] flex-col gap-0 overflow-hidden border-0 bg-black p-0 sm:max-w-lg sm:rounded-xl"
        aria-describedby={undefined}
      >
        <div className="relative flex min-h-[min(100dvh,720px)] flex-1 flex-col bg-black">
          {queue.length > 1 ? (
            <div
              className="absolute left-0 right-0 top-0 z-30 flex gap-1 px-3 pt-[max(0.6rem,env(safe-area-inset-top))]"
              aria-hidden
            >
              {queue.map((entry, i) => (
                <div key={entry.authorId} className="h-0.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/25">
                  <div
                    className={cn(
                      "h-full rounded-full bg-white transition-[width] duration-200",
                      i < index ? "w-full" : i === index ? "w-full" : "w-0",
                    )}
                  />
                </div>
              ))}
            </div>
          ) : null}

          <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between gap-2 p-3 pt-[max(2rem,env(safe-area-inset-top))]">
            <p className="truncate text-sm font-semibold text-white drop-shadow">{displayName}</p>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-white hover:bg-white/15 hover:text-white"
                disabled={reportBusy || !resolvedStory}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleReport();
                }}
                aria-label="Report story"
              >
                <Flag className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-white hover:bg-white/15 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenChange(false);
                }}
                aria-label="Close story"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <button
            type="button"
            className="relative flex flex-1 cursor-default items-center justify-center border-0 bg-transparent p-0 outline-none"
            onClick={advance}
            aria-label={isLast ? "Close story" : "Next story"}
          >
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-white/70" aria-hidden />
            ) : failed || !resolvedStory ? (
              <p className="px-6 text-center text-sm text-white/70">This story is no longer available.</p>
            ) : !mediaUrl ? (
              <Loader2 className="h-8 w-8 animate-spin text-white/70" aria-hidden />
            ) : resolvedStory.media_kind === "image" ? (
              <img src={mediaUrl} alt="" className="max-h-[100dvh] w-full object-contain pointer-events-none" />
            ) : (
              <video
                src={mediaUrl}
                className="max-h-[100dvh] w-full object-contain pointer-events-none"
                controls={false}
                playsInline
                autoPlay
                muted
                loop
              />
            )}
          </button>

          {queue.length > 1 ? (
            <p className="pointer-events-none absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-0 right-0 z-20 text-center text-[11px] text-white/50">
              Tap for {isLast ? "close" : "next"}
            </p>
          ) : (
            <p className="pointer-events-none absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-0 right-0 z-20 text-center text-[11px] text-white/50">
              Tap to close
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
