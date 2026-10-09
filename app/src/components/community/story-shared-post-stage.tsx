import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Bookmark, Heart, Loader2, MessageSquare, Share2 } from "lucide-react";
import { Link } from "wouter";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { CommunityPostImageGrid } from "@/components/community/community-post-image-grid";
import { FeedEventCard } from "@/components/community/feed-event-card";
import { FeedLinkPreview } from "@/components/community/feed-link-preview";
import { FeedPollCard } from "@/components/community/feed-poll-card";
import { FeedPostVideo } from "@/components/community/feed-post-video";
import { renderBodyWithMentions } from "@/components/community/render-body-with-mentions";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import {
  fetchCommunityPostById,
  parseEventExtra,
  parsePollExtra,
  type CommunityPostRow,
} from "@/lib/community";
import { communityContentNoteHint, communityContentNoteLabel } from "@/lib/community/content-notes";
import { getFirstWhitelistedFeedLink } from "@/lib/community/link-whitelist";
import { communityTopicLabel } from "@/lib/community/topics";
import { getProfilesByIds } from "@/lib/profile";
import { cn } from "@/lib/utils";

type AuthorMeta = {
  id: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
};

type Props = {
  postId: string;
  className?: string;
  onOpenPost: () => void;
  onOpenAuthor: (authorId: string) => void;
};

/**
 * A reshared feed post inside a story. Same card as the feed: author, topic,
 * media, caption, and the action row, on the app canvas rather than a dark stage.
 */
export function StorySharedPostStage({ postId, className, onOpenPost, onOpenAuthor }: Props) {
  const { user } = useAuth();
  const [post, setPost] = useState<CommunityPostRow | null>(null);
  const [author, setAuthor] = useState<AuthorMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setPost(null);
    setAuthor(null);

    void (async () => {
      const res = await fetchCommunityPostById(postId);
      if (cancelled) return;
      if (res.error || !res.data) {
        setFailed(true);
        setLoading(false);
        return;
      }
      const row = res.data;
      setPost(row);

      const prof = await getProfilesByIds([row.author_id]);
      if (cancelled) return;
      const p = prof.get(row.author_id);
      setAuthor({
        id: row.author_id,
        name: p?.full_name?.trim() || "Member",
        handle: p?.public_handle?.trim().replace(/^@/, "") || null,
        avatarUrl: p?.avatar_url ?? null,
      });
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (loading) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center bg-background", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (failed || !post || !author) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center bg-background px-8", className)}>
        <p className="text-center text-sm text-muted-foreground">This post is no longer available.</p>
      </div>
    );
  }

  return (
    <div className={cn("h-full w-full overflow-y-auto bg-background", className)}>
      <div className="mx-auto flex min-h-full w-full max-w-lg flex-col px-3 py-[max(5.25rem,calc(env(safe-area-inset-top)+4.5rem))] pb-[max(7.5rem,calc(env(safe-area-inset-bottom)+5.5rem))]">
        <SharedFeedCard
          post={post}
          author={author}
          viewerId={user?.id}
          onOpenPost={onOpenPost}
          onOpenAuthor={onOpenAuthor}
        />
      </div>
    </div>
  );
}

