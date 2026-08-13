import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { Loader2, RefreshCw, SearchX, Users } from "lucide-react";
import { EmptyState, FeedLoadingSkeleton } from "@/components/empty-state";
import { FeedPostCard } from "@/components/community/feed-post-card";
import { PostEditImagesField } from "@/components/community/post-edit-images-field";
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
import { usePostEditImages } from "@/hooks/use-post-edit-images";
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
  toggleCommentLike,
  toggleEventInterest,
  togglePostSave,
  updateCommunityPost,
  shouldUseFeedServerSearch,
  prefetchPostMediaSignedUrls,
  type CommunityPostCommentRow,
  type CommunityPostRow,
  type CommunityTopicId,
  type CommunityTopicRow,
  type FeedCursor,
} from "@/lib/community";
import { requestAiFeedReply } from "@/lib/ai-feed-reply/client";
import { getBeatieFeedBotUserIdFromEnv } from "@/lib/ai-feed-reply/config";
import {
  authorMetaFromPostPreview,
  authorIdsNeedingProfileFetch,
  displayAuthorName,
  fetchAuthorMetaMap,
  type FeedAuthorMeta,
} from "@/lib/community/feed-author-meta";
import { prefetchProfileAvatarUrls } from "@/lib/storage-profile";
import {
  buildCommunityFeedQueryKey,
  COMMUNITY_FEED_STALE_MS,
  getCommunityFeedNextPageParam,
} from "@/lib/community-feed-cache";
import { APP_SCROLL_MAIN_ID } from "@/lib/app-scroll";
import { COMMUNITY_FEED_ENGAGE_REQUIRED_MESSAGE } from "@/lib/profile";

function mapPostRowsInInfiniteData(
  old: InfiniteData<CommunityPostRow[]> | undefined,
  mapFn: (p: CommunityPostRow) => CommunityPostRow,
): InfiniteData<CommunityPostRow[]> | undefined {
  if (!old) return old;
  return {
    pageParams: old.pageParams,
    pages: old.pages.map((page) => page.map(mapFn)),
  };
}

function filterPostRowsInInfiniteData(
  old: InfiniteData<CommunityPostRow[]> | undefined,
  pred: (p: CommunityPostRow) => boolean,
): InfiniteData<CommunityPostRow[]> | undefined {
  if (!old) return old;
  return {
    pageParams: old.pageParams,
    pages: old.pages.map((page) => page.filter(pred)),
  };
}

