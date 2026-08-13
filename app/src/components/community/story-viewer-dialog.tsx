import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, Eye, Flag, Loader2, MessageCircle, Send, Trash2, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { StoryOverlayLayer } from "@/components/community/story-overlay-layer";
import { StoryViewersSheet } from "@/components/community/story-viewers-sheet";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { sendStoryReplyToDmThread, submitContentReport } from "@/lib/community";
import {
  deleteCommunityStory,
  fetchActiveStoryForAuthor,
  fetchStoryReactionSummary,
  getStoryMediaSignedUrl,
  markStoryViewed,
  setStoryReaction,
  STORY_REACTION_OPTIONS,
  type CommunityStoryRow,
  type StoryReactionKind,
  type StoryReactionSummary,
} from "@/lib/community/stories-supabase";
import { cn } from "@/lib/utils";

const DISMISS_DRAG_PX = 72;
const NAV_DRAG_PX = 56;
const TAP_SLOP_PX = 12;

export type StoryViewerEntry = {
  authorId: string;
  story?: CommunityStoryRow | null;
  authorDisplayName?: string;
  authorAvatarUrl?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewerId?: string;
  entries?: StoryViewerEntry[];
  initialIndex?: number;
  /** @deprecated Prefer `entries`. Single-story fallback. */
  authorId?: string | null;
  /** @deprecated Prefer `entries`. */
  story?: CommunityStoryRow | null;
  /** @deprecated Prefer `entries`. */
  authorDisplayName?: string;
  /** @deprecated Prefer `entries`. */
  authorAvatarUrl?: string | null;
  onViewed?: () => void;
};

