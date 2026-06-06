import { useRef, useState, type ReactNode } from "react";
import { BellOff, EyeOff, Pin } from "lucide-react";

import { cn } from "@/lib/utils";

const ACTION_WIDTH = 56;
const OPEN_THRESHOLD = 36;
const MAX_SWIPE = ACTION_WIDTH * 3;

type DmInboxSwipeRowProps = {
  children: ReactNode;
  isPinned: boolean;
  isMuted: boolean;
  onPin: () => void;
  onMute: () => void;
  onHide: () => void;
};

export function DmInboxSwipeRow({
  children,
  isPinned,
  isMuted,
  onPin,
  onMute,
  onHide,
}: DmInboxSwipeRowProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);
  const startOffsetRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);

  function snapOpen() {
    setOffsetX(-MAX_SWIPE);
  }

  function snapClosed() {
    setOffsetX(0);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointerIdRef.current = e.pointerId;
    startXRef.current = e.clientX;
    startOffsetRef.current = offsetX;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== e.pointerId) return;
    const delta = e.clientX - startXRef.current;
    const next = Math.max(-MAX_SWIPE, Math.min(0, startOffsetRef.current + delta));
    setOffsetX(next);
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== e.pointerId) return;
    pointerIdRef.current = null;
    setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (offsetX <= -OPEN_THRESHOLD) snapOpen();
    else snapClosed();
  }

  function runAction(action: () => void) {
    action();
    snapClosed();
  }

  return (
    <div className="relative overflow-hidden" data-testid="dm-inbox-swipe-row">
      <div
        className="absolute inset-y-0 right-0 flex items-stretch"
        aria-hidden={offsetX === 0}
      >
        <button
          type="button"
          className="flex w-14 flex-col items-center justify-center gap-0.5 bg-amber-500/90 text-[10px] font-medium text-white"
          aria-label={isPinned ? "Unpin conversation" : "Pin conversation"}
          onClick={() => runAction(onPin)}
        >
          <Pin className="h-4 w-4" />
          {isPinned ? "Unpin" : "Pin"}
        </button>
        <button
          type="button"
          className="flex w-14 flex-col items-center justify-center gap-0.5 bg-sky-600/90 text-[10px] font-medium text-white"
          aria-label={isMuted ? "Unmute conversation" : "Mute conversation"}
          onClick={() => runAction(onMute)}
        >
          <BellOff className="h-4 w-4" />
          {isMuted ? "Unmute" : "Mute"}
        </button>
        <button
          type="button"
          className="flex w-14 flex-col items-center justify-center gap-0.5 bg-rose-600/90 text-[10px] font-medium text-white"
          aria-label="Hide conversation"
          onClick={() => runAction(onHide)}
        >
          <EyeOff className="h-4 w-4" />
          Hide
        </button>
      </div>

      <div
        className={cn(
          "relative bg-card/60 touch-pan-y",
          !dragging && "transition-transform duration-200 ease-out",
        )}
        style={{ transform: `translateX(${offsetX}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {children}
      </div>
    </div>
  );
}
