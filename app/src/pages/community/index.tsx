import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  BarChart2,
  Calendar,
  ImagePlus,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  X,
} from "lucide-react";
import { EmptyState, FeedLoadingSkeleton } from "@/components/empty-state";
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
import { Input } from "@/components/ui/input";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
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
  insertFeedPost,
  isCommunityTopicId,
  MAX_POST_IMAGES,
  submitContentReport,
  togglePostLike,
  updateCommunityPost,
  type CommunityPostCommentRow,
  type CommunityPostRow,
  type CommunityTopicId,
  type FeedPostMentions,
} from "@/lib/community";
import { getProfileIdByPublicHandle, getProfilesByIds, normalizePublicHandleInput } from "@/lib/profile";
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

const MAX_POLL_OPTIONS = 6;

const FEED_COMPOSER_DRAFT_KEY = "diabeaters-feed-composer-draft-v1";

function readFeedComposerDraft(): { body: string; topic: CommunityTopicId } | null {
  try {
    const raw = localStorage.getItem(FEED_COMPOSER_DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Record<string, unknown>;
    const body = typeof d.body === "string" ? d.body : "";
    const topicRaw = d.topic;
    const topic =
      typeof topicRaw === "string" && isCommunityTopicId(topicRaw)
        ? topicRaw
        : DEFAULT_COMMUNITY_TOPIC;
    return { body, topic };
  } catch {
    return null;
  }
}

type ComposerPostKind = "standard" | "poll" | "event";

async function buildMentionsForPost(body: string, authorId: string | undefined): Promise<FeedPostMentions> {
  const mentionMap: Record<string, string> = {};
  const idOrder: string[] = [];
  const seen = new Set<string>();
  const re = /@([a-z0-9_]{3,30})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const raw = m[1]!.toLowerCase();
    if (mentionMap[raw]) continue;
    if (seen.size >= 12) continue;
    let normalized: string | null;
    try {
      normalized = normalizePublicHandleInput(raw);
    } catch {
      continue;
    }
    if (!normalized) continue;
    const { userId, error } = await getProfileIdByPublicHandle(normalized);
    if (error || !userId || (authorId && userId === authorId)) continue;
    mentionMap[raw] = userId;
    if (!seen.has(userId)) {
      seen.add(userId);
      idOrder.push(userId);
    }
  }
  return { userIds: idOrder, mentionMap };
}

