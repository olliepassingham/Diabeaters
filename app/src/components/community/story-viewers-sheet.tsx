import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Eye } from "lucide-react";
import { Link } from "wouter";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { fetchStoryViewerProfiles, type StoryViewerProfile } from "@/lib/community/stories-supabase";
import { cn } from "@/lib/utils";

export function useStoryViewerCount(storyId: string | undefined, authorId: string | undefined) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!storyId || !authorId) {
      setCount(0);
      return;
    }
    setLoading(true);
    const res = await fetchStoryViewerProfiles(storyId, { excludeUserId: authorId });
    setLoading(false);
    if (!res.error) setCount(res.data.length);
  }, [storyId, authorId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { count, loading, refresh };
}

type StoryViewersSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storyId: string;
  authorId: string;
};

export function StoryViewersSheet({ open, onOpenChange, storyId, authorId }: StoryViewersSheetProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [viewers, setViewers] = useState<StoryViewerProfile[]>([]);

  useEffect(() => {
    if (!open) {
      setViewers([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchStoryViewerProfiles(storyId, { excludeUserId: authorId }).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.error) {
        toast({ title: "Could not load viewers", description: res.error.message, variant: "destructive" });
        return;
      }
      setViewers(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, storyId, authorId, toast]);

  const title =
    viewers.length === 1 ? "1 person viewed your story" : `${viewers.length} people viewed your story`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[70dvh] overflow-hidden sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{loading ? "Story viewers" : viewers.length === 0 ? "Story viewers" : title}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[50dvh] overflow-y-auto">
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : viewers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No views yet. Friends who follow you will see your story on the feed.
            </p>
          ) : (
            <ul className="space-y-1">
              {viewers.map((v) => (
                <li key={v.viewer_id}>
                  <Link
                    href={`/community/profile/${encodeURIComponent(v.viewer_id)}`}
                    onClick={() => onOpenChange(false)}
                    className="flex items-center gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-muted/60"
                  >
                    <CommunityAuthorAvatar displayName={v.name} avatarPath={v.avatar_url} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{v.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {v.public_handle ? `@${v.public_handle} · ` : ""}
                        {formatDistanceToNow(new Date(v.viewed_at), { addSuffix: true })}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type StoryViewersSummaryProps = {
  storyId: string;
  authorId: string;
  className?: string;
  variant?: "inline" | "button" | "chip";
  onOpen?: () => void;
};

export function StoryViewersSummary({
  storyId,
  authorId,
  className,
  variant = "button",
  onOpen,
}: StoryViewersSummaryProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { count, loading, refresh } = useStoryViewerCount(storyId, authorId);

  function openSheet() {
    onOpen?.();
    void refresh();
    setSheetOpen(true);
  }

  const label = loading ? "…" : count === 1 ? "1 view" : `${count} views`;

  return (
    <>
      {variant === "chip" ? (
        <button
          type="button"
          onClick={openSheet}
          className={cn(
            "inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            className,
          )}
        >
          <Eye className="h-3 w-3" aria-hidden />
          {label}
        </button>
      ) : variant === "inline" ? (
        <button
          type="button"
          onClick={openSheet}
          className={cn(
            "text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline",
            className,
          )}
        >
          {loading ? "Loading views…" : count === 0 ? "No views yet" : `${count} ${count === 1 ? "person" : "people"} viewed · See who`}
        </button>
      ) : (
        <Button type="button" variant="outline" size="sm" className={cn("gap-1.5", className)} onClick={openSheet}>
          <Eye className="h-4 w-4" />
          {loading ? "Loading…" : count === 0 ? "No views yet" : label}
          {!loading && count > 0 ? " · See who" : ""}
        </Button>
      )}

      <StoryViewersSheet open={sheetOpen} onOpenChange={setSheetOpen} storyId={storyId} authorId={authorId} />
    </>
  );
}
