import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { EmptyState, FeedLoadingSkeleton } from "@/components/empty-state";
import { FeedPostCard } from "@/components/community/feed-post-card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useToast } from "@/hooks/use-toast";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  COMMUNITY_TOPICS,
  DEFAULT_COMMUNITY_TOPIC,
  deleteCommunityComment,
  deleteCommunityPost,
  fetchCommentsForPost,
  insertCommunityComment,
  isCommunityTopicId,
  submitContentReport,
  togglePostLike,
  updateCommunityPost,
  type CommunityPostCommentRow,
  type CommunityPostRow,
  type CommunityTopicId,
  type FeedCursor,
} from "@/lib/community";
import { getProfilesByIds } from "@/lib/profile";

type AuthorMeta = { name: string; avatar_url: string | null; public_handle: string | null; loading?: boolean };

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

export function FeedPostList(props: {
  viewerId: string | undefined;
  fetchPage: (
    limit: number,
    cursor: FeedCursor | null,
  ) => Promise<{ data: CommunityPostRow[] | null; error: Error | null }>;
  pageSize?: number;
  searchQuery?: string;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  className?: string;
  showRefreshButton?: boolean;
}) {
  const { toast } = useToast();
  const pageSize = props.pageSize ?? 20;
  const { fetchPage } = props;

  const [posts, setPosts] = useState<CommunityPostRow[]>([]);
  const postsRef = useRef(posts);
  postsRef.current = posts;

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [authorMeta, setAuthorMeta] = useState<Record<string, AuthorMeta>>({});
  const [authorMetaPending, setAuthorMetaPending] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, CommunityPostCommentRow[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});
  const commentInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: "post" | "comment"; id: string } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [deletePostBusy, setDeletePostBusy] = useState(false);

  const [editPost, setEditPost] = useState<CommunityPostRow | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editTopic, setEditTopic] = useState<CommunityTopicId>(DEFAULT_COMMUNITY_TOPIC);
  const [editImageAlts, setEditImageAlts] = useState<string[]>([]);
  const [editBusy, setEditBusy] = useState(false);

  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const pullAnchorRef = useRef<HTMLDivElement>(null);

  const loadFirstPage = useCallback(async () => {
    const res = await fetchPage(pageSize, null);
    if (res.error) {
      toast({ title: "Could not load posts", description: res.error.message, variant: "destructive" });
      setPosts([]);
      setHasMore(false);
      return;
    }
    const list = res.data ?? [];
    setPosts(list);
    setHasMore(list.length >= pageSize);
  }, [fetchPage, pageSize, toast]);

  const refresh = useCallback(async () => {
    try {
      await loadFirstPage();
    } catch (e) {
      console.error(e);
      toast({
        title: "Could not load posts",
        description: e instanceof Error ? e.message : "Something went wrong.",
        variant: "destructive",
      });
      setPosts([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [loadFirstPage, toast]);

  const runRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadFirstPage();
    } finally {
      setRefreshing(false);
    }
  }, [loadFirstPage]);

  const { pullProgress } = usePullToRefresh({
    anchorRef: pullAnchorRef,
    onRefresh: runRefresh,
    enabled: isSupabaseConfigured(),
    isBusy: refreshing || loading,
  });

  useEffect(() => {
    setLoading(true);
    void refresh();
    // Reset per-post state when data source changes.
    setExpanded({});
    setCommentsByPost({});
    setCommentDrafts({});
    setLoadingComments({});
  }, [refresh]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading) return;
    const list = postsRef.current;
    if (list.length === 0) return;
    const last = list[list.length - 1];
    if (!last) return;
    setLoadingMore(true);
    const res = await fetchPage(pageSize, { created_at: last.created_at, id: last.id });
    setLoadingMore(false);
    if (res.error) {
      toast({ title: "Could not load more", description: res.error.message, variant: "destructive" });
      return;
    }
    const next = res.data ?? [];
    if (next.length === 0) {
      setHasMore(false);
      return;
    }
    setPosts((prev) => [...prev, ...next]);
    setHasMore(next.length >= pageSize);
  }, [hasMore, loadingMore, loading, fetchPage, pageSize, toast]);

  useEffect(() => {
    const el = loadMoreSentinelRef.current;
    if (!el || !hasMore || loading) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "240px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadMore, loading, posts.length]);

  useEffect(() => {
    const ids = new Set<string>();
    for (const p of posts) ids.add(p.author_id);
    for (const arr of Object.values(commentsByPost)) {
      for (const c of arr) ids.add(c.author_id);
    }
    const list = [...ids];
    if (list.length === 0) {
      setAuthorMeta({});
      setAuthorMetaPending(false);
      return;
    }
    let cancelled = false;
    setAuthorMetaPending(true);
    void (async () => {
      const map = await getProfilesByIds(list);
      if (cancelled) return;
      const next: Record<string, AuthorMeta> = {};
      for (const id of list) {
        const prof = map.get(id);
        next[id] = {
          name: prof?.full_name?.trim() || shortId(id),
          avatar_url: prof?.avatar_url ?? null,
          public_handle: prof?.public_handle?.trim() ? prof.public_handle.trim() : null,
        };
      }
      setAuthorMeta(next);
      setAuthorMetaPending(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [posts, commentsByPost]);

  function metaFor(authorId: string): AuthorMeta {
    const m = authorMeta[authorId];
    if (m) return m;
    if (authorMetaPending) return { name: "", avatar_url: null, public_handle: null, loading: true };
    return { name: shortId(authorId), avatar_url: null, public_handle: null };
  }

  const filteredPosts = useMemo(() => {
    const q = (props.searchQuery ?? "").trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p) => {
      if (p.body.toLowerCase().includes(q)) return true;
      const m = authorMeta[p.author_id];
      const name = (m?.name ?? "").toLowerCase();
      const handle = (m?.public_handle ?? "").toLowerCase();
      return name.includes(q) || handle.includes(q);
    });
  }, [posts, props.searchQuery, authorMeta]);

  async function ensureCommentsLoaded(postId: string) {
    if (commentsByPost[postId]) return;
    setLoadingComments((m) => ({ ...m, [postId]: true }));
    const res = await fetchCommentsForPost(postId);
    setLoadingComments((m) => ({ ...m, [postId]: false }));
    if (res.error) {
      toast({ title: "Could not load comments", description: res.error.message, variant: "destructive" });
      return;
    }
    const loaded = res.data ?? [];
    setCommentsByPost((m) => ({ ...m, [postId]: loaded }));
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comment_count: Math.max(p.comment_count, loaded.length) } : p)),
    );
  }

  async function onToggleComments(postId: string) {
    const nextOpen = !expanded[postId];
    setExpanded((m) => ({ ...m, [postId]: nextOpen }));
    if (nextOpen) await ensureCommentsLoaded(postId);
  }

  async function onSubmitComment(postId: string) {
    if (!props.viewerId) {
      toast({ title: "Sign in to reply", description: "Log in to write a comment.", variant: "destructive" });
      return;
    }
    const draft = (commentDrafts[postId] ?? "").trim();
    if (!draft) return;
    const res = await insertCommunityComment(postId, draft);
    if (res.error) {
      toast({ title: "Could not comment", description: res.error.message, variant: "destructive" });
      return;
    }
    setCommentDrafts((m) => ({ ...m, [postId]: "" }));
    setCommentsByPost((m) => ({ ...m, [postId]: [...(m[postId] ?? []), ...(res.data ? [res.data] : [])] }));
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p)));
  }

  async function onLike(postId: string) {
    if (!props.viewerId) return;
    const cur = postsRef.current.find((p) => p.id === postId);
    if (!cur) return;
    const res = await togglePostLike(postId, cur.liked_by_me);
    if (res.error) {
      toast({ title: "Could not update like", description: res.error.message, variant: "destructive" });
      return;
    }
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const nextLiked = !p.liked_by_me;
        const nextCount = Math.max(0, p.like_count + (nextLiked ? 1 : -1));
        return { ...p, liked_by_me: nextLiked, like_count: nextCount };
      }),
    );
  }

  function openReport(type: "post" | "comment", id: string) {
    setReportTarget({ type, id });
    setReportReason("");
    setReportOpen(true);
  }

  async function submitReport() {
    if (!reportTarget) return;
    setReportSubmitting(true);
    const res = await submitContentReport({
      targetType: reportTarget.type,
      targetId: reportTarget.id,
      reason: reportReason.trim() || null,
    });
    setReportSubmitting(false);
    if (res.error) {
      toast({ title: "Report failed", description: res.error.message, variant: "destructive" });
      return;
    }
    setReportOpen(false);
    setReportTarget(null);
    setReportReason("");
    toast({ title: "Thanks", description: "Your report was submitted." });
  }

  async function onDeleteComment(postId: string, commentId: string) {
    const res = await deleteCommunityComment(commentId);
    if (res.error) {
      toast({ title: "Could not delete", description: res.error.message, variant: "destructive" });
      return;
    }
    setCommentsByPost((m) => ({ ...m, [postId]: (m[postId] ?? []).filter((c) => c.id !== commentId) }));
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comment_count: Math.max(0, p.comment_count - 1) } : p)),
    );
  }

  function openDeletePost(postId: string) {
    setDeletePostId(postId);
  }

  async function confirmDeletePost() {
    if (!deletePostId) return;
    setDeletePostBusy(true);
    const res = await deleteCommunityPost(deletePostId);
    setDeletePostBusy(false);
    if (res.error) {
      toast({ title: "Could not delete", description: res.error.message, variant: "destructive" });
      return;
    }
    setPosts((prev) => prev.filter((p) => p.id !== deletePostId));
    setDeletePostId(null);
    toast({ title: "Deleted", description: "Your post was removed." });
  }

  function openEditPost(postId: string) {
    const p = postsRef.current.find((x) => x.id === postId) ?? null;
    if (!p) return;
    setEditPost(p);
    setEditBody(p.body);
    setEditTopic(p.topic);
    setEditImageAlts(p.image_alt_texts ?? []);
  }

  async function submitEditPost() {
    if (!editPost) return;
    const topic = isCommunityTopicId(editTopic) ? editTopic : DEFAULT_COMMUNITY_TOPIC;
    setEditBusy(true);
    const res = await updateCommunityPost(editPost.id, editBody, topic, { imageAltTexts: editImageAlts });
    setEditBusy(false);
    if (res.error) {
      toast({ title: "Could not update", description: res.error.message, variant: "destructive" });
      return;
    }
    if (res.data) {
      setPosts((prev) => prev.map((p) => (p.id === editPost.id ? res.data! : p)));
    }
    setEditPost(null);
    toast({ title: "Updated", description: "Your post was updated." });
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className={props.className}>
        <p className="text-sm text-muted-foreground">Connect Supabase to view posts.</p>
      </div>
    );
  }

  return (
    <div className={props.className}>
      <div ref={pullAnchorRef} />
      {pullProgress > 0 ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground pb-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Pull to refresh…
        </div>
      ) : null}

      {props.showRefreshButton ? (
        <div className="flex justify-end pb-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void runRefresh()}
            disabled={refreshing || loading}
            className="gap-1.5"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh
          </Button>
        </div>
      ) : null}

      {loading ? (
        <FeedLoadingSkeleton />
      ) : filteredPosts.length === 0 ? (
        <EmptyState
          title={props.emptyStateTitle ?? "No posts yet"}
          description={props.emptyStateDescription ?? "When someone posts, it will show up here."}
        />
      ) : (
        <div className="space-y-3">
          {filteredPosts.map((post) => {
            const m = metaFor(post.author_id);
            return (
              <FeedPostCard
                key={post.id}
                post={post}
                viewerId={props.viewerId}
                authorDisplayName={m.name}
                authorLoading={Boolean(m.loading)}
                authorPublicHandle={m.public_handle}
                authorAvatarPath={m.avatar_url}
                expanded={Boolean(expanded[post.id])}
                loadingComments={Boolean(loadingComments[post.id])}
                comments={commentsByPost[post.id] ?? []}
                commentDraft={commentDrafts[post.id] ?? ""}
                onCommentDraftChange={(value) => setCommentDrafts((d) => ({ ...d, [post.id]: value }))}
                commentInputRef={(el) => {
                  commentInputRefs.current[post.id] = el;
                }}
                onToggleComments={() => void onToggleComments(post.id)}
                onReplyFocus={() => {
                  setExpanded((m) => ({ ...m, [post.id]: true }));
                  void ensureCommentsLoaded(post.id);
                  window.setTimeout(() => commentInputRefs.current[post.id]?.focus(), 0);
                }}
                onLike={() => void onLike(post.id)}
                onSubmitComment={() => void onSubmitComment(post.id)}
                onReportPost={() => openReport("post", post.id)}
                onReportComment={(commentId) => openReport("comment", commentId)}
                commentMeta={(authorId) => {
                  const cm = metaFor(authorId);
                  return { name: cm.name, avatar_url: cm.avatar_url };
                }}
                isAuthor={Boolean(props.viewerId && props.viewerId === post.author_id)}
                onMenuEdit={() => openEditPost(post.id)}
                onMenuDelete={() => openDeletePost(post.id)}
                onDeleteComment={(commentId) => void onDeleteComment(post.id, commentId)}
                showPermalink
                onLikersLoaded={({ visibleCount }) => {
                  setPosts((prev) =>
                    prev.map((p) => (p.id === post.id ? { ...p, like_count: Math.max(p.like_count, visibleCount) } : p)),
                  );
                }}
              />
            );
          })}
        </div>
      )}

      <div ref={loadMoreSentinelRef} className="h-10" />
      {loadingMore ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : null}

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report</DialogTitle>
            <DialogDescription>Tell us briefly what is wrong. This is for safety review only, not medical advice.</DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Optional details"
            maxLength={2000}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setReportOpen(false)} disabled={reportSubmitting}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitReport()} disabled={reportSubmitting || !reportTarget}>
              {reportSubmitting ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletePostId !== null} onOpenChange={(v) => (v ? null : setDeletePostId(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete post?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the post and any attached images.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePostBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDeletePost()} disabled={deletePostBusy}>
              {deletePostBusy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editPost !== null} onOpenChange={(v) => (v ? null : setEditPost(null))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit post</DialogTitle>
            <DialogDescription>Update your post text and topic. Photos stay the same.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="edit-post-topic">Topic</Label>
              <Select
                value={editTopic}
                onValueChange={(v) => {
                  if (isCommunityTopicId(v)) setEditTopic(v);
                }}
              >
                <SelectTrigger id="edit-post-topic">
                  <SelectValue placeholder="Choose a topic" />
                </SelectTrigger>
                <SelectContent>
                  {COMMUNITY_TOPICS.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-post-body">Post</Label>
              <Textarea
                id="edit-post-body"
                rows={6}
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                maxLength={8000}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setEditPost(null)} disabled={editBusy}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitEditPost()} disabled={editBusy || !editPost}>
              {editBusy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

