import { useCallback, useEffect, useRef } from "react";
import { Heart } from "lucide-react";

const DOUBLE_TAP_MS = 240;

/**
 * First tap waits briefly. A second tap in that window runs `onDouble` and
 * skips the single-tap action (open a photo, pause a video).
 */
export function useTapSplitter(onDouble: (() => void) | undefined) {
  const timer = useRef<number | null>(null);
  const onDoubleRef = useRef(onDouble);
  onDoubleRef.current = onDouble;

  useEffect(() => {
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    };
  }, []);

  return useCallback((onSingle: () => void) => {
    const double = onDoubleRef.current;
    if (!double) {
      onSingle();
      return;
    }
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
      double();
      return;
    }
    timer.current = window.setTimeout(() => {
      timer.current = null;
      onSingle();
    }, DOUBLE_TAP_MS);
  }, []);
}

export function FeedLikeBurst({ show, onDone }: { show: boolean; onDone: () => void }) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!show) return;
    const timer = window.setTimeout(() => onDoneRef.current(), 720);
    return () => window.clearTimeout(timer);
  }, [show]);

  if (!show) return null;
  return (
    <span className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center" aria-hidden>
      <Heart
        className="h-[4.5rem] w-[4.5rem] fill-white text-white drop-shadow-[0_8px_18px_rgba(0,0,0,0.4)] animate-feed-like-burst"
        strokeWidth={1.25}
      />
    </span>
  );
}
