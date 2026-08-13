import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { FeedPostCard } from "@/components/community/feed-post-card";
import { PostEditImagesField } from "@/components/community/post-edit-images-field";
import { StoryCreateSheet } from "@/components/community/story-create-sheet";
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
import { useCommunityTopicOrder } from "@/hooks/use-community-topic-order";
import { usePostEditImages } from "@/hooks/use-post-edit-images";
import { useSharePostToStory } from "@/hooks/use-share-post-to-story";
import { useAuth } from "@/lib/auth-context";
import { canEngageWithCommunityFeed, COMMUNITY_FEED_ENGAGE_REQUIRED_MESSAGE, useProfile } from "@/lib/profile";
import {
  DEFAULT_COMMUNITY_TOPIC,
  deleteCommunityComment,
  deleteCommunityPost,
  fetchCommentsForPost,
  fetchCommunityPostById,
  insertCommunityComment,
  submitContentReport,
  togglePostLike,
  toggleCommentLike,
  toggleEventInterest,
  togglePostSave,
  updateCommunityPost,
  type CommunityPostCommentRow,
  type CommunityPostRow,
  type CommunityTopicId,
} from "@/lib/community";
import { getBeatieFeedBotUserIdFromEnv } from "@/lib/ai-feed-reply/config";
import { requestAiFeedReply } from "@/lib/ai-feed-reply/client";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  authorMetaFromPostPreview,
  authorIdsNeedingProfileFetch,
  displayAuthorName,
  fetchAuthorMetaMap,
  type FeedAuthorMeta,
} from "@/lib/community/feed-author-meta";

