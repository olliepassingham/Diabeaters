import { useCallback, useEffect, useMemo, useState } from "react";
import Cropper, { type Area, type MediaSize } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { cropStoryFrameToJpeg } from "@/lib/image-crop";
import { STORY_STAGE_CLASS } from "@/lib/community/story-frame";
import { cn } from "@/lib/utils";

/** Match feed story share export / viewer framing. */
export const STORY_CROP_ASPECT = 9 / 16;
const STORY_OUTPUT_W = 1080;
const STORY_OUTPUT_H = 1920;
/** Floor for pinch / slider — well below “fit” so letterboxing is obvious. */
const STORY_MIN_ZOOM = 0.2;
const STORY_MAX_ZOOM = 3;
const ZOOM_STEP = 0.08;

function clampZoom(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Zoom where a cover-fitted image shows fully inside the 9:16 frame. */
function fitZoomForMedia(media: MediaSize, cropAspect: number): number {
  const mediaAspect =
    media.naturalWidth > 0 && media.naturalHeight > 0
      ? media.naturalWidth / media.naturalHeight
      : media.width / media.height;
  if (!(mediaAspect > 0) || !(cropAspect > 0)) return 1;
  return Math.min(1, Math.min(mediaAspect / cropAspect, cropAspect / mediaAspect));
}

type StoryMediaCropStageProps = {
  imageUrl: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (file: File) => void | Promise<void>;
};

export function StoryMediaCropStage({
  imageUrl,
  busy = false,
  onCancel,
  onConfirm,
}: StoryMediaCropStageProps) {
  const { toast } = useToast();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [fitZoom, setFitZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setFitZoom(1);
    setCroppedAreaPixels(null);
    setSaving(false);
  }, [imageUrl]);

  const onCropAreaChange = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const onMediaLoaded = useCallback((mediaSize: MediaSize) => {
    const nextFit = fitZoomForMedia(mediaSize, STORY_CROP_ASPECT);
    setFitZoom(nextFit);
  }, []);

  const applyZoom = useCallback((next: number) => {
    setZoom(clampZoom(next, STORY_MIN_ZOOM, STORY_MAX_ZOOM));
  }, []);

  async function handleNext() {
    if (!croppedAreaPixels || saving || busy) return;
    setSaving(true);
    let cropped: File;
    try {
      cropped = await cropStoryFrameToJpeg(imageUrl, croppedAreaPixels, {
        width: STORY_OUTPUT_W,
        height: STORY_OUTPUT_H,
        fileName: `story-${Date.now()}.jpg`,
        background: "#000000",
      });
    } catch (err) {
      setSaving(false);
      toast({
        title: "Couldn't adjust that photo",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
      return;
    }
    try {
      await onConfirm(cropped);
    } catch {
      setSaving(false);
    }
  }

  const disabled = saving || busy;
  const showingLetterbox = zoom < fitZoom - 0.02;
  const zoomHint = useMemo(() => {
    if (showingLetterbox) return "Full photo with black bars";
    if (zoom <= 1.02) return "Fills the story frame (edges may crop)";
    return "Zoomed in";
  }, [showingLetterbox, zoom]);

  return (
    <div className="fixed inset-0 z-[150] flex h-dvh max-h-dvh flex-col bg-black text-white touch-manipulation [-webkit-tap-highlight-color:transparent]">
      <div className="flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))] [padding-left:max(0.75rem,env(safe-area-inset-left))] [padding-right:max(0.75rem,env(safe-area-inset-right))]">
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 backdrop-blur-md active:scale-95"
          aria-label="Cancel"
          disabled={disabled}
          onClick={onCancel}
        >
          <X className="h-5 w-5" />
        </button>
        <p className="text-[15px] font-semibold tracking-tight">Adjust photo</p>
        <span className="w-11" aria-hidden />
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-0">
        <div className={cn(STORY_STAGE_CLASS, "bg-black")}>
          <div
            className="absolute inset-0 touch-none overscroll-none"
            style={{ touchAction: "none" }}
          >
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              minZoom={STORY_MIN_ZOOM}
              maxZoom={STORY_MAX_ZOOM}
              aspect={STORY_CROP_ASPECT}
              cropShape="rect"
              showGrid={false}
              // Cover fills the story by default; zoom < 1 letterboxes on black.
              objectFit="cover"
              restrictPosition={false}
              zoomWithScroll={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropAreaChange}
              onCropAreaChange={onCropAreaChange}
              onMediaLoaded={onMediaLoaded}
              classes={{
                containerClassName: "bg-black",
              }}
              style={{
                containerStyle: { background: "#000" },
                cropAreaStyle: {
                  border: "1px solid rgba(255,255,255,0.35)",
                  color: "rgba(0,0,0,0.45)",
                },
              }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 [padding-left:max(1.25rem,env(safe-area-inset-left))] [padding-right:max(1.25rem,env(safe-area-inset-right))]">
        <p className="text-center text-[13px] text-white/70">{zoomHint}</p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            className="h-11 flex-1 rounded-full bg-white/15 text-white hover:bg-white/25"
            disabled={disabled}
            onClick={() => applyZoom(fitZoom)}
          >
            Fit full photo
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-11 flex-1 rounded-full bg-white/15 text-white hover:bg-white/25"
            disabled={disabled}
            onClick={() => applyZoom(1)}
          >
            Fill frame
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 active:scale-95 disabled:opacity-40"
            aria-label="Zoom out"
            disabled={disabled || zoom <= STORY_MIN_ZOOM}
            onClick={() => applyZoom(zoom - ZOOM_STEP)}
          >
            <Minus className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1 space-y-1 py-2">
            <Label htmlFor="story-crop-zoom" className="sr-only">
              Zoom
            </Label>
            <Slider
              id="story-crop-zoom"
              min={STORY_MIN_ZOOM}
              max={STORY_MAX_ZOOM}
              step={0.01}
              value={[zoom]}
              disabled={disabled}
              onValueChange={(value) => applyZoom(value[0] ?? 1)}
              aria-label="Zoom story photo"
              className="h-11 [&_[role=slider]]:h-7 [&_[role=slider]]:w-7 [&_[role=slider]]:border-white [&_[role=slider]]:bg-white [&_.bg-primary]:bg-white [&_.bg-secondary]:bg-white/25 [&_[data-orientation=horizontal]]:h-2"
            />
          </div>
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 active:scale-95 disabled:opacity-40"
            aria-label="Zoom in"
            disabled={disabled || zoom >= STORY_MAX_ZOOM}
            onClick={() => applyZoom(zoom + ZOOM_STEP)}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
        <Button
          type="button"
          className="h-12 w-full rounded-full text-sm font-semibold"
          disabled={disabled || !croppedAreaPixels}
          onClick={() => {
            void handleNext();
          }}
        >
          {saving || busy ? "Preparing…" : "Next"}
        </Button>
      </div>
    </div>
  );
}
