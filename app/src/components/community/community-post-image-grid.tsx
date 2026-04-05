import { useEffect, useState } from "react";
import { getPostImageSignedUrls } from "@/lib/community/posts-supabase";

type Props = {
  paths: string[];
  className?: string;
};

/**
 * Resolves private storage paths to signed URLs and renders a small grid.
 */
export function CommunityPostImageGrid({ paths, className }: Props) {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    if (paths.length === 0) {
      setUrls([]);
      return;
    }
    let cancelled = false;
    const key = paths.join("\0");
    void (async () => {
      const next = await getPostImageSignedUrls(paths);
      if (!cancelled) setUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [paths]);

  if (paths.length === 0) return null;

  return (
    <div className={className ?? "grid grid-cols-2 gap-2 pt-1"}>
      {urls.map((src, i) => (
        <a
          key={`${src}-${i}`}
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="block overflow-hidden rounded-md border border-border/60 bg-muted/40"
        >
          <img
            src={src}
            alt=""
            className="h-auto w-full max-h-72 object-cover"
            loading="lazy"
          />
        </a>
      ))}
    </div>
  );
}
