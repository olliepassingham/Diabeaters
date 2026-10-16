import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Check, Minus, Plus } from "lucide-react";
import {
  StoryOverlayLayer,
  storyOverlayClassName,
  storyOverlayInlineStyle,
  storyOverlayWhitespaceClass,
} from "@/components/community/story-overlay-layer";
import {
  MAX_STORY_OVERLAY_TEXT_LENGTH,
  STORY_TEXT_COLORS,
  STORY_TEXT_FONTS,
  STORY_TEXT_SIZES,
  stepStoryTextSize,
  type StoryOverlay,
  type StoryOverlayStyle,
  type StoryTextColor,
  type StoryTextFont,
  type StoryTextSize,
} from "@/lib/community/stories-supabase";
import { cn } from "@/lib/utils";

type Props = {
  overlays: StoryOverlay[];
  onChange: (overlays: StoryOverlay[]) => void;
  children?: ReactNode;
  className?: string;
  onEditingChange?: (editing: boolean) => void;
  /** New text on a light card should start dark so it is readable. */
  newTextColor?: StoryTextColor;
  newTextStyle?: StoryOverlayStyle;
  transparent?: boolean;
};

const TAP_MOVE_PX = 8;
/** Keep text nearly edge-to-edge so placement feels free, not forced. */
const POS_MIN = 0.04;
const POS_MAX = 0.96;

function clampStoryPos(value: number): number {
  return Math.min(POS_MAX, Math.max(POS_MIN, value));
}

