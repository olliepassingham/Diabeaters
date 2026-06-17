import { Capacitor } from "@capacitor/core";

const MAX_POST_IMAGES = 4;

/** Collect image files from a file input, respecting the per-post cap. */
export function filesFromImageInput(files: FileList | null, currentCount: number): File[] {
  if (!files?.length) return [];
  const next: File[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (!f || !f.type.startsWith("image/")) continue;
    if (currentCount + next.length >= MAX_POST_IMAGES) break;
    next.push(f);
  }
  return next;
}

/** Native photo library picker; on web, triggers the hidden file input instead. */
export async function pickPostImagesFromLibrary(
  currentCount: number,
  fallbackInput?: HTMLInputElement | null,
): Promise<File[]> {
  const remaining = Math.max(0, MAX_POST_IMAGES - currentCount);
  if (remaining <= 0) return [];

  if (!Capacitor.isNativePlatform()) {
    fallbackInput?.click();
    return [];
  }

  const { Camera } = await import("@capacitor/camera");
  const res = await Camera.pickImages({ limit: remaining });
  const photos = res?.photos ?? [];
  if (photos.length === 0) return [];

  const newFiles: File[] = [];
  for (const p of photos) {
    const webPath = p.webPath?.trim();
    if (!webPath) continue;
    const r = await fetch(webPath);
    const blob = await r.blob();
    if (!blob.type.startsWith("image/")) continue;
    const name = p.path?.split("/").pop()?.trim() || `photo-${Date.now()}.jpg`;
    newFiles.push(new File([blob], name, { type: blob.type }));
    if (currentCount + newFiles.length >= MAX_POST_IMAGES) break;
  }
  return newFiles;
}
