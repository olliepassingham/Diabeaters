import { useCallback, useEffect, useRef, useState, type TouchEvent, type WheelEvent } from "react";
import { createPortal } from "react-dom";
import { Heart, Loader2, Volume2, VolumeX, X } from "lucide-react";
import { Link } from "wouter";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { Button } from "@/components/ui/button";
import {
  communityTopicLabel,
  getCachedPostMediaSignedUrl,
  getPostVideoSignedUrl,
  prefetchPostMediaSignedUrls,
  togglePostLike,
  type CommunityPostRow,
} from "@/lib/community";
import { claimActiveFeedVideo, releaseActiveFeedVideo } from "@/lib/feed-video-playback";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  posts: CommunityPostRow[];
  initialIndex?: number;
  viewerId?: string;
  canEngage?: boolean;
  loading?: boolean;
};

const PLAY_THRESHOLD = 0.65;
/** Ignore tiny finger wobble when deciding tap vs scroll. */
const TAP_MOVE_PX = 12;
/** Pull past the first clip this far (px) to dismiss Watch. */
const DISMISS_PULL_PX = 72;

function WatchLearnSlide({
  post,
  active,
  muted,
  priority,
}: {
  post: CommunityPostRow;
  active: boolean;
  muted: boolean;
  priority: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const path = post.video_url!;
  const [src, setSrc] = useState<string | null>(() => getCachedPostMediaSignedUrl(path));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
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
    const video = videoRef.current;
    if (!video || !src) return;
    if (active) {
      claimActiveFeedVideo(video);
      video.muted = muted;
      void video.play().catch(() => {
        video.muted = true;
        void video.play().catch(() => {});
      });
    } else {
      video.pause();
      releaseActiveFeedVideo(video);
    }
    return () => {
      releaseActiveFeedVideo(video);
    };
  }, [active, muted, src]);

  if (failed) {
    return (
      <p className="px-6 text-center text-sm text-white/70">This clip could not be loaded.</p>
    );
  }

  if (!src) {
    return <Loader2 className="h-7 w-7 animate-spin text-white/70" aria-hidden />;
  }

  return (
    <video
      ref={videoRef}
      src={src}
      loop
      playsInline
      muted={muted}
      preload={priority ? "auto" : "metadata"}
      className="h-full w-full object-contain"
      data-testid={`watch-learn-video-${post.id}`}
    />
  );
}

