import { useMemo } from "react";
import { Link } from "wouter";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ImageIcon, Loader2, Play } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { fetchCommunityPostsByAuthorPage, type CommunityPostRow, type FeedCursor } from "@/lib/community";
import { getPostImageSignedUrls, getPostVideoSignedUrl } from "@/lib/community/posts-supabase";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function ProfileGridThumb({ post }: { post: CommunityPostRow }) {
  const isVideo = Boolean(post.video_url);
  const path = isVideo ? post.video_url! : post.image_urls[0];
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    void (isVideo ? getPostVideoSignedUrl(path) : getPostImageSignedUrls([path]).then((urls) => urls[0] ?? null)).then(
      (next) => {
        if (!cancelled) setUrl(next);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [path, isVideo]);

  const alt = post.image_alt_texts?.[0]?.trim() || (isVideo ? "Video from post" : "Photo from post");

  return (
    <Link
      href={`/community/post/${post.id}`}
      className="group relative block aspect-square overflow-hidden bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={isVideo ? "Open video post" : "Open post"}
    >
      {url ? (
        isVideo ? (
          <video src={url} preload="metadata" muted playsInline className="h-full w-full object-cover" />
        ) : (
          <img
            src={url}
            alt={alt}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
            loading="lazy"
          />
        )
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
        </div>
      )}
      {isVideo ? (
        <span className="absolute inset-0 flex items-center justify-center bg-black/20">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
            <Play className="h-4 w-4 fill-current" aria-hidden />
          </span>
        </span>
      ) : null}
      {!isVideo && post.image_urls.length > 1 ? (
        <span className="absolute right-1.5 top-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          +{post.image_urls.length - 1}
        </span>
      ) : null}
    </Link>
  );
}

export function ProfilePostMediaGrid(props: {
  authorId: string;
  className?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const query = useInfiniteQuery({
    queryKey: ["profile-media-grid", props.authorId],
    queryFn: async ({ pageParam }) => {
      const res = await fetchCommunityPostsByAuthorPage(props.authorId, 30, pageParam as FeedCursor | null, null);
      if (res.error) throw res.error;
      return res.data ?? [];
    },
    initialPageParam: null as FeedCursor | null,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < 30) return undefined;
      const last = lastPage[lastPage.length - 1];
      if (!last) return undefined;
      return { created_at: last.created_at, id: last.id };
    },
  });

  const photoPosts = useMemo(
    () => (query.data?.pages.flat() ?? []).filter((p) => p.image_urls.length > 0 || Boolean(p.video_url)),
    [query.data?.pages],
  );

  if (query.isLoading) {
    return (
      <div className={cn("grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border/40 bg-border/40", props.className)}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square animate-pulse bg-muted/50" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <EmptyState
        title="Could not load photos"
        description={query.error instanceof Error ? query.error.message : "Please try again."}
      />
    );
  }

  if (photoPosts.length === 0) {
    return (
      <EmptyState
        title={props.emptyTitle ?? "No photos yet"}
        description={props.emptyDescription ?? "Posts with photos will appear here."}
        icon={ImageIcon}
      />
    );
  }

  return (
    <div className={props.className}>
      <div
        className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border/40 bg-border/40"
        data-testid="profile-post-media-grid"
      >
        {photoPosts.map((post) => (
          <ProfileGridThumb key={post.id} post={post} />
        ))}
      </div>
      {query.hasNextPage ? (
        <div className="flex justify-center pt-3">
          <button
            type="button"
            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? "Loading…" : "Load more photos"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
