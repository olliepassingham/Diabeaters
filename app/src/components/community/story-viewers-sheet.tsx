import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Eye } from "lucide-react";
import { Link } from "wouter";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  fetchStoryReactionProfiles,
  fetchStoryReactionSummary,
  fetchStoryViewerProfiles,
  storyReactionEmoji,
  totalStoryReactions,
  type StoryReactionProfile,
  type StoryViewerProfile,
} from "@/lib/community/stories-supabase";
import { cn } from "@/lib/utils";

export function useStoryViewerCount(storyId: string | undefined, authorId: string | undefined) {
  const [count, setCount] = useState(0);
  const [reactionCount, setReactionCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!storyId || !authorId) {
      setCount(0);
      setReactionCount(0);
      return;
    }
    setLoading(true);
    const [viewersRes, reactionsRes] = await Promise.all([
      fetchStoryViewerProfiles(storyId, { excludeUserId: authorId }),
      fetchStoryReactionSummary(storyId),
    ]);
    setLoading(false);
    if (!viewersRes.error) setCount(viewersRes.data.length);
    if (!reactionsRes.error && reactionsRes.data) {
      setReactionCount(totalStoryReactions(reactionsRes.data));
    }
  }, [storyId, authorId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { count, reactionCount, loading, refresh };
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
  const [reactions, setReactions] = useState<StoryReactionProfile[]>([]);

  useEffect(() => {
    if (!open) {
      setViewers([]);
      setReactions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      fetchStoryViewerProfiles(storyId, { excludeUserId: authorId }),
      fetchStoryReactionProfiles(storyId),
    ]).then(([viewersRes, reactionsRes]) => {
      if (cancelled) return;
      setLoading(false);
      if (viewersRes.error || reactionsRes.error) {
        toast({
          title: "Could not load story activity",
          description: viewersRes.error?.message ?? reactionsRes.error?.message,
          variant: "destructive",
        });
        return;
      }
      setViewers(viewersRes.data);
      setReactions(reactionsRes.data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, storyId, authorId, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[70dvh] overflow-hidden sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Story activity</DialogTitle>
        </DialogHeader>
        <div className="max-h-[50dvh] space-y-5 overflow-y-auto">
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reactions</h3>
                {reactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No reactions yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {reactions.map((r) => (
                      <li key={r.user_id}>
                        <Link
                          href={`/community/profile/${encodeURIComponent(r.user_id)}`}
                          onClick={() => onOpenChange(false)}
                          className="flex items-center gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-muted/60"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-lg">
                            {storyReactionEmoji(r.reaction_kind)}
                          </span>
                          <CommunityAuthorAvatar displayName={r.name} avatarPath={r.avatar_url} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{r.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-2 border-t border-border/40 pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Viewers</h3>
                {viewers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No views yet.</p>
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
              </section>
            </>
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
  const { count, reactionCount, loading, refresh } = useStoryViewerCount(storyId, authorId);

  function openSheet() {
    onOpen?.();
    void refresh();
    setSheetOpen(true);
  }

  const activityParts = [
    !loading && count > 0 ? (count === 1 ? "1 view" : `${count} views`) : null,
    !loading && reactionCount > 0
      ? `${reactionCount} ${reactionCount === 1 ? "reaction" : "reactions"}`
      : null,
  ].filter(Boolean);

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
          {loading ? "…" : activityParts.length > 0 ? activityParts.join(" · ") : "No activity"}
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
          {loading
            ? "Loading activity…"
            : activityParts.length === 0
              ? "No activity yet"
              : `${activityParts.join(" · ")} · See details`}
        </button>
      ) : (
        <Button type="button" variant="outline" size="sm" className={cn("gap-1.5", className)} onClick={openSheet}>
          <Eye className="h-4 w-4" />
          {loading ? "Loading…" : activityParts.length === 0 ? "No activity yet" : activityParts.join(" · ")}
          {!loading && (count > 0 || reactionCount > 0) ? " · See details" : ""}
        </Button>
      )}

      <StoryViewersSheet open={sheetOpen} onOpenChange={setSheetOpen} storyId={storyId} authorId={authorId} />
    </>
  );
}
