import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { Camera, ChevronLeft, ChevronRight, Clock3, ImagePlus, Loader2, RefreshCw, Send, Video, X } from "lucide-react";
import heic2any from "heic2any";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { StoryCameraCapture } from "@/components/community/story-camera-capture";
import { StoryOverlayEditor } from "@/components/community/story-overlay-editor";
import { StorySharedPostStage } from "@/components/community/story-shared-post-stage";
import { useToast } from "@/hooks/use-toast";
import { clickHiddenFileInput, FILE_INPUT_HIDDEN_CLASS, isFilePickerActive } from "@/lib/click-hidden-file-input";
import { STORY_MEDIA_CLASS, STORY_STAGE_CLASS } from "@/lib/community/story-frame";
import { cn } from "@/lib/utils";
import { pickSinglePhoto } from "@/lib/community/pick-post-images";
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

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

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

function StoryChoiceRow({
  icon,
  title,
  hint,
  prominent,
  onClick,
  accept,
  capture,
  onFile,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  prominent?: boolean;
  onClick?: () => void;
  accept?: string;
  capture?: "environment" | "user";
  onFile?: (file: File) => void;
}) {
  const className = cn(
    "relative flex min-h-[4.75rem] w-full items-center gap-3.5 overflow-hidden rounded-[1.35rem] px-4 text-left transition-transform active:scale-[0.99]",
    prominent
      ? "bg-primary text-primary-foreground shadow-sm"
      : "border border-border/50 bg-card text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04)] active:bg-muted/70",
  );
  const body = (
    <>
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
          prominent ? "bg-primary-foreground/15" : "bg-primary/10 text-primary",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold tracking-tight">{title}</span>
        <span
          className={cn(
            "mt-0.5 block text-[13px] leading-snug",
            prominent ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {hint}
        </span>
      </span>
      <ChevronRight
        className={cn("h-4 w-4 shrink-0", prominent ? "text-primary-foreground/75" : "text-muted-foreground/80")}
        aria-hidden
      />
    </>
  );
  if (onFile && accept) {
    return (
      <label className={className}>
        {body}
        <input
          type="file"
          accept={accept}
          {...(capture ? { capture } : {})}
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
          onChange={(event) => {
            const picked = event.target.files?.[0] ?? null;
            event.target.value = "";
            if (picked) onFile(picked);
          }}
        />
      </label>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
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
  const pickingRef = useRef(false);
  const nativeApp = Capacitor.isNativePlatform();
  const systemStoryPicker = nativeApp || isIosDevice();
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

  async function choosePhoto(source: CameraSource) {
    if (pickingRef.current) return;
    pickingRef.current = true;
    try {
      const picked = await pickSinglePhoto(source, nativeApp ? null : photoInputRef.current);
      if (picked) await applyPickedFile(picked);
    } catch (err) {
      toast({
        title: "Couldn't open that",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      pickingRef.current = false;
    }
  }

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
            className={cn(
              "fixed inset-0 z-[140] flex h-dvh max-h-dvh touch-manipulation [-webkit-tap-highlight-color:transparent]",
              linkedPostId
                ? "bg-background text-foreground"
                : "items-center justify-center bg-black text-white",
            )}
          >
            <div
              className={linkedPostId ? "relative h-full w-full" : STORY_STAGE_CLASS}
              data-testid="story-editor-stage"
            >
            {linkedPostId ? (
              <StorySharedPostStage
                postId={linkedPostId}
                onOpenPost={() => {}}
                onOpenAuthor={() => {}}
              />
            ) : (
            <StoryOverlayEditor
              overlays={overlays}
              onChange={setOverlays}
              onEditingChange={setTextEditing}
              className="absolute inset-0"
            >
              {file?.type.startsWith("video/") ? (
                <video
                  src={preview}
                  className={STORY_MEDIA_CLASS}
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : (
                <img src={preview} alt="" className={STORY_MEDIA_CLASS} />
              )}
            </StoryOverlayEditor>
            )}

            {!textEditing ? (
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))] [padding-left:max(0.75rem,env(safe-area-inset-left))] [padding-right:max(0.75rem,env(safe-area-inset-right))]">
                <button
                  type="button"
                  className={cn(
                    "pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md active:scale-95",
                    linkedPostId
                      ? "bg-card text-foreground shadow-sm ring-1 ring-border/60"
                      : "bg-black/45 text-white",
                  )}
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
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md active:scale-95",
                    linkedPostId
                      ? "bg-card text-foreground shadow-sm ring-1 ring-border/60"
                      : "bg-black/45 text-white",
                  )}
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

  if (open && !prefillFile && systemStoryPicker && typeof document !== "undefined") {
    return (
      <>
        {fileInputs}
        {createPortal(
          <div className="fixed inset-0 z-[160] flex flex-col bg-background text-foreground">
            <div className="px-2 pt-[max(0.35rem,env(safe-area-inset-top))] [padding-left:max(0.5rem,env(safe-area-inset-left))] [padding-right:max(0.5rem,env(safe-area-inset-right))]">
              <button
                type="button"
                className="flex h-11 items-center gap-0.5 rounded-full px-2 text-[17px] font-semibold text-primary active:opacity-70"
                aria-label="Back to feed"
                onClick={() => {
                  reset();
                  onOpenChange(false);
                }}
              >
                <ChevronLeft className="h-6 w-6" aria-hidden />
                Feed
              </button>
            </div>
            <div className="px-5 pb-1 pt-2">
              <h1 className="font-display text-[1.7rem] font-semibold tracking-tight">New story</h1>
              <p className="mt-1.5 max-w-[22rem] text-[15px] leading-snug text-muted-foreground">
                People who follow you can see it for 24 hours.
              </p>
            </div>
            <div className="mt-5 flex flex-col gap-2.5 px-4">
              <StoryChoiceRow
                prominent
                icon={<Camera className="h-5 w-5 shrink-0" aria-hidden />}
                title="Take a photo"
                hint="Opens your camera"
                accept="image/*"
                capture="environment"
                onFile={(picked) => void applyPickedFile(picked)}
              />
              <StoryChoiceRow
                icon={<ImagePlus className="h-5 w-5 shrink-0" aria-hidden />}
                title="Choose a photo"
                hint="From your library"
                onClick={() => void choosePhoto(CameraSource.Photos)}
              />
              <StoryChoiceRow
                icon={<Video className="h-5 w-5 shrink-0" aria-hidden />}
                title="Choose a video"
                hint="From your library"
                accept="video/*"
                onFile={(picked) => void applyPickedFile(picked)}
              />
            </div>
            <p className="mt-auto flex items-center justify-center gap-2 px-6 pb-[max(1.35rem,env(safe-area-inset-bottom))] text-center text-[13px] leading-snug text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>Up to {maxMb} MB. Record a video in the Camera app, then choose it here.</span>
            </p>
          </div>,
          document.body,
        )}
      </>
    );
  }

  if (open && !prefillFile) {
    return (
      <>
        {fileInputs}
        <StoryCameraCapture
          active={open}
          onClose={() => {
            reset();
            onOpenChange(false);
          }}
          onCapture={(picked) => {
            void applyPickedFile(picked);
          }}
          onLibrary={(mode) => {
            if (mode === "video") {
              clickHiddenFileInput(videoInputRef.current);
              return;
            }
            void choosePhoto(CameraSource.Photos);
          }}
        />
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
                onClick={() => void choosePhoto(CameraSource.Photos)}
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