export default function CommunityPostPage() {
  const [, params] = useRoute("/community/post/:postId");
  const postId = params?.postId ?? null;
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const orderedTopics = useCommunityTopicOrder();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const shareToStory = useSharePostToStory();

  const [post, setPost] = useState<CommunityPostRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [authorMeta, setAuthorMeta] = useState<Record<string, FeedAuthorMeta>>({});
  const [expanded, setExpanded] = useState(true);
  const [comments, setComments] = useState<CommunityPostCommentRow[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const beatieFeedBotUserId = useMemo(() => getBeatieFeedBotUserIdFromEnv(), []);
  const [askBeatieBusy, setAskBeatieBusy] = useState(false);

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
  const editImages = usePostEditImages();
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

  useLayoutEffect(() => {
    if (!post) return;
    const seeded = authorMetaFromPostPreview(post);
    if (!seeded) return;
    setAuthorMeta((old) => ({ ...old, [post.author_id]: seeded }));
  }, [post]);

  useEffect(() => {
    if (!post) {
      setAuthorMeta({});
      return;
    }
    const ids = new Set<string>([post.author_id]);
    for (const c of comments) ids.add(c.author_id);
    const list = authorIdsNeedingProfileFetch(ids, post ? [post] : [], beatieFeedBotUserId);
    if (list.length === 0 && !(beatieFeedBotUserId && ids.has(beatieFeedBotUserId))) return;
    let cancelled = false;
    void (async () => {
      const fetched = await fetchAuthorMetaMap([...ids], post ? [post] : [], beatieFeedBotUserId);
      if (cancelled) return;
      setAuthorMeta((old) => ({ ...old, ...fetched }));
    })();
    return () => {
      cancelled = true;
    };
  }, [post, comments, beatieFeedBotUserId]);

  function metaFor(authorId: string): FeedAuthorMeta {
    const m = authorMeta[authorId];
    if (m) {
      return { ...m, name: displayAuthorName(m, authorId, beatieFeedBotUserId) };
    }
    return { name: "", avatar_url: null, public_handle: null, loading: true };
  }

  const canEngageWithFeed = !profileLoading && canEngageWithCommunityFeed(profile);

  async function handleToggleLike(pid: string, currentlyLiked: boolean) {
    if (!user || !post || pid !== post.id) return;
    if (!canEngageWithFeed) {
      toast({
        title: "Set up your public profile",
        description: COMMUNITY_FEED_ENGAGE_REQUIRED_MESSAGE,
        variant: "destructive",
      });
      return;
    }
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

  async function handleToggleInterest(pid: string, currentlyInterested: boolean) {
    if (!user || !post || pid !== post.id || post.post_kind !== "event") return;
    if (!canEngageWithFeed) {
      toast({
        title: "Set up your public profile",
        description: COMMUNITY_FEED_ENGAGE_REQUIRED_MESSAGE,
        variant: "destructive",
      });
      return;
    }
    setPost({
      ...post,
      interested_by_me: !currentlyInterested,
      interested_count: Math.max(0, post.interested_count + (currentlyInterested ? -1 : 1)),
    });
    const res = await toggleEventInterest(pid, currentlyInterested);
    if (res.error) {
      setPost({
        ...post,
        interested_by_me: currentlyInterested,
        interested_count: Math.max(0, post.interested_count + (currentlyInterested ? 1 : -1)),
      });
      toast({ title: "Could not update interest", description: res.error.message, variant: "destructive" });
    }
  }

  async function handleToggleSave(pid: string, currentlySaved: boolean) {
    if (!user || !post || pid !== post.id) return;
    setPost({ ...post, saved_by_me: !currentlySaved });
    const res = await togglePostSave(pid, currentlySaved);
    if (res.error) {
      setPost({ ...post, saved_by_me: currentlySaved });
      toast({ title: "Could not update bookmark", description: res.error.message, variant: "destructive" });
    }
  }

  async function handleLikeComment(commentId: string, currentlyLiked: boolean) {
    if (!user || !post) return;
    if (!canEngageWithFeed) {
      toast({
        title: "Set up your public profile",
        description: COMMUNITY_FEED_ENGAGE_REQUIRED_MESSAGE,
        variant: "destructive",
      });
      return;
    }
    const prev = comments;
    setComments((list) =>
      list.map((c) =>
        c.id === commentId
          ? {
              ...c,
              liked_by_me: !currentlyLiked,
              like_count: Math.max(0, c.like_count + (currentlyLiked ? -1 : 1)),
            }
          : c,
      ),
    );
    const res = await toggleCommentLike(commentId, currentlyLiked, post.id);
    if (res.error) {
      setComments(prev);
      toast({ title: "Could not update like", description: res.error.message, variant: "destructive" });
    }
  }

  async function submitComment() {
    if (!postId || !post) return;
    if (!canEngageWithFeed) {
      toast({
        title: "Set up your public profile",
        description: COMMUNITY_FEED_ENGAGE_REQUIRED_MESSAGE,
        variant: "destructive",
      });
      return;
    }
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

  async function handleAskBeatie() {
    if (!postId || !post || !user) {
      toast({ title: "Sign in", description: "Log in to ask Beatie.", variant: "destructive" });
      return;
    }
    if (askBeatieBusy) return;
    setAskBeatieBusy(true);
    try {
      const res = await requestAiFeedReply(postId);
      if (res.ok) {
        setComments((prev) => [...prev, res.comment]);
        setPost((p) => (p ? { ...p, comment_count: p.comment_count + 1 } : p));
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
      toast({ title: "Ask Beatie did not run", description: desc, variant: "destructive" });
    } finally {
      setAskBeatieBusy(false);
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

  function closeEditPost() {
    setEditPost(null);
    editImages.reset();
  }

  async function saveEditPost() {
    if (!editPost || !post) return;
    if (!editImages.hasBodyOrImages(editBody)) {
      toast({
        title: "Add text or a photo",
        description: "Posts need some text or at least one photo.",
        variant: "destructive",
      });
      return;
    }
    setEditBusy(true);
    const res = await updateCommunityPost(editPost.id, editBody, editTopic, {
      keepImagePaths: editImages.keptPaths,
      addImageFiles: editImages.newFiles,
      imageAltTexts: editImages.imageAlts,
    });
    setEditBusy(false);
    if (res.error) {
      toast({ title: "Could not save", description: res.error.message, variant: "destructive" });
      return;
    }
    if (res.data) setPost(res.data);
    closeEditPost();
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
    <PageShell
      variant="standard"
      className="max-w-lg mx-auto space-y-4 pb-4"
    >
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
        canEngageWithFeed={canEngageWithFeed}
        authorDisplayName={m.name}
        authorLoading={Boolean(m.loading)}
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
        onEventInterest={
          post.post_kind === "event"
            ? () => void handleToggleInterest(post.id, post.interested_by_me)
            : undefined
        }
        onSavePost={() => void handleToggleSave(post.id, post.saved_by_me)}
        onSubmitComment={() => void submitComment()}
        onReportPost={() => openReport("post", post.id)}
        onReportComment={(cid) => openReport("comment", cid)}
        onLikeComment={(commentId, currentlyLiked) => void handleLikeComment(commentId, currentlyLiked)}
        commentMeta={metaFor}
        isAuthor={Boolean(user?.id && user.id === post.author_id)}
        onMenuEdit={() => {
          if (post.post_kind !== "standard") return;
          setEditPost(post);
          setEditBody(post.body);
          setEditTopic(post.topic);
          editImages.loadFromPost(post.image_urls, post.image_alt_texts ?? []);
        }}
        onMenuDelete={() => setDeletePostId(post.id)}
        onDeleteComment={(cid) => void handleDeleteComment(cid)}
        beatieFeedBotUserId={beatieFeedBotUserId}
        onAskBeatie={beatieFeedBotUserId ? () => void handleAskBeatie() : undefined}
        askBeatieBusy={askBeatieBusy}
        onLikersLoaded={({ visibleCount }) => {
          setPost((prev) =>
            prev ? { ...prev, like_count: Math.max(prev.like_count, visibleCount) } : prev,
          );
        }}
        onAddToStory={(p) => void shareToStory.sharePostToStory(p)}
        addToStoryBusy={shareToStory.busyPostId === post.id}
      />

      <StoryCreateSheet
        open={shareToStory.open}
        prefillFile={shareToStory.prefillFile}
        onOpenChange={shareToStory.onOpenChange}
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

      <Dialog open={editPost != null} onOpenChange={(o) => !o && !editBusy && closeEditPost()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit post</DialogTitle>
            <DialogDescription>Update your text, topic, and photos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
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
                  {orderedTopics.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post-edit-body" className="text-sm">
                Post
              </Label>
              <Textarea
                id="post-edit-body"
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={6}
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
              onClick={() => void saveEditPost()}
              disabled={editBusy || !editImages.hasBodyOrImages(editBody)}
            >
              {editBusy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
