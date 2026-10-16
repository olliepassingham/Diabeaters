import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { cropImageAreaToJpeg } from "@/lib/image-crop";
import { STORY_STAGE_CLASS } from "@/lib/community/story-frame";
import { cn } from "@/lib/utils";

/** Match feed story share export / viewer framing. */
export const STORY_CROP_ASPECT = 9 / 16;
const STORY_OUTPUT_W = 1080;
const STORY_OUTPUT_H = 1920;

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
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setSaving(false);
  }, [imageUrl]);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleNext() {
    if (!croppedAreaPixels || saving || busy) return;
    setSaving(true);
    let cropped: File;
    try {
      cropped = await cropImageAreaToJpeg(imageUrl, croppedAreaPixels, {
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
          <div className="absolute inset-0">
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={STORY_CROP_ASPECT}
              cropShape="rect"
              showGrid={false}
              objectFit="contain"
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              classes={{
                containerClassName: "bg-black",
                mediaClassName: "max-h-none",
              }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 [padding-left:max(1.25rem,env(safe-area-inset-left))] [padding-right:max(1.25rem,env(safe-area-inset-right))]">
        <p className="text-center text-[13px] text-white/70">Drag to move · pinch or slide to zoom</p>
        <div className="space-y-2">
          <Label htmlFor="story-crop-zoom" className="sr-only">
            Zoom
          </Label>
          <Slider
            id="story-crop-zoom"
            min={1}
            max={3}
            step={0.01}
            value={[zoom]}
            disabled={disabled}
            onValueChange={(value) => setZoom(value[0] ?? 1)}
            aria-label="Zoom story photo"
            className="[&_[role=slider]]:border-white [&_[role=slider]]:bg-white [&_.bg-primary]:bg-white [&_.bg-secondary]:bg-white/25"
          />
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