function SharedFeedCard({
  post,
  author,
  viewerId,
  onOpenPost,
  onOpenAuthor,
}: {
  post: CommunityPostRow;
  author: AuthorMeta;
  viewerId: string | undefined;
  onOpenPost: () => void;
  onOpenAuthor: (authorId: string) => void;
}) {
  const eventExtra = post.post_kind === "event" ? parseEventExtra(post.post_extra) : null;
  const pollExtra = post.post_kind === "poll" ? parsePollExtra(post.post_extra) : null;
  const topicLabel = communityTopicLabel(post.topic);
  const contentNoteLabel = post.content_note ? communityContentNoteLabel(post.content_note) : null;
  const contentNoteHint = post.content_note ? communityContentNoteHint(post.content_note) : null;
  const previewLink = useMemo(() => getFirstWhitelistedFeedLink(post.body), [post.body]);
  const bodyText = (() => {
    const b = post.body.trim();
    if (b.length === 0) return null;
    if (pollExtra && b === pollExtra.question.trim()) return null;
    if (eventExtra && b === eventExtra.title.trim()) return null;
    return b;
  })();
  const hasFeedImages = !eventExtra && !post.video_url && post.image_urls.length > 0;
  const hasFeedVideo = !eventExtra && Boolean(post.video_url);
  const isMediaFirst = hasFeedVideo || hasFeedImages;

  return (
    <article
      className="my-auto w-full overflow-hidden rounded-3xl border border-border/40 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:bg-card/80 dark:shadow-none"
      data-testid="story-shared-post-card"
    >
      <div className="flex items-center gap-3 px-3.5 pb-2.5 pt-3 sm:px-4">
        <button
          type="button"
          className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={author.name}
          onClick={(e) => {
            e.stopPropagation();
            onOpenAuthor(author.id);
          }}
        >
          <CommunityAuthorAvatar
            displayName={author.name}
            avatarPath={author.avatarUrl}
            size="md"
            className="!h-11 !w-11"
          />
        </button>
        <div className="min-w-0 flex-1">
          <div className="space-y-0.5">
            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <Link
                href={`/community/profile/${post.author_id}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onOpenAuthor(author.id);
                }}
                className="truncate text-[15px] font-semibold leading-tight text-foreground hover:underline underline-offset-2"
              >
                {author.name}
              </Link>
              {author.handle ? (
                <span className="truncate text-[13px] text-muted-foreground">@{author.handle}</span>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] text-muted-foreground">
              <span className="inline-flex max-w-[10rem] truncate rounded-full bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium text-foreground/80">
                {topicLabel}
              </span>
              {contentNoteLabel ? (
                <>
                  <span aria-hidden>·</span>
                  <span
                    title={contentNoteHint ?? contentNoteLabel}
                    className="inline-flex max-w-[9rem] truncate rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-900 dark:text-amber-100"
                  >
                    {contentNoteLabel}
                  </span>
                </>
              ) : null}
              <span aria-hidden>·</span>
              <time title={post.created_at}>
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </time>
            </div>
          </div>
        </div>
      </div>

      {hasFeedVideo && post.video_url ? (
        <FeedPostVideo path={post.video_url} posterPath={post.video_poster_url} priority topicLabel={topicLabel} />
      ) : null}
      {hasFeedVideo ? (
        <div className="flex items-center gap-2 border-b border-border/30 px-3.5 py-2 text-[11px] text-muted-foreground sm:px-4">
          <span className="min-w-0 flex-1 leading-snug">Peer experience — not medical advice or dosing guidance.</span>
        </div>
      ) : null}
      {hasFeedImages ? (
        <CommunityPostImageGrid
          paths={post.image_urls}
          altTexts={post.image_alt_texts}
          variant="feed"
          priority
        />
      ) : null}

      {!isMediaFirst ? (
        <div className="space-y-2 px-3.5 pb-1 sm:px-4">
          {bodyText ? (
            <p className="whitespace-pre-wrap text-[15px] leading-[1.45] text-foreground">
              {renderBodyWithMentions(bodyText, post.mention_map)}
            </p>
          ) : null}
          {eventExtra ? (
            <FeedEventCard
              event={eventExtra}
              imagePaths={post.image_urls}
              imageAltTexts={post.image_alt_texts}
              interestedCount={post.interested_count}
              interestedByMe={post.interested_by_me}
            />
          ) : null}
          {pollExtra ? (
            <FeedPollCard
              postId={post.id}
              question={pollExtra.question}
              options={pollExtra.options}
              viewerId={viewerId}
            />
          ) : null}
          {previewLink ? <FeedLinkPreview href={previewLink} className="mt-1" /> : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-1 px-2 pb-2 pt-1 sm:px-3.5">
        <div className="flex min-w-0 items-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 w-11 p-0 text-foreground hover:text-foreground"
            aria-label={post.liked_by_me ? "Unlike" : "Like"}
            aria-pressed={post.liked_by_me}
            onClick={(e) => {
              e.stopPropagation();
              onOpenPost();
            }}
          >
            <Heart
              className={cn(
                "h-[22px] w-[22px] shrink-0",
                post.liked_by_me && "scale-105 fill-primary text-primary",
              )}
            />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 w-11 p-0 text-foreground hover:text-foreground"
            aria-label={`${post.comment_count} comment${post.comment_count === 1 ? "" : "s"}`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenPost();
            }}
          >
            <MessageSquare className="h-[22px] w-[22px] shrink-0" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 w-11 p-0 text-foreground hover:text-foreground"
            aria-label="Open post"
            onClick={(e) => {
              e.stopPropagation();
              onOpenPost();
            }}
          >
            <Share2 className="h-[21px] w-[21px] shrink-0" aria-hidden />
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-11 w-11 p-0 text-foreground hover:text-foreground"
          aria-pressed={post.saved_by_me}
          aria-label={post.saved_by_me ? "Remove bookmark" : "Save post"}
          onClick={(e) => {
            e.stopPropagation();
            onOpenPost();
          }}
        >
          <Bookmark
            className={cn("h-[22px] w-[22px] shrink-0", post.saved_by_me && "fill-primary text-primary")}
          />
        </Button>
      </div>

      {post.like_count > 0 ? (
        <button
          type="button"
          className="flex w-full items-center px-3.5 pb-0.5 text-left sm:px-4"
          onClick={(e) => {
            e.stopPropagation();
            onOpenPost();
          }}
        >
          <span className="text-sm font-semibold text-foreground">
            {post.like_count === 1 ? "1 like" : `${post.like_count} likes`}
          </span>
        </button>
      ) : null}

      {isMediaFirst && bodyText ? (
        <p className="px-3.5 pb-3 pt-1.5 text-sm leading-snug text-foreground sm:px-4">
          <button
            type="button"
            className="mr-1.5 font-semibold hover:underline underline-offset-2"
            onClick={(e) => {
              e.stopPropagation();
              onOpenAuthor(author.id);
            }}
          >
            {author.name}
          </button>
          <span className="whitespace-pre-wrap">{renderBodyWithMentions(bodyText, post.mention_map)}</span>
        </p>
      ) : (
        <div className="h-2" />
      )}

      {isMediaFirst && (eventExtra || pollExtra || previewLink) ? (
        <div className="space-y-2 px-3.5 pb-3 sm:px-4">
          {eventExtra ? (
            <FeedEventCard
              event={eventExtra}
              imagePaths={post.image_urls}
              imageAltTexts={post.image_alt_texts}
              interestedCount={post.interested_count}
              interestedByMe={post.interested_by_me}
            />
          ) : null}
          {pollExtra ? (
            <FeedPollCard
              postId={post.id}
              question={pollExtra.question}
              options={pollExtra.options}
              viewerId={viewerId}
            />
          ) : null}
          {previewLink ? <FeedLinkPreview href={previewLink} /> : null}
        </div>
      ) : null}
    </article>
  );
}
