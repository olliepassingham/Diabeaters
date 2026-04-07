import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ImagePlus, Loader2, MessageCircle, RefreshCw, Send, Settings, X } from "lucide-react";
import { FeedPostCard } from "@/components/community/feed-post-card";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  COMMUNITY_TOPICS,
  DEFAULT_COMMUNITY_TOPIC,
  deleteCommunityComment,
  deleteCommunityPost,
  fetchCommentsForPost,
  fetchCommunityPostsFromFollowingPage,
  fetchCommunityPostsPage,
  insertCommunityComment,
  insertCommunityPost,
  MAX_POST_IMAGES,
  submitContentReport,
  togglePostLike,
  updateCommunityPost,
  type CommunityPostCommentRow,
  type CommunityPostRow,
  type CommunityTopicId,
} from "@/lib/community";
import { getProfilesByIds } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { InlineInfoHint } from "@/components/ui/field-label-with-info";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

type AuthorMeta = { name: string; avatar_url: string | null; public_handle: string | null };

type FeedTab = "everyone" | "following";

const PAGE_SIZE = 20;

export default function CommunityHomePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [feedTab, setFeedTab] = useState<FeedTab>("everyone");
  /** `null` = all topics. */
  const [topicFilter, setTopicFilter] = useState<CommunityTopicId | null>(null);
  const [composerTopic, setComposerTopic] = useState<CommunityTopicId>(DEFAULT_COMMUNITY_TOPIC);
  const [posts, setPosts] = useState<CommunityPostRow[]>([]);
  const postsRef = useRef(posts);
  postsRef.current = posts;

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [composer, setComposer] = useState("");
  const [composerFiles, setComposerFiles] = useState<File[]>([]);
  const [composerPreviews, setComposerPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [authorMeta, setAuthorMeta] = useState<Record<string, AuthorMeta>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, CommunityPostCommentRow[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});

  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: "post" | "comment"; id: string } | null>(
    null,
  );
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [deletePostBusy, setDeletePostBusy] = useState(false);
  const [editPost, setEditPost] = useState<CommunityPostRow | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editTopic, setEditTopic] = useState<CommunityTopicId>(DEFAULT_COMMUNITY_TOPIC);
  const [editBusy, setEditBusy] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const commentInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  useEffect(() => {
    const urls = composerFiles.map((f) => URL.createObjectURL(f));
    setComposerPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [composerFiles]);

  const loadFirstPage = useCallback(async () => {
    const res =
      feedTab === "everyone"
        ? await fetchCommunityPostsPage(PAGE_SIZE, null, topicFilter)
        : await fetchCommunityPostsFromFollowingPage(PAGE_SIZE, null, topicFilter);
    if (res.error) {
      toast({
        title: "Could not load posts",
        description: res.error.message,
        variant: "destructive",
      });
      setPosts([]);
      setHasMore(false);
    } else {
      const list = res.data ?? [];
      setPosts(list);
      setHasMore(list.length >= PAGE_SIZE);
    }
  }, [toast, feedTab, topicFilter]);

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

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading) return;
    const list = postsRef.current;
    if (list.length === 0) return;
    const last = list[list.length - 1];
    setLoadingMore(true);
    const res =
      feedTab === "everyone"
        ? await fetchCommunityPostsPage(
            PAGE_SIZE,
            {
              created_at: last.created_at,
              id: last.id,
            },
            topicFilter,
          )
        : await fetchCommunityPostsFromFollowingPage(
            PAGE_SIZE,
            {
              created_at: last.created_at,
              id: last.id,
            },
            topicFilter,
          );
    setLoadingMore(false);
    if (res.error) {
      toast({
        title: "Could not load more",
        description: res.error.message,
        variant: "destructive",
      });
      return;
    }
    const next = res.data ?? [];
    if (next.length === 0) {
      setHasMore(false);
      return;
    }
    setPosts((prev) => [...prev, ...next]);
    setHasMore(next.length >= PAGE_SIZE);
  }, [feedTab, hasMore, loadingMore, loading, toast, topicFilter]);

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
      return;
    }

    let cancelled = false;
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
    })();
    return () => {
      cancelled = true;
    };
  }, [posts, commentsByPost]);

  function metaFor(authorId: string): AuthorMeta {
    return authorMeta[authorId] ?? { name: shortId(authorId), avatar_url: null, public_handle: null };
  }

  function onPickImages(files: FileList | null) {
    if (!files?.length) return;
    const next: File[] = [...composerFiles];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f) continue;
      if (next.length >= MAX_POST_IMAGES) break;
      if (!f.type.startsWith("image/")) continue;
      next.push(f);
    }
    setComposerFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeComposerImage(index: number) {
    setComposerFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    const body = composer.trim();
    if (!body && composerFiles.length === 0) return;
    setSubmitting(true);
    const res = await insertCommunityPost(body, composerFiles.length ? composerFiles : undefined);
    setSubmitting(false);
    if (res.error) {
      toast({ title: "Post failed", description: res.error.message, variant: "destructive" });
      return;
    }
    setComposer("");
    setComposerFiles([]);
    setComposerTopic(DEFAULT_COMMUNITY_TOPIC);
    if (res.data) setPosts((prev) => [res.data!, ...prev]);
    toast({ title: "Posted" });
  }

  async function loadCommentsIfNeeded(postId: string) {
    if (postId in commentsByPost || loadingComments[postId]) return;
    setLoadingComments((prev) => ({ ...prev, [postId]: true }));
    const res = await fetchCommentsForPost(postId);
    setLoadingComments((prev) => ({ ...prev, [postId]: false }));
    if (res.error) {
      toast({ title: "Comments", description: res.error.message, variant: "destructive" });
      return;
    }
    setCommentsByPost((prev) => ({ ...prev, [postId]: res.data ?? [] }));
  }

  async function toggleComments(postId: string) {
    const willOpen = !expanded[postId];
    setExpanded((prev) => ({ ...prev, [postId]: !prev[postId] }));
    if (willOpen) await loadCommentsIfNeeded(postId);
  }

  async function replyToPost(postId: string) {
    setExpanded((prev) => ({ ...prev, [postId]: true }));
    await loadCommentsIfNeeded(postId);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        commentInputRefs.current[postId]?.focus();
      });
    });
  }

  async function handleToggleLike(postId: string, currentlyLiked: boolean) {
    if (!user) return;
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        return {
          ...p,
          liked_by_me: !currentlyLiked,
          like_count: Math.max(0, p.like_count + (currentlyLiked ? -1 : 1)),
        };
      }),
    );
    const res = await togglePostLike(postId, currentlyLiked);
    if (res.error) {
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          return {
            ...p,
            liked_by_me: currentlyLiked,
            like_count: Math.max(0, p.like_count + (currentlyLiked ? 1 : -1)),
          };
        }),
      );
      toast({ title: "Could not update like", description: res.error.message, variant: "destructive" });
    }
  }

  async function submitComment(postId: string) {
    const text = (commentDrafts[postId] ?? "").trim();
    if (!text) return;
    const res = await insertCommunityComment(postId, text);
    if (res.error) {
      toast({ title: "Comment failed", description: res.error.message, variant: "destructive" });
      return;
    }
    setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
    if (res.data) {
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] ?? []), res.data!],
      }));
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p,
        ),
      );
    }
  }

  function openReport(type: "post" | "comment", id: string) {
    setReportTarget({ type, id });
    setReportReason("");
    setReportOpen(true);
  }

  async function confirmReport() {
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
    toast({ title: "Thanks — we’ve received your report." });
  }

  async function confirmDeletePost() {
    if (!deletePostId) return;
    setDeletePostBusy(true);
    const id = deletePostId;
    const res = await deleteCommunityPost(id);
    setDeletePostBusy(false);
    if (res.error) {
      toast({ title: "Could not delete post", description: res.error.message, variant: "destructive" });
      return;
    }
    setPosts((prev) => prev.filter((p) => p.id !== id));
    setCommentsByPost((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setExpanded((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setDeletePostId(null);
    toast({ title: "Post deleted" });
  }

  async function saveEditPost() {
    if (!editPost) return;
    setEditBusy(true);
    const res = await updateCommunityPost(editPost.id, editBody, editTopic);
    setEditBusy(false);
    if (res.error) {
      toast({ title: "Could not save", description: res.error.message, variant: "destructive" });
      return;
    }
    if (res.data) {
      setPosts((prev) => prev.map((p) => (p.id === res.data!.id ? res.data! : p)));
    }
    setEditPost(null);
    toast({ title: "Post updated" });
  }

  async function handleDeleteComment(postId: string, commentId: string) {
    const res = await deleteCommunityComment(commentId);
    if (res.error) {
      toast({ title: "Could not delete comment", description: res.error.message, variant: "destructive" });
      return;
    }
    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: (prev[postId] ?? []).filter((c) => c.id !== commentId),
    }));
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comment_count: Math.max(0, p.comment_count - 1) } : p,
      ),
    );
  }

  if (!isSupabaseConfigured()) {
    return (
      <PageShell variant="standard" className="max-w-lg mx-auto space-y-4">
        <PageHeader leading={<PageBackButton />} title="Feed" />
        <p className="text-sm text-muted-foreground">Connect Supabase in your environment to use Feed.</p>
      </PageShell>
    );
  }

  return (
    <PageShell variant="standard" className="max-w-lg mx-auto space-y-4 pb-24">
      <PageHeader
        leading={<PageBackButton />}
        title="Feed"
        description="Everyone signed in can see posts. Profile photos use each person’s account picture when their profile is visible."
        actions={
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" asChild>
              <Link href="/account#community" aria-label="Feed profile settings">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/community/messages">
                <MessageCircle className="h-4 w-4 mr-1.5" />
                Messages
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <Tabs value={feedTab} onValueChange={(v) => setFeedTab(v as FeedTab)} className="w-full sm:max-w-md">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="following">Following</TabsTrigger>
              <TabsTrigger value="everyone">Everyone</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 min-h-11"
            disabled={refreshing || loading}
            onClick={() => void runRefresh()}
            aria-label="Refresh feed"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
        <div
          className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
          role="group"
          aria-label="Filter feed by topic"
        >
          <Button
            type="button"
            variant={topicFilter === null ? "default" : "outline"}
            size="sm"
            className="shrink-0"
            onClick={() => setTopicFilter(null)}
          >
            All topics
          </Button>
          {COMMUNITY_TOPICS.map((t) => (
            <Button
              key={t.id}
              type="button"
              variant={topicFilter === t.id ? "default" : "outline"}
              size="sm"
              className="shrink-0 whitespace-nowrap"
              onClick={() => setTopicFilter(t.id)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">New post</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePost} className="space-y-2">
            <div className="space-y-1.5">
              <Label htmlFor="feed-topic" className="text-sm">
                Topic
              </Label>
              <Select
                value={composerTopic}
                onValueChange={(v) => setComposerTopic(v as CommunityTopicId)}
                disabled={submitting || !user}
              >
                <SelectTrigger id="feed-topic" className="w-full">
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
            <Textarea
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              placeholder="Share something on the feed…"
              rows={3}
              maxLength={8000}
              disabled={submitting || !user}
            />
            {composerPreviews.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {composerPreviews.map((src, i) => (
                  <div key={src} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-border">
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5 shadow"
                      onClick={() => removeComposerImage(i)}
                      aria-label="Remove image"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                id="feed-composer-images"
                disabled={submitting || !user || composerFiles.length >= MAX_POST_IMAGES}
                onChange={(e) => onPickImages(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={submitting || !user || composerFiles.length >= MAX_POST_IMAGES}
                onClick={() => fileInputRef.current?.click()}
                aria-label="Add photos to post"
              >
                <ImagePlus className="h-4 w-4 mr-1.5" />
                Photo
              </Button>
              <InlineInfoHint
                ariaLabel="Photo limits for posts"
                content={`Up to ${MAX_POST_IMAGES} photos per post, 5MB each.`}
              />
              <Button
                type="submit"
                size="sm"
                className="ml-auto"
                disabled={
                  submitting ||
                  (!composer.trim() && composerFiles.length === 0) ||
                  !user
                }
              >
                <Send className="h-4 w-4 mr-1.5" />
                Post
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {feedTab === "following"
            ? topicFilter
              ? "No posts in this topic from people you follow yet. Try All topics or follow more profiles."
              : "No posts from people you follow yet. Follow profiles from the Everyone tab, or post something yourself."
            : topicFilter
              ? "No posts in this topic yet. Try another topic or be the first to post here."
              : "No posts yet. Be the first to post."}
        </p>
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => {
            const m = metaFor(p.author_id);
            return (
              <li key={p.id}>
                <FeedPostCard
                  post={p}
                  viewerId={user?.id}
                  authorDisplayName={m.name}
                  authorPublicHandle={m.public_handle}
                  authorAvatarPath={m.avatar_url}
                  expanded={Boolean(expanded[p.id])}
                  loadingComments={Boolean(loadingComments[p.id])}
                  comments={commentsByPost[p.id] ?? []}
                  commentDraft={commentDrafts[p.id] ?? ""}
                  onCommentDraftChange={(v) => setCommentDrafts((prev) => ({ ...prev, [p.id]: v }))}
                  commentInputRef={(el) => {
                    commentInputRefs.current[p.id] = el;
                  }}
                  onToggleComments={() => void toggleComments(p.id)}
                  onReplyFocus={() => void replyToPost(p.id)}
                  onLike={() => void handleToggleLike(p.id, p.liked_by_me)}
                  onSubmitComment={() => void submitComment(p.id)}
                  onReportPost={() => openReport("post", p.id)}
                  onReportComment={(cid) => openReport("comment", cid)}
                  commentMeta={metaFor}
                  isAuthor={Boolean(user?.id && user.id === p.author_id)}
                  onMenuEdit={() => {
                    setEditPost(p);
                    setEditBody(p.body);
                    setEditTopic(p.topic);
                  }}
                  onMenuDelete={() => setDeletePostId(p.id)}
                  onDeleteComment={(cid) => void handleDeleteComment(p.id, cid)}
                  showPermalink
                  onLikersLoaded={({ visibleCount }) => {
                    setPosts((prev) =>
                      prev.map((x) =>
                        x.id === p.id
                          ? { ...x, like_count: Math.max(x.like_count, visibleCount) }
                          : x,
                      ),
                    );
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}

      {!loading && posts.length > 0 && hasMore && (
        <div ref={loadMoreSentinelRef} className="flex justify-center py-4" aria-hidden>
          {loadingMore ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <span className="text-xs text-muted-foreground">Scroll for more</span>
          )}
        </div>
      )}

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report {reportTarget?.type === "comment" ? "comment" : "post"}</DialogTitle>
            <DialogDescription>
              Reports are reviewed according to community guidelines. Optional: add a short note.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Why are you reporting this?"
            rows={3}
            maxLength={2000}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void confirmReport()} disabled={reportSubmitting}>
              {reportSubmitting ? "Sending…" : "Submit report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletePostId != null} onOpenChange={(o) => !o && !deletePostBusy && setDeletePostId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Comments will be removed with the post.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePostBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDeletePost();
              }}
              disabled={deletePostBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePostBusy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editPost != null} onOpenChange={(o) => !o && !editBusy && setEditPost(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit post</DialogTitle>
            <DialogDescription>Update topic or text. Photos stay the same.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="edit-feed-topic" className="text-sm">
              Topic
            </Label>
            <Select
              value={editTopic}
              onValueChange={(v) => setEditTopic(v as CommunityTopicId)}
              disabled={editBusy}
            >
              <SelectTrigger id="edit-feed-topic" className="w-full">
                <SelectValue />
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
          <Textarea
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            rows={6}
            maxLength={8000}
            disabled={editBusy}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setEditPost(null)} disabled={editBusy}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveEditPost()} disabled={editBusy}>
              {editBusy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