export function FeedPostList(props: {
  viewerId: string | undefined;
  /** Isolates React Query cache (main feed vs profile author tab, etc.). */
  scopeKey: string;
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
  /** When false, viewer can read but not like, comment, or vote. */
  canEngageWithFeed?: boolean;
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

  const queryClient = useQueryClient();
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const pullAnchorRef = useRef<HTMLDivElement>(null);

  const [authorMeta, setAuthorMeta] = useState<Record<string, FeedAuthorMeta>>({});
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
  const editImages = usePostEditImages();
  const [editBusy, setEditBusy] = useState(false);

  const [debouncedSearch, setDebouncedSearch] = useState(props.searchQuery ?? "");
  const [newPostCount, setNewPostCount] = useState(0);
  const blockedUserIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(props.searchQuery ?? ""), 250);
    return () => window.clearTimeout(t);
  }, [props.searchQuery]);

  const useServerSearch = shouldUseFeedServerSearch(debouncedSearch);

  const feedQueryKey = useMemo(
    () =>
      buildCommunityFeedQueryKey({
        scopeKey: props.scopeKey,
        viewerId: props.viewerId ?? "",
        feedTab: props.feedTab,
        topicFilter,
        debouncedSearch,
        useServerSearch,
        authorIdsForServerSearch,
        savedOnly: props.savedOnly,
      }),
    [
      props.scopeKey,
      props.viewerId,
      useServerSearch,
      props.feedTab,
      topicFilter,
      debouncedSearch,
      authorIdsForServerSearch,
      props.savedOnly,
    ],
  );

  const feedQuery = useInfiniteQuery<
    CommunityPostRow[],
    Error,
    InfiniteData<CommunityPostRow[], FeedCursor | null>,
    typeof feedQueryKey,
    FeedCursor | null
  >({
    queryKey: feedQueryKey,
    initialPageParam: null as FeedCursor | null,
    enabled: isSupabaseConfigured(),
    staleTime: COMMUNITY_FEED_STALE_MS,
    gcTime: 10 * 60_000,
    refetchOnMount: (query) => {
      const pages = query.state.data?.pages;
      return !(pages?.[0]?.length);
    },
    queryFn: async ({ pageParam }) => {
      if (useServerSearch) {
        const res = await searchCommunityPostsPage(
          pageSize,
          pageParam,
          debouncedSearch,
          topicFilter,
          authorIdsForServerSearch,
        );
        if (res.error) throw new Error(res.error.message);
        return res.data ?? [];
      }
      const res = await fetchPage(pageSize, pageParam);
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
    getNextPageParam: (lastPage) => getCommunityFeedNextPageParam(lastPage, pageSize),
  });

  const posts = useMemo(() => feedQuery.data?.pages.flatMap((p) => p) ?? [], [feedQuery.data]);
  const postsRef = useRef(posts);
  postsRef.current = posts;

  const loadingPosts = feedQuery.status === "pending" && posts.length === 0;
  const feedError = feedQuery.status === "error" ? feedQuery.error : null;

  const feedLoadErrorKey = feedError?.message ?? null;
  useEffect(() => {
    if (!feedLoadErrorKey || !feedError) return;
    toast({
      title: useServerSearch ? "Search failed" : "Could not load posts",
      description: feedError.message,
      variant: "destructive",
    });
  }, [feedLoadErrorKey, feedError, useServerSearch, toast]);
  const [refreshing, setRefreshing] = useState(false);

  const runRefresh = useCallback(async () => {
    setRefreshing(true);
    setNewPostCount(0);
    try {
      await feedQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [feedQuery]);

  const feedQueryIdentity = useMemo(() => JSON.stringify(feedQueryKey), [feedQueryKey]);

  useEffect(() => {
    setExpanded({});
    setCommentsByPost({});
    setCommentDrafts({});
    setLoadingComments({});
    setNewPostCount(0);
  }, [feedQueryIdentity]);

  const patchPostsInCache = useCallback(
    (mapFn: (p: CommunityPostRow) => CommunityPostRow) => {
      queryClient.setQueryData<InfiniteData<CommunityPostRow[]>>(feedQueryKey, (old) =>
        mapPostRowsInInfiniteData(old, mapFn),
      );
    },
    [queryClient, feedQueryKey],
  );

  const removePostFromCache = useCallback(
    (postId: string) => {
      queryClient.setQueryData<InfiniteData<CommunityPostRow[]>>(feedQueryKey, (old) =>
        filterPostRowsInInfiniteData(old, (p) => p.id !== postId),
      );
    },
    [queryClient, feedQueryKey],
  );

  const { pullProgress } = usePullToRefresh({
    anchorRef: pullAnchorRef,
    onRefresh: runRefresh,
    enabled: isSupabaseConfigured(),
    isBusy: refreshing || loadingPosts || feedQuery.isFetching,
  });

  useEffect(() => {
    const el = loadMoreSentinelRef.current;
    if (!el || !feedQuery.hasNextPage || loadingPosts) return;
    const scrollRoot = document.getElementById(APP_SCROLL_MAIN_ID);
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || feedQuery.isFetchingNextPage) return;
        void feedQuery.fetchNextPage();
      },
      { root: scrollRoot, rootMargin: "240px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [feedQuery, feedQuery.hasNextPage, feedQuery.isFetchingNextPage, loadingPosts, posts.length]);

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
    const list = authorIdsNeedingProfileFetch(ids, postsRef.current, beatieFeedBotUserId);
    if (list.length === 0 && !(beatieFeedBotUserId && ids.has(beatieFeedBotUserId))) {
      setAuthorMetaPending(false);
      return;
    }
    let cancelled = false;
    setAuthorMetaPending(true);
    void (async () => {
      const fetched = await fetchAuthorMetaMap([...ids], postsRef.current, beatieFeedBotUserId);
      if (cancelled) return;
      setAuthorMeta((old) => ({ ...old, ...fetched }));
      setAuthorMetaPending(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [posts, commentsByPost, beatieFeedBotUserId]);

  function metaFor(authorId: string): FeedAuthorMeta {
    if (beatieFeedBotUserId && authorId === beatieFeedBotUserId) {
      const m = authorMeta[authorId];
      if (m) return m;
      if (authorMetaPending) {
        return { name: "", avatar_url: null, public_handle: null, loading: true };
      }
      return { name: "", avatar_url: null, public_handle: null };
    }
    const m = authorMeta[authorId];
    if (m) {
      return {
        ...m,
        name: displayAuthorName(m, authorId, beatieFeedBotUserId),
      };
    }
    if (authorMetaPending) return { name: "", avatar_url: null, public_handle: null, loading: true };
    return { name: "", avatar_url: null, public_handle: null, loading: true };
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

  useEffect(() => {
    if (displayPosts.length === 0) return;
    const mediaPaths: string[] = [];
    const avatarPaths: string[] = [];
    for (const post of displayPosts.slice(0, 20)) {
      mediaPaths.push(...post.image_urls);
      if (post.video_url) mediaPaths.push(post.video_url);
      const previewAvatar = post.author_preview?.avatar_url;
      if (previewAvatar) avatarPaths.push(previewAvatar);
      const metaAvatar = authorMeta[post.author_id]?.avatar_url;
      if (metaAvatar) avatarPaths.push(metaAvatar);
    }
    prefetchPostMediaSignedUrls(mediaPaths, { preloadImages: 6 });
    prefetchProfileAvatarUrls(avatarPaths, { preloadImages: 12 });
  }, [displayPosts, authorMeta]);

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
    patchPostsInCache((p) =>
      p.id === postId ? { ...p, comment_count: Math.max(p.comment_count, loaded.length) } : p,
    );
  }

  async function onToggleComments(postId: string) {
    const nextOpen = !expanded[postId];
    setExpanded((m) => ({ ...m, [postId]: nextOpen }));
    if (nextOpen) await ensureCommentsLoaded(postId);
  }

  const canEngageWithFeed = props.canEngageWithFeed !== false;

  function showEngageBlockedToast() {
    toast({
      title: "Set up your public profile",
      description: COMMUNITY_FEED_ENGAGE_REQUIRED_MESSAGE,
      variant: "destructive",
    });
  }

  async function onSubmitComment(postId: string) {
    if (!props.viewerId) {
      toast({ title: "Sign in to reply", description: "Log in to write a comment.", variant: "destructive" });
      return;
    }
    if (!canEngageWithFeed) {
      showEngageBlockedToast();
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
    patchPostsInCache((p) => (p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p));
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
        patchPostsInCache((p) => (p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p));
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

  async function onLikeComment(postId: string, commentId: string, currentlyLiked: boolean) {
    if (!props.viewerId) return;
    if (!canEngageWithFeed) {
      showEngageBlockedToast();
      return;
    }
    const prev = commentsByPost[postId] ?? [];
    const next = prev.map((c) =>
      c.id === commentId
        ? {
            ...c,
            liked_by_me: !currentlyLiked,
            like_count: Math.max(0, c.like_count + (currentlyLiked ? -1 : 1)),
          }
        : c,
    );
    setCommentsByPost((m) => ({ ...m, [postId]: next }));
    const res = await toggleCommentLike(commentId, currentlyLiked, postId);
    if (res.error) {
      setCommentsByPost((m) => ({ ...m, [postId]: prev }));
      toast({ title: "Could not update like", description: res.error.message, variant: "destructive" });
    }
  }

  async function onLike(postId: string) {
    if (!props.viewerId) return;
    if (!canEngageWithFeed) {
      showEngageBlockedToast();
      return;
    }
    const cur = postsRef.current.find((p) => p.id === postId);
    if (!cur) return;
    const res = await togglePostLike(postId, cur.liked_by_me);
    if (res.error) {
      toast({ title: "Could not update like", description: res.error.message, variant: "destructive" });
      return;
    }
    patchPostsInCache((p) => {
      if (p.id !== postId) return p;
      const nextLiked = !p.liked_by_me;
      const nextCount = Math.max(0, p.like_count + (nextLiked ? 1 : -1));
      return { ...p, liked_by_me: nextLiked, like_count: nextCount };
    });
  }

  async function onEventInterest(postId: string) {
    if (!props.viewerId) return;
    if (!canEngageWithFeed) {
      showEngageBlockedToast();
      return;
    }
    const cur = postsRef.current.find((p) => p.id === postId);
    if (!cur || cur.post_kind !== "event") return;
    const res = await toggleEventInterest(postId, cur.interested_by_me);
    if (res.error) {
      toast({ title: "Could not update interest", description: res.error.message, variant: "destructive" });
      return;
    }
    patchPostsInCache((p) => {
      if (p.id !== postId) return p;
      const nextInterested = !p.interested_by_me;
      const nextCount = Math.max(0, p.interested_count + (nextInterested ? 1 : -1));
      return { ...p, interested_by_me: nextInterested, interested_count: nextCount };
    });
  }

  async function onSavePost(postId: string) {
    if (!props.viewerId) {
      toast({ title: "Sign in", description: "Log in to save posts.", variant: "destructive" });
      return;
    }
    const cur = postsRef.current.find((p) => p.id === postId);
    if (!cur) return;
    // Optimistic update; togglePostSave is idempotent (duplicate PK treated as success).
    patchPostsInCache((p) => (p.id === postId ? { ...p, saved_by_me: !p.saved_by_me } : p));
    const res = await togglePostSave(postId, cur.saved_by_me);
    if (res.error) {
      // Revert on failure.
      patchPostsInCache((p) => (p.id === postId ? { ...p, saved_by_me: cur.saved_by_me } : p));
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
    patchPostsInCache((p) => (p.id === postId ? { ...p, comment_count: Math.max(0, p.comment_count - 1) } : p));
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
    removePostFromCache(deletePostId);
    setDeletePostId(null);
    toast({ title: "Deleted", description: "Your post was removed." });
  }

  function openEditPost(postId: string) {
    const p = postsRef.current.find((x) => x.id === postId) ?? null;
    if (!p) return;
    setEditPost(p);
    setEditBody(p.body);
    setEditTopic(p.topic);
    editImages.loadFromPost(p.image_urls, p.image_alt_texts ?? []);
  }

  function closeEditPost() {
    setEditPost(null);
    editImages.reset();
  }

  async function submitEditPost() {
    if (!editPost) return;
    if (!editImages.hasBodyOrImages(editBody)) {
      toast({
        title: "Add text or a photo",
        description: "Posts need some text or at least one photo.",
        variant: "destructive",
      });
      return;
    }
    const topic = isCommunityTopicId(editTopic) ? editTopic : DEFAULT_COMMUNITY_TOPIC;
    setEditBusy(true);
    const res = await updateCommunityPost(editPost.id, editBody, topic, {
      keepImagePaths: editImages.keptPaths,
      addImageFiles: editImages.newFiles,
      imageAltTexts: editImages.imageAlts,
    });
    setEditBusy(false);
    if (res.error) {
      toast({ title: "Could not update", description: res.error.message, variant: "destructive" });
      return;
    }
    if (res.data) {
      patchPostsInCache((p) => (p.id === editPost.id ? res.data! : p));
    }
    closeEditPost();
    toast({ title: "Updated", description: "Your post was updated." });
  }

  const searchLabelRaw = useServerSearch ? debouncedSearch.trim() : (props.searchQuery ?? "").trim();
  const searchNoResults =
    Boolean(searchLabelRaw) &&
    displayPosts.length === 0 &&
    !loadingPosts &&
    (useServerSearch ? posts.length === 0 : posts.length > 0);

  const savedFilterEmpty =
    Boolean(props.savedOnly) && !loadingPosts && posts.length > 0 && displayPosts.length === 0;

  const followingOnboardingEmpty =
    props.feedTab === "following" &&
    !loadingPosts &&
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
            disabled={refreshing || loadingPosts}
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
            className="h-9 w-full rounded-full text-xs font-medium shadow-sm"
            variant="secondary"
            onClick={() => void runRefresh()}
          >
            {newPostCount} new {newPostCount === 1 ? "post" : "posts"} — tap to refresh
          </Button>
        </div>
      ) : null}

      {loadingPosts ? (
        <FeedLoadingSkeleton />
      ) : feedError ? (
        <EmptyState
          title={useServerSearch ? "Search failed" : "Could not load posts"}
          description={feedError.message || "Please try again."}
          icon={RefreshCw}
        >
          <Button type="button" size="sm" onClick={() => void runRefresh()} disabled={refreshing}>
            Retry
          </Button>
        </EmptyState>
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
          title="Your Following feed is ready when you are"
          description="Find a few people to follow for a personalised stream — or browse Everyone to see what’s happening now."
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
        <div className="flex flex-col gap-3">
          {displayPosts.map((post, index) => {
            const m = metaFor(post.author_id);
            const authorDisplayName = displayAuthorName(m, post.author_id, beatieFeedBotUserId);
            return (
              <FeedPostCard
                key={post.id}
                post={post}
                mediaPriority={index < 3}
                viewerId={props.viewerId}
                canEngageWithFeed={canEngageWithFeed}
                authorDisplayName={authorDisplayName}
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
                onEventInterest={
                  post.post_kind === "event" ? () => void onEventInterest(post.id) : undefined
                }
                onSavePost={() => void onSavePost(post.id)}
                onSubmitComment={() => void onSubmitComment(post.id)}
                onReportPost={() => openReport("post", post.id)}
                onReportComment={(commentId) => openReport("comment", commentId)}
                onLikeComment={(commentId, currentlyLiked) =>
                  void onLikeComment(post.id, commentId, currentlyLiked)
                }
                commentMeta={metaFor}
                isAuthor={Boolean(props.viewerId && props.viewerId === post.author_id)}
                onMenuEdit={() => openEditPost(post.id)}
                onMenuDelete={() => openDeletePost(post.id)}
                onDeleteComment={(commentId) => void onDeleteComment(post.id, commentId)}
                showPermalink
                beatieFeedBotUserId={beatieFeedBotUserId}
                onAskBeatie={beatieFeedBotUserId ? () => void onAskBeatie(post.id) : undefined}
                askBeatieBusy={Boolean(askBeatieBusy[post.id])}
                onLikersLoaded={({ visibleCount }) => {
                  patchPostsInCache((p) =>
                    p.id === post.id ? { ...p, like_count: Math.max(p.like_count, visibleCount) } : p,
                  );
                }}
              />
            );
          })}
        </div>
      )}

      <div ref={loadMoreSentinelRef} className="h-10" />
      {feedQuery.isFetchingNextPage ? (
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

      <Dialog open={editPost !== null} onOpenChange={(v) => (v ? null : !editBusy && closeEditPost())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit post</DialogTitle>
            <DialogDescription>Update your text, topic, and photos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="edit-post-topic">Topic</Label>
              <Select
                value={editTopic}
                onValueChange={(v) => {
                  if (isCommunityTopicId(v)) setEditTopic(v);
                }}
                disabled={editBusy}
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
                disabled={editBusy}
              />
            </div>
            <PostEditImagesField images={editImages} disabled={editBusy} />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={closeEditPost} disabled={editBusy}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void submitEditPost()}
              disabled={editBusy || !editPost || !editImages.hasBodyOrImages(editBody)}
            >
              {editBusy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

