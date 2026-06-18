import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getPostVideoSignedUrl } from "@/lib/community/posts-supabase";
import { cn } from "@/lib/utils";

type Props = {
  path: string;
  className?: string;
};

export function FeedPostVideo({ path, className }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setFailed(false);
    void getPostVideoSignedUrl(path).then((url) => {
      if (cancelled) return;
      if (url) setSrc(url);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (failed) {
    return (
      <p className={cn("px-3 py-6 text-center text-xs text-muted-foreground", className)}>
        Video could not be loaded. Try refreshing the feed.
      </p>
    );
  }

  if (!src) {
    return (
      <div
        className={cn(
          "flex aspect-[4/5] max-h-[min(72vw,28rem)] w-full items-center justify-center bg-muted/30",
          className,
        )}
        aria-busy="true"
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  return (
    <video
      src={src}
      controls
      playsInline
      preload="metadata"
      className={cn(
        "block aspect-[4/5] max-h-[min(72vw,28rem)] w-full bg-black object-contain",
        className,
      )}
      data-testid="feed-post-video"
    />
  );
}
