import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Play } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  communityTopicLabel,
  getCachedPostMediaSignedUrl,
  getPostVideoSignedUrl,
  prefetchPostMediaSignedUrls,
  type CommunityPostRow,
} from "@/lib/community";
import { cn } from "@/lib/utils";

type Props = {
  posts: CommunityPostRow[];
  loading: boolean;
  className?: string;
};

function WatchLearnThumb({ post }: { post: CommunityPostRow }) {
  const path = post.video_url!;
  const [src, setSrc] = useState<string | null>(() => getCachedPostMediaSignedUrl(path));
  const author =
    post.author_preview?.full_name?.trim() ||
    (post.author_preview?.public_handle ? `@${post.author_preview.public_handle}` : "Member");
  const topic = communityTopicLabel(post.topic);

  useEffect(() => {
    let cancelled = false;
    void getPostVideoSignedUrl(path).then((url) => {
      if (!cancelled && url) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return (
    <Link
      href={`/community/post/${encodeURIComponent(post.id)}`}
      className="group relative w-[7.75rem] shrink-0 snap-start overflow-hidden rounded-2xl bg-black shadow-sm ring-1 ring-border/35"
      data-testid={`watch-learn-item-${post.id}`}
    >
      <div className="relative aspect-[4/5] w-full">
        {src ? (
          <video
            src={src}
            muted
            playsInline
            preload="metadata"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted/40">
            <Play className="h-5 w-5 text-muted-foreground" aria-hidden />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
          Watch
        </span>
        <div className="absolute inset-x-0 bottom-0 space-y-0.5 p-2">
          <p className="truncate text-[10px] font-semibold text-white/90">{topic}</p>
          <p className="truncate text-[11px] font-medium text-white">{author}</p>
        </div>
      </div>
    </Link>
  );
}

export function FeedWatchLearnStrip({ posts, loading, className }: Props) {
  useEffect(() => {
    const paths = posts.map((post) => post.video_url).filter((path): path is string => Boolean(path));
    if (paths.length) prefetchPostMediaSignedUrls(paths);
  }, [posts]);

  if (!loading && posts.length === 0) return null;

  return (
    <section
      className={cn(
        "animate-soft-in overflow-hidden rounded-2xl border border-border/45 bg-gradient-to-br from-primary/[0.07] via-card/80 to-cyan-500/[0.06] px-3 py-3 shadow-sm ring-1 ring-primary/10",
        className,
      )}
      data-testid="feed-watch-learn-strip"
      aria-label="Watch and learn from the community"
    >
      <div className="mb-2.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">Watch & learn</p>
          <p className="text-sm font-semibold text-foreground">Peer tips from the community</p>
        </div>
        <p className="shrink-0 text-[11px] text-muted-foreground">30–60s clips</p>
      </div>
      <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-0.5 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {loading && posts.length === 0
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={`watch-sk-${i}`} className="aspect-[4/5] w-[7.75rem] shrink-0 rounded-2xl" />
            ))
          : posts.map((post) => (post.video_url ? <WatchLearnThumb key={post.id} post={post} /> : null))}
      </div>
    </section>
  );
}
