import { Camera, MediaType, MediaTypeSelection, type MediaResult } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { beginFilePickerHold, unlockSystemPickerPointerEvents } from "@/lib/click-hidden-file-input";

const CHOOSE_MEDIA_CANCELLED = "OS-PLUG-CAMR-0020";

export function storyVideoFileMeta(format: string | undefined): { ext: string; type: string } {
  const kind = (format || "").toLowerCase().replace(/^video\//, "");
  if (kind === "quicktime" || kind === "mov") return { ext: "mov", type: "video/quicktime" };
  if (kind === "webm") return { ext: "webm", type: "video/webm" };
  return { ext: "mp4", type: "video/mp4" };
}

export function isGalleryPickerCancel(error: unknown): boolean {
  if (error == null) return false;
  const record = typeof error === "object" ? (error as { code?: unknown; message?: unknown }) : null;
  const code = record ? String(record.code ?? "") : "";
  const message = record ? String(record.message ?? "") : String(error);
  return code === CHOOSE_MEDIA_CANCELLED || /cancel/i.test(message);
}

export const isStoryVideoPickerCancel = isGalleryPickerCancel;

export function imageFileMeta(format: string | undefined): { ext: string; type: string } {
  const kind = (format || "").toLowerCase().replace(/^image\//, "");
  if (kind === "png") return { ext: "png", type: "image/png" };
  if (kind === "gif") return { ext: "gif", type: "image/gif" };
  if (kind === "webp") return { ext: "webp", type: "image/webp" };
  if (kind === "heic" || kind === "heif") return { ext: "heic", type: "image/heic" };
  return { ext: "jpg", type: "image/jpeg" };
}

/**
 * Read bytes from a Capacitor gallery/camera URL.
 * On iPhone, `fetch(capacitor://…)` often throws "Load failed" for camera-roll
 * paths — XMLHttpRequest can still load them (same lesson as feed video upload).
 */
export async function blobFromNativeMediaUrl(src: string): Promise<Blob | null> {
  const url = src.trim();
  if (!url) return null;

  try {
    const viaXhr = await new Promise<Blob>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", url);
      xhr.responseType = "blob";
      xhr.onload = () => {
        const ok = xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300);
        if (ok && xhr.response) resolve(xhr.response as Blob);
        else reject(new Error(`HTTP ${xhr.status || "error"}`));
      };
      xhr.onerror = () => reject(new Error("Load failed"));
      xhr.send();
    });
    if (viaXhr.size > 0) return viaXhr;
  } catch {
    /* Fall through to fetch. */
  }

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
}

/** Read a gallery item into a File. Uses webPath, then the native URI. */
export async function fileFromGalleryMedia(item: MediaResult, namePrefix: string): Promise<File | null> {
  const src = item.webPath?.trim() || (item.uri ? Capacitor.convertFileSrc(item.uri) : "");
  if (!src) return null;
  const blob = await blobFromNativeMediaUrl(src);
  if (!blob) return null;
  const format = item.metadata?.format || blob.type;
  if (item.type === MediaType.Video || blob.type.startsWith("video/")) {
    const meta = storyVideoFileMeta(format);
    const type = blob.type.startsWith("video/") ? blob.type : meta.type;
    return new File([blob], `${namePrefix}-${Date.now()}.${meta.ext}`, { type });
  }
  const meta = imageFileMeta(format);
  const type = blob.type.startsWith("image/") ? blob.type : meta.type;
  return new File([blob], `${namePrefix}-${Date.now()}.${meta.ext}`, { type });
}

/** One video from the photo library. Does not open the camera. */
export async function pickStoryVideoFromLibrary(): Promise<File | null> {
  const endHold = beginFilePickerHold();
  const restore = unlockSystemPickerPointerEvents();
  try {
    const picked = await Camera.chooseFromGallery({
      mediaType: MediaTypeSelection.Video,
      allowMultipleSelection: false,
      includeMetadata: true,
      presentationStyle: "fullscreen",
    });
    const item = picked.results?.find((row) => row.type === MediaType.Video) ?? picked.results?.[0];
    if (!item) return null;
    const file = await fileFromGalleryMedia(item, "video");
    if (!file) throw new Error("Couldn't read that video. Try choosing it again.");
    return file;
  } catch (error) {
    if (isGalleryPickerCancel(error)) return null;
    const message = error instanceof Error ? error.message : "Couldn't open your videos.";
    throw new Error(message);
  } finally {
    restore();
    endHold();
  }
}
