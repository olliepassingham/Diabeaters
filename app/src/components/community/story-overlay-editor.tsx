import { useCallback, useRef, useState, type ReactNode } from "react";
import { Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StoryOverlayLayer } from "@/components/community/story-overlay-layer";
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
};

function defaultOverlay(): StoryOverlay {
  return {
    id: crypto.randomUUID(),
    text: "Your text",
    x: 0.5,
    y: 0.4,
    style: "shadow",
  };
}

export function StoryOverlayEditor({ overlays, onChange, children, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>(
    null,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");

  const selected = overlays[0] ?? null;

  const updateOverlay = useCallback(
    (id: string, patch: Partial<StoryOverlay>) => {
      onChange(overlays.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    },
    [onChange, overlays],
  );

  function startEdit(overlay: StoryOverlay) {
    setEditingId(overlay.id);
    setDraftText(overlay.text);
  }

  function commitEdit() {
    if (!editingId) return;
    const text = draftText.trim();
    if (!text) {
      onChange(overlays.filter((o) => o.id !== editingId));
    } else {
      updateOverlay(editingId, { text: text.slice(0, MAX_STORY_OVERLAY_TEXT_LENGTH) });
    }
    setEditingId(null);
    setDraftText("");
  }

  function toggleStyle() {
    if (!selected) return;
    const next: StoryOverlayStyle = selected.style === "shadow" ? "pill" : "shadow";
    updateOverlay(selected.id, { style: next });
  }

  function addOverlay() {
    const overlay = defaultOverlay();
    onChange([overlay]);
    startEdit(overlay);
  }

  function onPointerDown(overlayId: string, e: React.PointerEvent) {
    const container = containerRef.current;
    if (!container) return;
    const overlay = overlays.find((o) => o.id === overlayId);
    if (!overlay) return;
    dragRef.current = {
      id: overlayId,
      startX: e.clientX,
      startY: e.clientY,
      originX: overlay.x,
      originY: overlay.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    const container = containerRef.current;
    if (!drag || !container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dx = (e.clientX - drag.startX) / rect.width;
    const dy = (e.clientY - drag.startY) / rect.height;
    const x = Math.min(0.92, Math.max(0.08, drag.originX + dx));
    const y = Math.min(0.92, Math.max(0.08, drag.originY + dy));
    updateOverlay(drag.id, { x, y });
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className={cn("relative overflow-hidden rounded-xl border border-border/50 bg-black", className)}
        data-vaul-no-drag
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {children}
        <StoryOverlayLayer
          overlays={overlays}
          interactive
          selectedOverlayId={selected?.id ?? null}
          onOverlayPointerDown={onPointerDown}
          onOverlayClick={(id) => {
            const overlay = overlays.find((o) => o.id === id);
            if (overlay) startEdit(overlay);
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {overlays.length === 0 ? (
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addOverlay}>
            <Type className="h-4 w-4" />
            Add text
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" size="sm" onClick={toggleStyle}>
              Style: {selected?.style === "pill" ? "Pill" : "Shadow"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => selected && startEdit(selected)}>
              Edit text
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
              Remove text
            </Button>
          </>
        )}
      </div>

      {editingId ? (
        <div className="flex gap-2">
          <Input
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            maxLength={MAX_STORY_OVERLAY_TEXT_LENGTH}
            placeholder="Text on your story"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitEdit();
              }
            }}
          />
          <Button type="button" size="sm" onClick={commitEdit}>
            Done
          </Button>
        </div>
      ) : null}
    </div>
  );
}
