import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { FeedPostCard } from "@/components/community/feed-post-card";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  COMMUNITY_TOPICS,
  DEFAULT_COMMUNITY_TOPIC,
  deleteCommunityComment,
  deleteCommunityPost,
  fetchCommentsForPost,
  fetchCommunityPostById,
  insertCommunityComment,
  submitContentReport,
  togglePostLike,
  updateCommunityPost,
  type CommunityPostCommentRow,
  type CommunityPostRow,
  type CommunityTopicId,
} from "@/lib/community";
import { getProfilesByIds } from "@/lib/profile";
import { isSupabaseConfigured } from "@/lib/supabase";

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

type AuthorMeta = { name: string; avatar_url: string | null; public_handle: string | null };

export default function CommunityPostPage() {
  const [, params] = useRoute("/community/post/:postId");
  const postId = params?.postId ?? null;
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [post, setPost] = useState<CommunityPostRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [authorMeta, setAuthorMeta] = useState<Record<string, AuthorMeta>>({});
  const [expanded, setExpanded] = useState(true);
  const [comments, setComments] = useState<CommunityPostCommentRow[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: "post" | "comment"; id: string } | null>(
    null,
  );
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [deletePostBusy, setDeletePostBusy] = useState(false);
  const [editPost, setEditPost] = useState<CommunityPostRow | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editTopic, setEditTopic] = useState<CommunityTopicId>(DEFAULT_COMMUNITY_TOPIC);
  const [editBusy, setEditBusy] = useState(false);

  const loadPost = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    setNotFound(false);
    const res = await fetchCommunityPostById(postId);
    if (res.error) {
      toast({
        title: "Could not load post",
        description: res.error.message,
        variant: "destructive",
      });
      setPost(null);
      setNotFound(true);
      setLoading(false);
      return;
    }
    if (!res.data) {
      setPost(null);
      setNotFound(true);
      setLoading(false);
      return;
    }
    setPost(res.data);
    setLoading(false);
  }, [postId, toast]);

  useEffect(() => {
    void loadPost();
  }, [loadPost]);

  const loadComments = useCallback(async () => {
    if (!postId) return;
    setLoadingComments(true);
    const res = await fetchCommentsForPost(postId);
    setLoadingComments(false);
    if (res.error) {
      toast({ title: "Comments", description: res.error.message, variant: "destructive" });
      return;
    }
    setComments(res.data ?? []);
  }, [postId, toast]);

  useEffect(() => {
    if (!post?.id) return;
    void loadComments();
  }, [post?.id, loadComments]);

  useEffect(() => {
    if (!post) {
      setAuthorMeta({});
      return;
    }
    const ids = new Set<string>([post.author_id]);
    for (const c of comments) ids.add(c.author_id);
    const list = [...ids];
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
  }, [post, comments]);

  function metaFor(authorId: string): AuthorMeta {
    return authorMeta[authorId] ?? { name: shortId(authorId), avatar_url: null, public_handle: null };
  }

  async function handleToggleLike(pid: string, currentlyLiked: boolean) {
    if (!user || !post || pid !== post.id) return;
    setPost({
      ...post,
      liked_by_me: !currentlyLiked,
      like_count: Math.max(0, post.like_count + (currentlyLiked ? -1 : 1)),
    });
    const res = await togglePostLike(pid, currentlyLiked);
    if (res.error) {
      setPost({
        ...post,
        liked_by_me: currentlyLiked,
        like_count: Math.max(0, post.like_count + (currentlyLiked ? 1 : -1)),
      });
      toast({ title: "Could not update like", description: res.error.message, variant: "destructive" });
    }
  }

  async function submitComment() {
    if (!postId || !post) return;
    const text = commentDraft.trim();
    if (!text) return;
    const res = await insertCommunityComment(postId, text);
    if (res.error) {
      toast({ title: "Comment failed", description: res.error.message, variant: "destructive" });
      return;
    }
    setCommentDraft("");
    if (res.data) {
      setComments((prev) => [...prev, res.data!]);
      setPost((p) => (p ? { ...p, comment_count: p.comment_count + 1 } : p));
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
    if (!deletePostId || !post || deletePostId !== post.id) return;
    setDeletePostBusy(true);
    const res = await deleteCommunityPost(deletePostId);
    setDeletePostBusy(false);
    if (res.error) {
      toast({ title: "Could not delete post", description: res.error.message, variant: "destructive" });
      return;
    }
    setDeletePostId(null);
    toast({ title: "Post deleted" });
    setLocation("/community");
  }

  async function saveEditPost() {
    if (!editPost || !post) return;
    setEditBusy(true);
    const res = await updateCommunityPost(editPost.id, editBody, editTopic);
    setEditBusy(false);
    if (res.error) {
      toast({ title: "Could not save", description: res.error.message, variant: "destructive" });
      return;
    }
    if (res.data) setPost(res.data);
    setEditPost(null);
    toast({ title: "Post updated" });
  }

  async function handleDeleteComment(commentId: string) {
    if (!postId) return;
    const res = await deleteCommunityComment(commentId);
    if (res.error) {
      toast({ title: "Could not delete comment", description: res.error.message, variant: "destructive" });
      return;
    }
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    setPost((p) => (p ? { ...p, comment_count: Math.max(0, p.comment_count - 1) } : p));
  }

  function replyFocus() {
    setExpanded(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => commentInputRef.current?.focus());
    });
  }

  if (!isSupabaseConfigured()) {
    return (
      <PageShell variant="standard" className="max-w-lg mx-auto space-y-4">
        <PageHeader leading={<PageBackButton />} title="Post" />
        <p className="text-sm text-muted-foreground">Connect Supabase in your environment to use Feed.</p>
      </PageShell>
    );
  }

  if (!postId) {
    return (
      <PageShell variant="standard" className="max-w-lg mx-auto space-y-4">
        <PageHeader leading={<PageBackButton />} title="Post" />
        <p className="text-sm text-muted-foreground">Invalid link.</p>
      </PageShell>
    );
  }

  if (loading) {
    return (
      <PageShell variant="standard" className="max-w-lg mx-auto space-y-4">
        <PageHeader leading={<PageBackButton />} title="Post" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </PageShell>
    );
  }

  if (notFound || !post) {
    return (
      <PageShell variant="standard" className="max-w-lg mx-auto space-y-4">
        <PageHeader leading={<PageBackButton />} title="Post" />
        <p className="text-sm text-muted-foreground">This post isn’t available or was removed.</p>
        <Button variant="outline" asChild>
          <Link href="/community">Back to Feed</Link>
        </Button>
      </PageShell>
    );
  }

  const m = metaFor(post.author_id);

  return (
    <PageShell variant="standard" className="max-w-lg mx-auto space-y-4 pb-24">
      <PageHeader
        leading={<PageBackButton />}
        title="Post"
        description="Shared from the community feed"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/community">Feed</Link>
          </Button>
        }
      />

      <FeedPostCard
        post={post}
        viewerId={user?.id}
        authorDisplayName={m.name}
        authorPublicHandle={m.public_handle}
        authorAvatarPath={m.avatar_url}
        expanded={expanded}
        loadingComments={loadingComments}
        comments={comments}
        commentDraft={commentDraft}
        onCommentDraftChange={setCommentDraft}
        commentInputRef={(el) => {
          commentInputRef.current = el;
        }}
        onToggleComments={() => setExpanded((e) => !e)}
        onReplyFocus={replyFocus}
        onLike={() => void handleToggleLike(post.id, post.liked_by_me)}
        onSubmitComment={() => void submitComment()}
        onReportPost={() => openReport("post", post.id)}
        onReportComment={(cid) => openReport("comment", cid)}
        commentMeta={metaFor}
        isAuthor={Boolean(user?.id && user.id === post.author_id)}
        onMenuEdit={() => {
          setEditPost(post);
          setEditBody(post.body);
          setEditTopic(post.topic);
        }}
        onMenuDelete={() => setDeletePostId(post.id)}
        onDeleteComment={(cid) => void handleDeleteComment(cid)}
        onLikersLoaded={({ visibleCount }) => {
          setPost((prev) =>
            prev ? { ...prev, like_count: Math.max(prev.like_count, visibleCount) } : prev,
          );
        }}
      />

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
            <Label htmlFor="post-edit-topic" className="text-sm">
              Topic
            </Label>
            <Select
              value={editTopic}
              onValueChange={(v) => setEditTopic(v as CommunityTopicId)}
              disabled={editBusy}
            >
              <SelectTrigger id="post-edit-topic" className="w-full">
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