export default function CommunityHomePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [feedTab, setFeedTab] = useState<FeedTab>("everyone");
  /** `null` = all topics. */
  const [topicFilter, setTopicFilter] = useState<CommunityTopicId | null>(null);
  const [composerTopic, setComposerTopic] = useState<CommunityTopicId>(
    () => readFeedComposerDraft()?.topic ?? DEFAULT_COMMUNITY_TOPIC,
  );
  const [feedSearch, setFeedSearch] = useState("");
  const [posts, setPosts] = useState<CommunityPostRow[]>([]);
  const postsRef = useRef(posts);
  postsRef.current = posts;

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [composer, setComposer] = useState(() => readFeedComposerDraft()?.body ?? "");
  const [composerFiles, setComposerFiles] = useState<File[]>([]);
  const [composerImageAlts, setComposerImageAlts] = useState<string[]>([]);
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
  const [editImageAlts, setEditImageAlts] = useState<string[]>([]);
  const [composerPostKind, setComposerPostKind] = useState<ComposerPostKind>("standard");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [eventTitle, setEventTitle] = useState("");
  const [eventStartsAt, setEventStartsAt] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventDetails, setEventDetails] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const commentInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  useEffect(() => {
    const urls = composerFiles.map((f) => URL.createObjectURL(f));
    setComposerPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [composerFiles]);

  useEffect(() => {
    setComposerImageAlts((prev) => {
      const n = composerFiles.length;
      if (prev.length === n) return prev;
      const next = prev.slice(0, n);
      while (next.length < n) next.push("");
      return next;
    });
  }, [composerFiles.length]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        if (!composer.trim()) {
          localStorage.removeItem(FEED_COMPOSER_DRAFT_KEY);
          return;
        }
        localStorage.setItem(
          FEED_COMPOSER_DRAFT_KEY,
          JSON.stringify({
            body: composer,
            topic: composerTopic,
          }),
        );
      } catch {
        /* quota / private mode */
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [composer, composerTopic]);

  useEffect(() => {
    if (composerPostKind !== "standard") setComposerFiles([]);
  }, [composerPostKind]);

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

  const feedPullAnchorRef = useRef<HTMLDivElement>(null);
  const { pullProgress } = usePullToRefresh({
    anchorRef: feedPullAnchorRef,
    onRefresh: runRefresh,
    enabled: isSupabaseConfigured(),
    isBusy: refreshing || loading,
  });

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

  const filteredPosts = useMemo(() => {
    const q = feedSearch.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p) => {
      if (p.body.toLowerCase().includes(q)) return true;
      const m = authorMeta[p.author_id];
      const name = (m?.name ?? "").toLowerCase();
      const handle = (m?.public_handle ?? "").toLowerCase();
      return name.includes(q) || handle.includes(q);
    });
  }, [posts, feedSearch, authorMeta]);

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

  function resetComposerAfterPost() {
    setComposer("");
    setComposerFiles([]);
    setComposerImageAlts([]);
    setComposerPostKind("standard");
    setPollQuestion("");
    setPollOptions(["", ""]);
    setEventTitle("");
    setEventStartsAt("");
    setEventLocation("");
    setEventDetails("");
    try {
      localStorage.removeItem(FEED_COMPOSER_DRAFT_KEY);
    } catch {
      /* ignore */
    }
  }

  function onPollModeClick() {
    if (composerPostKind === "poll") {
      setComposerPostKind("standard");
      return;
    }
    setEventTitle("");
    setEventStartsAt("");
    setEventLocation("");
    setEventDetails("");
    setComposerPostKind("poll");
  }

  function onEventModeClick() {
    if (composerPostKind === "event") {
      setComposerPostKind("standard");
      return;
    }
    setPollQuestion("");
    setPollOptions(["", ""]);
    setComposerPostKind("event");
  }

  const composerCanSubmit = useMemo(() => {
    if (!user) return false;
    if (composerPostKind === "standard") {
      const t = composer.trim();
      return Boolean(t || composerFiles.length > 0);
    }
    if (composerPostKind === "poll") {
      const q = pollQuestion.trim();
      const opts = pollOptions.map((o) => o.trim()).filter(Boolean);
      return q.length > 0 && opts.length >= 2 && opts.length <= MAX_POLL_OPTIONS;
    }
    const titleOk = eventTitle.trim().length > 0;
    const whenOk = eventStartsAt.trim().length > 0;
    return titleOk && whenOk;
  }, [user, composerPostKind, composer, composerFiles.length, pollQuestion, pollOptions, eventTitle, eventStartsAt]);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !composerCanSubmit) return;
    setSubmitting(true);

    const mentions = await buildMentionsForPost(composer, user.id);

    let res: { data: CommunityPostRow | null; error: Error | null };
    if (composerPostKind === "standard") {
      res = await insertFeedPost({
        kind: "standard",
        topic: composerTopic,
        body: composer,
        imageFiles: composerFiles.length ? composerFiles : undefined,
        imageAlts: composerImageAlts,
        mentions,
      });
    } else if (composerPostKind === "poll") {
      res = await insertFeedPost({
        kind: "poll",
        topic: composerTopic,
        body: composer,
        question: pollQuestion,
        options: pollOptions,
        mentions,
      });
    } else {
      const startDate = new Date(eventStartsAt);
      if (Number.isNaN(startDate.getTime())) {
        setSubmitting(false);
        toast({ title: "Invalid date", description: "Choose a valid start date and time.", variant: "destructive" });
        return;
      }
      const iso = startDate.toISOString();
      res = await insertFeedPost({
        kind: "event",
        topic: composerTopic,
        body: composer,
        title: eventTitle,
        startsAt: iso,
        location: eventLocation.trim() || undefined,
        details: eventDetails.trim() || undefined,
        mentions,
      });
    }

    setSubmitting(false);
    if (res.error) {
      toast({ title: "Post failed", description: res.error.message, variant: "destructive" });
      return;
    }
    resetComposerAfterPost();
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
    const res = await updateCommunityPost(editPost.id, editBody, editTopic, {
      imageAltTexts: editImageAlts,
    });
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
      <PageShell variant="standard" className="mx-auto max-w-lg space-y-6">
        <PageHeader leading={<PageBackButton />} title="Feed" />
        <EmptyState
          title="Feed needs Supabase"
          description="Connect Supabase in your environment to use the community feed."
        />
      </PageShell>
    );
  }

  return (
    <div ref={feedPullAnchorRef} className="contents">
      <PageShell variant="standard" className="mx-auto max-w-lg space-y-6 pb-24">
        <PageHeader
          leading={<PageBackButton />}
          title="Feed"
          actions={
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-border/50 bg-card/70 px-2.5"
                disabled={refreshing || loading}
                onClick={() => void runRefresh()}
                aria-label="Refresh feed"
              >
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              </Button>
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

        <div
          className={cn(
            "flex justify-center overflow-hidden transition-[height,opacity,margin] duration-200 ease-out",
            refreshing || pullProgress > 0.04 ? "mb-1 h-5 opacity-100" : "h-0 opacity-0",
          )}
          aria-hidden
        >
          <RefreshCw
            aria-hidden
            className={cn("h-4 w-4 text-muted-foreground", refreshing && "animate-spin")}
            style={
              refreshing
                ? undefined
                : { transform: `rotate(${pullProgress * 240}deg)`, opacity: 0.4 + pullProgress * 0.6 }
            }
          />
        </div>

        <div className="surface-glass-muted space-y-3 rounded-2xl p-4">
          <div className="flex flex-col gap-3">
            <Tabs value={feedTab} onValueChange={(v) => setFeedTab(v as FeedTab)} className="w-full sm:max-w-md">
              <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl bg-muted/60 p-1 dark:bg-muted/40">
                <TabsTrigger value="following" className="rounded-lg data-[state=active]:bg-card/95">
                  Following
                </TabsTrigger>
                <TabsTrigger value="everyone" className="rounded-lg data-[state=active]:bg-card/95">
                  Everyone
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        <div
          className="-mx-1 flex gap-2 overflow-x-auto rounded-xl bg-background/40 px-2 py-2 dark:bg-background/25"
          role="group"
          aria-label="Filter feed by topic"
        >
          <Button
            type="button"
            variant={topicFilter === null ? "default" : "outline"}
            size="sm"
            className="shrink-0 rounded-full"
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
              className="shrink-0 whitespace-nowrap rounded-full"
              onClick={() => setTopicFilter(t.id)}
            >
              {t.label}
            </Button>
          ))}
        </div>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={feedSearch}
            onChange={(e) => setFeedSearch(e.target.value)}
            placeholder="Search loaded posts…"
            className="pl-9"
            aria-label="Search feed"
          />
        </div>
      </div>

      <Card variant="glass">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-base font-semibold">New post</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePost} className="space-y-3">
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
            {composerPostKind === "poll" ? (
              <div className="space-y-2 rounded-xl border border-border/50 bg-muted/20 p-3">
                <div className="space-y-1">
                  <Label htmlFor="feed-poll-q">Poll question</Label>
                  <Input
                    id="feed-poll-q"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value.slice(0, 500))}
                    placeholder="What do you want to ask?"
                    disabled={submitting || !user}
                    maxLength={500}
                  />
                </div>
                <p className="text-xs text-muted-foreground">2–6 options, each up to 500 characters.</p>
                <div className="space-y-2">
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={opt}
                        onChange={(e) =>
                          setPollOptions((prev) => {
                            const next = [...prev];
                            next[i] = e.target.value.slice(0, 500);
                            return next;
                          })
                        }
                        placeholder={`Option ${i + 1}`}
                        disabled={submitting || !user}
                        maxLength={500}
                        aria-label={`Poll option ${i + 1}`}
                      />
                      {pollOptions.length > 2 ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                          disabled={submitting || !user}
                          onClick={() => setPollOptions((prev) => prev.filter((_, j) => j !== i))}
                          aria-label={`Remove option ${i + 1}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  {pollOptions.length < MAX_POLL_OPTIONS ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={submitting || !user}
                      onClick={() => setPollOptions((prev) => [...prev, ""])}
                    >
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add option
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {composerPostKind === "event" ? (
              <div className="space-y-2 rounded-xl border border-border/50 bg-muted/20 p-3">
                <div className="space-y-1">
                  <Label htmlFor="feed-event-title">Event name</Label>
                  <Input
                    id="feed-event-title"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value.slice(0, 500))}
                    placeholder="Meetup title"
                    disabled={submitting || !user}
                    maxLength={500}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="feed-event-start">Starts</Label>
                  <Input
                    id="feed-event-start"
                    type="datetime-local"
                    value={eventStartsAt}
                    onChange={(e) => setEventStartsAt(e.target.value)}
                    disabled={submitting || !user}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="feed-event-loc">Location (optional)</Label>
                  <Input
                    id="feed-event-loc"
                    value={eventLocation}
                    onChange={(e) => setEventLocation(e.target.value.slice(0, 500))}
                    placeholder="Where?"
                    disabled={submitting || !user}
                    maxLength={500}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="feed-event-details">Details (optional)</Label>
                  <Textarea
                    id="feed-event-details"
                    value={eventDetails}
                    onChange={(e) => setEventDetails(e.target.value.slice(0, 2000))}
                    placeholder="More about the event…"
                    rows={3}
                    disabled={submitting || !user}
                    maxLength={2000}
                    className="surface-field rounded-xl"
                  />
                </div>
              </div>
            ) : null}
            <Textarea
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              placeholder={
                composerPostKind === "poll"
                  ? "Optional intro before the poll…"
                  : composerPostKind === "event"
                    ? "Optional intro before the event details…"
                    : "Share something on the feed…"
              }
              rows={3}
              maxLength={8000}
              disabled={submitting || !user}
              className="surface-field min-h-[5.5rem] rounded-xl"
            />
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Use <code className="rounded bg-muted px-1">@username</code> in the text to mention someone (public handles).
              </p>
              <p className="text-right text-xs text-muted-foreground tabular-nums sm:shrink-0">
                {composer.length} / 8000
              </p>
            </div>
            {composerPostKind === "standard" && composerPreviews.length > 0 && (
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
            {composerPostKind === "standard" && composerPreviews.length > 0 ? (
              <div className="space-y-2">
                {composerPreviews.map((src, i) => (
                  <div key={src} className="space-y-1">
                    <Label htmlFor={`feed-composer-alt-${i}`} className="text-xs">
                      Photo {i + 1} description (optional)
                    </Label>
                    <Input
                      id={`feed-composer-alt-${i}`}
                      value={composerImageAlts[i] ?? ""}
                      onChange={(e) =>
                        setComposerImageAlts((prev) => {
                          const next = [...prev];
                          next[i] = e.target.value.slice(0, 500);
                          return next;
                        })
                      }
                      placeholder="What’s in this image? Helps people using screen readers."
                      disabled={submitting || !user}
                      maxLength={500}
                    />
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                id="feed-composer-images"
                disabled={
                  submitting ||
                  !user ||
                  composerFiles.length >= MAX_POST_IMAGES ||
                  composerPostKind !== "standard"
                }
                onChange={(e) => onPickImages(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                  submitting ||
                  !user ||
                  composerFiles.length >= MAX_POST_IMAGES ||
                  composerPostKind !== "standard"
                }
                onClick={() => fileInputRef.current?.click()}
                aria-label="Add photos to post"
              >
                <ImagePlus className="h-4 w-4 mr-1.5" />
                Photo
              </Button>
              <Button
                type="button"
                variant={composerPostKind === "poll" ? "default" : "outline"}
                size="sm"
                disabled={submitting || !user}
                onClick={onPollModeClick}
                aria-pressed={composerPostKind === "poll"}
                aria-label={composerPostKind === "poll" ? "Switch to normal post" : "Add poll"}
              >
                <BarChart2 className="h-4 w-4 mr-1.5" />
                Poll
              </Button>
              <Button
                type="button"
                variant={composerPostKind === "event" ? "default" : "outline"}
                size="sm"
                disabled={submitting || !user}
                onClick={onEventModeClick}
                aria-pressed={composerPostKind === "event"}
                aria-label={composerPostKind === "event" ? "Switch to normal post" : "Add event"}
              >
                <Calendar className="h-4 w-4 mr-1.5" />
                Event
              </Button>
              <InlineInfoHint
                ariaLabel="Photo limits for posts"
                content={`Up to ${MAX_POST_IMAGES} photos per post, 5MB each.`}
              />
              <Button type="submit" size="sm" className="ml-auto" disabled={submitting || !composerCanSubmit}>
                <Send className="h-4 w-4 mr-1.5" />
                Post
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <FeedLoadingSkeleton rows={4} />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="Nothing here yet"
          description={
            feedTab === "following"
              ? topicFilter
                ? "No posts in this topic from people you follow yet. Try All topics or follow more profiles."
                : "No posts from people you follow yet. Follow profiles from the Everyone tab, or post something yourself."
              : topicFilter
                ? "No posts in this topic yet. Try another topic or be the first to post here."
                : "No posts yet. Be the first to post."
          }
        />
      ) : filteredPosts.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matches"
          description="Nothing in the posts loaded so far matches your search. Clear the search box or pull to load more, then try again."
        />
      ) : (
        <ul className="space-y-3">
          {filteredPosts.map((p) => {
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
                    if (p.post_kind !== "standard") return;
                    setEditPost(p);
                    setEditBody(p.body);
                    setEditTopic(p.topic);
                    setEditImageAlts([...p.image_alt_texts]);
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
          {editPost && editPost.image_urls.length > 0 ? (
            <div className="max-h-48 space-y-2 overflow-y-auto">
              <p className="text-xs font-medium text-foreground">Photo descriptions</p>
              {editPost.image_urls.map((_, i) => (
                <div key={editPost.id + String(i)} className="space-y-1">
                  <Label htmlFor={`edit-alt-${i}`} className="text-xs">
                    Photo {i + 1}
                  </Label>
                  <Input
                    id={`edit-alt-${i}`}
                    value={editImageAlts[i] ?? ""}
                    onChange={(e) =>
                      setEditImageAlts((prev) => {
                        const next = [...prev];
                        next[i] = e.target.value.slice(0, 500);
                        return next;
                      })
                    }
                    maxLength={500}
                    disabled={editBusy}
                  />
                </div>
              ))}
            </div>
          ) : null}
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
    </div>
  );
}
