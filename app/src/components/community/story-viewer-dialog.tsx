import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Eye, ChevronRight, Flag, Loader2, MessageCircle, Send, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { StoryOverlayLayer } from "@/components/community/story-overlay-layer";
import { StoryViewersSheet, useStoryViewerCount } from "@/components/community/story-viewers-sheet";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { sendStoryReplyToDmThread, submitContentReport } from "@/lib/community";
import {
  fetchActiveStoryForAuthor,
  fetchStoryReactionProfiles,
  fetchStoryReactionSummary,
  getStoryMediaSignedUrl,
  markStoryViewed,
  setStoryReaction,
  storyReactionEmoji,
  STORY_REACTION_OPTIONS,
  totalStoryReactions,
  type CommunityStoryRow,
  type StoryReactionKind,
  type StoryReactionProfile,
  type StoryReactionSummary,
} from "@/lib/community/stories-supabase";
import { cn } from "@/lib/utils";

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
  const [reactionProfiles, setReactionProfiles] = useState<StoryReactionProfile[]>([]);

  const current = queue[index];
  const isLast = index >= queue.length - 1;
  const displayName = current?.authorDisplayName?.trim() || "Story";
  const profileHref = current ? `/community/profile/${encodeURIComponent(current.authorId)}` : "#";
  const isOwnStory = Boolean(viewerId && current?.authorId === viewerId);
  const canInteract = Boolean(viewerId && current && !isOwnStory);
  const { count: viewCount, refresh: refreshViewCount } = useStoryViewerCount(
    isOwnStory ? resolvedStory?.id : undefined,
    isOwnStory ? viewerId : undefined,
  );

  const closeViewer = useCallback(() => onOpenChange(false), [onOpenChange]);

  useEffect(() => {
    if (!open) {
      setMediaUrl(null);
      setFailed(false);
      setResolvedStory(null);
      setReactions(null);
      setReplyOpen(false);
      setReplyDraft("");
      setViewersOpen(false);
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

  const refreshReactionProfiles = useCallback(async () => {
    if (!resolvedStory || !isOwnStory) {
      setReactionProfiles([]);
      return;
    }
    const res = await fetchStoryReactionProfiles(resolvedStory.id);
    if (!res.error) {
      setReactionProfiles(res.data);
      setReactions((prev) => {
        const base: StoryReactionSummary = { heart: 0, support: 0, celebrate: 0, my_reaction: prev?.my_reaction ?? null };
        for (const row of res.data) {
          if (row.reaction_kind === "heart") base.heart += 1;
          else if (row.reaction_kind === "support") base.support += 1;
          else if (row.reaction_kind === "celebrate") base.celebrate += 1;
        }
        return base;
      });
    }
  }, [resolvedStory, isOwnStory]);

  useEffect(() => {
    if (!open || !resolvedStory || !isOwnStory) {
      setReactionProfiles([]);
      return;
    }
    void refreshReactionProfiles();
    const id = window.setInterval(() => void refreshReactionProfiles(), 12_000);
    return () => window.clearInterval(id);
  }, [open, resolvedStory?.id, isOwnStory, refreshReactionProfiles]);

  const advance = useCallback(() => {
    if (replyOpen) return;
    if (index < queue.length - 1) {
      setIndex((i) => i + 1);
      return;
    }
    onOpenChange(false);
  }, [index, queue.length, onOpenChange, replyOpen]);

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

  async function openViewers() {
    if (!resolvedStory || !isOwnStory || !viewerId) return;
    void refreshViewCount();
    void refreshReactionProfiles();
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

  const reactionTotal = totalStoryReactions(reactions);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} mobileSheet={false}>
        <DialogContent
          className="flex max-h-[100dvh] max-w-[100vw] flex-col gap-0 overflow-hidden border-0 bg-black p-0 sm:max-w-lg sm:rounded-xl"
          aria-describedby={undefined}
        >
          <div className="relative flex min-h-[min(100dvh,720px)] flex-1 flex-col bg-black">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-gradient-to-b from-black/80 via-black/40 to-transparent"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-40 bg-gradient-to-t from-black/85 via-black/45 to-transparent"
              aria-hidden
            />

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

            <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between gap-2 px-3 pb-2 pt-[max(2.25rem,env(safe-area-inset-top))]">
              {current ? (
                <Link
                  href={profileHref}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeViewer();
                  }}
                  className="flex min-w-0 max-w-[calc(100%-5.5rem)] items-center gap-2.5 rounded-full py-1 pr-3 pl-1 outline-none ring-offset-background transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/35"
                  data-testid="story-viewer-author-link"
                >
                  <CommunityAuthorAvatar
                    displayName={displayName}
                    avatarPath={current.authorAvatarUrl}
                    size="sm"
                    className="!h-9 !w-9 shrink-0 ring-2 ring-white/20 shadow-md"
                  />
                  <span className="min-w-0 text-left">
                    <span className="block truncate text-sm font-semibold leading-tight text-white">{displayName}</span>
                    {resolvedStory?.created_at ? (
                      <time
                        className="block truncate text-[11px] leading-tight text-white/65"
                        dateTime={resolvedStory.created_at}
                        title={resolvedStory.created_at}
                      >
                        {formatDistanceToNow(new Date(resolvedStory.created_at), { addSuffix: true })}
                      </time>
                    ) : (
                      <span className="block text-[11px] leading-tight text-white/55">View profile</span>
                    )}
                  </span>
                </Link>
              ) : (
                <div className="min-w-0 flex-1" />
              )}
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full text-white/90 hover:bg-white/15 hover:text-white"
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
                  className="h-9 w-9 rounded-full text-white/90 hover:bg-white/15 hover:text-white"
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
              className="relative flex flex-1 cursor-default items-center justify-center border-0 bg-transparent p-0 pb-28 outline-none"
              onClick={advance}
              aria-label={isLast ? "Close story" : "Next story"}
            >
              {loading ? (
                <Loader2 className="h-8 w-8 animate-spin text-white/70" aria-hidden />
              ) : failed || !resolvedStory ? (
                <p className="px-6 text-center text-sm text-white/70">This story is no longer available.</p>
              ) : !mediaUrl ? (
                <Loader2 className="h-8 w-8 animate-spin text-white/70" aria-hidden />
              ) : (
                <div className="relative flex h-full w-full items-center justify-center">
                  {resolvedStory.media_kind === "image" ? (
                    <img src={mediaUrl} alt="" className="max-h-full w-full object-contain pointer-events-none" />
                  ) : (
                    <video
                      src={mediaUrl}
                      className="max-h-full w-full object-contain pointer-events-none"
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

            <div className="absolute bottom-0 left-0 right-0 z-20 space-y-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {resolvedStory?.caption ? (
                <p className="text-center text-sm leading-snug text-white/90">{resolvedStory.caption}</p>
              ) : null}

              {isOwnStory ? (
                <div className="flex flex-col items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex max-w-full items-center gap-2.5 rounded-full border border-white/15 bg-black/40 px-4 py-2.5 text-left shadow-lg backdrop-blur-md transition-colors hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                    onClick={(e) => {
                      e.stopPropagation();
                      void openViewers();
                    }}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                      <Eye className="h-4 w-4 text-white/90" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium leading-tight text-white">
                        {viewCount === 0 && reactionTotal === 0
                          ? "No activity yet"
                          : [
                              viewCount > 0 ? `${viewCount} viewer${viewCount === 1 ? "" : "s"}` : null,
                              reactionTotal > 0
                                ? `${reactionTotal} reaction${reactionTotal === 1 ? "" : "s"}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                      </span>
                      <span className="block text-xs leading-tight text-white/55">Tap for views and reactions</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-white/45" aria-hidden />
                  </button>
                  {reactionProfiles.length > 0 ? (
                    <div className="flex max-w-full flex-wrap justify-center gap-1.5 px-2">
                      {reactionProfiles.slice(0, 6).map((r) => (
                        <span
                          key={r.user_id}
                          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/35 px-2 py-1 text-xs text-white/90 backdrop-blur-sm"
                        >
                          <span aria-hidden>{storyReactionEmoji(r.reaction_kind)}</span>
                          <span className="max-w-[5rem] truncate">{r.name.split(" ")[0]}</span>
                        </span>
                      ))}
                      {reactionProfiles.length > 6 ? (
                        <span className="text-xs text-white/50">+{reactionProfiles.length - 6} more</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : canInteract ? (
                <div className="space-y-2">
                  {replyOpen ? (
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Input
                        value={replyDraft}
                        onChange={(e) => setReplyDraft(e.target.value)}
                        placeholder="Write a reply…"
                        className="border-white/20 bg-black/40 text-white placeholder:text-white/50"
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
                        className="shrink-0"
                        disabled={replyBusy}
                        onClick={() => void handleSendReply()}
                        aria-label="Send reply"
                      >
                        {replyBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
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
                        className="h-11 gap-1.5 rounded-full px-3 text-white hover:bg-white/15"
                        onClick={() => setReplyOpen(true)}
                      >
                        <MessageCircle className="h-4 w-4" />
                        Reply
                      </Button>
                    </div>
                  )}
                </div>
              ) : null}

              {queue.length > 1 ? (
                <p className="pointer-events-none text-center text-[11px] text-white/50">
                  Tap for {isLast ? "close" : "next"}
                </p>
              ) : !canInteract && !isOwnStory ? (
                <p className="pointer-events-none text-center text-[11px] text-white/50">Tap to close</p>
              ) : null}
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
    </>
  );
}