export function StoryOverlayEditor({
  overlays,
  onChange,
  children,
  className,
  onEditingChange,
  newTextColor = "white",
  newTextStyle = "shadow",
  transparent = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>(
    null,
  );
  const dragMoved = useRef(false);
  const editingIdRef = useRef<string | null>(null);
  const overlaysRef = useRef(overlays);
  overlaysRef.current = overlays;
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [keyboardInset, setKeyboardInset] = useState(0);

  const editing = overlays.find((o) => o.id === editingId) ?? null;
  editingIdRef.current = editingId;
  const sizeMeta = STORY_TEXT_SIZES.find((s) => s.id === (editing?.size ?? "m")) ?? STORY_TEXT_SIZES[1]!;

  useEffect(() => {
    onEditingChange?.(editingId != null);
  }, [editingId, onEditingChange]);

  useEffect(() => {
    if (!editingId) {
      setKeyboardInset(0);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setKeyboardInset(inset);
      if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [editingId]);

  function placeCaret(el: HTMLElement) {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  const updateOverlay = useCallback(
    (id: string, patch: Partial<StoryOverlay>) => {
      const next = overlaysRef.current.map((o) => (o.id === id ? { ...o, ...patch } : o));
      overlaysRef.current = next;
      onChange(next);
    },
    [onChange],
  );

  function startEdit(overlay: StoryOverlay) {
    const text = overlay.text === "Your text" ? "" : overlay.text;
    flushSync(() => {
      setEditingId(overlay.id);
      setDraftText(text);
    });
    const el = inputRef.current;
    if (!el) return;
    el.textContent = text;
    placeCaret(el);
  }

  function commitEdit() {
    const id = editingIdRef.current;
    if (!id) return;
    editingIdRef.current = null;
    // Preserve intentional blank lines; only trim outer edges.
    const text = draftText.replace(/^\n+|\n+$/g, "").slice(0, MAX_STORY_OVERLAY_TEXT_LENGTH);
    if (!text.trim()) onChange(overlays.filter((o) => o.id !== id));
    else updateOverlay(id, { text });
    setEditingId(null);
    setDraftText("");
    inputRef.current?.blur();
  }

  function toggleStyle() {
    if (!editing) return;
    const next: StoryOverlayStyle = editing.style === "shadow" ? "pill" : "shadow";
    updateOverlay(editing.id, { style: next });
  }

  function setTextColor(color: StoryTextColor) {
    if (!editing) return;
    updateOverlay(editing.id, { color });
  }

  function setTextFont(font: StoryTextFont) {
    if (!editing) return;
    updateOverlay(editing.id, { font });
  }

  function setTextSize(size: StoryTextSize) {
    if (!editing) return;
    updateOverlay(editing.id, { size });
  }

  function nudgeTextSize(delta: -1 | 1) {
    if (!editing) return;
    updateOverlay(editing.id, { size: stepStoryTextSize(editing.size, delta) });
  }

  function pointInStage(clientX: number, clientY: number): { x: number; y: number } | null {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: clampStoryPos((clientX - rect.left) / rect.width),
      y: clampStoryPos((clientY - rect.top) / rect.height),
    };
  }

  function addTextAt(clientX: number, clientY: number) {
    const point = pointInStage(clientX, clientY);
    if (!point) return;
    const overlay: StoryOverlay = {
      id: crypto.randomUUID(),
      text: "",
      x: point.x,
      y: point.y,
      style: newTextStyle,
      color: newTextColor,
      font: "classic",
      size: "m",
    };
    flushSync(() => {
      onChange([...overlays, overlay]);
      setEditingId(overlay.id);
      setDraftText("");
    });
    const el = inputRef.current;
    if (!el) return;
    el.textContent = "";
    placeCaret(el);
  }

  function editingTop(): string {
    if (!editing) return "50%";
    if (keyboardInset < 80 || !containerRef.current) return `${editing.y * 100}%`;
    const height = containerRef.current.clientHeight;
    const natural = editing.y * height;
    const minCenter = 88;
    const maxCenter = height - keyboardInset - 36;
    const lifted = Math.max(minCenter, Math.min(natural, maxCenter));
    return `${lifted}px`;
  }

  function onOverlayPointerDown(overlayId: string, e: ReactPointerEvent) {
    // Allow dragging the active text while editing so placement stays free.
    if (editingId && editingId !== overlayId) return;
    const overlay = overlays.find((o) => o.id === overlayId);
    if (!overlay) return;
    dragMoved.current = false;
    dragRef.current = {
      id: overlayId,
      startX: e.clientX,
      startY: e.clientY,
      originX: overlay.x,
      originY: overlay.y,
    };
    setDraggingId(overlayId);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* The pointer can already be gone; dragging still follows pointermove. */
    }
  }

  function onPointerMove(e: ReactPointerEvent) {
    const drag = dragRef.current;
    const container = containerRef.current;
    if (!drag || !container) return;
    const dxPx = e.clientX - drag.startX;
    const dyPx = e.clientY - drag.startY;
    if (Math.hypot(dxPx, dyPx) > TAP_MOVE_PX) dragMoved.current = true;
    if (!dragMoved.current) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = clampStoryPos(drag.originX + dxPx / rect.width);
    const y = clampStoryPos(drag.originY + dyPx / rect.height);
    updateOverlay(drag.id, { x, y });
    // Keep drag origin tied to finger so continuous moves stay smooth.
    drag.startX = e.clientX;
    drag.startY = e.clientY;
    drag.originX = x;
    drag.originY = y;
  }

  function onPointerUp() {
    const moved = dragMoved.current;
    dragRef.current = null;
    setDraggingId(null);
    if (moved) {
      window.setTimeout(() => {
        dragMoved.current = false;
      }, 0);
    }
  }

  const multilineDraft = draftText.includes("\n");

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden touch-none select-none",
        transparent ? "bg-transparent" : "bg-black",
        className,
      )}
      data-vaul-no-drag
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {children}
      <button
        type="button"
        className="absolute inset-0 z-[1] cursor-text border-0 bg-transparent outline-none [-webkit-tap-highlight-color:transparent]"
        aria-label={editing ? "Finish text" : "Add text"}
        onClick={(e) => {
          if (editingId) {
            commitEdit();
            return;
          }
          addTextAt(e.clientX, e.clientY);
        }}
      />
      {editing ? (
        <div
          className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-b from-black/55 via-black/25 to-black/45"
          aria-hidden
        />
      ) : null}
      <StoryOverlayLayer
        overlays={overlays.filter((o) => o.id !== editingId && o.text.trim())}
        interactive={!editingId}
        selectedOverlayId={draggingId}
        className="z-[3]"
        onOverlayPointerDown={onOverlayPointerDown}
        onOverlayClick={(id) => {
          if (dragMoved.current) {
            dragMoved.current = false;
            return;
          }
          const overlay = overlays.find((o) => o.id === id);
          if (overlay) startEdit(overlay);
        }}
      />
      {editing ? (
        <>
          <div
            className={cn(
              "absolute z-[4] -translate-x-1/2 -translate-y-1/2",
              multilineDraft ? "w-[min(88%,22rem)] max-w-[88%]" : "w-max max-w-[min(96%,42rem)]",
            )}
            style={{ left: `${editing.x * 100}%`, top: editingTop() }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => {
              // Drag the text block to reposition while editing (not from the caret itself).
              if (e.target === inputRef.current || (e.target as HTMLElement).closest?.("[data-story-text]")) {
                e.stopPropagation();
                return;
              }
              e.stopPropagation();
              onOverlayPointerDown(editing.id, e);
            }}
          >
            <div
              className={cn(
                "relative cursor-grab text-center active:cursor-grabbing",
                storyOverlayClassName(editing.style, editing.color, editing.font),
              )}
              style={storyOverlayInlineStyle(editing.color, editing.font, editing.size, editing.style)}
            >
              {!draftText ? (
                <span
                  className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-45"
                  aria-hidden
                  style={{ fontSize: sizeMeta.fontSize, lineHeight: sizeMeta.lineHeight }}
                >
                  Type something
                </span>
              ) : null}
              <div
                ref={inputRef}
                contentEditable
                role="textbox"
                aria-label="Text on your story"
                aria-multiline="true"
                data-story-text
                suppressContentEditableWarning
                className={cn(
                  "relative min-h-[1.2em] min-w-[3ch] text-center outline-none select-text",
                  storyOverlayWhitespaceClass(draftText),
                  editing.color === "black" ? "caret-black" : "caret-white",
                )}
                style={{ WebkitUserSelect: "text", userSelect: "text" }}
                onInput={(e) => {
                  const raw = e.currentTarget.innerText.replace(/\u00a0/g, " ");
                  const next = raw.slice(0, MAX_STORY_OVERLAY_TEXT_LENGTH);
                  if (raw !== next) e.currentTarget.innerText = next;
                  setDraftText(next === "\n" ? "" : next);
                }}
                onBlur={() => {
                  window.setTimeout(() => {
                    if (document.activeElement === inputRef.current) return;
                    if (!editingIdRef.current) return;
                    commitEdit();
                  }, 0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    // Opt-in line breaks only — never auto-wrap into paragraphs for the author.
                    e.preventDefault();
                    document.execCommand("insertLineBreak");
                  }
                }}
              />
            </div>
          </div>

          <div className="absolute inset-x-0 top-[max(0.65rem,env(safe-area-inset-top))] z-[5] flex flex-col items-center gap-2.5 px-3">
            <div className="flex w-full max-w-md items-center justify-between gap-2">
              <button
                type="button"
                className="h-10 rounded-full bg-white/12 px-3.5 text-[13px] font-semibold tracking-wide text-white/95 backdrop-blur-xl ring-1 ring-white/15 active:scale-95"
                onPointerDown={(e) => e.preventDefault()}
                onClick={toggleStyle}
              >
                {editing.style === "pill" ? "Plain" : "Highlight"}
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-semibold tracking-wide text-black shadow-[0_8px_28px_rgba(0,0,0,0.35)] active:scale-95"
                onPointerDown={(e) => e.preventDefault()}
                onClick={commitEdit}
              >
                <Check className="h-4 w-4" aria-hidden />
                Done
              </button>
            </div>

            <div className="flex items-center gap-1 rounded-full bg-black/45 p-1 backdrop-blur-xl ring-1 ring-white/12">
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full text-white active:scale-95 disabled:opacity-35"
                aria-label="Smaller text"
                disabled={editing.size === "s"}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => nudgeTextSize(-1)}
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="flex items-end gap-0.5 px-1 pb-0.5" aria-hidden>
                <span className="text-[11px] font-semibold leading-none text-white/55">A</span>
                <span className="text-[17px] font-bold leading-none text-white">{sizeMeta.label}</span>
              </div>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full text-white active:scale-95 disabled:opacity-35"
                aria-label="Larger text"
                disabled={editing.size === "xl"}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => nudgeTextSize(1)}
              >
                <Plus className="h-4 w-4" />
              </button>
              <div className="mx-0.5 h-5 w-px bg-white/15" aria-hidden />
              {STORY_TEXT_SIZES.map((size) => (
                <button
                  key={size.id}
                  type="button"
                  className={cn(
                    "h-9 min-w-9 rounded-full px-2 text-[12px] font-semibold tracking-wide active:scale-95",
                    editing.size === size.id ? "bg-white text-black" : "text-white/80",
                  )}
                  aria-label={`Text size ${size.label}`}
                  aria-pressed={editing.size === size.id}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => setTextSize(size.id)}
                >
                  {size.label}
                </button>
              ))}
            </div>

            <div className="flex max-w-full gap-1.5 overflow-x-auto rounded-full bg-black/35 p-1 backdrop-blur-xl ring-1 ring-white/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {STORY_TEXT_FONTS.map((font) => (
                <button
                  key={font.id}
                  type="button"
                  className={cn(
                    "h-9 shrink-0 rounded-full px-3.5 text-[13px] active:scale-95",
                    editing.font === font.id ? "bg-white text-black" : "text-white/90",
                  )}
                  style={{ fontFamily: font.family }}
                  aria-pressed={editing.font === font.id}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => setTextFont(font.id)}
                >
                  {font.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 rounded-full bg-black/35 px-2.5 py-1.5 backdrop-blur-xl ring-1 ring-white/10">
              {STORY_TEXT_COLORS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  className={cn(
                    "h-7 w-7 shrink-0 rounded-full border border-white/25 active:scale-95",
                    editing.color === color.id && "ring-2 ring-white ring-offset-2 ring-offset-black/50",
                  )}
                  style={{ backgroundColor: color.hex }}
                  aria-label={color.label}
                  aria-pressed={editing.color === color.id}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => setTextColor(color.id)}
                />
              ))}
            </div>

            <p className="max-w-[18rem] text-center text-[11px] font-medium leading-snug text-white/65">
              Drag outside the text to move · Enter for a new line
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
