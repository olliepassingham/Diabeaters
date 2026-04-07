import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Flag,
  Heart,
  Link2,
  Loader2,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FieldLabelWithInfo } from "@/components/ui/field-label-with-info";
import { useToast } from "@/hooks/use-toast";
import { getProfileIdByPublicHandle, getProfilesByIds, normalizePublicHandleInput } from "@/lib/profile";
import { cn } from "@/lib/utils";
import {
  communityTopicLabel,
  fetchDmThreadsForCurrentUser,
  fetchLikerUserIdsForPost,
  fetchPostLikersWithProfiles,
  otherMemberUserId,
  POST_LIKERS_QUERY_LIMIT,
  sendFeedPostToDmThread,
  type CommunityPostCommentRow,
  type CommunityPostRow,
} from "@/lib/community";

const RECENT_DM_PEERS_LIMIT = 10;

function shortPeerId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

export type CommentAuthorMeta = { name: string; avatar_url: string | null };

type FeedPostCardProps = {
  post: CommunityPostRow;
  viewerId: string | undefined;
  authorDisplayName: string;
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
  const [shareRecentPeers, setShareRecentPeers] = useState<
    { user_id: string; name: string; avatar_url: string | null }[]
  >([]);
  const [shareRecentLoading, setShareRecentLoading] = useState(false);
  const [shareRecentError, setShareRecentError] = useState<string | null>(null);

  /** Align card like_count with reaction rows the viewer can see (fixes stale feed totals). */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchLikerUserIdsForPost(post.id);
      if (cancelled || res.error) return;
      onLikersLoadedRef.current?.({ visibleCount: res.data.length });
    })();
    return () => {
      cancelled = true;
    };
  }, [post.id]);

  const [likersOpen, setLikersOpen] = useState(false);
  const [likersLoading, setLikersLoading] = useState(false);
  const [likersRows, setLikersRows] = useState<
    { user_id: string; name: string; avatar_url: string | null }[]
  >([]);
  const [likersError, setLikersError] = useState<string | null>(null);
  const [likersTruncated, setLikersTruncated] = useState(false);

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
    toast({ title: "Message sent", description: "Opening your conversation…" });
    if (res.data) setLocation(`/community/messages/${res.data.threadId}`);
  }

  async function handleShareToMessages(e: React.FormEvent) {
    e.preventDefault();
    if (!viewerId) return;
    const raw = shareHandle.trim().replace(/^@/, "");
    if (!raw) {
      toast({
        title: "Enter a handle",
        description: "Use their public @handle from Feed profile settings.",
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

    await sendShareToPeer(userId);
    setShareBusy(false);
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        <div className="flex gap-3">
          <CommunityAuthorAvatar
            displayName={authorDisplayName}
            avatarPath={authorAvatarPath}
            profileHref={`/community/profile/${post.author_id}`}
          />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex justify-between gap-2 text-xs text-muted-foreground items-start">
              <div className="min-w-0">
                <Link
                  href={`/community/profile/${post.author_id}`}
                  className="font-medium text-foreground truncate hover:underline underline-offset-2 block"
                >
                  {authorDisplayName}
                </Link>
                {authorPublicHandle?.trim() ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">@{authorPublicHandle.trim()}</p>
                ) : null}
                <Badge variant="secondary" className="mt-1.5 w-fit max-w-full font-normal">
                  {communityTopicLabel(post.topic)}
                </Badge>
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
                      <DropdownMenuItem onClick={onMenuEdit}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit post
                      </DropdownMenuItem>
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
                <span title={post.created_at}>
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </span>
              </span>
            </div>
            {post.body.trim().length > 0 ? (
              <p className="text-sm whitespace-pre-wrap">{post.body}</p>
            ) : null}
            <CommunityPostImageGrid paths={post.image_urls} />
            <div
              className="flex flex-wrap items-center gap-0.5 border-t border-border/50 pt-2"
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
                    className={cn("h-4 w-4 shrink-0", post.liked_by_me && "fill-primary text-primary")}
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
                    : post.comment_count === 0
                      ? "Comment"
                      : `${post.comment_count} comment${post.comment_count === 1 ? "" : "s"}`
                }
                onClick={onToggleComments}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="text-xs text-foreground">
                  {expanded
                    ? "Hide comments"
                    : post.comment_count === 0
                      ? "Comment"
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
                aria-label="Send post in a private message"
                onClick={() => setShareOpen(true)}
                data-testid="button-share-post-to-dm"
              >
                <Share2 className="h-4 w-4 shrink-0" />
                <span className="text-xs text-foreground">Send</span>
              </Button>
            </div>
            {expanded && (
              <div className="border-t border-border/60 pt-3 space-y-2">
                {loadingComments ? (
                  <p className="text-xs text-muted-foreground">Loading comments…</p>
                ) : (
                  <ul className="space-y-2">
                    {comments.map((c) => {
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
                                  {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
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
                                    onClick={() => onDeleteComment(c.id)}
                                    aria-label="Delete comment"
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
              Use Refresh on the feed to sync the like count on the post card.
            </p>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send in Messages</DialogTitle>
            <DialogDescription>
              Send a link to this post in a private chat. Tap someone you&apos;ve messaged recently, or enter a @handle
              below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Recent</p>
            {shareRecentLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
              </div>
            ) : shareRecentError ? (
              <p className="text-sm text-muted-foreground">{shareRecentError}</p>
            ) : shareRecentPeers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No conversations yet — use @handle below.</p>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border/60 p-1">
                {shareRecentPeers.map((peer) => (
                  <li key={peer.user_id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted/60 min-h-11 disabled:opacity-50"
                      disabled={shareBusy || !viewerId}
                      onClick={() => {
                        void (async () => {
                          if (!viewerId || peer.user_id === viewerId) return;
                          setShareBusy(true);
                          try {
                            await sendShareToPeer(peer.user_id);
                          } finally {
                            setShareBusy(false);
                          }
                        })();
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
          <form onSubmit={(e) => void handleShareToMessages(e)} className="space-y-3">
            <div className="space-y-2">
              <FieldLabelWithInfo
                htmlFor="share-post-handle"
                info="Same as starting a chat from Messages: enter their public handle."
              >
                Their @handle
              </FieldLabelWithInfo>
              <Input
                id="share-post-handle"
                value={shareHandle}
                onChange={(e) => setShareHandle(e.target.value)}
                placeholder="e.g. neil or @neil"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="off"
                disabled={shareBusy || !viewerId}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="share-post-note" className="text-sm font-medium text-foreground">
                Note (optional)
              </label>
              <Textarea
                id="share-post-note"
                value={shareNote}
                onChange={(e) => setShareNote(e.target.value)}
                placeholder="Add a short note above the link…"
                rows={2}
                maxLength={2000}
                disabled={shareBusy}
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setShareOpen(false)} disabled={shareBusy}>
                Cancel
              </Button>
              <Button type="submit" disabled={shareBusy || !shareHandle.trim() || !viewerId}>
                {shareBusy ? "Sending…" : "Send"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
