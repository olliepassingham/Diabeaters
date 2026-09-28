import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Clock3, ImagePlus, Loader2, RefreshCw, Send, Video, X } from "lucide-react";
import heic2any from "heic2any";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { StoryOverlayEditor } from "@/components/community/story-overlay-editor";
import { useToast } from "@/hooks/use-toast";
import { clickHiddenFileInput, FILE_INPUT_HIDDEN_CLASS, isFilePickerActive } from "@/lib/click-hidden-file-input";
import { pickSingleImageFromLibrary } from "@/lib/community/pick-post-images";
import {
  insertCommunityStory,
  MAX_STORY_BYTES,
  MAX_STORY_OVERLAY_TEXT_LENGTH,
  type StoryOverlay,
} from "@/lib/community/stories-supabase";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPosted?: () => void;
  /** Opens the composer with this file already selected (e.g. share a post photo). */
  prefillFile?: File | null;
  /** Optional credit overlay (e.g. @handle when sharing someone else's post). */
  prefillOverlayText?: string | null;
  /** Feed post this story should link back to (cleared if the user changes media). */
  sourcePostId?: string | null;
};

function isHeicFile(file: File): boolean {
  const t = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return t === "image/heic" || t === "image/heif" || name.endsWith(".heic") || name.endsWith(".heif");
}

async function jpegFromHeic(file: File): Promise<File> {
  const converted = (await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.9,
  })) as Blob | Blob[];
  const blob = Array.isArray(converted) ? converted[0] : converted;
  if (!blob) throw new Error("No image data returned");
  const base = file.name.replace(/\.(heic|heif)$/i, "") || "photo";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

