import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight, Eye } from "lucide-react";
import { Link } from "wouter";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  fetchStoryReactionProfiles,
  fetchStoryReactionSummary,
  fetchStoryViewerProfiles,
  storyReactionEmoji,
  totalStoryReactions,
  type StoryReactionKind,
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

type ActivityRow = {
  userId: string;
  name: string;
  avatar_url: string | null;
  public_handle: string | null;
  at: string;
  reactionKind?: StoryReactionKind;
};

function buildActivityRows(viewers: StoryViewerProfile[], reactions: StoryReactionProfile[]): ActivityRow[] {
  const reactionByUser = new Map(reactions.map((row) => [row.user_id, row]));
  const viewerByUser = new Map(viewers.map((row) => [row.viewer_id, row]));
  const ids = new Set([...viewerByUser.keys(), ...reactionByUser.keys()]);
  const rows: ActivityRow[] = [];
  for (const userId of ids) {
    const viewer = viewerByUser.get(userId);
    const reaction = reactionByUser.get(userId);
    rows.push({
      userId,
      name: viewer?.name ?? reaction?.name ?? "Member",
      avatar_url: viewer?.avatar_url ?? reaction?.avatar_url ?? null,
      public_handle: viewer?.public_handle ?? reaction?.public_handle ?? null,
      at: reaction?.created_at ?? viewer?.viewed_at ?? "",
      reactionKind: reaction?.reaction_kind,
    });
  }
  return rows.sort((a, b) => {
    const reacted = Number(Boolean(b.reactionKind)) - Number(Boolean(a.reactionKind));
    if (reacted !== 0) return reacted;
    return (b.at || "").localeCompare(a.at || "");
  });
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

  const rows = useMemo(() => buildActivityRows(viewers, reactions), [viewers, reactions]);
  const viewCount = viewers.length;
  const reactionCount = reactions.length;
  const summary =
    viewCount === 0 && reactionCount === 0
      ? "No views yet"
      : [
          viewCount > 0 ? `${viewCount} view${viewCount === 1 ? "" : "s"}` : null,
          reactionCount > 0 ? `${reactionCount} reaction${reactionCount === 1 ? "" : "s"}` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(72vh,32rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="space-y-0 border-b border-border/50 px-4 py-3.5 text-left sm:px-5 sm:py-4">
          <div className="flex items-start gap-3 pr-8">
            <div
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10"
              aria-hidden
            >
              <Eye className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-base font-semibold leading-tight">Activity</DialogTitle>
                {!loading && viewCount > 0 ? (
                  <Badge variant="secondary" className="h-5 shrink-0 rounded-full px-1.5 text-[10px] tabular-nums">
                    {viewCount}
                  </Badge>
                ) : null}
              </div>
              <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
                {loading ? "Loading who viewed and reacted…" : summary}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 sm:px-3">
          {loading ? (
            <div className="space-y-1 px-1 py-1">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl px-2.5 py-2.5">
                  <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-2.5 w-16 opacity-70" />
                  </div>
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                <Eye className="h-6 w-6 text-muted-foreground/40" aria-hidden />
              </div>
              <p className="text-sm font-medium text-foreground">No activity yet</p>
              <p className="text-xs text-muted-foreground">Views and reactions will show up here.</p>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {rows.map((row) => (
                <li key={row.userId}>
                  <Link
                    href={`/community/profile/${encodeURIComponent(row.userId)}`}
                    onClick={() => onOpenChange(false)}
                    className="flex min-h-12 items-center gap-3 rounded-2xl px-2.5 py-2 transition-colors hover:bg-muted/50 active:bg-muted/70"
                  >
                    <CommunityAuthorAvatar size="md" displayName={row.name} avatarPath={row.avatar_url} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{row.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {row.public_handle ? `@${row.public_handle}` : ""}
                        {row.public_handle && row.at ? " · " : ""}
                        {row.at ? formatDistanceToNow(new Date(row.at), { addSuffix: true }) : ""}
                      </span>
                    </span>
                    {row.reactionKind ? (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/70 text-base" aria-hidden>
                        {storyReactionEmoji(row.reactionKind)}
                      </span>
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/45" aria-hidden />
                    )}
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
