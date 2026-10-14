import { useEffect, useRef, useState } from "react";
import { Loader2, Maximize2, Play } from "lucide-react";
import { FeedMediaLightbox } from "@/components/community/feed-media-lightbox";
import { APP_SCROLL_MAIN_ID } from "@/lib/app-scroll";
import { claimActiveFeedVideo, releaseActiveFeedVideo } from "@/lib/feed-video-playback";
import { getCachedPostMediaSignedUrl, getPostVideoSignedUrl } from "@/lib/community";
import { getPostImageSignedUrls } from "@/lib/community/posts-supabase";
import { readFeedVideoMuted, writeFeedVideoMuted } from "@/lib/community/feed-video-mute";
import { cn } from "@/lib/utils";

type Props = {
  path: string;
  /** Optional JPEG poster path — shows immediately while the video buffers. */
  posterPath?: string | null;
  className?: string;
  /** Start buffering immediately (first visible feed posts). */
  priority?: boolean;
  /** Optional topic chip shown on the video surface. */
  topicLabel?: string | null;
};

const PLAY_THRESHOLD = 0.6;

export function FeedPostVideo({ path, posterPath = null, className, priority = false, topicLabel = null }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const expandedVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | null>(() => getCachedPostMediaSignedUrl(path));
  const [posterSrc, setPosterSrc] = useState<string | null>(() =>
    posterPath ? getCachedPostMediaSignedUrl(posterPath) : null,
  );
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(() => readFeedVideoMuted());
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const [frame, setFrame] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cached = getCachedPostMediaSignedUrl(path);
    setSrc(cached);
    setFailed(false);
    setPlaybackError(false);
    setFrame(null);
    void getPostVideoSignedUrl(path).then((url) => {
      if (cancelled) return;
      if (url) setSrc(url);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  useEffect(() => {
    if (!posterPath) {
      setPosterSrc(null);
      return;
    }
    let cancelled = false;
    const cached = getCachedPostMediaSignedUrl(posterPath);
    setPosterSrc(cached);
    void getPostImageSignedUrls([posterPath]).then((urls) => {
      if (cancelled) return;
      setPosterSrc(urls[0] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [posterPath]);

  useEffect(() => {
    const el = containerRef.current;
    const video = videoRef.current;
    if (!el || !src || !video || expanded) return;

    const scrollRoot = document.getElementById(APP_SCROLL_MAIN_ID);

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry || !videoRef.current) return;
        const v = videoRef.current;
        if (entry.isIntersecting && entry.intersectionRatio >= PLAY_THRESHOLD) {
          claimActiveFeedVideo(v);
          void v.play().catch(() => {
            /* autoplay blocked */
          });
        } else {
          v.pause();
          releaseActiveFeedVideo(v);
        }
      },
      {
        root: scrollRoot,
        threshold: [0, PLAY_THRESHOLD, 1],
        rootMargin: "0px 0px -8% 0px",
      },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      releaseActiveFeedVideo(video);
    };
  }, [src, expanded]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (expanded) {
      video.pause();
      releaseActiveFeedVideo(video);
      return;
    }
    const el = containerRef.current;
    if (!el || !src) return;
    const scrollRoot = document.getElementById(APP_SCROLL_MAIN_ID);
    const rect = el.getBoundingClientRect();
    const rootRect = scrollRoot?.getBoundingClientRect();
    const visible =
      rect.height > 0 &&
      (rootRect
        ? rect.top < rootRect.bottom && rect.bottom > rootRect.top
        : rect.top < window.innerHeight && rect.bottom > 0);
    if (visible) {
      claimActiveFeedVideo(video);
      void video.play().catch(() => {});
    }
  }, [expanded, src]);

  useEffect(() => {
    const ev = expandedVideoRef.current;
    if (!expanded || !ev || !src) return;
    ev.muted = muted;
    void ev.play().catch(() => {});
    return () => {
      ev.pause();
    };
  }, [expanded, src, muted]);

  if (failed || playbackError) {
    return (
      <p className={cn("px-3 py-8 text-center text-xs text-muted-foreground", className)}>
        This video could not play. Try refreshing the feed.
      </p>
    );
  }

  if (!src && !posterSrc) {
    return (
      <div
        className={cn(
          "relative flex aspect-[4/5] max-h-[min(85vw,32rem)] w-full items-center justify-center bg-black/90",
          className,
        )}
        aria-busy="true"
      >
        <Loader2 className="h-6 w-6 animate-spin text-white/70" aria-hidden />
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        className={cn("group relative w-full overflow-hidden bg-black", className)}
        style={frame ? { aspectRatio: `${frame.w} / ${frame.h}`, maxHeight: "70dvh" } : { aspectRatio: "4 / 5", maxHeight: "70dvh" }}
        data-testid="feed-post-video"
      >
        {src ? (
          <video
            ref={videoRef}
            src={src}
            poster={posterSrc ?? undefined}
            muted={muted}
            loop
            playsInline
            controls
            preload={priority ? "auto" : "metadata"}
            className="h-full w-full bg-black object-contain"
            onLoadedMetadata={(event) => {
              const v = event.currentTarget;
              if (v.videoWidth > 0 && v.videoHeight > 0) {
                setFrame({ w: v.videoWidth, h: v.videoHeight });
              }
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onVolumeChange={(event) => {
              const next = event.currentTarget.muted;
              setMuted(next);
              writeFeedVideoMuted(next);
            }}
            onError={() => setPlaybackError(true)}
          />
        ) : (
          <img src={posterSrc!} alt="" className="h-full w-full object-contain" />
        )}
        {topicLabel ? (
          <span className="pointer-events-none absolute left-3 top-3 z-10 max-w-[70%] truncate rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            {topicLabel}
          </span>
        ) : !playing && src ? (
          <span className="pointer-events-none absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
            Video
          </span>
        ) : null}
        <button
          type="button"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm"
          onClick={() => setExpanded(true)}
          aria-label="Watch video fullscreen"
        >
          <Maximize2 className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <FeedMediaLightbox open={expanded} onOpenChange={setExpanded}>
        {src ? (
          <video
            ref={expandedVideoRef}
            src={src}
            poster={posterSrc ?? undefined}
            muted={muted}
            loop
            playsInline
            controls
            className="max-h-[85dvh] w-full object-contain"
            onError={() => setPlaybackError(true)}
          />
        ) : null}
      </FeedMediaLightbox>
    </>
  );
}
