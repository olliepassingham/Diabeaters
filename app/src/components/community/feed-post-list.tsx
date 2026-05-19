import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, SearchX, Users } from "lucide-react";
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
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase";
import {
  COMMUNITY_TOPICS,
  DEFAULT_COMMUNITY_TOPIC,
  deleteCommunityComment,
  deleteCommunityPost,
  fetchCommentsForPost,
  insertCommunityComment,
  isCommunityTopicId,
  listBlockRelatedUserIdsForCurrentUser,
  searchCommunityPostsPage,
  submitContentReport,
  togglePostLike,
  togglePostSave,
  updateCommunityPost,
  shouldUseFeedServerSearch,
  type CommunityPostAuthorPreview,
  type CommunityPostCommentRow,
  type CommunityPostRow,
  type CommunityTopicId,
  type CommunityTopicRow,
  type FeedCursor,
} from "@/lib/community";
import { requestAiFeedReply } from "@/lib/ai-feed-reply/client";
import { getBeatieFeedBotUserIdFromEnv } from "@/lib/ai-feed-reply/config";
import { getProfilesByIds } from "@/lib/profile";

type AuthorMeta = { name: string; avatar_url: string | null; public_handle: string | null; loading?: boolean };

function authorMetaFromPostPreview(post: CommunityPostRow): AuthorMeta | null {
  const prev = post.author_preview;
  if (!prev) return null;
  return authorMetaFromPreviewFields(post.author_id, prev);
}

