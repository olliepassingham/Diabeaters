import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DISMISS_DRAG_PX = 72;
const NAV_DRAG_PX = 56;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  slideLabel?: string;
  onPrev?: () => void;
  onNext?: () => void;
  className?: string;
};

/**
 * Full-screen media viewer with swipe-down (or swipe-away) to dismiss on touch devices.
 */
export function FeedMediaLightbox({
  open,
  onOpenChange,
  children,
  slideLabel,
  onPrev,
  onNext,
  className,
}: Props) {
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const dragRef = useRef({ x: 0, y: 0 });
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!open) {
      dragRef.current = { x: 0, y: 0 };
      setDrag({ x: 0, y: 0 });
      setDragging(false);
      touchStart.current = null;
      return;
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft" && onPrev) onPrev();
      if (e.key === "ArrowRight" && onNext) onNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close, onPrev, onNext]);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    if (!t) return;
    touchStart.current = { x: t.clientX, y: t.clientY };
    setDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    if (Math.abs(dy) > Math.abs(dx) && dy > 0) {
      dragRef.current = { x: 0, y: dy };
      setDrag({ x: 0, y: dy });
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) {
      dragRef.current = { x: dx, y: 0 };
      setDrag({ x: dx, y: 0 });
      return;
    }
    dragRef.current = { x: 0, y: 0 };
    setDrag({ x: 0, y: 0 });
  };

  const onTouchEnd = () => {
    if (!touchStart.current) return;
    const { x, y } = dragRef.current;
    if (y >= DISMISS_DRAG_PX) {
      close();
    } else if (!onPrev && !onNext && Math.abs(x) >= NAV_DRAG_PX && Math.abs(x) > y) {
      close();
    } else if (x <= -NAV_DRAG_PX && onNext) {
      onNext();
    } else if (x >= NAV_DRAG_PX && onPrev) {
      onPrev();
    }
    touchStart.current = null;
    dragRef.current = { x: 0, y: 0 };
    setDragging(false);
    setDrag({ x: 0, y: 0 });
  };

  if (!open || typeof document === "undefined") return null;

  const dismissProgress = Math.min(1, drag.y / 220);
  const backdropOpacity = 0.96 - dismissProgress * 0.5;

  return createPortal(
    <div
      className={cn("fixed inset-0 z-[120] flex flex-col", className)}
      role="dialog"
      aria-modal="true"
      aria-label="Media viewer"
      data-testid="feed-media-lightbox"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black transition-opacity"
        style={{ opacity: backdropOpacity }}
        aria-label="Close media"
        onClick={close}
      />

      <div className="pointer-events-none relative z-10 flex items-center justify-between px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {slideLabel ? (
          <span className="pointer-events-auto rounded-full bg-black/50 px-2.5 py-1 text-xs text-white/90 backdrop-blur-sm">
            {slideLabel}
          </span>
        ) : (
          <span />
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="pointer-events-auto rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-sm hover:bg-black/60"
          onClick={close}
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div
        className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {onPrev ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-sm hover:bg-black/60 sm:inline-flex"
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
            aria-label="Previous"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        ) : null}

        {onNext ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-sm hover:bg-black/60 sm:inline-flex"
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            aria-label="Next"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        ) : null}

        <div
          className={cn(
            "relative max-h-full w-full max-w-[min(100%,48rem)] touch-pan-y",
            dragging ? "transition-none" : "transition-transform duration-200 ease-out",
          )}
          style={{
            transform: `translate3d(${drag.x}px, ${drag.y}px, 0) scale(${1 - dismissProgress * 0.06})`,
            opacity: 1 - dismissProgress * 0.35,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
