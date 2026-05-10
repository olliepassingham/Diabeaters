import { useEffect, useMemo, useState } from "react";
import { getPostImageSignedUrls } from "@/lib/community/posts-supabase";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  paths: string[];
  /** Parallel to `paths`; empty strings fall back to generic alt text. */
  altTexts?: string[];
  className?: string;
  /** `event-banner`: wide hero image for the first photo (feed event cards). */
  variant?: "default" | "event-banner";
};

function indexWithUrl(urls: (string | null)[], start: number, dir: -1 | 1): number | null {
  let j = start + dir;
  while (j >= 0 && j < urls.length) {
    if (urls[j]) return j;
    j += dir;
  }
  return null;
}

/**
 * Resolves private storage paths to signed URLs and renders a small grid.
 */
export function CommunityPostImageGrid({ paths, altTexts, className, variant = "default" }: Props) {
  const [urls, setUrls] = useState<(string | null)[]>([]);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  useEffect(() => {
    if (paths.length === 0) {
      setUrls([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const next = await getPostImageSignedUrls(paths);
      if (!cancelled) setUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [paths]);

  const loadedIndices = useMemo(
    () => paths.map((_, i) => i).filter((i) => Boolean(urls[i]?.trim())),
    [paths, urls],
  );

  const safeIdx = openIdx != null && openIdx >= 0 && openIdx < urls.length && urls[openIdx] ? openIdx : null;
  const activeSrc = safeIdx != null ? urls[safeIdx]! : null;
  const activeAlt =
    safeIdx == null ? "Photo attached to post" : altTexts?.[safeIdx]?.trim() || "Photo attached to post";

  const prevIdx = safeIdx != null ? indexWithUrl(urls, safeIdx, -1) : null;
  const nextIdx = safeIdx != null ? indexWithUrl(urls, safeIdx, 1) : null;
  const slidePosition = safeIdx != null ? loadedIndices.indexOf(safeIdx) + 1 : 0;
  const slideTotal = loadedIndices.length;

  if (paths.length === 0) return null;

  const loadFailed = paths.length > 0 && urls.length === paths.length && loadedIndices.length === 0;

  if (variant === "event-banner") {
    const heroIdx = loadedIndices[0];
    const moreIdx = loadedIndices.slice(1);
    return (
      <>
        <div className={cn("overflow-hidden", className)}>
          {heroIdx != null ? (
            <button
              type="button"
              onClick={() => setOpenIdx(heroIdx)}
              className="relative block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Open cover photo"
            >
              <img
                src={urls[heroIdx]!}
                alt={altTexts?.[heroIdx]?.trim() || "Event photo"}
                className="h-44 w-full object-cover sm:h-52"
                loading="lazy"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent" />
            </button>
          ) : loadFailed ? (
            <div className="flex h-28 items-center justify-center bg-muted/40 px-4 text-center text-xs text-muted-foreground">
              Photo could not be loaded. Try refreshing the feed.
            </div>
          ) : (
            <div className="h-8 animate-pulse bg-muted/50" aria-hidden />
          )}
          {moreIdx.length > 0 ? (
            <div className="flex gap-1.5 border-t border-border/50 bg-muted/20 p-2 dark:bg-muted/10">
              {moreIdx.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setOpenIdx(i)}
                  className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border/60 bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Open photo ${i + 1}`}
                >
                  <img
                    src={urls[i]!}
                    alt={altTexts?.[i]?.trim() || `Photo ${i + 1}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <Dialog
          open={safeIdx != null}
          onOpenChange={(v) => {
            if (!v) setOpenIdx(null);
          }}
        >
          <DialogContent className="max-w-[min(96vw,48rem)] overflow-hidden bg-background p-0">
            <div className="relative">
              <div className="absolute left-2 top-2 z-10 flex items-center gap-2">
                {slideTotal > 1 ? (
                  <div className="rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-xs text-muted-foreground backdrop-blur">
                    {slidePosition} / {slideTotal}
                  </div>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 z-10 rounded-full border border-border/60 bg-background/80 backdrop-blur"
                onClick={() => setOpenIdx(null)}
                aria-label="Close image"
              >
                <X className="h-4 w-4" />
              </Button>

              {prevIdx != null ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border/60 bg-background/80 backdrop-blur"
                  onClick={() => setOpenIdx(prevIdx)}
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              ) : null}

              {nextIdx != null ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border/60 bg-background/80 backdrop-blur"
                  onClick={() => setOpenIdx(nextIdx)}
                  aria-label="Next image"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              ) : null}

              {activeSrc ? (
                <img
                  src={activeSrc}
                  alt={activeAlt}
                  className="block h-auto max-h-[80vh] w-full bg-black/95 object-contain"
                />
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className={className ?? "grid grid-cols-2 gap-2 pt-1"}>
        {paths.map((path, i) => {
          const src = urls[i];
          if (!src) return null;
          const alt = altTexts?.[i]?.trim() || "Photo attached to post";
          return (
            <button
              key={`${path}-${i}`}
              type="button"
              onClick={() => setOpenIdx(i)}
              className="block overflow-hidden rounded-md border border-border/60 bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Open photo"
            >
              <img src={src} alt={alt} className="h-auto max-h-72 w-full object-cover" loading="lazy" />
            </button>
          );
        })}
      </div>
      {loadFailed ? (
        <p className="pt-1 text-xs text-muted-foreground">Photos could not be loaded. Try refreshing the feed.</p>
      ) : null}

      <Dialog
        open={safeIdx != null}
        onOpenChange={(v) => {
          if (!v) setOpenIdx(null);
        }}
      >
        <DialogContent className="max-w-[min(96vw,48rem)] overflow-hidden bg-background p-0">
          <div className="relative">
            <div className="absolute left-2 top-2 z-10 flex items-center gap-2">
              {slideTotal > 1 ? (
                <div className="rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-xs text-muted-foreground backdrop-blur">
                  {slidePosition} / {slideTotal}
                </div>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 z-10 rounded-full border border-border/60 bg-background/80 backdrop-blur"
              onClick={() => setOpenIdx(null)}
              aria-label="Close image"
            >
              <X className="h-4 w-4" />
            </Button>

            {prevIdx != null ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border/60 bg-background/80 backdrop-blur"
                onClick={() => setOpenIdx(prevIdx)}
                aria-label="Previous image"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            ) : null}

            {nextIdx != null ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border/60 bg-background/80 backdrop-blur"
                onClick={() => setOpenIdx(nextIdx)}
                aria-label="Next image"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            ) : null}

            {activeSrc ? (
              <img
                src={activeSrc}
                alt={activeAlt}
                className="block h-auto max-h-[80vh] w-full bg-black/95 object-contain"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
