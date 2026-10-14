import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play, Volume2, VolumeX } from "lucide-react";
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
};

const PLAY_THRESHOLD = 0.55;

function playFeedVideo(video: HTMLVideoElement, preferMuted: boolean): void {
  video.muted = preferMuted;
  void video.play().catch(() => {
    video.muted = true;
    void video.play().catch(() => {
      /* Autoplay can still be blocked until the next tap. */
    });
  });
}

export function FeedPostVideo({ path, posterPath = null, className, priority = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userPausedRef = useRef(false);
  const [held, setHeld] = useState(false);
  const flashTimerRef = useRef<number | null>(null);
  const [src, setSrc] = useState<string | null>(() => getCachedPostMediaSignedUrl(path));
  const [posterSrc, setPosterSrc] = useState<string | null>(() =>
    posterPath ? getCachedPostMediaSignedUrl(posterPath) : null,
  );
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(() => readFeedVideoMuted());
  const [playing, setPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const [frame, setFrame] = useState<{ w: number; h: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const [flash, setFlash] = useState<"play" | "pause" | null>(null);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cached = getCachedPostMediaSignedUrl(path);
    setSrc(cached);
    setFailed(false);
    setPlaybackError(false);
    setFrame(null);
    setProgress(0);
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
    if (!el || !src || !video) return;

    const scrollRoot = document.getElementById(APP_SCROLL_MAIN_ID);

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const current = videoRef.current;
        if (!entry || !current) return;
        if (entry.isIntersecting && entry.intersectionRatio >= PLAY_THRESHOLD) {
          if (userPausedRef.current) return;
          claimActiveFeedVideo(current);
          playFeedVideo(current, current.muted || readFeedVideoMuted());
        } else {
          current.pause();
          userPausedRef.current = false;
          setHeld(false);
          releaseActiveFeedVideo(current);
        }
      },
      {
        root: scrollRoot,
        threshold: [0, 0.25, PLAY_THRESHOLD, 0.8, 1],
        rootMargin: "0px",
      },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      releaseActiveFeedVideo(video);
    };
  }, [src]);

  function showFlash(kind: "play" | "pause") {
    setFlash(kind);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(null), 650);
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      userPausedRef.current = false;
      setHeld(false);
      claimActiveFeedVideo(video);
      playFeedVideo(video, muted);
      showFlash("play");
    } else {
      userPausedRef.current = true;
      setHeld(true);
      video.pause();
      showFlash("pause");
    }
  }

  function toggleMuted() {
    const video = videoRef.current;
    const next = !muted;
    setMuted(next);
    writeFeedVideoMuted(next);
    if (video) video.muted = next;
  }

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
        className={cn("relative flex aspect-[4/5] max-h-[70dvh] w-full items-center justify-center bg-black", className)}
        aria-busy="true"
      >
        <Loader2 className="h-6 w-6 animate-spin text-white/70" aria-hidden />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full overflow-hidden bg-black", className)}
      style={
        frame
          ? { aspectRatio: `${frame.w} / ${frame.h}`, maxHeight: "70dvh" }
          : { aspectRatio: "4 / 5", maxHeight: "70dvh" }
      }
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
          preload={priority ? "auto" : "metadata"}
          className="h-full w-full bg-black object-contain"
          onLoadedMetadata={(event) => {
            const v = event.currentTarget;
            if (v.videoWidth > 0 && v.videoHeight > 0) {
              setFrame({ w: v.videoWidth, h: v.videoHeight });
            }
          }}
          onTimeUpdate={(event) => {
            const v = event.currentTarget;
            if (!Number.isFinite(v.duration) || v.duration <= 0) return;
            setProgress(Math.min(1, v.currentTime / v.duration));
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={() => setPlaybackError(true)}
        />
      ) : (
        <img src={posterSrc!} alt="" className="h-full w-full object-contain" />
      )}

      {src ? (
        <button
          type="button"
          className="absolute inset-0 z-10"
          aria-label={playing ? "Pause video" : "Play video"}
          onClick={togglePlay}
        />
      ) : null}

      {flash || (held && !playing) ? (
        <span className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/45 text-white">
            {flash === "pause" ? (
              <Pause className="h-7 w-7 fill-current" />
            ) : (
              <Play className="h-7 w-7 fill-current" />
            )}
          </span>
        </span>
      ) : null}

      {src ? (
        <button
          type="button"
          className="absolute bottom-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white"
          aria-label={muted ? "Unmute video" : "Mute video"}
          aria-pressed={!muted}
          onClick={toggleMuted}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      ) : null}

      {src ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-0.5 bg-white/25" aria-hidden>
          <div className="h-full bg-white" style={{ width: `${progress * 100}%` }} />
        </div>
      ) : null}
    </div>
  );
}
