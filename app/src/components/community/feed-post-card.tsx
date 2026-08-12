import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  Bookmark,
  ChevronRight,
  Flag,
  Heart,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { CommunityPostImageGrid } from "@/components/community/community-post-image-grid";
import { FeedPostVideo } from "@/components/community/feed-post-video";
import { FeedEventCard } from "@/components/community/feed-event-card";
import { FeedPollCard } from "@/components/community/feed-poll-card";
import { FeedCommentItem } from "@/components/community/feed-comment-item";
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
import { MentionTextarea } from "@/components/community/mention-textarea";
import { renderBodyWithMentions } from "@/components/community/render-body-with-mentions";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FieldLabelWithInfo } from "@/components/ui/field-label-with-info";
import { useToast } from "@/hooks/use-toast";
import { buildPublicAppUrl } from "@/lib/auth-app-url";
import { getProfileIdByPublicHandle, getProfilesByIds, normalizePublicHandleInput } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { BEATIE_FEED_AVATAR_FALLBACK_SRC } from "@/lib/ai-feed-reply/config";
import { AI_ASSISTANT_NAME } from "@/lib/ai-coach/persona";
import { type FeedAuthorMeta } from "@/lib/community/feed-author-meta";
import {
  communityTopicLabel,
  fetchDmThreadsForCurrentUser,
  getFirstWhitelistedFeedLink,
  fetchPostLikersWithProfiles,
  fetchPostInterestedWithProfiles,
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

export type CommentAuthorMeta = FeedAuthorMeta;

type FeedPostCardProps = {
  post: CommunityPostRow;
  viewerId: string | undefined;
  /** When false, like/comment/vote controls are disabled (read-only feed). */
  canEngageWithFeed?: boolean;
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
  /** Event posts: toggle interest (separate from like). */
  onEventInterest?: () => void;
  onSavePost: () => void;
  onSubmitComment: () => void;
  onReportPost: () => void;
  onReportComment: (commentId: string) => void;
  onLikeComment: (commentId: string, currentlyLiked: boolean) => void;
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
  /** When set with `onAskBeatie`, post author sees Ask Beatie on expanded thread. */
  beatieFeedBotUserId?: string | null;
  onAskBeatie?: () => void;
  askBeatieBusy?: boolean;
  /** Prioritize loading images/video in the first visible feed posts. */
  mediaPriority?: boolean;
};

export function FeedPostCard({
  post,
  viewerId,
  canEngageWithFeed = true,
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
  onEventInterest,
  onSavePost,
  onSubmitComment,
  onReportPost,
  onReportComment,
  onLikeComment,
  commentMeta,
  isAuthor,
  onMenuEdit,
  onMenuDelete,
  onDeleteComment,
  showPermalink,
  onLikersLoaded,
  beatieFeedBotUserId,
  onAskBeatie,
  askBeatieBusy,
  mediaPriority = false,
}: FeedPostCardProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const mayEngage = Boolean(viewerId && canEngageWithFeed);
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

  const [interestedOpen, setInterestedOpen] = useState(false);
  const [interestedLoading, setInterestedLoading] = useState(false);
  const [interestedRows, setInterestedRows] = useState<
    { user_id: string; name: string; avatar_url: string | null }[]
  >([]);
  const [interestedError, setInterestedError] = useState<string | null>(null);
  const [interestedTruncated, setInterestedTruncated] = useState(false);

  const isBeatiePost = Boolean(beatieFeedBotUserId && post.author_id === beatieFeedBotUserId);
  const showBeatieAvatar =
    isBeatiePost || authorDisplayName.trim() === AI_ASSISTANT_NAME;

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
    if (!interestedOpen) return;
    let cancelled = false;
    setInterestedLoading(true);
    setInterestedError(null);
    void (async () => {
      const res = await fetchPostInterestedWithProfiles(post.id);
      if (cancelled) return;
      setInterestedLoading(false);
      if (res.error) {
        setInterestedError(res.error.message);
        setInterestedRows([]);
        setInterestedTruncated(false);
        return;
      }
      setInterestedRows(res.data);
      setInterestedTruncated(res.truncated);
    })();
    return () => {
      cancelled = true;
    };
  }, [interestedOpen, post.id]);

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
    const url = buildPublicAppUrl(`/community/post/${post.id}`);
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

  const topicLabel = communityTopicLabel(post.topic);
  const bodyText = (() => {
    const b = post.body.trim();
    if (b.length === 0) return null;
    if (pollExtra && b === pollExtra.question.trim()) return null;
    if (eventExtra && b === eventExtra.title.trim()) return null;
    return b;
  })();
  const hasFeedImages = !eventExtra && !post.video_url && post.image_urls.length > 0;
  const hasFeedVideo = !eventExtra && Boolean(post.video_url);
  const isMediaFirst = hasFeedVideo || hasFeedImages;

  const engagementRow = (
    <div
      className="flex items-center justify-between gap-1 px-2 pt-0.5 sm:px-3"
      data-testid="post-engagement-row"
    >
      <div className="flex min-w-0 items-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-11 w-11 p-0 text-foreground hover:text-foreground"
          disabled={!mayEngage}
          aria-pressed={post.liked_by_me}
          aria-label={post.liked_by_me ? "Unlike" : "Like"}
          onClick={onLike}
        >
          <Heart
            className={cn(
              "h-[22px] w-[22px] shrink-0 transition-all duration-200 ease-out",
              post.liked_by_me ? "fill-primary text-primary scale-105" : "scale-100",
            )}
          />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-11 w-11 p-0 text-foreground hover:text-foreground"
          aria-expanded={expanded}
          aria-label={
            expanded
              ? "Hide comments"
              : `${post.comment_count} comment${post.comment_count === 1 ? "" : "s"}`
          }
          onClick={onToggleComments}
        >
          <MessageSquare className="h-[22px] w-[22px] shrink-0" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-11 w-11 p-0 text-foreground hover:text-foreground"
              aria-label="Share post"
              data-testid="button-share-post-to-dm"
            >
              <Share2 className="h-[21px] w-[21px] shrink-0" aria-hidden />
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
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-11 w-11 p-0 text-foreground hover:text-foreground"
        disabled={!viewerId}
        aria-pressed={post.saved_by_me}
        aria-label={post.saved_by_me ? "Remove bookmark" : "Save post"}
        onClick={onSavePost}
      >
        <Bookmark
          className={cn(
            "h-[22px] w-[22px] shrink-0 transition-colors",
            post.saved_by_me && "fill-primary text-primary",
          )}
        />
      </Button>
    </div>
  );

  return (
    <>
    <article className="animate-soft-in border-b border-border/40 bg-transparent py-3 last:border-b-0 sm:mx-1 sm:mb-3 sm:rounded-[1.35rem] sm:border sm:border-border/50 sm:bg-card/70 sm:py-3.5 sm:shadow-sm sm:last:border dark:sm:bg-card/50">
      <div className="flex items-center gap-3 px-3 py-1 sm:px-4">
        <CommunityAuthorAvatar
          displayName={authorDisplayName}
          avatarPath={authorAvatarPath}
          profileHref={`/community/profile/${post.author_id}`}
          size="md"
          className="!h-10 !w-10"
          fallbackSrc={showBeatieAvatar ? BEATIE_FEED_AVATAR_FALLBACK_SRC : undefined}
        />
        <div className="min-w-0 flex-1">
          {authorLoading ? (
            <div className="space-y-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-36" />
            </div>
          ) : (
            <div className="space-y-0.5">
              <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <Link
                  href={`/community/profile/${post.author_id}`}
                  className="truncate text-[15px] font-semibold leading-tight text-foreground hover:underline underline-offset-2"
                >
                  {authorDisplayName}
                </Link>
                {isBeatiePost ? (
                  <Badge
                    variant="outline"
                    className="border-primary/35 bg-transparent px-1 py-0 text-[9px] font-medium leading-none text-primary"
                  >
                    AI guide
                  </Badge>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] text-muted-foreground">
                <span data-testid="feed-post-topic" title={topicLabel} className="truncate">
                  {topicLabel}
                </span>
                <span aria-hidden>·</span>
                <time title={post.created_at}>
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </time>
              </div>
            </div>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-11 w-11 p-0 text-muted-foreground"
              aria-label="Post options"
            >
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {showPermalink ? (
              <DropdownMenuItem asChild>
                <Link href={`/community/post/${post.id}`}>Open post</Link>
              </DropdownMenuItem>
            ) : null}
            {isAuthor && post.post_kind === "standard" ? (
              <DropdownMenuItem onClick={onMenuEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit post
              </DropdownMenuItem>
            ) : null}
            {isAuthor ? (
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onMenuDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete post
              </DropdownMenuItem>
            ) : null}
            {canReportPost ? (
              <DropdownMenuItem onClick={onReportPost}>
                <Flag className="h-4 w-4 mr-2" />
                Report
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {hasFeedVideo && post.video_url ? (
        <FeedPostVideo path={post.video_url} priority={mediaPriority} />
      ) : null}

      {hasFeedImages ? (
        <CommunityPostImageGrid
          paths={post.image_urls}
          altTexts={post.image_alt_texts}
          variant="feed"
          priority={mediaPriority}
        />
      ) : null}

      {!isMediaFirst ? (
        <div className="space-y-2 px-3 pb-1">
          {bodyText ? (
            <p className="text-[15px] leading-[1.45] whitespace-pre-wrap text-foreground">
              {renderBodyWithMentions(bodyText, post.mention_map)}
            </p>
          ) : null}
          {eventExtra ? (
            <FeedEventCard
              event={eventExtra}
              imagePaths={post.image_urls}
              imageAltTexts={post.image_alt_texts}
              interestedCount={post.interested_count}
              interestedByMe={post.interested_by_me}
              viewerCanReact={mayEngage}
              onInterested={onEventInterest}
              onShowInterested={() => setInterestedOpen(true)}
            />
          ) : null}
          {pollExtra ? (
            <FeedPollCard
              postId={post.id}
              question={pollExtra.question}
              options={pollExtra.options}
              viewerId={viewerId}
              canEngageWithFeed={canEngageWithFeed}
            />
          ) : null}
          {previewLink ? <FeedLinkPreview href={previewLink} className="mt-1" /> : null}
          {!eventExtra && !hasFeedImages ? (
            <CommunityPostImageGrid paths={post.image_urls} altTexts={post.image_alt_texts} />
          ) : null}
        </div>
      ) : null}

      {engagementRow}

      {post.like_count > 0 ? (
        <button
          type="button"
          className="block px-3 pt-1.5 text-left text-sm font-semibold text-foreground hover:underline underline-offset-2"
          disabled={!viewerId}
          aria-label={`${post.like_count} ${post.like_count === 1 ? "like" : "likes"} — see who liked`}
          onClick={() => setLikersOpen(true)}
          data-testid="button-post-likers"
        >
          {post.like_count} {post.like_count === 1 ? "like" : "likes"}
        </button>
      ) : null}

      {isMediaFirst && bodyText ? (
        <p className="px-3 pt-1.5 text-sm leading-snug text-foreground">
          <Link
            href={`/community/profile/${post.author_id}`}
            className="mr-1.5 font-semibold hover:underline underline-offset-2"
          >
            {authorDisplayName}
          </Link>
          <span className="whitespace-pre-wrap">{renderBodyWithMentions(bodyText, post.mention_map)}</span>
        </p>
      ) : null}

      {isMediaFirst && (eventExtra || pollExtra || previewLink) ? (
        <div className="space-y-2 px-3 pt-2">
          {eventExtra ? (
            <FeedEventCard
              event={eventExtra}
              imagePaths={post.image_urls}
              imageAltTexts={post.image_alt_texts}
              interestedCount={post.interested_count}
              interestedByMe={post.interested_by_me}
              viewerCanReact={mayEngage}
              onInterested={onEventInterest}
              onShowInterested={() => setInterestedOpen(true)}
            />
          ) : null}
          {pollExtra ? (
            <FeedPollCard
              postId={post.id}
              question={pollExtra.question}
              options={pollExtra.options}
              viewerId={viewerId}
              canEngageWithFeed={canEngageWithFeed}
            />
          ) : null}
          {previewLink ? <FeedLinkPreview href={previewLink} /> : null}
        </div>
      ) : null}

      {!expanded && post.comment_count > 0 ? (
        <button
          type="button"
          className="block px-3 pt-1 text-left text-xs text-muted-foreground hover:text-foreground"
          onClick={onToggleComments}
        >
          View all {post.comment_count} comment{post.comment_count === 1 ? "" : "s"}
        </button>
      ) : null}

      {expanded ? (
        <div className="mt-2 space-y-2.5 border-t border-border/25 px-3 pt-3 sm:px-4">
          {loadingComments ? (
            <div className="space-y-1.5" aria-busy="true">
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
          ) : (
            <div className="space-y-2">
              {isAuthor && onAskBeatie && !isBeatiePost ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 rounded-full px-2.5 text-[11px]"
                  disabled={askBeatieBusy}
                  onClick={onAskBeatie}
                >
                  {askBeatieBusy ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                      Beatie is writing…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Ask Beatie (educational)
                    </>
                  )}
                </Button>
              ) : null}
              {comments.length > 0 ? (
                <ul className="space-y-1" role="list">
                  {comments.map((c) => (
                    <FeedCommentItem
                      key={c.id}
                      commentId={c.id}
                      authorId={c.author_id}
                      body={c.body}
                      createdAt={c.created_at}
                      mentionMap={c.mention_map}
                      meta={commentMeta(c.author_id)}
                      beatieFeedBotUserId={beatieFeedBotUserId}
                      viewerId={viewerId}
                      likeCount={c.like_count}
                      likedByMe={c.liked_by_me}
                      canLike={mayEngage && Boolean(viewerId && viewerId !== c.author_id)}
                      onLike={() => onLikeComment(c.id, c.liked_by_me)}
                      onReport={() => onReportComment(c.id)}
                      onDelete={() => setPendingDeleteCommentId(c.id)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="py-0.5 text-[11px] text-muted-foreground">No comments yet — say hello.</p>
              )}
            </div>
          )}
          <div className="text-composer-shell rounded-full px-3.5 py-1">
            <div className="min-w-0 flex-1">
              <MentionTextarea
                textareaRef={commentInputRef}
                value={commentDraft}
                onChange={onCommentDraftChange}
                currentUserId={viewerId}
                rows={1}
                maxLength={4000}
                hideHint
                autoGrow
                maxGrowPx={148}
                bare
                placeholder={mayEngage ? "Add a comment…" : "Set up your @handle to comment"}
                disabled={!mayEngage}
                className="min-h-10 resize-none px-0 py-2 text-[15px] leading-snug"
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="mb-0.5 h-10 shrink-0 rounded-full px-4 text-sm font-semibold shadow-none"
              disabled={!mayEngage || !commentDraft.trim()}
              onClick={onSubmitComment}
            >
              Post
            </Button>
          </div>
        </div>
      ) : null}
    </article>

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

      <Dialog open={interestedOpen} onOpenChange={setInterestedOpen}>
        <DialogContent className="flex max-h-[min(72vh,32rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="space-y-0 border-b border-border/50 px-4 py-3.5 text-left sm:px-5 sm:py-4">
            <div className="flex items-start gap-3 pr-8">
              <div
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10"
                aria-hidden
              >
                <Heart className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-base font-semibold leading-tight">Interested</DialogTitle>
                  {!interestedLoading && !interestedError && interestedRows.length > 0 ? (
                    <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-[10px] tabular-nums">
                      {interestedRows.length}
                    </Badge>
                  ) : null}
                </div>
                {eventExtra?.title?.trim() ? (
                  <p className="truncate text-xs text-muted-foreground">{eventExtra.title.trim()}</p>
                ) : null}
                <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
                  {interestedLoading
                    ? "Loading…"
                    : interestedError
                      ? "Could not load this list."
                      : interestedRows.length === 0
                        ? "No one has marked interest yet."
                        : interestedTruncated
                          ? `First ${POST_LIKERS_QUERY_LIMIT} shown — there may be more.`
                          : `${interestedRows.length === 1 ? "1 person" : `${interestedRows.length} people`} interested in this event`}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 sm:px-3">
            {interestedLoading ? (
              <div className="space-y-2 px-1 py-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl px-2.5 py-2">
                    <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                    <Skeleton className="h-4 flex-1 max-w-[8rem]" />
                  </div>
                ))}
              </div>
            ) : interestedError ? (
              <p className="px-2 py-6 text-center text-sm text-destructive">{interestedError}</p>
            ) : interestedRows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <Heart className="h-8 w-8 text-muted-foreground/35" aria-hidden />
                <p className="text-sm text-muted-foreground">Be the first to mark interested.</p>
              </div>
            ) : (
              <ul className="space-y-0.5">
                {interestedRows.map((row) => (
                  <li key={row.user_id}>
                    <Link
                      href={`/community/profile/${row.user_id}`}
                      className="flex min-h-11 items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-muted/50 active:bg-muted/70"
                      onClick={() => setInterestedOpen(false)}
                    >
                      <CommunityAuthorAvatar
                        size="sm"
                        displayName={row.name}
                        avatarPath={row.avatar_url}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {row.name}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {interestedTruncated ? (
            <p className="border-t border-border/50 px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground sm:px-5">
              Pull down on the feed to refresh the interest count on the event card.
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
    </>
  );
}
