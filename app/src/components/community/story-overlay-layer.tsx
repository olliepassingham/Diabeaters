import type { CSSProperties, PointerEvent } from "react";
import { cn } from "@/lib/utils";
import {
  STORY_TEXT_COLORS,
  STORY_TEXT_FONTS,
  STORY_TEXT_SIZES,
  type StoryOverlay,
  type StoryOverlayStyle,
  type StoryTextColor,
  type StoryTextFont,
  type StoryTextSize,
} from "@/lib/community/stories-supabase";

export function storyOverlayClassName(
  style: StoryOverlayStyle,
  color: StoryTextColor = "white",
  font: StoryTextFont = "classic",
): string {
  const face =
    font === "serif" ? "italic" : font === "mono" ? "font-medium tracking-tight" : "font-bold";
  if (style === "pill") {
    return cn(
      "inline-block max-w-full rounded-[1.15rem] px-3.5 py-2 font-semibold backdrop-blur-md",
      color === "black" ? "bg-white/90" : "bg-black/55",
      face,
    );
  }
  return cn(
    "inline-block max-w-full tracking-tight",
    face,
    color === "black"
      ? "drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]"
      : "drop-shadow-[0_2px_10px_rgba(0,0,0,0.88)]",
  );
}

export function storyOverlayInlineStyle(
  color: StoryTextColor,
  font: StoryTextFont,
  size: StoryTextSize = "m",
  style: StoryOverlayStyle = "shadow",
): CSSProperties {
  const scale = STORY_TEXT_SIZES.find((s) => s.id === size) ?? STORY_TEXT_SIZES[1]!;
  return {
    color: STORY_TEXT_COLORS.find((c) => c.id === color)?.hex ?? "#FFFFFF",
    fontFamily: STORY_TEXT_FONTS.find((f) => f.id === font)?.family,
    fontSize: style === "pill" ? scale.pillFontSize : scale.fontSize,
    lineHeight: scale.lineHeight,
  };
}

/** Single line until the author presses Enter — intentional breaks only. */
export function storyOverlayWhitespaceClass(text: string): string {
  return text.includes("\n") ? "whitespace-pre-wrap break-words text-center" : "whitespace-nowrap";
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
      {overlays.map((overlay) => {
        const multiline = overlay.text.includes("\n");
        return (
          <div
            key={overlay.id}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2 text-center",
              multiline ? "max-w-[88%]" : "max-w-[min(96%,42rem)]",
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
              className={cn(
                storyOverlayClassName(overlay.style, overlay.color, overlay.font),
                storyOverlayWhitespaceClass(overlay.text),
              )}
              style={storyOverlayInlineStyle(overlay.color, overlay.font, overlay.size, overlay.style)}
            >
              {overlay.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
