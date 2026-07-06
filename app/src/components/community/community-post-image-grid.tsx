import { useEffect, useMemo, useState } from "react";
import { getCachedPostMediaSignedUrl, getPostImageSignedUrls } from "@/lib/community";
import { FeedMediaLightbox } from "@/components/community/feed-media-lightbox";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  paths: string[];
  /** Parallel to `paths`; empty strings fall back to generic alt text. */
  altTexts?: string[];
  className?: string;
  /** `event-banner`: wide hero image for the first photo (feed event cards). */
  /** `feed`: edge-to-edge media in post cards. */
  variant?: "default" | "event-banner" | "feed";
  /** Shown in placeholder when cover photo is missing or failed. */
  eventTitle?: string;
  /** Load immediately (first visible feed posts). */
  priority?: boolean;
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
export function CommunityPostImageGrid({ paths, altTexts, className, variant = "default", eventTitle, priority = false }: Props) {
  const [urls, setUrls] = useState<(string | null)[]>(() =>
    paths.map((path) => getCachedPostMediaSignedUrl(path)),
  );
  const [failedIndices, setFailedIndices] = useState<Set<number>>(() => new Set());
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  useEffect(() => {
    if (paths.length === 0) {
      setUrls([]);
      setFailedIndices(new Set());
      return;
    }
    let cancelled = false;
    void (async () => {
      const next = await getPostImageSignedUrls(paths);
      if (!cancelled) {
        setUrls(next);
        setFailedIndices(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paths]);

  const loadedIndices = useMemo(
    () => paths.map((_, i) => i).filter((i) => Boolean(urls[i]?.trim()) && !failedIndices.has(i)),
    [paths, urls, failedIndices],
  );

  const safeIdx = openIdx != null && openIdx >= 0 && openIdx < urls.length && urls[openIdx] ? openIdx : null;
  const activeSrc = safeIdx != null ? urls[safeIdx]! : null;
  const activeAlt =
    safeIdx == null ? "Photo attached to post" : altTexts?.[safeIdx]?.trim() || "Photo attached to post";

  const prevIdx = safeIdx != null ? indexWithUrl(urls, safeIdx, -1) : null;
  const nextIdx = safeIdx != null ? indexWithUrl(urls, safeIdx, 1) : null;
  const slidePosition = safeIdx != null ? loadedIndices.indexOf(safeIdx) + 1 : 0;
  const slideTotal = loadedIndices.length;
  const imgLoading = priority ? "eager" : "lazy";
  const imgFetchPriority = priority ? "high" : "auto";

  const imageLightbox = (
    <FeedMediaLightbox
      open={safeIdx != null}
      onOpenChange={(v) => {
        if (!v) setOpenIdx(null);
      }}
      slideLabel={slideTotal > 1 ? `${slidePosition} / ${slideTotal}` : undefined}
      onPrev={prevIdx != null ? () => setOpenIdx(prevIdx) : undefined}
      onNext={nextIdx != null ? () => setOpenIdx(nextIdx) : undefined}
    >
      {activeSrc ? (
        <img
          src={activeSrc}
          alt={activeAlt}
          className="block h-auto max-h-[85dvh] w-full object-contain"
          draggable={false}
        />
      ) : null}
    </FeedMediaLightbox>
  );

  if (paths.length === 0) return null;

  const loadFailed = paths.length > 0 && urls.length === paths.length && loadedIndices.length === 0;

  if (variant === "event-banner") {
    const heroIdx = loadedIndices[0];
    const moreIdx = loadedIndices.slice(1);
    const waitingForUrls = urls.length !== paths.length || (paths.length > 0 && loadedIndices.length === 0 && !loadFailed);
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
                alt={altTexts?.[heroIdx]?.trim() || eventTitle?.trim() || "Event cover photo"}
                className="h-44 w-full object-cover sm:h-52"
                loading={imgLoading}
                fetchPriority={imgFetchPriority}
                onError={() => setFailedIndices((prev) => new Set(prev).add(heroIdx))}
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent" />
            </button>
          ) : waitingForUrls ? (
            <div className="flex h-32 animate-pulse items-end bg-gradient-to-br from-primary/10 to-muted/30 p-4 sm:h-40" aria-hidden>
              <div className="h-3 w-24 rounded-full bg-muted/60" />
            </div>
          ) : (
            <div className="flex h-28 flex-col items-center justify-center gap-1 bg-gradient-to-br from-primary/12 via-primary/5 to-muted/25 px-4 text-center sm:h-32">
              <Calendar className="h-8 w-8 text-primary/35" aria-hidden />
              {eventTitle?.trim() ? (
                <p className="max-w-full truncate text-xs font-medium text-muted-foreground">{eventTitle.trim()}</p>
              ) : null}
            </div>
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
                    loading={imgLoading}
                fetchPriority={imgFetchPriority}
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {imageLightbox}
      </>
    );
  }

  if (variant === "feed") {
    const waitingForUrls = urls.length !== paths.length || (paths.length > 0 && loadedIndices.length === 0 && !loadFailed);
    const tileButtonClass =
      "block w-full overflow-hidden bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

    return (
      <>
        <div className={cn("overflow-hidden bg-muted/20", className)}>
          {paths.length === 1 ? (
            loadedIndices[0] != null ? (
              <button type="button" onClick={() => setOpenIdx(loadedIndices[0]!)} className={tileButtonClass} aria-label="Open photo">
                <img
                  src={urls[loadedIndices[0]!]!}
                  alt={altTexts?.[loadedIndices[0]!]?.trim() || "Photo attached to post"}
                  className="aspect-[4/5] max-h-[min(85vw,32rem)] w-full object-cover"
                  loading={imgLoading}
                fetchPriority={imgFetchPriority}
                />
              </button>
            ) : waitingForUrls ? (
              <div className="aspect-[4/5] max-h-[min(72vw,28rem)] w-full animate-pulse bg-muted/40" aria-hidden />
            ) : null
          ) : (
            <div className="grid grid-cols-2 gap-px bg-border/50">
              {paths.map((path, i) => {
                const src = urls[i];
                if (!src) {
                  if (waitingForUrls) {
                    return <div key={`${path}-${i}`} className="aspect-square animate-pulse bg-muted/40" aria-hidden />;
                  }
                  return null;
                }
                const alt = altTexts?.[i]?.trim() || "Photo attached to post";
                return (
                  <button
                    key={`${path}-${i}`}
                    type="button"
                    onClick={() => setOpenIdx(i)}
                    className={cn(tileButtonClass, paths.length === 3 && i === 0 && "col-span-2 aspect-[2/1]")}
                    aria-label={`Open photo ${i + 1}`}
                  >
                    <img
                      src={src}
                      alt={alt}
                      className={cn(
                        "h-full w-full object-cover",
                        paths.length === 3 && i === 0 ? "aspect-[2/1]" : "aspect-square max-h-56",
                      )}
                      loading={imgLoading}
                fetchPriority={imgFetchPriority}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {loadFailed ? (
          <p className="px-3 pt-1 text-xs text-muted-foreground">Photos could not be loaded. Try refreshing the feed.</p>
        ) : null}
        {imageLightbox}
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
              <img src={src} alt={alt} className="h-auto max-h-72 w-full object-cover" loading={imgLoading} fetchPriority={imgFetchPriority} />
            </button>
          );
        })}
      </div>
      {loadFailed ? (
        <p className="pt-1 text-xs text-muted-foreground">Photos could not be loaded. Try refreshing the feed.</p>
      ) : null}

      {imageLightbox}
    </>
  );
}
