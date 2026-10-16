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
