import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Volume2, VolumeX } from "lucide-react";
import { FeedMediaLightbox } from "@/components/community/feed-media-lightbox";
import { APP_SCROLL_MAIN_ID } from "@/lib/app-scroll";
import { claimActiveFeedVideo, releaseActiveFeedVideo } from "@/lib/feed-video-playback";
import { getCachedPostMediaSignedUrl, getPostVideoSignedUrl } from "@/lib/community";
import { cn } from "@/lib/utils";

type Props = {
  path: string;
  className?: string;
  /** Start buffering immediately (first visible feed posts). */
  priority?: boolean;
};

const PLAY_THRESHOLD = 0.6;

export function FeedPostVideo({ path, className, priority = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const expandedVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | null>(() => getCachedPostMediaSignedUrl(path));
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [showMuteHint, setShowMuteHint] = useState(false);
  const [expanded, setExpanded] = useState(false);

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

  useEffect(() => {
    if (!showMuteHint) return;
    const t = window.setTimeout(() => setShowMuteHint(false), 1200);
    return () => window.clearTimeout(t);
  }, [showMuteHint, muted]);

  const toggleMute = useCallback(() => {
    setMuted((m) => !m);
    setShowMuteHint(true);
  }, []);

  if (failed) {
    return (
      <p className={cn("px-3 py-8 text-center text-xs text-muted-foreground", className)}>
        Video could not be loaded. Try refreshing the feed.
      </p>
    );
  }

  if (!src) {
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
        data-testid="feed-post-video"
      >
        <button
          type="button"
          className="relative block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          onClick={() => setExpanded(true)}
          aria-label="Open video fullscreen"
        >
          <video
            ref={videoRef}
            src={src}
            muted={muted}
            loop
            playsInline
            preload={priority ? "auto" : "metadata"}
            className="pointer-events-none aspect-[4/5] max-h-[min(85vw,32rem)] w-full object-cover"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent transition-opacity duration-300",
              playing ? "opacity-100" : "opacity-0",
            )}
            aria-hidden
          />
        </button>
        <button
          type="button"
          className={cn(
            "absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-all duration-200",
            showMuteHint || muted ? "scale-100 opacity-100" : "scale-95 opacity-0 group-hover:opacity-100",
          )}
          onClick={toggleMute}
          aria-label={muted ? "Unmute video" : "Mute video"}
        >
          {muted ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
        </button>
      </div>

      <FeedMediaLightbox open={expanded} onOpenChange={setExpanded}>
        <video
          ref={expandedVideoRef}
          src={src}
          muted={muted}
          loop
          playsInline
          controls
          className="max-h-[85dvh] w-full object-contain"
        />
      </FeedMediaLightbox>
    </>
  );
}
