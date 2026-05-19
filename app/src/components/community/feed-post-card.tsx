import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  Bookmark,
  Calendar,
  Flag,
  Heart,
  Link2,
  Loader2,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Reply,
  Share2,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { CommunityPostImageGrid } from "@/components/community/community-post-image-grid";
import { FeedLinkPreview } from "@/components/community/feed-link-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FieldLabelWithInfo } from "@/components/ui/field-label-with-info";
import { useToast } from "@/hooks/use-toast";
import { getProfileIdByPublicHandle, getProfilesByIds, normalizePublicHandleInput } from "@/lib/profile";
import { cn } from "@/lib/utils";
import {
  castPollVote,
  communityTopicLabel,
  fetchCommentsForPost,
  fetchDmThreadsForCurrentUser,
  fetchPollVoteState,
  getFirstWhitelistedFeedLink,
  fetchPostLikersWithProfiles,
  fetchPollVotersWithProfiles,
  otherMemberUserId,
  parseEventExtra,
  parsePollExtra,
  POST_LIKERS_QUERY_LIMIT,
  sendFeedPostToDmThread,
  type CommunityPostCommentRow,
  type CommunityPostRow,
} from "@/lib/community";

const RECENT_DM_PEERS_LIMIT = 20;

function shortPeerId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

function renderBodyWithMentions(body: string, mentionMap: Record<string, string>) {
  const re = /@([a-z0-9_]{3,30})/gi;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) {
      out.push(<Fragment key={`t-${key++}`}>{body.slice(last, m.index)}</Fragment>);
    }
    const rawHandle = m[1]!;
    const uid = mentionMap[rawHandle.toLowerCase()];
    if (uid) {
      out.push(
        <Link
          key={`m-${key++}`}
          href={`/community/profile/${uid}`}
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          @{rawHandle}
        </Link>,
      );
    } else {
      out.push(<Fragment key={`h-${key++}`}>@{rawHandle}</Fragment>);
    }
    last = re.lastIndex;
  }
  if (last < body.length) {
    out.push(<Fragment key={`t-${key++}`}>{body.slice(last)}</Fragment>);
  }
  return out;
}

function formatEventWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function FeedPollBlock({
  postId,
  question,
  options,
  viewerId,
}: {
  postId: string;
  question: string;
  options: string[];
  viewerId: string | undefined;
}) {
  const { toast } = useToast();
  const [counts, setCounts] = useState<number[]>(() => Array.from({ length: options.length }, () => 0));
  const [myIdx, setMyIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [votersOpen, setVotersOpen] = useState(false);
  const [votersLoading, setVotersLoading] = useState(false);
  const [voters, setVoters] = useState<Array<{ user_id: string; name: string; avatar_url: string | null; option_index: number }>>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await fetchPollVoteState(postId, options.length);
      if (cancelled) return;
      setLoading(false);
      if (!r.error) {
        setCounts(r.counts);
        setMyIdx(r.myOptionIndex);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId, options.length]);

  const total = useMemo(() => counts.reduce((a, b) => a + b, 0), [counts]);
  const revealTallies = myIdx !== null;

  async function onPick(i: number) {
    if (!viewerId) {
      toast({ title: "Sign in to vote", description: "Log in to cast your vote on this poll.", variant: "destructive" });
      return;
    }
    const errRes = await castPollVote(postId, i);
    if (errRes.error) {
      toast({ title: "Could not vote", description: errRes.error.message, variant: "destructive" });
      return;
    }
    const r = await fetchPollVoteState(postId, options.length);
    if (!r.error) {
      setCounts(r.counts);
      setMyIdx(r.myOptionIndex);
    }
  }

  async function openVoters() {
    setVotersOpen(true);
    if (votersLoading || voters.length > 0) return;
    setVotersLoading(true);
    const res = await fetchPollVotersWithProfiles(postId);
    setVotersLoading(false);
    if (res.error) {
      toast({ title: "Could not load voters", description: res.error.message, variant: "destructive" });
      return;
    }
    setVoters(res.data.map((r) => ({ user_id: r.user_id, name: r.name, avatar_url: r.avatar_url, option_index: r.option_index })));
  }

  return (
    <div className="space-y-2 rounded-xl border border-border/60 bg-muted/15 p-3">
      <p className="text-sm font-semibold leading-snug">{question}</p>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading poll…</p>
      ) : (
        <ul className="space-y-2">
          {options.map((label, i) => {
            const pct = total > 0 && revealTallies ? Math.round((counts[i]! / total) * 100) : null;
            return (
              <li key={i}>
                <Button
                  type="button"
                  variant={myIdx === i ? "default" : "outline"}
                  size="sm"
                  className="h-auto min-h-9 w-full justify-start whitespace-normal px-3 py-2 text-left font-normal"
                  disabled={!viewerId}
                  onClick={() => void onPick(i)}
                >
                  <span className="flex w-full items-start justify-between gap-2">
                    <span>{label}</span>
                    {revealTallies && pct !== null ? (
                      <span className="shrink-0 tabular-nums text-xs opacity-80">
                        {pct}% · {counts[i]}
                      </span>
                    ) : null}
                  </span>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {!loading && total > 0 ? (
        <div className="pt-1">
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => void openVoters()}>
            View who voted
          </Button>
        </div>
      ) : null}

      <Dialog open={votersOpen} onOpenChange={setVotersOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Poll voters</DialogTitle>
            <DialogDescription>Who has voted so far (hidden for blocked users).</DialogDescription>
          </DialogHeader>
          {votersLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : voters.length === 0 ? (
            <p className="text-sm text-muted-foreground">No votes yet.</p>
          ) : (
            <ul className="space-y-2">
              {voters.map((v) => (
                <li key={v.user_id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/60 p-2">
                  <CommunityAuthorAvatar
                    displayName={v.name}
                    avatarPath={v.avatar_url}
                    size="sm"
                    profileHref={`/community/profile/${encodeURIComponent(v.user_id)}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{v.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      Voted: {options[v.option_index] ?? "—"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** date-fns throws RangeError on invalid dates; DB/RPC should always send ISO strings but guard anyway. */
function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "recently";
  try {
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "recently";
  }
}

export type CommentAuthorMeta = { name: string; avatar_url: string | null };

type FeedPostCardProps = {
  post: CommunityPostRow;
  viewerId: string | undefined;
  authorDisplayName: string;
  authorLoading?: boolean;
  /** Shown under the display name when set (community public handle). */
  authorPublicHandle?: string | null;
  authorAvatarPath: string | null;
  expanded: boolean;
  loadingComments: boolean;
  comments: CommunityPostCommentRow[];
  commentDraft: string;
  onCommentDraftChange: (value: string) => void;
  commentInputRef: (el: HTMLTextAreaElement | null) => void;
  onToggleComments: () => void;
  onReplyFocus: () => void;
  onLike: () => void;
  onSavePost: () => void;
  onSubmitComment: () => void;
  onReportPost: () => void;
  onReportComment: (commentId: string) => void;
  commentMeta: (authorId: string) => CommentAuthorMeta;
  isAuthor: boolean;
  onMenuEdit: () => void;
  onMenuDelete: () => void;
  onDeleteComment: (commentId: string) => void;
  /** Show “Open post” link next to timestamp (feed list). */
  showPermalink?: boolean;
  /**
   * Called after likers are fetched successfully (e.g. sync `like_count` with visible rows;
   * parent should use Math.max with existing count when merging).
   */
  onLikersLoaded?: (info: { visibleCount: number }) => void;
};

export function FeedPostCard({
  post,
  viewerId,
  authorDisplayName,
  authorLoading,
  authorPublicHandle,
  authorAvatarPath,
  expanded,
  loadingComments,
  comments,
  commentDraft,
  onCommentDraftChange,
  commentInputRef,
  onToggleComments,
  onReplyFocus,
  onLike,
  onSavePost,
  onSubmitComment,
  onReportPost,
  onReportComment,
  commentMeta,
  isAuthor,
  onMenuEdit,
  onMenuDelete,
  onDeleteComment,
  showPermalink,
  onLikersLoaded,
}: FeedPostCardProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const canReportPost = viewerId && viewerId !== post.author_id;
  const onLikersLoadedRef = useRef(onLikersLoaded);
  onLikersLoadedRef.current = onLikersLoaded;

  const [shareOpen, setShareOpen] = useState(false);
  const [shareHandle, setShareHandle] = useState("");
  const [shareNote, setShareNote] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareSelectedPeer, setShareSelectedPeer] = useState<{
    user_id: string;
    name: string;
    avatar_url: string | null;
  } | null>(null);
  const [shareLookupPeer, setShareLookupPeer] = useState<{
    user_id: string;
    name: string;
    avatar_url: string | null;
  } | null>(null);
  const [shareRecentPeers, setShareRecentPeers] = useState<
    { user_id: string; name: string; avatar_url: string | null }[]
  >([]);
  const [shareRecentLoading, setShareRecentLoading] = useState(false);
  const [shareRecentError, setShareRecentError] = useState<string | null>(null);
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<string | null>(null);

  const [likersOpen, setLikersOpen] = useState(false);
  const [likersLoading, setLikersLoading] = useState(false);
  const [likersRows, setLikersRows] = useState<
    { user_id: string; name: string; avatar_url: string | null }[]
  >([]);
  const [likersError, setLikersError] = useState<string | null>(null);
  const [likersTruncated, setLikersTruncated] = useState(false);

  const [commentSort, setCommentSort] = useState<"oldest" | "newest">("oldest");
  const [topCommentPreview, setTopCommentPreview] = useState<{ body: string; authorName: string } | null>(null);
  const commentMetaRef = useRef(commentMeta);
  commentMetaRef.current = commentMeta;
  const sortedComments = useMemo(() => {
    const arr = [...comments];
    if (commentSort === "newest") arr.reverse();
    return arr;
  }, [comments, commentSort]);

  useEffect(() => {
    if (expanded || post.comment_count === 0) {
      setTopCommentPreview(null);
      return;
    }
    let cancelled = false;
    void fetchCommentsForPost(post.id, { limit: 1 }).then((res) => {
      if (cancelled || res.error || !res.data?.[0]) {
        if (!cancelled) setTopCommentPreview(null);
        return;
      }
      const c = res.data[0];
      const meta = commentMetaRef.current(c.author_id);
      setTopCommentPreview({
        body: c.body.trim(),
        authorName: meta.name,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [post.id, post.comment_count, expanded]);

  const previewLink = useMemo(() => getFirstWhitelistedFeedLink(post.body), [post.body]);

  const pollExtra = useMemo(
    () => (post.post_kind === "poll" ? parsePollExtra(post.post_extra) : null),
    [post.post_kind, post.post_extra],
  );
  const eventExtra = useMemo(
    () => (post.post_kind === "event" ? parseEventExtra(post.post_extra) : null),
    [post.post_kind, post.post_extra],
  );

  useEffect(() => {
    if (!likersOpen) return;
    let cancelled = false;
    setLikersLoading(true);
    setLikersError(null);
    void (async () => {
      const res = await fetchPostLikersWithProfiles(post.id);
      if (cancelled) return;
      setLikersLoading(false);
      if (res.error) {
        setLikersError(res.error.message);
        setLikersRows([]);
        setLikersTruncated(false);
        return;
      }
      setLikersRows(res.data);
      setLikersTruncated(res.truncated);
      onLikersLoadedRef.current?.({ visibleCount: res.data.length });
    })();
    return () => {
      cancelled = true;
    };
  }, [likersOpen, post.id]);

  useEffect(() => {
    if (!shareOpen || !viewerId) return;
    let cancelled = false;
    setShareRecentLoading(true);
    setShareRecentError(null);
    setShareRecentPeers([]);
    void (async () => {
      const res = await fetchDmThreadsForCurrentUser();
      if (cancelled) return;
      if (res.error) {
        setShareRecentLoading(false);
        setShareRecentError(res.error.message);
        return;
      }
      const threads = res.data ?? [];
      const seen = new Set<string>();
      const peerIds: string[] = [];
      for (const t of threads) {
        const other = otherMemberUserId(t.members, viewerId);
        if (!other || seen.has(other)) continue;
        seen.add(other);
        peerIds.push(other);
        if (peerIds.length >= RECENT_DM_PEERS_LIMIT) break;
      }
      if (peerIds.length === 0) {
        setShareRecentLoading(false);
        return;
      }
      const profiles = await getProfilesByIds(peerIds);
      if (cancelled) return;
      const rows = peerIds.map((uid) => {
        const p = profiles.get(uid);
        return {
          user_id: uid,
          name: p?.full_name?.trim() || shortPeerId(uid),
          avatar_url: p?.avatar_url ?? null,
        };
      });
      setShareRecentPeers(rows);
      setShareRecentLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [shareOpen, viewerId]);

  async function sendShareToPeer(otherUserId: string) {
    const res = await sendFeedPostToDmThread(otherUserId, post.id, shareNote.trim() || undefined);
    if (res.error) {
      toast({ title: "Could not send", description: res.error.message, variant: "destructive" });
      return;
    }
    setShareOpen(false);
    setShareHandle("");
    setShareNote("");
    setShareSelectedPeer(null);
    setShareLookupPeer(null);
    toast({ title: "Message sent", description: "Opening your conversation…" });
    if (res.data) setLocation(`/community/messages/${res.data.threadId}`);
  }

  async function lookupShareHandle(e: React.FormEvent) {
    e.preventDefault();
    if (!viewerId) return;
    const raw = shareHandle.trim().replace(/^@/, "");
    if (!raw) {
      toast({
        title: "Enter a handle",
        description: "Type their @handle.",
        variant: "destructive",
      });
      return;
    }
    let normalized: string;
    try {
      const n = normalizePublicHandleInput(raw);
      if (!n) {
        toast({
          title: "Enter a handle",
          description: "Use their public handle (e.g. olliepass).",
          variant: "destructive",
        });
        return;
      }
      normalized = n;
    } catch (err) {
      toast({
        title: "Invalid handle",
        description: err instanceof Error ? err.message : "Use 3–30 letters, numbers, or underscores.",
        variant: "destructive",
      });
      return;
    }

    setShareBusy(true);
    setShareLookupPeer(null);
    const { userId, error: lookupError } = await getProfileIdByPublicHandle(normalized);
    if (lookupError) {
      setShareBusy(false);
      toast({ title: "Could not look up handle", description: lookupError.message, variant: "destructive" });
      return;
    }
    if (!userId) {
      setShareBusy(false);
      toast({
        title: "No user found",
        description: `No one is using @${normalized} yet. They need to set a community handle in settings.`,
        variant: "destructive",
      });
      return;
    }
    if (userId === viewerId) {
      setShareBusy(false);
      toast({ title: "Choose someone else", description: "You cannot send a post to yourself.", variant: "destructive" });
      return;
    }

    const profiles = await getProfilesByIds([userId]);
    const p = profiles.get(userId);
    setShareLookupPeer({
      user_id: userId,
      name: p?.full_name?.trim() || shortPeerId(userId),
      avatar_url: p?.avatar_url ?? null,
    });
    setShareBusy(false);
  }

  async function sharePostLinkExternally() {
    const url = `${window.location.origin}/community/post/${post.id}`;
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: "Diabeaters post",
          text: post.body.slice(0, 200),
          url,
        });
        return;
      }
    } catch {
      /* fall through */
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "Paste to share elsewhere." });
    } catch {
      toast({ title: "Could not share", description: url, variant: "destructive" });
    }
  }

  async function handleSendSelectedPeer() {
    if (!viewerId || !shareSelectedPeer?.user_id) return;
    if (shareSelectedPeer.user_id === viewerId) return;
    setShareBusy(true);
    try {
      await sendShareToPeer(shareSelectedPeer.user_id);
    } finally {
      setShareBusy(false);
    }
  }

  return (
    <Card className="pressable card-interactive">
      <CardContent className="space-y-1.5 pt-3 sm:space-y-2 sm:pt-4">
        <div className="flex gap-3">
          <CommunityAuthorAvatar
            displayName={authorDisplayName}
            avatarPath={authorAvatarPath}
            profileHref={`/community/profile/${post.author_id}`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex justify-between gap-2 text-xs text-muted-foreground items-start">
              <div className="min-w-0 flex-1">
                {authorLoading ? (
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ) : (
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                    <Link
                      href={`/community/profile/${post.author_id}`}
                      className="max-w-full shrink font-medium text-foreground truncate hover:underline underline-offset-2"
                    >
                      {authorDisplayName}
                    </Link>
                    {authorPublicHandle?.trim() ? (
                      <span className="shrink-0 text-muted-foreground">@{authorPublicHandle.trim()}</span>
                    ) : null}
                    <span className="shrink-0 whitespace-nowrap text-muted-foreground" title={post.created_at}>
                      · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                    </span>
                  </div>
                )}
              </div>
              <span className="flex shrink-0 items-center gap-1">
                {canReportPost && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-muted-foreground"
                    onClick={onReportPost}
                    aria-label="Report post"
                  >
                    <Flag className="h-3.5 w-3.5" />
                  </Button>
                )}
                {isAuthor && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-8 p-0 text-muted-foreground"
                        aria-label="Post options"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {post.post_kind === "standard" ? (
                        <DropdownMenuItem onClick={onMenuEdit}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit post
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onMenuDelete}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete post
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {showPermalink ? (
                  <Button variant="ghost" size="sm" className="h-6 px-1.5" asChild>
                    <Link href={`/community/post/${post.id}`} aria-label="Open post">
                      <Link2 className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                ) : null}
              </span>
            </div>
            <div className="mt-1.5 max-w-full">
              <Badge
                variant="secondary"
                className="w-full max-w-full font-normal truncate chip chip-muted"
                data-testid="feed-post-topic"
                title={communityTopicLabel(post.topic)}
              >
                {communityTopicLabel(post.topic)}
              </Badge>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          {(() => {
            const b = post.body.trim();
            if (b.length === 0) return null;
            if (pollExtra && b === pollExtra.question.trim()) return null;
            if (eventExtra && b === eventExtra.title.trim()) return null;
            return (
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap sm:text-sm sm:leading-normal">
                {renderBodyWithMentions(post.body, post.mention_map)}
              </p>
            );
          })()}
          {eventExtra ? (
            <div className="overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-b from-primary/[0.07] to-muted/20 shadow-sm ring-1 ring-border/50 dark:from-primary/10 dark:to-muted/10">
              {post.image_urls.length > 0 ? (
                <CommunityPostImageGrid
                  paths={post.image_urls}
                  altTexts={post.image_alt_texts}
                  variant="event-banner"
                />
              ) : null}
              <div
                className={cn(
                  "space-y-2 p-3 text-sm",
                  post.image_urls.length > 0 && "border-t border-border/50 bg-background/50 backdrop-blur-sm dark:bg-background/30",
                )}
              >
                <div className="flex items-start gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary dark:bg-primary/20">
                    <Calendar className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-semibold leading-snug text-foreground">{eventExtra.title}</p>
                    <p className="text-sm text-muted-foreground">{formatEventWhen(eventExtra.starts_at)}</p>
                    {eventExtra.location ? (
                      <p className="flex items-start gap-1.5 text-sm text-foreground/90">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        <span>{eventExtra.location}</span>
                      </p>
                    ) : null}
                  </div>
                </div>
                {eventExtra.details ? (
                  <p className="whitespace-pre-wrap border-t border-border/40 pt-2 text-sm text-muted-foreground pl-[2.75rem] sm:pl-12">
                    {eventExtra.details}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
          {pollExtra ? (
            <FeedPollBlock
              postId={post.id}
              question={pollExtra.question}
              options={pollExtra.options}
              viewerId={viewerId}
            />
          ) : null}
          {previewLink ? <FeedLinkPreview href={previewLink} className="mt-1" /> : null}
          {!(eventExtra && post.image_urls.length > 0) ? (
            <CommunityPostImageGrid paths={post.image_urls} altTexts={post.image_alt_texts} />
          ) : null}
          <div
            className="flex flex-wrap items-center gap-1 border-t border-border/50 pt-1.5 sm:gap-0.5 sm:pt-2"
            data-testid="post-engagement-row"
          >
            <div className="flex items-center gap-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
                disabled={!viewerId}
                aria-pressed={post.liked_by_me}
                aria-label={post.liked_by_me ? "Unlike" : "Like"}
                onClick={onLike}
              >
                <Heart
                  className={cn(
                    "h-4 w-4 shrink-0 transition-all duration-200 ease-out",
                    post.liked_by_me ? "fill-primary text-primary scale-110" : "scale-100",
                  )}
                />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 min-w-[2rem] px-1.5 text-muted-foreground hover:text-foreground"
                disabled={!viewerId}
                aria-label={`${post.like_count} ${post.like_count === 1 ? "like" : "likes"} — see who liked`}
                onClick={() => setLikersOpen(true)}
                data-testid="button-post-likers"
              >
                <span className="text-xs tabular-nums text-foreground">{post.like_count}</span>
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
              aria-expanded={expanded}
              aria-label={
                expanded
                  ? "Hide comments"
                  : `${post.comment_count} comment${post.comment_count === 1 ? "" : "s"}`
              }
              onClick={onToggleComments}
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              <span className="text-xs text-foreground">
                {expanded
                  ? "Hide comments"
                  : `${post.comment_count} comment${post.comment_count === 1 ? "" : "s"}`}
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
              disabled={!viewerId}
              aria-label="Reply"
              onClick={onReplyFocus}
            >
              <Reply className="h-4 w-4 shrink-0" />
              <span className="text-xs text-foreground">Reply</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
              disabled={!viewerId}
              aria-pressed={post.saved_by_me}
              aria-label={post.saved_by_me ? "Remove bookmark" : "Save post"}
              onClick={onSavePost}
            >
              <Bookmark
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  post.saved_by_me && "fill-primary text-primary",
                )}
              />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
                  aria-label="Share post"
                  data-testid="button-share-post-to-dm"
                >
                  <Share2 className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="text-xs text-foreground">Share</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuItem disabled={!viewerId} onClick={() => setShareOpen(true)}>
                  Send in message
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    void sharePostLinkExternally();
                  }}
                >
                  Share link
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {!expanded && topCommentPreview && post.comment_count > 0 ? (
            <button
              type="button"
              className="w-full rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/35"
              onClick={onToggleComments}
            >
              <span className="font-semibold text-foreground">{topCommentPreview.authorName}</span>
              <span className="text-muted-foreground"> · </span>
              <span className="line-clamp-2">{topCommentPreview.body}</span>
            </button>
          ) : null}
          {expanded && (
            <div className="border-t border-border/60 pt-3 space-y-2">
              {loadingComments ? (
                <p className="text-xs text-muted-foreground">Loading comments…</p>
              ) : (
                <>
                  {comments.length > 1 ? (
                    <div className="flex flex-wrap items-center justify-end gap-1 pb-1">
                      <span className="pr-1 text-tiny text-muted-foreground">Order</span>
                      <Button
                        type="button"
                        variant={commentSort === "oldest" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setCommentSort("oldest")}
                      >
                        Oldest
                      </Button>
                      <Button
                        type="button"
                        variant={commentSort === "newest" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setCommentSort("newest")}
                      >
                        Newest
                      </Button>
                    </div>
                  ) : null}
                  <ul className="space-y-2">
                    {sortedComments.map((c) => {
                      const cm = commentMeta(c.author_id);
                      const canReportComment = viewerId && viewerId !== c.author_id;
                      const isCommentAuthor = Boolean(viewerId && viewerId === c.author_id);
                      return (
                        <li key={c.id} className="flex gap-2 rounded-md bg-muted/40 px-2 py-2">
                          <CommunityAuthorAvatar
                            size="sm"
                            displayName={cm.name}
                            avatarPath={cm.avatar_url}
                            profileHref={`/community/profile/${c.author_id}`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-1">
                              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0">
                                <Link
                                  href={`/community/profile/${c.author_id}`}
                                  className="text-xs font-medium text-foreground hover:underline underline-offset-2"
                                >
                                  {cm.name}
                                </Link>
                                <span className="text-tiny text-muted-foreground" title={c.created_at}>
                                  {formatRelativeTime(c.created_at)}
                                </span>
                              </div>
                              <span className="flex shrink-0 items-center gap-0.5">
                                {canReportComment && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 shrink-0 px-1 text-muted-foreground"
                                    onClick={() => onReportComment(c.id)}
                                    aria-label="Report comment"
                                  >
                                    <Flag className="h-3 w-3" />
                                  </Button>
                                )}
                                {isCommentAuthor && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 shrink-0 px-1 text-muted-foreground hover:text-destructive"
                                    onClick={() => setPendingDeleteCommentId(c.id)}
                                    aria-label="Delete comment"
                                    data-testid={`button-delete-comment-${c.id}`}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{c.body}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
              <div className="flex gap-2">
                <Textarea
                  ref={(el) => {
                    commentInputRef(el);
                  }}
                  rows={2}
                  placeholder="Write a comment…"
                  value={commentDraft}
                  onChange={(e) => onCommentDraftChange(e.target.value)}
                  maxLength={4000}
                />
                <Button type="button" size="sm" onClick={onSubmitComment}>
                  Reply
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>

      <Dialog open={likersOpen} onOpenChange={setLikersOpen}>
        <DialogContent className="sm:max-w-md flex flex-col max-h-[min(70vh,28rem)]">
          <DialogHeader>
            <DialogTitle>Likes</DialogTitle>
            <DialogDescription>
              {likersLoading
                ? "Fetching who liked this post…"
                : likersError
                  ? "Could not load the list of likes."
                  : likersRows.length === 0
                    ? "No one has liked this post yet."
                    : likersTruncated
                      ? `Showing the first ${POST_LIKERS_QUERY_LIMIT} people who liked this post (there may be more).`
                      : `People who liked this post (${likersRows.length}).`}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1 -mr-1">
            {likersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
              </div>
            ) : likersError ? (
              <p className="text-sm text-destructive">{likersError}</p>
            ) : likersRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No likes to show.</p>
            ) : (
              <ul className="space-y-2">
                {likersRows.map((row) => (
                  <li key={row.user_id}>
                    <Link
                      href={`/community/profile/${row.user_id}`}
                      className="flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-muted/60 min-h-11"
                      onClick={() => setLikersOpen(false)}
                    >
                      <CommunityAuthorAvatar
                        size="sm"
                        displayName={row.name}
                        avatarPath={row.avatar_url}
                      />
                      <span className="text-sm font-medium text-foreground truncate">{row.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {likersTruncated ? (
            <p className="text-tiny text-muted-foreground pt-1 border-t border-border/60">
              Pull down on the feed (or use the refresh icon) to sync the like count on the post card.
            </p>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={shareOpen}
        onOpenChange={(open) => {
          setShareOpen(open);
          if (!open) {
            setShareHandle("");
            setShareNote("");
            setShareSelectedPeer(null);
            setShareLookupPeer(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send in Messages</DialogTitle>
            <DialogDescription className="sr-only">Send this post to someone in Messages.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {shareRecentLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
              </div>
            ) : shareRecentError ? (
              <p className="text-sm text-muted-foreground">{shareRecentError}</p>
            ) : shareRecentPeers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent chats yet.</p>
            ) : (
              <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border/60 p-1">
                {shareRecentPeers.map((peer) => (
                  <li key={peer.user_id}>
                    <button
                      type="button"
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm min-h-11 disabled:opacity-50 ${
                        shareSelectedPeer?.user_id === peer.user_id
                          ? "bg-primary/10 ring-1 ring-primary/25"
                          : "hover:bg-muted/60"
                      }`}
                      disabled={shareBusy || !viewerId}
                      onClick={() => {
                        setShareSelectedPeer(peer);
                        setShareLookupPeer(null);
                      }}
                    >
                      <CommunityAuthorAvatar
                        size="sm"
                        displayName={peer.name}
                        avatarPath={peer.avatar_url}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{peer.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-3">
            {!shareSelectedPeer ? (
              <>
                <form onSubmit={(e) => void lookupShareHandle(e)} className="space-y-2">
                  <label htmlFor="share-post-handle" className="text-sm font-medium text-foreground">
                    Search
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="share-post-handle"
                      value={shareHandle}
                      onChange={(e) => setShareHandle(e.target.value)}
                      placeholder="Type a @handle"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      autoComplete="off"
                      disabled={shareBusy || !viewerId}
                    />
                    <Button type="submit" variant="outline" disabled={shareBusy || !shareHandle.trim() || !viewerId}>
                      {shareBusy ? "…" : "Search"}
                    </Button>
                  </div>
                </form>

                {shareLookupPeer ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md border border-border/60 px-2 py-2 text-left text-sm hover:bg-muted/60 min-h-11"
                    disabled={shareBusy || !viewerId}
                    onClick={() => {
                      setShareRecentPeers((prev) => {
                        const next = [shareLookupPeer, ...prev.filter((p) => p.user_id !== shareLookupPeer.user_id)];
                        return next.slice(0, RECENT_DM_PEERS_LIMIT);
                      });
                      setShareSelectedPeer(shareLookupPeer);
                      setShareHandle("");
                    }}
                  >
                    <CommunityAuthorAvatar
                      size="sm"
                      displayName={shareLookupPeer.name}
                      avatarPath={shareLookupPeer.avatar_url}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">{shareLookupPeer.name}</span>
                  </button>
                ) : null}
              </>
            ) : null}

            {shareSelectedPeer ? (
              <div className="space-y-2">
                <label htmlFor="share-post-note" className="text-sm font-medium text-foreground">
                  Note (optional)
                </label>
                <Textarea
                  id="share-post-note"
                  value={shareNote}
                  onChange={(e) => setShareNote(e.target.value)}
                  placeholder="Add a short note…"
                  rows={2}
                  maxLength={2000}
                  disabled={shareBusy}
                />
              </div>
            ) : null}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setShareOpen(false)} disabled={shareBusy}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleSendSelectedPeer()}
                disabled={shareBusy || !shareSelectedPeer || !viewerId}
              >
                {shareBusy ? "Sending…" : "Send"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDeleteCommentId !== null}
        onOpenChange={(o) => {
          if (!o) setPendingDeleteCommentId(null);
        }}
      >
        <AlertDialogContent data-testid="dialog-delete-comment-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete comment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove your comment. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-delete-comment-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const id = pendingDeleteCommentId;
                setPendingDeleteCommentId(null);
                if (id) onDeleteComment(id);
              }}
              data-testid="button-delete-comment-confirm"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