function authorMetaFromPreviewFields(authorId: string, prev: CommunityPostAuthorPreview): AuthorMeta {
  const name =
    prev.full_name?.trim() ||
    (prev.public_handle ? `@${prev.public_handle}` : "") ||
    shortId(authorId);
  return {
    name,
    avatar_url: prev.avatar_url,
    public_handle: prev.public_handle,
  };
}

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
  /** Topic dropdown order (edit post); defaults to canonical list. */
  topicsForSelect?: readonly CommunityTopicRow[];
  /** Main feed only: Following vs Everyone (onboarding empty state). */
  feedTab?: "everyone" | "following";
  topicFilter?: CommunityTopicId | null;
  /** When `feedTab` is following, author ids (self + followees) for search + realtime. */
  followingAuthorIds?: string[] | null;
  /** Author ids matched from name/handle search (used for server search). */
  searchMatchedAuthorIds?: string[] | null;
  onOpenFindPeople?: () => void;
  /** Show only posts saved by the viewer (client filter). */
  savedOnly?: boolean;
  /** Bump when parent remount key changes (realtime channel id). */
  feedListRevision?: number;
  /** Clear search field (main feed). */
  onClearSearch?: () => void;
  /** Switch to Everyone tab with a topic (onboarding). */
  onExploreTopicInEveryone?: (topicId: CommunityTopicId) => void;
  /** Switch to Everyone tab (onboarding). */
  onSwitchToEveryone?: () => void;
}) {
  const { toast } = useToast();
  const pageSize = props.pageSize ?? 20;
  const { fetchPage } = props;
  const topicsForSelect = props.topicsForSelect ?? COMMUNITY_TOPICS;
  const topicFilter = props.topicFilter ?? null;
  const followingAuthorIdsForSearch =
    props.feedTab === "following" && props.followingAuthorIds && props.followingAuthorIds.length > 0
      ? props.followingAuthorIds
      : null;
  const authorIdsForServerSearch =
    props.searchMatchedAuthorIds && props.searchMatchedAuthorIds.length > 0 ? props.searchMatchedAuthorIds : null;

  const [posts, setPosts] = useState<CommunityPostRow[]>([]);
  const postsRef = useRef(posts);
  postsRef.current = posts;

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState(props.searchQuery ?? "");
  const [newPostCount, setNewPostCount] = useState(0);
  const blockedUserIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(props.searchQuery ?? ""), 250);
    return () => window.clearTimeout(t);
  }, [props.searchQuery]);

  const useServerSearch = shouldUseFeedServerSearch(debouncedSearch);

  const [authorMeta, setAuthorMeta] = useState<Record<string, AuthorMeta>>({});
  const [authorMetaPending, setAuthorMetaPending] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, CommunityPostCommentRow[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});
  const commentInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const beatieFeedBotUserId = useMemo(() => getBeatieFeedBotUserIdFromEnv(), []);
  const [askBeatieBusy, setAskBeatieBusy] = useState<Record<string, boolean>>({});

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
    if (useServerSearch) {
      const res = await searchCommunityPostsPage(
        pageSize,
        null,
        debouncedSearch,
        topicFilter,
        authorIdsForServerSearch,
      );
      if (res.error) {
        toast({ title: "Search failed", description: res.error.message, variant: "destructive" });
        setPosts([]);
        setHasMore(false);
        return;
      }
      const list = res.data ?? [];
      setPosts(list);
      setHasMore(list.length >= pageSize);
      return;
    }

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
  }, [
    useServerSearch,
    debouncedSearch,
    topicFilter,
    authorIdsForServerSearch,
    fetchPage,
    pageSize,
    toast,
  ]);

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
    setNewPostCount(0);
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
    setExpanded({});
    setCommentsByPost({});
    setCommentDrafts({});
    setLoadingComments({});
    setNewPostCount(0);
  }, [refresh]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading) return;
    const list = postsRef.current;
    if (list.length === 0) return;
    const last = list[list.length - 1];
    if (!last) return;
    setLoadingMore(true);

    if (useServerSearch) {
      const res = await searchCommunityPostsPage(
        pageSize,
        { created_at: last.created_at, id: last.id },
        debouncedSearch,
        topicFilter,
        authorIdsForServerSearch,
      );
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
      return;
    }

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
  }, [
    hasMore,
    loadingMore,
    loading,
    fetchPage,
    pageSize,
    toast,
    useServerSearch,
    debouncedSearch,
    topicFilter,
    authorIdsForServerSearch,
  ]);

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
    if (!isSupabaseConfigured() || useServerSearch || !props.viewerId) return;
    const supabase = getSupabase();
    if (!supabase) return;

    let cancelled = false;
    void listBlockRelatedUserIdsForCurrentUser().then((r) => {
      if (cancelled || r.error) return;
      blockedUserIdsRef.current = r.ids;
    });

    const selfId = props.viewerId;
    const topic = topicFilter;
    const following = followingAuthorIdsForSearch;
    const rev = props.feedListRevision ?? 0;

    const channel = supabase
      .channel(`community_posts_inserts_${selfId}_${rev}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_posts" },
        (payload) => {
          const row = payload.new as { id?: string; author_id?: string; topic?: string };
          if (!row?.author_id || !row.id) return;
          if (row.author_id === selfId) return;
          if (blockedUserIdsRef.current.has(row.author_id)) return;
          if (topic != null && row.topic !== topic) return;
          if (following && !following.includes(row.author_id)) return;
          setNewPostCount((c) => c + 1);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [props.viewerId, topicFilter, followingAuthorIdsForSearch, useServerSearch, props.feedListRevision]);

  /** Seed author rows from post payload so names/avatar paths paint with the feed (not after a second fetch). */
  useLayoutEffect(() => {
    setAuthorMeta((old) => {
      let touched = false;
      const next = { ...old };
      for (const p of posts) {
        const seeded = authorMetaFromPostPreview(p);
        if (!seeded) continue;
        const cur = next[p.author_id];
        if (
          cur &&
          !cur.loading &&
          cur.name === seeded.name &&
          cur.avatar_url === seeded.avatar_url &&
          cur.public_handle === seeded.public_handle
        ) {
          continue;
        }
        next[p.author_id] = seeded;
        touched = true;
      }
      return touched ? next : old;
    });
  }, [posts]);

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
        const postPreview = postsRef.current.find((p) => p.author_id === id)?.author_preview;
        next[id] = postPreview
          ? authorMetaFromPreviewFields(id, postPreview)
          : {
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

  const displayPosts = useMemo(() => {
    let list = posts;
    if (props.savedOnly) {
      list = list.filter((p) => p.saved_by_me);
    }
    if (useServerSearch) return list;
    const q = (props.searchQuery ?? "").trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => {
      if (p.body.toLowerCase().includes(q)) return true;
      const m = authorMeta[p.author_id];
      const name = (m?.name ?? "").toLowerCase();
      const handle = (m?.public_handle ?? "").toLowerCase();
      return name.includes(q) || handle.includes(q);
    });
  }, [posts, props.searchQuery, props.savedOnly, authorMeta, useServerSearch]);

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

  async function onAskBeatie(postId: string) {
    if (!props.viewerId) {
      toast({ title: "Sign in", description: "Log in to ask Beatie.", variant: "destructive" });
      return;
    }
    if (askBeatieBusy[postId]) return;
    setAskBeatieBusy((m) => ({ ...m, [postId]: true }));
    try {
      const res = await requestAiFeedReply(postId);
      if (res.ok) {
        setCommentsByPost((m) => ({ ...m, [postId]: [...(m[postId] ?? []), res.comment] }));
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p)));
        toast({ title: "Beatie replied", description: "Their reply appears in the thread below." });
        return;
      }
      const desc =
        res.message ||
        (res.code === "beatie_already_replied"
          ? "Beatie has already commented on this post."
          : res.code === "consent_required"
            ? "Accept Beatie consent in Coach first."
            : res.code === "rate_limited"
              ? "Daily limit reached — try again tomorrow."
              : res.code);
      toast({
        title: "Ask Beatie did not run",
        description: desc,
        variant: "destructive",
      });
    } finally {
      setAskBeatieBusy((m) => ({ ...m, [postId]: false }));
    }
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

  async function onSavePost(postId: string) {
    if (!props.viewerId) {
      toast({ title: "Sign in", description: "Log in to save posts.", variant: "destructive" });
      return;
    }
    const cur = postsRef.current.find((p) => p.id === postId);
    if (!cur) return;
    // Optimistic update; togglePostSave is idempotent (duplicate PK treated as success).
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, saved_by_me: !p.saved_by_me } : p)));
    const res = await togglePostSave(postId, cur.saved_by_me);
    if (res.error) {
      // Revert on failure.
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, saved_by_me: cur.saved_by_me } : p)));
      toast({ title: "Could not update bookmark", description: res.error.message, variant: "destructive" });
    }
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

  const searchLabelRaw = useServerSearch ? debouncedSearch.trim() : (props.searchQuery ?? "").trim();
  const searchNoResults =
    Boolean(searchLabelRaw) &&
    displayPosts.length === 0 &&
    !loading &&
    (useServerSearch ? posts.length === 0 : posts.length > 0);

  const savedFilterEmpty =
    Boolean(props.savedOnly) && !loading && posts.length > 0 && displayPosts.length === 0;

  const followingOnboardingEmpty =
    props.feedTab === "following" &&
    !loading &&
    posts.length === 0 &&
    !useServerSearch &&
    !props.savedOnly &&
    !(props.searchQuery ?? "").trim();

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

      {newPostCount > 0 && !useServerSearch ? (
        <div className="pb-2" aria-live="polite">
          <Button
            type="button"
            size="sm"
            className="w-full rounded-full shadow-sm"
            variant="secondary"
            onClick={() => void runRefresh()}
          >
            {newPostCount} new {newPostCount === 1 ? "post" : "posts"} — tap to refresh
          </Button>
        </div>
      ) : null}

      {loading ? (
        <FeedLoadingSkeleton />
      ) : searchNoResults ? (
        <EmptyState
          title={`No matches for "${searchLabelRaw}"`}
          description="Try different words or clear search."
          icon={SearchX}
        >
          {props.onClearSearch ? (
            <Button type="button" variant="outline" size="sm" onClick={() => props.onClearSearch?.()}>
              Clear search
            </Button>
          ) : null}
        </EmptyState>
      ) : savedFilterEmpty ? (
        <EmptyState
          title="No saved posts yet"
          description="Use the bookmark action on a post to save it here."
        />
      ) : followingOnboardingEmpty ? (
        <EmptyState
          title="Build your Following feed"
          description="Follow a few people to personalise this tab. Until then, browse Everyone to discover posts and topics."
          icon={Users}
        >
          <div className="flex flex-wrap justify-center gap-2">
            {props.onOpenFindPeople ? (
              <Button type="button" size="sm" onClick={() => props.onOpenFindPeople?.()}>
                Find people
              </Button>
            ) : null}
            {props.onSwitchToEveryone ? (
              <Button type="button" size="sm" variant="outline" onClick={() => props.onSwitchToEveryone?.()}>
                Go to Everyone
              </Button>
            ) : null}
          </div>
          {props.onExploreTopicInEveryone ? (
            <div className="w-full max-w-sm space-y-2 text-left">
              <p className="text-center text-xs font-medium text-muted-foreground">Browse a topic (Everyone)</p>
              <div className="flex flex-wrap justify-center gap-2">
                {(props.topicsForSelect ?? COMMUNITY_TOPICS)
                  .filter((t) => t.id !== DEFAULT_COMMUNITY_TOPIC)
                  .slice(0, 5)
                  .map((t) => (
                    <Button
                      key={t.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full text-xs"
                      onClick={() => props.onExploreTopicInEveryone?.(t.id)}
                    >
                      {t.label}
                    </Button>
                  ))}
              </div>
            </div>
          ) : null}
        </EmptyState>
      ) : displayPosts.length === 0 ? (
        <EmptyState
          title={props.emptyStateTitle ?? "No posts yet"}
          description={props.emptyStateDescription ?? "When someone posts, it will show up here."}
        />
      ) : (
        <div className="space-y-3">
          {displayPosts.map((post) => {
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
                onSavePost={() => void onSavePost(post.id)}
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
                beatieFeedBotUserId={beatieFeedBotUserId}
                onAskBeatie={beatieFeedBotUserId ? () => void onAskBeatie(post.id) : undefined}
                askBeatieBusy={Boolean(askBeatieBusy[post.id])}
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
                  {topicsForSelect.map((t) => (
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

