import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_POST_IMAGES } from "@/lib/community";
import type { usePostEditImages } from "@/hooks/use-post-edit-images";

type PostEditImages = ReturnType<typeof usePostEditImages>;

type Props = {
  images: PostEditImages;
  disabled?: boolean;
};

export function PostEditImagesField({ images, disabled = false }: Props) {
  const {
    fileInputRef,
    previews,
    imageAlts,
    totalCount,
    canAddMore,
    removeAt,
    onPickFromInput,
    pickFromLibrary,
    setAltAt,
  } = images;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm">Photos</Label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {totalCount} / {MAX_POST_IMAGES}
        </span>
      </div>

      {previews.length > 0 ? (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 pt-0.5 [scrollbar-width:thin]">
          {previews.map((item, i) => (
            <div key={item.key} className="relative w-[5.5rem] shrink-0 sm:w-24">
              <div className="relative aspect-square overflow-hidden rounded-lg border border-border/70 bg-muted/30 shadow-sm">
                {item.previewUrl ? (
                  <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                    Loading…
                  </div>
                )}
                <button
                  type="button"
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-background/95 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => removeAt(i)}
                  aria-label={`Remove ${item.label}`}
                  disabled={disabled}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1.5 truncate text-center text-[10px] leading-tight text-muted-foreground sm:text-xs" title={item.label}>
                {item.isNew ? "New" : item.label}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No photos yet. Add one below.</p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        disabled={disabled || !canAddMore}
        onChange={(e) => onPickFromInput(e.target.files)}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 rounded-xl"
        disabled={disabled || !canAddMore}
        onClick={() => void pickFromLibrary()}
      >
        <ImagePlus className="mr-2 h-4 w-4" aria-hidden />
        {canAddMore ? "Add photos" : "Photo limit reached"}
      </Button>

      {previews.length > 0 ? (
        <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-border/50 bg-muted/10 p-3">
          <p className="text-xs font-medium text-foreground">Photo descriptions (optional)</p>
          {previews.map((item, i) => (
            <div key={`${item.key}-alt`} className="space-y-1">
              <Label htmlFor={`post-edit-alt-${i}`} className="text-xs text-muted-foreground">
                Photo {i + 1}
              </Label>
              <Input
                id={`post-edit-alt-${i}`}
                value={imageAlts[i] ?? ""}
                onChange={(e) => setAltAt(i, e.target.value)}
                maxLength={500}
                disabled={disabled}
                placeholder="Short description for screen readers"
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
