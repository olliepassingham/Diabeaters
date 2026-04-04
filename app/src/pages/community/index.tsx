import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { MessageCircle, Send, Settings } from "lucide-react";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  fetchCommentsForPost,
  fetchCommunityPosts,
  insertCommunityComment,
  insertCommunityPost,
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

export default function CommunityHomePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [feedTab, setFeedTab] = useState<FeedTab>("everyone");
  const [posts, setPosts] = useState<CommunityPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [composer, setComposer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [authorMeta, setAuthorMeta] = useState<Record<string, AuthorMeta>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, CommunityPostCommentRow[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});

  const refresh = useCallback(async () => {
    const res =
      feedTab === "everyone"
        ? await fetchCommunityPosts(40)
        : await fetchCommunityPostsFromFollowing(40);
    if (res.error) {
      toast({
        title: "Could not load posts",
        description: res.error.message,
        variant: "destructive",
      });
      setPosts([]);
    } else {
      setPosts(res.data ?? []);
    }
    setLoading(false);
  }, [toast, feedTab]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

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

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    const body = composer.trim();
    if (!body) return;
    setSubmitting(true);
    const res = await insertCommunityPost(body);
    setSubmitting(false);
    if (res.error) {
      toast({ title: "Post failed", description: res.error.message, variant: "destructive" });
      return;
    }
    setComposer("");
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

  if (!isSupabaseConfigured()) {
    return (
      <PageShell variant="standard" className="max-w-lg mx-auto space-y-4">
        <PageHeader leading={<PageBackButton />} title="Community" />
        <p className="text-sm text-muted-foreground">Connect Supabase in your environment to use Community.</p>
      </PageShell>
    );
  }

  return (
    <PageShell variant="standard" className="max-w-lg mx-auto space-y-4 pb-24">
      <PageHeader
        leading={<PageBackButton />}
        title="Community"
        description="Everyone signed in can see posts. Profile photos use each person’s account picture when their profile is visible."
        actions={
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" asChild>
              <Link href="/community/settings" aria-label="Community profile settings">
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
              placeholder="Share something with the community…"
              rows={3}
              maxLength={8000}
              disabled={submitting || !user}
            />
            <Button type="submit" size="sm" disabled={submitting || !composer.trim() || !user}>
              <Send className="h-4 w-4 mr-1.5" />
              Post
            </Button>
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
                          <span title={p.created_at} className="shrink-0">
                            {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{p.body}</p>
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
                                  return (
                                    <li key={c.id} className="flex gap-2 rounded-md bg-muted/40 px-2 py-2">
                                      <CommunityAuthorAvatar
                                        size="sm"
                                        displayName={cm.name}
                                        avatarPath={cm.avatar_url}
                                        profileHref={`/community/profile/${c.author_id}`}
                                      />
                                      <div className="min-w-0 flex-1">
                                        <Link
                                          href={`/community/profile/${c.author_id}`}
                                          className="text-xs font-medium text-foreground hover:underline underline-offset-2"
                                        >
                                          {cm.name}
                                        </Link>
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
                                onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))}
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
    </PageShell>
  );
}