export function buildStoryViewerQueue(
  self: { id: string; name: string; avatar_url: string | null } | null,
  people: { id: string; name: string; avatar_url: string | null }[],
  storiesByAuthor: Map<string, CommunityStoryRow[]>,
): StoryViewerEntry[] {
  const out: StoryViewerEntry[] = [];

  const appendAuthorStories = (
    authorId: string,
    authorDisplayName: string,
    authorAvatarUrl: string | null,
  ) => {
    for (const story of storiesByAuthor.get(authorId) ?? []) {
      out.push({ authorId, story, authorDisplayName, authorAvatarUrl });
    }
  };

  if (self && (storiesByAuthor.get(self.id)?.length ?? 0) > 0) {
    appendAuthorStories(self.id, self.name, self.avatar_url);
  }

  const others = people
    .filter((person) => (storiesByAuthor.get(person.id)?.length ?? 0) > 0)
    .sort((a, b) => {
      const aStories = storiesByAuthor.get(a.id) ?? [];
      const bStories = storiesByAuthor.get(b.id) ?? [];
      const aUnseen = aStories.some((s) => !s.viewed_by_me);
      const bUnseen = bStories.some((s) => !s.viewed_by_me);
      if (aUnseen !== bUnseen) return aUnseen ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  for (const person of others) {
    appendAuthorStories(person.id, person.name, person.avatar_url);
  }

  return out;
}

export function StoryViewerDialog({
  open,
  onOpenChange,
  viewerId,
  entries: entriesProp,
  initialIndex = 0,
  authorId,
  story: storyProp,
  authorDisplayName,
  authorAvatarUrl,
  onViewed,
}: Props) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queue = useMemo(() => {
    if (entriesProp && entriesProp.length > 0) return entriesProp;
    if (authorId) {
      return [{ authorId, story: storyProp, authorDisplayName, authorAvatarUrl }];
    }
    return [];
  }, [entriesProp, authorId, storyProp, authorDisplayName, authorAvatarUrl]);

  const [index, setIndex] = useState(initialIndex);
  const [resolvedStory, setResolvedStory] = useState<CommunityStoryRow | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [reactions, setReactions] = useState<StoryReactionSummary | null>(null);
  const [reactionBusy, setReactionBusy] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const current = queue[index];
  const isLast = index >= queue.length - 1;
  const displayName = current?.authorDisplayName?.trim() || "Story";
  const profileHref = current ? `/community/profile/${encodeURIComponent(current.authorId)}` : "#";
  const isOwnStory = Boolean(viewerId && current?.authorId === viewerId);
  const canInteract = Boolean(viewerId && current && !isOwnStory);

  const closeViewer = useCallback(() => onOpenChange(false), [onOpenChange]);
  const sourcePostId = resolvedStory?.source_post_id ?? null;
  const openSourcePost = useCallback(() => {
    if (!sourcePostId) return;
    closeViewer();
    setLocation(`/community/post/${sourcePostId}`);
  }, [sourcePostId, closeViewer, setLocation]);
  const viewPostButton = sourcePostId ? (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3.5 py-2 text-white shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-colors hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
      onClick={(e) => {
        e.stopPropagation();
        openSourcePost();
      }}
      data-testid="button-story-view-post"
    >
      <ExternalLink className="h-4 w-4 text-white/90" aria-hidden />
      <span className="text-[13px] font-medium tracking-tight">View post</span>
    </button>
  ) : null;
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const dragRef = useRef({ x: 0, y: 0 });
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!open) {
      setMediaUrl(null);
      setFailed(false);
      setResolvedStory(null);
      setReactions(null);
      setReplyOpen(false);
      setReplyDraft("");
      setViewersOpen(false);
      setDeleteOpen(false);
      touchStart.current = null;
      dragRef.current = { x: 0, y: 0 };
      setDrag({ x: 0, y: 0 });
      setDragging(false);
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
    if (!open || !resolvedStory || !viewerId) return;
    if (resolvedStory.author_id === viewerId) return;
    void markStoryViewed(resolvedStory.id).then(({ error }) => {
      if (!error) onViewed?.();
    });
  }, [open, resolvedStory?.id, resolvedStory?.author_id, viewerId, onViewed]);

  useEffect(() => {
    if (!open || !resolvedStory) return;
    let cancelled = false;
    void fetchStoryReactionSummary(resolvedStory.id).then((res) => {
      if (cancelled) return;
      if (!res.error) setReactions(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, resolvedStory?.id]);

  const advance = useCallback(() => {
    if (replyOpen || viewersOpen || deleteOpen) return;
    if (index < queue.length - 1) {
      setIndex((i) => i + 1);
      return;
    }
    onOpenChange(false);
  }, [index, queue.length, onOpenChange, replyOpen, viewersOpen, deleteOpen]);

  const goPrev = useCallback(() => {
    if (replyOpen || viewersOpen || deleteOpen) return;
    if (index > 0) setIndex((i) => i - 1);
  }, [index, replyOpen, viewersOpen, deleteOpen]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (replyOpen || viewersOpen || deleteOpen) return;
      if (e.key === "ArrowRight") advance();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, advance, goPrev, replyOpen, viewersOpen, deleteOpen]);

  const resetDrag = useCallback(() => {
    touchStart.current = null;
    dragRef.current = { x: 0, y: 0 };
    setDragging(false);
    setDrag({ x: 0, y: 0 });
  }, []);

  const onTouchStart = (e: TouchEvent) => {
    if (replyOpen || viewersOpen || deleteOpen) return;
    const t = e.changedTouches[0];
    if (!t) return;
    touchStart.current = { x: t.clientX, y: t.clientY };
    setDragging(true);
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!touchStart.current || replyOpen || viewersOpen || deleteOpen) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    if (Math.abs(dy) > Math.abs(dx) && dy > 0) {
      dragRef.current = { x: 0, y: dy };
      setDrag({ x: 0, y: dy });
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) {
      dragRef.current = { x: dx, y: 0 };
      setDrag({ x: dx, y: 0 });
      return;
    }
    dragRef.current = { x: 0, y: 0 };
    setDrag({ x: 0, y: 0 });
  };

  const onTouchEnd = () => {
    if (!touchStart.current) return;
    const { x, y } = dragRef.current;
    if (Math.abs(x) > TAP_SLOP_PX || Math.abs(y) > TAP_SLOP_PX) {
      suppressClick.current = true;
    }
    if (y >= DISMISS_DRAG_PX) {
      closeViewer();
    } else if (x <= -NAV_DRAG_PX) {
      advance();
    } else if (x >= NAV_DRAG_PX) {
      goPrev();
    }
    resetDrag();
  };

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

  async function handleDeleteStory() {
    if (!resolvedStory || !isOwnStory || deleteBusy) return;
    setDeleteBusy(true);
    const res = await deleteCommunityStory(resolvedStory.id);
    setDeleteBusy(false);
    if (res.error) {
      toast({ title: "Could not delete story", description: res.error.message, variant: "destructive" });
      return;
    }
    setDeleteOpen(false);
    toast({ title: "Story deleted", description: "It’s no longer on your profile." });
    onViewed?.();
    closeViewer();
  }

  async function handleReaction(kind: StoryReactionKind) {
    if (!resolvedStory || reactionBusy || !canInteract) return;
    const next = reactions?.my_reaction === kind ? null : kind;
    setReactionBusy(true);
    const res = await setStoryReaction(resolvedStory.id, next);
    setReactionBusy(false);
    if (res.error) {
      toast({ title: "Could not react", description: res.error.message, variant: "destructive" });
      return;
    }
    setReactions((prev) => {
      const base: StoryReactionSummary = prev ?? { heart: 0, support: 0, celebrate: 0, my_reaction: null };
      const updated = { ...base };
      if (base.my_reaction) {
        updated[base.my_reaction] = Math.max(0, updated[base.my_reaction] - 1);
      }
      if (next) {
        updated[next] += 1;
        updated.my_reaction = next;
      } else {
        updated.my_reaction = null;
      }
      return updated;
    });
  }

  function openViewers() {
    if (!resolvedStory || !isOwnStory || !viewerId) return;
    setViewersOpen(true);
  }

  async function handleSendReply() {
    if (!resolvedStory || !current || replyBusy || !canInteract) return;
    setReplyBusy(true);
    const res = await sendStoryReplyToDmThread(current.authorId, resolvedStory.id, replyDraft);
    setReplyBusy(false);
    if (res.error || !res.data) {
      toast({
        title: "Could not send reply",
        description: res.error?.message ?? "Try again.",
        variant: "destructive",
      });
      return;
    }
    setReplyOpen(false);
    setReplyDraft("");
    onOpenChange(false);
    setLocation(`/community/messages/${res.data.threadId}`);
  }

  if (!current && open) {
    return null;
  }

  const dismissProgress = Math.min(1, drag.y / 220);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} mobileSheet={false}>
        <DialogContent
          className="inset-0 flex h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-black p-0 left-0 top-0 sm:inset-auto sm:left-[50%] sm:top-[50%] sm:h-[min(100dvh,760px)] sm:w-full sm:max-w-md sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[1.75rem] [&>button]:hidden"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">{displayName}'s story</DialogTitle>
          <div
            className={cn(
              "relative flex min-h-0 flex-1 flex-col overflow-hidden bg-black",
              dragging ? "transition-none" : "transition-transform duration-200 ease-out",
            )}
            style={{
              transform: `translate3d(0, ${drag.y}px, 0) scale(${1 - dismissProgress * 0.06})`,
              opacity: 1 - dismissProgress * 0.35,
            }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchEnd}
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 z-10 h-36 bg-gradient-to-b from-black/75 via-black/35 to-transparent"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-44 bg-gradient-to-t from-black/80 via-black/35 to-transparent"
              aria-hidden
            />

            <div
              className="pointer-events-none absolute left-1/2 top-[max(0.4rem,env(safe-area-inset-top))] z-30 h-1 w-10 -translate-x-1/2 rounded-full bg-white/35 sm:hidden"
              aria-hidden
            />

            <div
              className="absolute left-0 right-0 top-0 z-30 flex gap-1 px-3 pt-[max(0.9rem,calc(env(safe-area-inset-top)+0.35rem))] sm:pt-3"
              aria-hidden
            >
              {(queue.length > 0 ? queue : [{ authorId: "story" }]).map((entry, i) => (
                <div
                  key={`${entry.authorId}-${i}`}
                  className="h-[2px] min-w-0 flex-1 overflow-hidden rounded-full bg-white/25"
                >
                  <div
                    className={cn(
                      "h-full rounded-full bg-white transition-[width] duration-200",
                      i < index || queue.length <= 1 ? "w-full" : i === index ? "w-full" : "w-0",
                    )}
                  />
                </div>
              ))}
            </div>

            <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between gap-2 px-3 pb-2 pt-[max(1.85rem,calc(env(safe-area-inset-top)+1.15rem))]">
              {current ? (
                <Link
                  href={profileHref}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeViewer();
                  }}
                  className="flex min-w-0 max-w-[calc(100%-5.5rem)] items-center gap-2.5 rounded-full py-1 pr-3 pl-1 outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/35"
                  data-testid="story-viewer-author-link"
                >
                  <CommunityAuthorAvatar
                    displayName={displayName}
                    avatarPath={current.authorAvatarUrl}
                    size="sm"
                    className="!h-9 !w-9 shrink-0 shadow-md ring-2 ring-white/25"
                  />
                  <span className="min-w-0 text-left">
                    <span className="block truncate text-[13px] font-semibold leading-tight tracking-tight text-white">
                      {displayName}
                    </span>
                    {resolvedStory?.created_at ? (
                      <time
                        className="block truncate text-[11px] leading-tight text-white/60"
                        dateTime={resolvedStory.created_at}
                        title={resolvedStory.created_at}
                      >
                        {formatDistanceToNow(new Date(resolvedStory.created_at), { addSuffix: true })}
                      </time>
                    ) : (
                      <span className="block text-[11px] leading-tight text-white/50">View profile</span>
                    )}
                  </span>
                </Link>
              ) : (
                <div className="min-w-0 flex-1" />
              )}
              <div className="flex shrink-0 items-center gap-1">
                {isOwnStory ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full border border-white/10 bg-white/10 text-white/90 backdrop-blur-md hover:bg-white/20 hover:text-white"
                    disabled={!resolvedStory || deleteBusy}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteOpen(true);
                    }}
                    aria-label="Delete story"
                    data-testid="button-delete-story"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full border border-white/10 bg-white/10 text-white/90 backdrop-blur-md hover:bg-white/20 hover:text-white"
                    disabled={reportBusy || !resolvedStory}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleReport();
                    }}
                    aria-label="Report story"
                  >
                    <Flag className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full border border-white/10 bg-white/10 text-white/90 backdrop-blur-md hover:bg-white/20 hover:text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeViewer();
                  }}
                  aria-label="Close story"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <button
              type="button"
              className="relative flex min-h-0 flex-1 cursor-default items-center justify-center border-0 bg-transparent p-0 outline-none"
              onClick={() => {
                if (suppressClick.current) {
                  suppressClick.current = false;
                  return;
                }
                advance();
              }}
              aria-label={isLast ? "Close story" : "Next story"}
            >
              {loading ? (
                <Loader2 className="h-8 w-8 animate-spin text-white/70" aria-hidden />
              ) : failed || !resolvedStory ? (
                <p className="px-6 text-center text-sm text-white/70">This story is no longer available.</p>
              ) : !mediaUrl ? (
                <Loader2 className="h-8 w-8 animate-spin text-white/70" aria-hidden />
              ) : (
                <div className="relative h-full w-full">
                  {resolvedStory.media_kind === "image" ? (
                    <img src={mediaUrl} alt="" className="h-full w-full object-cover pointer-events-none" />
                  ) : (
                    <video
                      src={mediaUrl}
                      className="h-full w-full object-cover pointer-events-none"
                      controls={false}
                      playsInline
                      autoPlay
                      muted
                      loop
                    />
                  )}
                  <StoryOverlayLayer overlays={resolvedStory.overlays} />
                </div>
              )}
            </button>

            <div
              className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-[max(1.1rem,env(safe-area-inset-bottom))]"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              {resolvedStory?.caption ? (
                <p className="mb-3 text-center text-sm font-medium leading-snug text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.65)]">
                  {resolvedStory.caption}
                </p>
              ) : null}

              {isOwnStory ? (
                <div className="flex justify-center gap-2">
                  {viewPostButton}
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3.5 py-2 text-white shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-colors hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
                    onClick={(e) => {
                      e.stopPropagation();
                      openViewers();
                    }}
                  >
                    <Eye className="h-4 w-4 text-white/90" aria-hidden />
                    <span className="text-[13px] font-medium tracking-tight">Activity</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {viewPostButton ? <div className="flex justify-center">{viewPostButton}</div> : null}
                  {canInteract ? (
                    replyOpen ? (
                    <div
                      className="flex items-center gap-2 rounded-full border border-white/12 bg-black/45 p-1 pl-4 backdrop-blur-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Input
                        value={replyDraft}
                        onChange={(e) => setReplyDraft(e.target.value)}
                        placeholder="Send a reply…"
                        className="h-10 border-0 bg-transparent px-0 text-white shadow-none placeholder:text-white/45 focus-visible:ring-0"
                        maxLength={500}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleSendReply();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="icon"
                        className="h-10 w-10 shrink-0 rounded-full"
                        disabled={replyBusy}
                        onClick={() => void handleSendReply()}
                        aria-label="Send reply"
                      >
                        {replyBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="mx-auto flex w-fit items-center gap-0.5 rounded-full border border-white/12 bg-black/40 p-1 backdrop-blur-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {STORY_REACTION_OPTIONS.map((opt) => (
                        <Button
                          key={opt.kind}
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-11 min-w-11 rounded-full px-2 text-xl hover:bg-white/15",
                            reactions?.my_reaction === opt.kind && "bg-white/20 ring-1 ring-white/40",
                          )}
                          disabled={reactionBusy}
                          aria-label={opt.label}
                          aria-pressed={reactions?.my_reaction === opt.kind}
                          onClick={() => void handleReaction(opt.kind)}
                        >
                          {opt.emoji}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-11 gap-1.5 rounded-full px-3.5 text-[13px] font-medium text-white hover:bg-white/15"
                        onClick={() => setReplyOpen(true)}
                      >
                        <MessageCircle className="h-4 w-4" />
                        Reply
                      </Button>
                    </div>
                    )
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {resolvedStory && viewerId && isOwnStory ? (
        <StoryViewersSheet
          open={viewersOpen}
          onOpenChange={setViewersOpen}
          storyId={resolvedStory.id}
          authorId={viewerId}
        />
      ) : null}

      <AlertDialog open={deleteOpen} onOpenChange={(open) => !deleteBusy && setDeleteOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this story?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be removed from your profile for everyone. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteBusy}
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteStory();
              }}
            >
              {deleteBusy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
