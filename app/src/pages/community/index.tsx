import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Flag, ImagePlus, Loader2, MessageCircle, Send, Settings, X } from "lucide-react";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { CommunityPostImageGrid } from "@/components/community/community-post-image-grid";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  fetchCommentsForPost,
  fetchCommunityPostsFromFollowingPage,
  fetchCommunityPostsPage,
  insertCommunityComment,
  insertCommunityPost,
  MAX_POST_IMAGES,
  submitContentReport,
  type CommunityPostCommentRow,
  type CommunityPostRow,
} from "@/lib/community";
import { getProfilesByIds } from "@/lib/profile";
import { isSupabaseConfigured } from "@/lib/supabase";
import { formatDistanceToNow } from "date-fns";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

type AuthorMeta = { name: string; avatar_url: string | null };

type FeedTab = "everyone" | "following";

const PAGE_SIZE = 20;

export default function CommunityHomePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [feedTab, setFeedTab] = useState<FeedTab>("everyone");
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const urls = composerFiles.map((f) => URL.createObjectURL(f));
    setComposerPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [composerFiles]);

  const refresh = useCallback(async () => {
    const res =
      feedTab === "everyone"
        ? await fetchCommunityPostsPage(PAGE_SIZE, null)
        : await fetchCommunityPostsFromFollowingPage(PAGE_SIZE, null);
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
    setLoading(false);
  }, [toast, feedTab]);

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
        ? await fetchCommunityPostsPage(PAGE_SIZE, {
            created_at: last.created_at,
            id: last.id,
          })
        : await fetchCommunityPostsFromFollowingPage(PAGE_SIZE, {
            created_at: last.created_at,
            id: last.id,
          });
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
  }, [feedTab, hasMore, loadingMore, loading, toast]);

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
        };
      }
      setAuthorMeta(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [posts, commentsByPost]);

  function metaFor(authorId: string): AuthorMeta {
    return authorMeta[authorId] ?? { name: shortId(authorId), avatar_url: null };
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
    if (res.data) setPosts((prev) => [res.data!, ...prev]);
    toast({ title: "Posted" });
  }

  async function toggleComments(postId: string) {
    setExpanded((prev) => ({ ...prev, [postId]: !prev[postId] }));
    if (commentsByPost[postId] || loadingComments[postId]) return;
    setLoadingComments((prev) => ({ ...prev, [postId]: true }));
    const res = await fetchCommentsForPost(postId);
    setLoadingComments((prev) => ({ ...prev, [postId]: false }));
    if (res.error) {
      toast({ title: "Comments", description: res.error.message, variant: "destructive" });
      return;
    }
    setCommentsByPost((prev) => ({ ...prev, [postId]: res.data ?? [] }));
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

      <Tabs value={feedTab} onValueChange={(v) => setFeedTab(v as FeedTab)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="following">Following</TabsTrigger>
          <TabsTrigger value="everyone">Everyone</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">New post</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePost} className="space-y-2">
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
              <span className="text-xs text-muted-foreground">
                Up to {MAX_POST_IMAGES} photos, 5MB each
              </span>
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
            ? "No posts from people you follow yet. Follow profiles from the Everyone tab, or post something yourself."
            : "No posts yet. Be the first to post."}
        </p>
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => {
            const m = metaFor(p.author_id);
            const canReportPost = user && user.id !== p.author_id;
            return (
              <li key={p.id}>
                <Card>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex gap-3">
                      <CommunityAuthorAvatar
                        displayName={m.name}
                        avatarPath={m.avatar_url}
                        profileHref={`/community/profile/${p.author_id}`}
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                          <Link
                            href={`/community/profile/${p.author_id}`}
                            className="font-medium text-foreground truncate hover:underline underline-offset-2"
                          >
                            {m.name}
                          </Link>
                          <span className="flex shrink-0 items-center gap-1.5">
                            {canReportPost && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-muted-foreground"
                                onClick={() => openReport("post", p.id)}
                                aria-label="Report post"
                              >
                                <Flag className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <span title={p.created_at}>{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</span>
                          </span>
                        </div>
                        {p.body.trim().length > 0 ? (
                          <p className="text-sm whitespace-pre-wrap">{p.body}</p>
                        ) : null}
                        <CommunityPostImageGrid paths={p.image_urls} />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => void toggleComments(p.id)}
                        >
                          {expanded[p.id] ? "Hide comments" : "Comments"}
                        </Button>
                        {expanded[p.id] && (
                          <div className="border-t border-border/60 pt-3 space-y-2">
                            {loadingComments[p.id] ? (
                              <p className="text-xs text-muted-foreground">Loading comments…</p>
                            ) : (
                              <ul className="space-y-2">
                                {(commentsByPost[p.id] ?? []).map((c) => {
                                  const cm = metaFor(c.author_id);
                                  const canReportComment = user && user.id !== c.author_id;
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
                                          <Link
                                            href={`/community/profile/${c.author_id}`}
                                            className="text-xs font-medium text-foreground hover:underline underline-offset-2"
                                          >
                                            {cm.name}
                                          </Link>
                                          {canReportComment && (
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 shrink-0 px-1 text-muted-foreground"
                                              onClick={() => openReport("comment", c.id)}
                                              aria-label="Report comment"
                                            >
                                              <Flag className="h-3 w-3" />
                                            </Button>
                                          )}
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
                                rows={2}
                                placeholder="Write a comment…"
                                value={commentDrafts[p.id] ?? ""}
                                onChange={(e) =>
                                  setCommentDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))
                                }
                                maxLength={4000}
                              />
                              <Button type="button" size="sm" onClick={() => void submitComment(p.id)}>
                                Reply
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
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
    </PageShell>
  );
}
