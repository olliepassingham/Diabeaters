import type { CSSProperties, PointerEvent } from "react";
import { cn } from "@/lib/utils";
import {
  STORY_TEXT_COLORS,
  STORY_TEXT_FONTS,
  type StoryOverlay,
  type StoryOverlayStyle,
  type StoryTextColor,
  type StoryTextFont,
} from "@/lib/community/stories-supabase";

export function storyOverlayClassName(
  style: StoryOverlayStyle,
  color: StoryTextColor = "white",
  font: StoryTextFont = "classic",
): string {
  const face =
    font === "serif" ? "italic" : font === "mono" ? "text-[1.2rem] font-medium tracking-tight" : "font-bold";
  if (style === "pill") {
    return cn(
      "rounded-full px-3.5 py-2 text-xl font-semibold backdrop-blur-md",
      color === "black" ? "bg-white/90" : "bg-black/55",
      face,
    );
  }
  return cn(
    "text-[1.65rem] leading-tight tracking-tight",
    face,
    color === "black"
      ? "drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]"
      : "drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]",
  );
}

export function storyOverlayInlineStyle(color: StoryTextColor, font: StoryTextFont): CSSProperties {
  return {
    color: STORY_TEXT_COLORS.find((c) => c.id === color)?.hex ?? "#FFFFFF",
    fontFamily: STORY_TEXT_FONTS.find((f) => f.id === font)?.family,
  };
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
            interactive && "pointer-events-auto touch-none px-2 py-1.5",
            interactive && selectedOverlayId === overlay.id && "rounded-lg ring-2 ring-white/70",
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
          <span
            className={storyOverlayClassName(overlay.style, overlay.color, overlay.font)}
            style={storyOverlayInlineStyle(overlay.color, overlay.font)}
          >
            {overlay.text}
          </span>
        </div>
      ))}
    </div>
  );
}
