import { Link } from "wouter";
import { Flag, Heart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
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

  return (
    <li
      className={cn(
        "flex gap-2 rounded-lg border px-2 py-1.5 transition-colors",
        isBeatie
          ? "border-primary/20 bg-primary/[0.06]"
          : "border-border/35 bg-background/40",
      )}
      data-testid={`feed-comment-${commentId}`}
    >
      <CommunityAuthorAvatar
        size="sm"
        displayName={isBeatie ? AI_ASSISTANT_NAME : displayName}
        avatarPath={meta.avatar_url}
        profileHref={isBeatie && beatieFeedBotUserId ? `/community/profile/${beatieFeedBotUserId}` : `/community/profile/${authorId}`}
        fallbackSrc={isBeatie ? BEATIE_FEED_AVATAR_FALLBACK_SRC : undefined}
        className="!h-7 !w-7 shrink-0"
      />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center justify-between gap-1">
          <div className="min-w-0">
            {meta.loading ? (
              <Skeleton className="h-3 w-24 rounded" />
            ) : (
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0">
                <Link
                  href={`/community/profile/${authorId}`}
                  className="text-xs font-semibold text-foreground hover:underline underline-offset-2"
                >
                  {displayName}
                </Link>
                {isBeatie ? (
                  <Badge
                    variant="outline"
                    className="border-primary/35 bg-transparent px-1 py-0 text-[9px] font-medium leading-none text-primary"
                  >
                    AI coach
                  </Badge>
                ) : null}
                <span className="text-[10px] text-muted-foreground" title={createdAt}>
                  {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
                </span>
              </div>
            )}
          </div>
          <span className="flex shrink-0 items-center">
            {canReport ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 -my-1 text-muted-foreground"
                onClick={onReport}
                aria-label="Report comment"
              >
                <Flag className="h-3 w-3" />
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 -my-1 text-muted-foreground hover:text-destructive"
                onClick={onDelete}
                aria-label="Delete comment"
                data-testid={`button-delete-comment-${commentId}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            ) : null}
          </span>
        </div>
        <p className="text-[13px] leading-snug text-foreground/90 whitespace-pre-wrap">
          {renderBodyWithMentions(body, mentionMap ?? {})}
        </p>
        {showLikeRow ? (
          <div className="flex items-center gap-1 pt-0.5">
            {canLike ? (
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-1 py-0.5 text-[11px] transition-colors",
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
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
