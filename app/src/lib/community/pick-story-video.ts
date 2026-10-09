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

export function isStoryVideoPickerCancel(error: unknown): boolean {
  if (error == null) return false;
  const record = typeof error === "object" ? (error as { code?: unknown; message?: unknown }) : null;
  const code = record ? String(record.code ?? "") : "";
  const message = record ? String(record.message ?? "") : String(error);
  return code === CHOOSE_MEDIA_CANCELLED || /cancel/i.test(message);
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
    });
    const item = picked.results?.find((row) => row.type === MediaType.Video) ?? picked.results?.[0];
    if (!item) return null;
    const file = await fileFromGalleryVideo(item);
    if (!file) throw new Error("Couldn't read that video.");
    return file;
  } catch (error) {
    if (isStoryVideoPickerCancel(error)) return null;
    const message = error instanceof Error ? error.message : "Couldn't open your videos.";
    throw new Error(message);
  } finally {
    restore();
    endHold();
  }
}

async function fileFromGalleryVideo(item: MediaResult): Promise<File | null> {
  const src = item.webPath?.trim() || (item.uri ? Capacitor.convertFileSrc(item.uri) : "");
  if (!src) return null;
  const response = await fetch(src);
  if (!response.ok) return null;
  const blob = await response.blob();
  const meta = storyVideoFileMeta(item.metadata?.format || blob.type);
  const type = blob.type.startsWith("video/") ? blob.type : meta.type;
  return new File([blob], `story-${Date.now()}.${meta.ext}`, { type });
}