export function FeedWatchLearnPlayer({
  open,
  onOpenChange,
  posts,
  initialIndex = 0,
  viewerId,
  canEngage = false,
  loading = false,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number; scrollTop: number } | null>(null);
  const dismissPullRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [dismissPull, setDismissPull] = useState(0);
  const [likeState, setLikeState] = useState<Record<string, { liked: boolean; count: number }>>({});

  const clips = posts.filter((post) => Boolean(post.video_url));
  const clipKey = clips.map((post) => post.id).join("|");

  const scrollToIndex = useCallback((index: number, behavior: ScrollBehavior = "smooth") => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const child = scroller.children[index] as HTMLElement | undefined;
    if (typeof child?.scrollIntoView === "function") {
      child.scrollIntoView({ behavior, block: "start" });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(Math.min(Math.max(0, initialIndex), Math.max(0, clips.length - 1)));
    setPaused(false);
    setLikeState((current) => {
      const next: Record<string, { liked: boolean; count: number }> = {};
      for (const post of clips) {
        next[post.id] = current[post.id] ?? { liked: post.liked_by_me, count: post.like_count };
      }
      return next;
    });
  }, [open, initialIndex, clipKey]);

  useEffect(() => {
    if (!open) return;
    const paths = clips
      .slice(Math.max(0, activeIndex), activeIndex + 3)
      .map((post) => post.video_url)
      .filter((path): path is string => Boolean(path));
    if (paths.length) prefetchPostMediaSignedUrls(paths);
  }, [open, activeIndex, clipKey]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        const next = Math.min(clips.length - 1, activeIndex + 1);
        if (next !== activeIndex) scrollToIndex(next);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (activeIndex <= 0) {
          onOpenChange(false);
          return;
        }
        scrollToIndex(activeIndex - 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange, activeIndex, clipKey, clips.length, scrollToIndex]);

  useEffect(() => {
    if (!open) return;
    const scroller = scrollerRef.current;
    const child = scroller?.children[Math.min(initialIndex, Math.max(0, clips.length - 1))] as
      | HTMLElement
      | undefined;
    if (typeof child?.scrollIntoView === "function") {
      child.scrollIntoView({ block: "start" });
    }
  }, [open, initialIndex, clips.length]);

  useEffect(() => {
    if (!open) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    if (typeof IntersectionObserver === "undefined") return;
    const slides = Array.from(scroller.children);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting && entry.intersectionRatio >= PLAY_THRESHOLD)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = slides.indexOf(visible.target);
        if (index >= 0) {
          setActiveIndex(index);
          setPaused(false);
        }
      },
      { root: scroller, threshold: [0.35, PLAY_THRESHOLD, 1] },
    );
    for (const slide of slides) observer.observe(slide);
    return () => observer.disconnect();
  }, [open, clips.length]);

  const onToggleLike = useCallback(
    async (post: CommunityPostRow) => {
      if (!canEngage || !viewerId) return;
      const current = likeState[post.id] ?? { liked: post.liked_by_me, count: post.like_count };
      setLikeState((state) => ({
        ...state,
        [post.id]: {
          liked: !current.liked,
          count: Math.max(0, current.count + (current.liked ? -1 : 1)),
        },
      }));
      const result = await togglePostLike(post.id, current.liked);
      if (result.error) {
        setLikeState((state) => ({ ...state, [post.id]: current }));
      }
    },
    [canEngage, likeState, viewerId],
  );

  const onScrollerTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("a, button, input, textarea, [role='button']")) {
      touchStartRef.current = null;
      return;
    }
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      scrollTop: scrollerRef.current?.scrollTop ?? 0,
    };
    dismissPullRef.current = 0;
    setDismissPull(0);
  };

  const onScrollerTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch) return;
    const dy = touch.clientY - start.y;
    // On the first clip, pulling down (finger moves down → content wants to go up) dismisses.
    const atTop = activeIndex <= 0 && start.scrollTop <= 2;
    if (atTop && dy > 0) {
      const pull = Math.min(140, dy);
      dismissPullRef.current = pull;
      setDismissPull(pull);
    } else if (dismissPullRef.current > 0) {
      dismissPullRef.current = 0;
      setDismissPull(0);
    }
  };

  const finishTouchGesture = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    const pull = dismissPullRef.current;
    dismissPullRef.current = 0;
    setDismissPull(0);

    if (pull >= DISMISS_PULL_PX) {
      onOpenChange(false);
      return;
    }

    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const dx = Math.abs(touch.clientX - start.x);
    const dy = Math.abs(touch.clientY - start.y);
    if (dx < TAP_MOVE_PX && dy < TAP_MOVE_PX) {
      setPaused((value) => !value);
    }
  };

  const onScrollerWheel = (event: WheelEvent<HTMLDivElement>) => {
    // Desktop: wheel up on the first clip closes Watch (parity with mobile pull-down).
    if (activeIndex <= 0 && event.deltaY < -24 && (scrollerRef.current?.scrollTop ?? 0) <= 2) {
      event.preventDefault();
      onOpenChange(false);
    }
  };

  if (!open || typeof document === "undefined") return null;

  if (loading && clips.length === 0) {
    return createPortal(
      <div
        className="fixed inset-0 z-[130] flex items-center justify-center bg-black"
        role="dialog"
        aria-modal="true"
        aria-label="Watch and learn"
        data-testid="feed-watch-learn-player"
      >
        <Loader2 className="h-7 w-7 animate-spin text-white/70" aria-hidden />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] rounded-full border border-white/15 bg-black/45 text-white hover:bg-black/60"
          onClick={() => onOpenChange(false)}
          aria-label="Close watch and learn"
          data-testid="button-close-watch-learn"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>,
      document.body,
    );
  }

  if (clips.length === 0) {
    return createPortal(
      <div
        className="fixed inset-0 z-[130] flex flex-col items-center justify-center bg-black px-8 text-center"
        role="dialog"
        aria-modal="true"
        aria-label="Watch and learn"
        data-testid="feed-watch-learn-player"
      >
        <p className="text-base font-semibold text-white">No clips yet</p>
        <p className="mt-2 max-w-xs text-sm text-white/70">
          Short peer videos will show up here. Share one from the Feed to start Watch & learn.
        </p>
        <Button
          type="button"
          variant="ghost"
          className="mt-6 rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/20"
          onClick={() => onOpenChange(false)}
          data-testid="button-close-watch-learn"
        >
          Back to feed
        </Button>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[130] bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Watch and learn"
      data-testid="feed-watch-learn-player"
    >
      <div
        ref={scrollerRef}
        className="h-[100dvh] snap-y snap-mandatory overflow-y-auto overscroll-y-contain touch-pan-y [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={
          dismissPull > 0
            ? { transform: `translateY(${dismissPull * 0.35}px)`, transition: "none" }
            : undefined
        }
        onTouchStart={onScrollerTouchStart}
        onTouchMove={onScrollerTouchMove}
        onTouchEnd={finishTouchGesture}
        onTouchCancel={finishTouchGesture}
        onWheel={onScrollerWheel}
        data-testid="watch-learn-scroller"
      >
        {clips.map((post, index) => {
          const author =
            post.author_preview?.full_name?.trim() ||
            (post.author_preview?.public_handle ? `@${post.author_preview.public_handle}` : "Member");
          const likes = likeState[post.id] ?? { liked: post.liked_by_me, count: post.like_count };
          return (
            <section
              key={post.id}
              className="relative flex h-[100dvh] w-full snap-start snap-always items-center justify-center bg-black"
              data-testid={`watch-learn-slide-${post.id}`}
            >
              <WatchLearnSlide
                post={post}
                active={index === activeIndex && !paused}
                muted={muted}
                priority={Math.abs(index - activeIndex) <= 1}
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-24">
                <div className="pointer-events-auto flex items-end gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Link
                      href={`/community/profile/${encodeURIComponent(post.author_id)}`}
                      className="flex items-center gap-2"
                      onClick={() => onOpenChange(false)}
                    >
                      <CommunityAuthorAvatar
                        displayName={author}
                        avatarPath={post.author_preview?.avatar_url}
                        size="sm"
                        className="!h-8 !w-8 ring-1 ring-white/30"
                      />
                      <span className="truncate text-sm font-semibold text-white">{author}</span>
                    </Link>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-white/80">
                      {communityTopicLabel(post.topic)}
                    </p>
                    {post.body.trim() ? (
                      <p className="line-clamp-3 text-sm leading-snug text-white/95">{post.body.trim()}</p>
                    ) : null}
                    <p className="text-[11px] text-white/65">Peer experience — not medical advice.</p>
                    <Link
                      href={`/community/post/${encodeURIComponent(post.id)}`}
                      className="inline-flex text-[11px] font-medium text-white/80 underline-offset-2 hover:underline"
                      onClick={() => onOpenChange(false)}
                    >
                      Open post
                    </Link>
                  </div>
                  <div className="flex flex-col items-center gap-3 pb-6">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-12 w-12 rounded-full bg-white/10 text-white hover:bg-white/20"
                      disabled={!canEngage}
                      aria-label={likes.liked ? "Unlike" : "Like"}
                      onClick={() => void onToggleLike(post)}
                    >
                      <Heart className={cn("h-6 w-6", likes.liked && "fill-red-500 text-red-500")} />
                    </Button>
                    <span className="text-[11px] font-semibold tabular-nums text-white/80">{likes.count}</span>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {dismissPull > 24 ? (
        <p
          className="pointer-events-none absolute left-1/2 top-[max(4.5rem,calc(env(safe-area-inset-top)+3.25rem))] z-30 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-sm"
          data-testid="watch-learn-dismiss-hint"
        >
          {dismissPull >= DISMISS_PULL_PX ? "Release to close" : "Pull to close"}
        </p>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="pointer-events-none rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur-sm">
          Watch & learn
        </span>
        <div className="pointer-events-auto flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full border border-white/15 bg-black/45 text-white hover:bg-black/60"
            onClick={() => setMuted((value) => !value)}
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full border border-white/15 bg-black/45 text-white hover:bg-black/60"
            onClick={() => onOpenChange(false)}
            aria-label="Close watch and learn"
            data-testid="button-close-watch-learn"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>
      {paused ? (
        <p className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/50 px-4 py-2 text-sm font-semibold text-white">
          Paused
        </p>
      ) : null}
    </div>,
    document.body,
  );
}
