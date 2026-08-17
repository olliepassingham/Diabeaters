import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { clickHiddenFileInput, unlockSystemPickerPointerEvents } from "@/lib/click-hidden-file-input";

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

async function fileFromWebPath(webPath: string, name: string): Promise<File | null> {
  const r = await fetch(webPath);
  const blob = await r.blob();
  const type = blob.type.startsWith("image/") ? blob.type : "image/jpeg";
  if (!type.startsWith("image/")) return null;
  return new File([blob], name, { type });
}

/** Native photo library picker; on web, triggers the hidden file input instead. */
export async function pickPostImagesFromLibrary(
  currentCount: number,
  fallbackInput?: HTMLInputElement | null,
): Promise<File[]> {
  const remaining = Math.max(0, MAX_POST_IMAGES - currentCount);
  if (remaining <= 0) return [];

  if (!Capacitor.isNativePlatform()) {
    clickHiddenFileInput(fallbackInput);
    return [];
  }

  const restore = unlockSystemPickerPointerEvents();
  try {
    const res = await Camera.pickImages({ limit: remaining, quality: 90 });
    const photos = res?.photos ?? [];
    if (photos.length === 0) return [];

    const newFiles: File[] = [];
    for (const p of photos) {
      const webPath = p.webPath?.trim();
      if (!webPath) continue;
      const name = p.path?.split("/").pop()?.trim() || `photo-${Date.now()}.jpg`;
      const file = await fileFromWebPath(webPath, name);
      if (!file) continue;
      newFiles.push(file);
      if (currentCount + newFiles.length >= MAX_POST_IMAGES) break;
    }
    return newFiles;
  } finally {
    restore();
  }
}

/** One photo from the library. On web, clicks the fallback input and returns null. */
export async function pickSingleImageFromLibrary(
  fallbackInput?: HTMLInputElement | null,
): Promise<File | null> {
  if (!Capacitor.isNativePlatform()) {
    clickHiddenFileInput(fallbackInput);
    return null;
  }

  const restore = unlockSystemPickerPointerEvents();
  try {
    const photo = await Camera.getPhoto({
      source: CameraSource.Photos,
      resultType: CameraResultType.Uri,
      quality: 90,
    });
    const webPath = photo.webPath?.trim();
    if (!webPath) return null;
    const ext = photo.format ? `.${photo.format}` : ".jpg";
    return await fileFromWebPath(webPath, `photo-${Date.now()}${ext}`);
  } catch {
    return null;
  } finally {
    restore();
  }
}
