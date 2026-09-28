import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Check } from "lucide-react";
import { StoryOverlayLayer, storyOverlayClassName } from "@/components/community/story-overlay-layer";
import {
  MAX_STORY_OVERLAY_TEXT_LENGTH,
  type StoryOverlay,
  type StoryOverlayStyle,
} from "@/lib/community/stories-supabase";
import { cn } from "@/lib/utils";

type Props = {
  overlays: StoryOverlay[];
  onChange: (overlays: StoryOverlay[]) => void;
  children: ReactNode;
  className?: string;
  onEditingChange?: (editing: boolean) => void;
};

const TAP_MOVE_PX = 8;

export function StoryOverlayEditor({ overlays, onChange, children, className, onEditingChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>(
    null,
  );
  const dragMoved = useRef(false);
  const editingIdRef = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [keyboardInset, setKeyboardInset] = useState(0);

  const editing = overlays.find((o) => o.id === editingId) ?? null;
  editingIdRef.current = editingId;

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
      onChange(overlays.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    },
    [onChange, overlays],
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
    const text = draftText.trim().slice(0, MAX_STORY_OVERLAY_TEXT_LENGTH);
    if (!text) onChange(overlays.filter((o) => o.id !== id));
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

  function pointInStage(clientX: number, clientY: number): { x: number; y: number } | null {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: Math.min(0.86, Math.max(0.14, (clientX - rect.left) / rect.width)),
      y: Math.min(0.74, Math.max(0.2, (clientY - rect.top) / rect.height)),
    };
  }

  function addTextAt(clientX: number, clientY: number) {
    const point = pointInStage(clientX, clientY);
    if (!point) return;
    const overlay: StoryOverlay = {
      id: crypto.randomUUID(),
      text: "",
      x: 0.5,
      y: point.y,
      style: "shadow",
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
    const minCenter = 72;
    const maxCenter = height - keyboardInset - 28;
    const lifted = Math.max(minCenter, Math.min(natural, maxCenter));
    return `${lifted}px`;
  }

  function onOverlayPointerDown(overlayId: string, e: ReactPointerEvent) {
    if (editingId) return;
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
    if (!drag || !container || editingId) return;
    const dxPx = e.clientX - drag.startX;
    const dyPx = e.clientY - drag.startY;
    if (Math.hypot(dxPx, dyPx) > TAP_MOVE_PX) dragMoved.current = true;
    if (!dragMoved.current) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = Math.min(0.86, Math.max(0.14, drag.originX + dxPx / rect.width));
    const y = Math.min(0.74, Math.max(0.18, drag.originY + dyPx / rect.height));
    updateOverlay(drag.id, { x, y });
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

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden bg-black touch-none select-none", className)}
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
      {editing ? <div className="pointer-events-none absolute inset-0 z-[2] bg-black/35" aria-hidden /> : null}
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
            className="absolute z-[4] w-[86%] max-w-md -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${editing.x * 100}%`, top: editingTop() }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className={cn("relative text-center", storyOverlayClassName(editing.style))}>
              {!draftText ? (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-white/50" aria-hidden>
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
                className="relative min-h-[1.3em] w-full whitespace-pre-wrap break-words text-center caret-white outline-none select-text"
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
                    e.preventDefault();
                    document.execCommand("insertLineBreak");
                  }
                }}
              />
            </div>
          </div>
          <div className="absolute inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[5] flex items-center justify-center gap-2 px-3">
            <button
              type="button"
              className="h-11 rounded-full bg-white/15 px-4 text-sm font-semibold text-white backdrop-blur-md active:scale-95"
              onPointerDown={(e) => e.preventDefault()}
              onClick={toggleStyle}
            >
              {editing.style === "pill" ? "Plain" : "Highlight"}
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center gap-1 rounded-full bg-white px-4 text-sm font-semibold text-black active:scale-95"
              onPointerDown={(e) => e.preventDefault()}
              onClick={commitEdit}
            >
              <Check className="h-4 w-4" aria-hidden />
              Done
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
