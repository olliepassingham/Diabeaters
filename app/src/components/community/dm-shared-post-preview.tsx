import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { fetchCommunityPostById, getPostImageSignedUrls, type CommunityPostRow } from "@/lib/community";
import { getProfilesByIds } from "@/lib/profile";
import { cn } from "@/lib/utils";

function shortAuthorId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

type Props = {
  postId: string;
  className?: string;
};

/**
 * Compact feed post card for DM bubbles (loads post + author via existing APIs).
 */
export function DmSharedPostPreview({ postId, className }: Props) {
  const [post, setPost] = useState<CommunityPostRow | null>(null);
  const [authorName, setAuthorName] = useState<string | null>(null);
  const [authorAvatar, setAuthorAvatar] = useState<string | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setUnavailable(false);
    setPost(null);
    setAuthorName(null);
    setAuthorAvatar(null);
    setThumbUrl(null);

    void (async () => {
      const res = await fetchCommunityPostById(postId);
      if (cancelled) return;
      setLoading(false);
      if (res.error || !res.data) {
        setUnavailable(true);
        return;
      }
      const row = res.data;
      setPost(row);

      const prof = await getProfilesByIds([row.author_id]);
      if (cancelled) return;
      const p = prof.get(row.author_id);
      setAuthorName(p?.full_name?.trim() || shortAuthorId(row.author_id));
      setAuthorAvatar(p?.avatar_url ?? null);

      const paths = row.image_urls ?? [];
      if (paths.length > 0) {
        const urls = await getPostImageSignedUrls(paths.slice(0, 1));
        if (!cancelled && urls[0]) setThumbUrl(urls[0]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (loading) {
    return (
      <div
        className={cn("h-24 animate-pulse rounded-lg bg-muted/80", className)}
        aria-hidden
      />
    );
  }

  if (unavailable || !post) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border/60 bg-background px-3 py-2 text-xs text-muted-foreground",
          className,
        )}
      >
        Post unavailable
      </div>
    );
  }

  const name = authorName ?? shortAuthorId(post.author_id);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border/60 bg-background text-left text-foreground shadow-sm",
        className,
      )}
    >
      <Link
        href={`/community/post/${post.id}`}
        className="block p-2.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex gap-2">
          <CommunityAuthorAvatar size="sm" displayName={name} avatarPath={authorAvatar} />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-xs font-medium text-foreground">{name}</p>
            {post.body.trim() ? (
              <p className="line-clamp-2 text-xs text-muted-foreground">{post.body.trim()}</p>
            ) : (
              <p className="text-xs italic text-muted-foreground">Photo</p>
            )}
            <span className="text-xs font-medium text-primary">Open post</span>
          </div>
          {thumbUrl ? (
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted/40">
              <img
                src={thumbUrl}
                alt={post.image_alt_texts[0]?.trim() || "Post photo"}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          ) : null}
        </div>
      </Link>
    </div>
  );
}