function MediaPickCard({
  icon,
  title,
  hint,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[9.5rem] flex-1 flex-col items-center justify-center gap-3 rounded-[1.35rem] border border-border/50 bg-gradient-to-b from-primary/[0.07] to-muted/20 px-3 py-6 text-center shadow-sm outline-none transition-colors hover:border-primary/35 hover:from-primary/[0.11] hover:to-muted/30 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background/80 text-primary shadow-sm ring-1 ring-border/40 transition-transform group-hover:scale-[1.03]">
        {icon}
      </span>
      <span className="space-y-0.5">
        <span className="block text-sm font-semibold tracking-tight text-foreground">{title}</span>
        <span className="block text-[11px] text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

export function StoryCreateSheet({
  open,
  onOpenChange,
  onPosted,
  prefillFile,
  prefillOverlayText,
  sourcePostId,
}: Props) {
  const { toast } = useToast();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [overlays, setOverlays] = useState<StoryOverlay[]>([]);
  const [busy, setBusy] = useState(false);
  const [textEditing, setTextEditing] = useState(false);
  const [linkedPostId, setLinkedPostId] = useState<string | null>(null);
  const appliedPrefill = useRef<File | null>(null);
  const hasMedia = Boolean(preview && file);
  const hasMediaRef = useRef(hasMedia);
  hasMediaRef.current = hasMedia;

  function reset() {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setOverlays([]);
    setTextEditing(false);
    setLinkedPostId(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
  }

  useEffect(() => {
    if (!hasMedia) return;
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    return () => {
      body.style.overflow = prev.overflow;
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, [hasMedia]);

  useEffect(() => {
    if (!open) {
      appliedPrefill.current = null;
      return;
    }
    if (!prefillFile || appliedPrefill.current === prefillFile) return;
    appliedPrefill.current = prefillFile;
    setFile(prefillFile);
    setLinkedPostId(sourcePostId?.trim() || null);
    const credit = prefillOverlayText?.trim().slice(0, MAX_STORY_OVERLAY_TEXT_LENGTH);
    setOverlays(
      credit
        ? [{ id: crypto.randomUUID(), text: credit, x: 0.5, y: 0.72, style: "pill", color: "white", font: "classic" }]
        : [],
    );
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(prefillFile);
    });
  }, [open, prefillFile, prefillOverlayText, sourcePostId]);

  function onPick(files: FileList | null) {
    const picked = files?.[0] ?? null;
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
    if (!picked) return;
    void applyPickedFile(picked);
  }

  async function applyPickedFile(f: File) {
    let next = f;
    if (isHeicFile(f)) {
      try {
        next = await jpegFromHeic(f);
      } catch (err) {
        toast({
          title: "Could not read that photo",
          description: err instanceof Error ? err.message : "Try a JPG or PNG.",
          variant: "destructive",
        });
        return;
      }
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setOverlays([]);
    setLinkedPostId(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
    onOpenChange(true);
  }

  async function handlePost() {
    if (!file || busy) return;
    setBusy(true);
    const res = await insertCommunityStory(file, {
      overlays: overlays.filter((o) => o.text.trim()),
      sourcePostId: linkedPostId,
    });
    setBusy(false);
    if (res.error) {
      toast({ title: "Story failed", description: res.error.message, variant: "destructive" });
      return;
    }
    reset();
    onOpenChange(false);
    onPosted?.();
    toast({ title: "Story shared", description: "Visible for 24 hours." });
  }

  const maxMb = Math.round(MAX_STORY_BYTES / (1024 * 1024));
  const fileInputs =
    typeof document !== "undefined"
      ? createPortal(
          <>
            <input
              ref={photoInputRef}
              id="story-photo-input"
              type="file"
              accept="image/*,.heic,.heif"
              className={FILE_INPUT_HIDDEN_CLASS}
              onChange={(e) => onPick(e.target.files)}
            />
            <input
              ref={videoInputRef}
              id="story-video-input"
              type="file"
              accept="video/*"
              className={FILE_INPUT_HIDDEN_CLASS}
              onChange={(e) => onPick(e.target.files)}
            />
          </>,
          document.body,
        )
      : null;

  if (hasMedia && preview && typeof document !== "undefined") {
    return (
      <>
        {fileInputs}
        {createPortal(
          <div
            data-story-stage
            className="fixed inset-0 z-[140] flex h-dvh max-h-dvh items-center justify-center bg-black text-white touch-manipulation [-webkit-tap-highlight-color:transparent]"
          >
            <div
              className="relative h-full w-full max-w-[min(100%,calc(100dvh*9/16))] overflow-hidden"
              data-testid="story-editor-stage"
            >
            <StoryOverlayEditor
              overlays={overlays}
              onChange={setOverlays}
              onEditingChange={setTextEditing}
              className="absolute inset-0"
            >
              {file?.type.startsWith("video/") ? (
                <video
                  src={preview}
                  className="h-full w-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : (
                <img
                  src={preview}
                  alt=""
                  className={linkedPostId ? "h-full w-full object-contain" : "h-full w-full object-cover"}
                />
              )}
            </StoryOverlayEditor>

            {!textEditing ? (
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))] [padding-left:max(0.75rem,env(safe-area-inset-left))] [padding-right:max(0.75rem,env(safe-area-inset-right))]">
                <button
                  type="button"
                  className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md active:scale-95"
                  aria-label="Close story"
                  onClick={() => {
                    reset();
                    onOpenChange(false);
                  }}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ) : null}

            {!textEditing && !linkedPostId && overlays.every((o) => !o.text.trim()) ? (
              <p className="pointer-events-none absolute inset-x-0 bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] z-10 px-16 text-center text-[13px] font-medium tracking-wide text-white/75 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                Tap the photo to add text
              </p>
            ) : null}

            {!textEditing ? (
              <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]">
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md active:scale-95"
                  aria-label="Change photo or video"
                  onClick={reset}
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                <span className="flex-1" />
                <Button
                  type="button"
                  className="h-11 rounded-full px-5 text-sm font-semibold shadow-lg active:scale-95"
                  disabled={!file || busy}
                  onClick={() => void handlePost()}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" aria-hidden />}
                  {busy ? "Sharing" : "Share"}
                </Button>
              </div>
            ) : null}
            </div>
          </div>,
          document.body,
        )}
      </>
    );
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          if (isFilePickerActive() || hasMediaRef.current) return;
          reset();
        }
        onOpenChange(v);
      }}
      title="New story"
      description="Visible for 24 hours on your profile."
      bodyClassName="flex min-h-0 flex-col overflow-hidden"
    >
      {fileInputs}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3">
          <div className="space-y-4 pt-1">
            <div className="flex gap-2.5">
              <MediaPickCard
                icon={<ImagePlus className="h-6 w-6" aria-hidden />}
                title="Photo"
                hint="JPG or PNG"
                onClick={() => {
                  void (async () => {
                    const picked = await pickSingleImageFromLibrary(photoInputRef.current);
                    if (picked) await applyPickedFile(picked);
                  })();
                }}
              />
              <MediaPickCard
                icon={<Video className="h-6 w-6" aria-hidden />}
                title="Video"
                hint="MP4, MOV, WebM"
                onClick={() => clickHiddenFileInput(videoInputRef.current)}
              />
            </div>
            <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>Friends can rewatch until it expires · up to {maxMb} MB</span>
            </div>
          </div>
      </div>
    </BottomSheet>
  );
}
