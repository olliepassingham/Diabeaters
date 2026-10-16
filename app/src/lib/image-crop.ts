import type { Area } from "react-easy-crop";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read image"));
    img.src = src;
  });
}

export type CropJpegOptions = {
  width: number;
  height: number;
  fileName?: string;
  /** Fill behind transparent / letterboxed regions. */
  background?: string;
  quality?: number;
};

/** Rasterise a react-easy-crop pixel area to a JPEG File. */
export async function cropImageAreaToJpeg(
  imageSrc: string,
  crop: Area,
  options: CropJpegOptions,
): Promise<File> {
  const image = await loadImage(imageSrc);
  const width = Math.max(1, Math.round(options.width));
  const height = Math.max(1, Math.round(options.height));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare image");

  ctx.fillStyle = options.background ?? "#000000";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", options.quality ?? 0.92);
  });
  if (!blob) throw new Error("Could not save cropped photo");
  return new File([blob], options.fileName ?? `crop-${Date.now()}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

/**
 * Story frames can zoom out past “fit”, so the crop area may extend beyond the
 * image. Fill the empty region with a solid background (letterbox / pillarbox).
 */
export async function cropStoryFrameToJpeg(
  imageSrc: string,
  crop: Area,
  options: CropJpegOptions,
): Promise<File> {
  const image = await loadImage(imageSrc);
  const srcW = image.naturalWidth || image.width;
  const srcH = image.naturalHeight || image.height;
  const width = Math.max(1, Math.round(options.width));
  const height = Math.max(1, Math.round(options.height));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare image");

  ctx.fillStyle = options.background ?? "#000000";
  ctx.fillRect(0, 0, width, height);

  if (!(crop.width > 0) || !(crop.height > 0) || !(srcW > 0) || !(srcH > 0)) {
    throw new Error("Could not crop that photo");
  }

  const scaleX = width / crop.width;
  const scaleY = height / crop.height;
  const sx = Math.max(0, crop.x);
  const sy = Math.max(0, crop.y);
  const sx2 = Math.min(srcW, crop.x + crop.width);
  const sy2 = Math.min(srcH, crop.y + crop.height);
  const sw = sx2 - sx;
  const sh = sy2 - sy;
  if (sw > 0 && sh > 0) {
    const dx = (sx - crop.x) * scaleX;
    const dy = (sy - crop.y) * scaleY;
    ctx.drawImage(image, sx, sy, sw, sh, dx, dy, sw * scaleX, sh * scaleY);
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", options.quality ?? 0.92);
  });
  if (!blob) throw new Error("Could not save cropped photo");
  return new File([blob], options.fileName ?? `story-${Date.now()}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}
