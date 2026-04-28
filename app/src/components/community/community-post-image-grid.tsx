import { useEffect, useState } from "react";
import { getPostImageSignedUrls } from "@/lib/community/posts-supabase";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type Props = {
  paths: string[];
  /** Parallel to `paths`; empty strings fall back to generic alt text. */
  altTexts?: string[];
  className?: string;
};

/**
 * Resolves private storage paths to signed URLs and renders a small grid.
 */
export function CommunityPostImageGrid({ paths, altTexts, className }: Props) {
  const [urls, setUrls] = useState<string[]>([]);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

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

  const safeIdx = openIdx != null && openIdx >= 0 && openIdx < urls.length ? openIdx : null;
  const activeSrc = safeIdx != null ? urls[safeIdx] : null;
  const activeAlt = safeIdx == null ? "Photo attached to post" : altTexts?.[safeIdx]?.trim() || "Photo attached to post";

  const hasPrev = safeIdx != null && safeIdx > 0;
  const hasNext = safeIdx != null && safeIdx < urls.length - 1;

  if (paths.length === 0) return null;

  return (
    <>
      <div className={className ?? "grid grid-cols-2 gap-2 pt-1"}>
        {urls.map((src, i) => {
          const alt = altTexts?.[i]?.trim() || "Photo attached to post";
          return (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => setOpenIdx(i)}
              className="block overflow-hidden rounded-md border border-border/60 bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Open photo"
            >
              <img
                src={src}
                alt={alt}
                className="h-auto w-full max-h-72 object-cover"
                loading="lazy"
              />
            </button>
          );
        })}
      </div>

      <Dialog
        open={safeIdx != null}
        onOpenChange={(v) => {
          if (!v) setOpenIdx(null);
        }}
      >
        <DialogContent className="max-w-[min(96vw,48rem)] p-0 overflow-hidden bg-background">
          <div className="relative">
            <div className="absolute left-2 top-2 z-10 flex items-center gap-2">
              {urls.length > 1 ? (
                <div className="rounded-full bg-background/80 backdrop-blur px-2.5 py-1 text-xs text-muted-foreground border border-border/60">
                  {safeIdx! + 1} / {urls.length}
                </div>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 z-10 rounded-full bg-background/80 backdrop-blur border border-border/60"
              onClick={() => setOpenIdx(null)}
              aria-label="Close image"
            >
              <X className="h-4 w-4" />
            </Button>

            {hasPrev ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-background/80 backdrop-blur border border-border/60"
                onClick={() => setOpenIdx((i) => (i == null ? i : Math.max(0, i - 1)))}
                aria-label="Previous image"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            ) : null}

            {hasNext ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-background/80 backdrop-blur border border-border/60"
                onClick={() => setOpenIdx((i) => (i == null ? i : Math.min(urls.length - 1, i + 1)))}
                aria-label="Next image"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            ) : null}

            {activeSrc ? (
              <img
                src={activeSrc}
                alt={activeAlt}
                className="block w-full h-auto max-h-[80vh] object-contain bg-black/95"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
