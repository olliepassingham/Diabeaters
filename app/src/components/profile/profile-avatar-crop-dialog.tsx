import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cropImageAreaToJpeg } from "@/lib/image-crop";

const OUTPUT_EDGE_PX = 1024;

type ProfileAvatarCropDialogProps = {
  open: boolean;
  imageUrl: string | null;
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (file: File) => void | Promise<void>;
};

export function ProfileAvatarCropDialog({
  open,
  imageUrl,
  busy = false,
  onOpenChange,
  onConfirm,
}: ProfileAvatarCropDialogProps) {
  const { toast } = useToast();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setSaving(false);
  }, [open, imageUrl]);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleSave() {
    if (!imageUrl || !croppedAreaPixels || saving || busy) return;
    setSaving(true);
    let cropped: File;
    try {
      cropped = await cropImageAreaToJpeg(imageUrl, croppedAreaPixels, {
        width: OUTPUT_EDGE_PX,
        height: OUTPUT_EDGE_PX,
        fileName: `avatar-${Date.now()}.jpg`,
        background: "#ffffff",
      });
    } catch (err) {
      setSaving(false);
      toast({
        title: "Couldn't crop that photo",
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

  const disabled = saving || busy || !imageUrl;

  return (
    <Dialog open={open} onOpenChange={(next) => !disabled && onOpenChange(next)} mobileSheet>
      <DialogContent className="gap-4 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust profile photo</DialogTitle>
          <DialogDescription>
            Drag to move and use the slider to zoom. The circle is what everyone will see.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mx-auto aspect-square w-full max-w-[20rem] overflow-hidden rounded-2xl bg-muted">
          {imageUrl ? (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              objectFit="contain"
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          ) : null}
        </div>

        <div className="space-y-2 px-1">
          <Label htmlFor="avatar-crop-zoom" className="text-xs text-muted-foreground">
            Zoom
          </Label>
          <Slider
            id="avatar-crop-zoom"
            min={1}
            max={3}
            step={0.01}
            value={[zoom]}
            disabled={disabled}
            onValueChange={(value) => setZoom(value[0] ?? 1)}
            aria-label="Zoom profile photo"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={disabled || !croppedAreaPixels}
            onClick={() => {
              void handleSave().catch(() => {
                setSaving(false);
              });
            }}
          >
            {saving || busy ? "Saving…" : "Use photo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
