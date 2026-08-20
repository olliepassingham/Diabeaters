import { Link } from "wouter";
import { useState } from "react";
import { Flag, Heart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { FeedMediaLightbox } from "@/components/community/feed-media-lightbox";
import { renderBodyWithMentions } from "@/components/community/render-body-with-mentions";
import { formatDistanceToNow } from "date-fns";
import { AI_ASSISTANT_NAME } from "@/lib/ai-coach/persona";
import { displayAuthorName, type FeedAuthorMeta } from "@/lib/community/feed-author-meta";
import { cn } from "@/lib/utils";

const BEATIE_FEED_AVATAR_FALLBACK_SRC = "/branding/diabeaters-mark.png";

export type FeedCommentItemProps = {
  commentId: string;
  authorId: string;
  body: string;
  createdAt: string;
  mentionMap: Record<string, string> | null | undefined;
  imageUrl?: string | null;
  imageStoragePath?: string | null;
  meta: FeedAuthorMeta;
  beatieFeedBotUserId?: string | null;
  viewerId?: string;
  likeCount?: number;
  likedByMe?: boolean;
  canLike?: boolean;
  onLike?: () => void;
  onReport?: () => void;
  onDelete?: () => void;
};

export function FeedCommentItem({
  commentId,
  authorId,
  body,
  createdAt,
  mentionMap,
  imageUrl,
  imageStoragePath,
  meta,
  beatieFeedBotUserId,
  viewerId,
  likeCount = 0,
  likedByMe = false,
  canLike = false,
  onLike,
  onReport,
  onDelete,
}: FeedCommentItemProps) {
  const isBeatie = Boolean(beatieFeedBotUserId && authorId === beatieFeedBotUserId);
  const displayName = displayAuthorName(meta, authorId, beatieFeedBotUserId);
  const canReport = Boolean(viewerId && viewerId !== authorId && onReport);
  const canDelete = Boolean(viewerId && viewerId === authorId && onDelete);
  const showLikeRow = canLike || likeCount > 0;
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const bodyText = body.trim();
  const showImage = Boolean(imageUrl);
  const imageFailed = Boolean(imageStoragePath && !imageUrl);

  return (
    <li
      className={cn("flex gap-2.5 rounded-2xl px-1 py-2", isBeatie && "bg-primary/[0.05] px-2.5")}
      data-testid={`feed-comment-${commentId}`}
    >
      <CommunityAuthorAvatar
        size="sm"
        displayName={isBeatie ? AI_ASSISTANT_NAME : displayName}
        avatarPath={meta.avatar_url}
        profileHref={isBeatie && beatieFeedBotUserId ? `/community/profile/${beatieFeedBotUserId}` : `/community/profile/${authorId}`}
        fallbackSrc={isBeatie ? BEATIE_FEED_AVATAR_FALLBACK_SRC : undefined}
        className="!h-9 !w-9 shrink-0"
      />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            {meta.loading ? (
              <Skeleton className="mb-1 h-3 w-24 rounded" />
            ) : null}
            <p className="text-[13px] leading-snug text-foreground/90 whitespace-pre-wrap">
              {!meta.loading ? (
                <Link
                  href={`/community/profile/${authorId}`}
                  className="mr-1.5 font-semibold text-foreground hover:underline underline-offset-2"
                >
                  {displayName}
                </Link>
              ) : null}
              {isBeatie ? (
                <Badge
                  variant="outline"
                  className="mr-1.5 border-primary/35 bg-transparent px-1 py-0 align-middle text-[9px] font-medium leading-none text-primary"
                >
                  AI coach
                </Badge>
              ) : null}
              {bodyText ? renderBodyWithMentions(body, mentionMap ?? {}) : null}
            </p>
            {showImage ? (
              <>
                <button
                  type="button"
                  className="mt-1.5 block max-w-[min(100%,16rem)] overflow-hidden rounded-xl text-left"
                  onClick={() => setLightboxOpen(true)}
                  aria-label="View comment photo"
                >
                  <img
                    src={imageUrl!}
                    alt=""
                    className="max-h-56 w-full object-cover"
                  />
                </button>
                <FeedMediaLightbox open={lightboxOpen} onOpenChange={setLightboxOpen} slideLabel="Comment photo">
                  <img src={imageUrl!} alt="" className="max-h-[90vh] w-auto max-w-full object-contain" />
                </FeedMediaLightbox>
              </>
            ) : null}
            {imageFailed ? (
              <p className="mt-1 text-[11px] text-muted-foreground">Could not load image</p>
            ) : null}
          </div>
          <span className="flex shrink-0 items-center">
            {canReport ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 -my-1 text-muted-foreground"
                onClick={onReport}
                aria-label="Report comment"
              >
                <Flag className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 -my-1 text-muted-foreground hover:text-destructive"
                onClick={onDelete}
                aria-label="Delete comment"
                data-testid={`button-delete-comment-${commentId}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </span>
        </div>
        <div className="flex items-center gap-2.5 pt-0.5">
          <span className="text-[11px] text-muted-foreground" title={createdAt}>
            {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
          </span>
          {showLikeRow ? (
            canLike ? (
              <button
                type="button"
                className={cn(
                  "inline-flex min-h-8 items-center gap-1 rounded-full px-1 text-[11px] font-medium transition-colors",
                  likedByMe ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={likedByMe}
                aria-label={likedByMe ? "Unlike comment" : "Like comment"}
                onClick={onLike}
              >
                <Heart className={cn("h-3.5 w-3.5", likedByMe && "fill-current")} />
                {likeCount > 0 ? <span>{likeCount}</span> : null}
              </button>
            ) : likeCount > 0 ? (
              <span className="inline-flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
                <Heart className="h-3.5 w-3.5" />
                {likeCount}
              </span>
            ) : null
          ) : null}
        </div>
      </div>
    </li>
  );
}
