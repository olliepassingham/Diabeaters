import type { PointerEvent } from "react";
import { cn } from "@/lib/utils";
import type { StoryOverlay, StoryOverlayStyle } from "@/lib/community/stories-supabase";

export function storyOverlayClassName(style: StoryOverlayStyle): string {
  return style === "pill"
    ? "rounded-full bg-black/55 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur-sm"
    : "text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]";
}

type StoryOverlayLayerProps = {
  overlays: StoryOverlay[];
  className?: string;
  interactive?: boolean;
  selectedOverlayId?: string | null;
  onOverlayPointerDown?: (overlayId: string, e: PointerEvent) => void;
  onOverlayClick?: (overlayId: string) => void;
};

export function StoryOverlayLayer({
  overlays,
  className,
  interactive = false,
  selectedOverlayId,
  onOverlayPointerDown,
  onOverlayClick,
}: StoryOverlayLayerProps) {
  if (overlays.length === 0) return null;

  return (
    <div className={cn("pointer-events-none absolute inset-0", className)} aria-hidden={!interactive}>
      {overlays.map((overlay) => (
        <div
          key={overlay.id}
          className={cn(
            "absolute max-w-[85%] -translate-x-1/2 -translate-y-1/2 text-center",
            interactive && "pointer-events-auto touch-none",
            interactive && selectedOverlayId === overlay.id && "ring-2 ring-white/80 ring-offset-2 ring-offset-transparent rounded-lg",
          )}
          style={{ left: `${overlay.x * 100}%`, top: `${overlay.y * 100}%` }}
          onPointerDown={
            interactive && onOverlayPointerDown
              ? (e) => {
                  e.stopPropagation();
                  onOverlayPointerDown(overlay.id, e);
                }
              : undefined
          }
          onClick={
            interactive && onOverlayClick
              ? (e) => {
                  e.stopPropagation();
                  onOverlayClick(overlay.id);
                }
              : undefined
          }
        >
          <span className={storyOverlayClassName(overlay.style)}>{overlay.text}</span>
        </div>
      ))}
    </div>
  );
}
