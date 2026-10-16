import { Camera, CameraResultType, CameraSource, MediaType, MediaTypeSelection } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { beginFilePickerHold, clickHiddenFileInput, unlockSystemPickerPointerEvents } from "@/lib/click-hidden-file-input";
import { fileFromGalleryMedia, isGalleryPickerCancel } from "@/lib/community/pick-story-video";

const MAX_POST_IMAGES = 4;

const IMAGE_NAME_RE = /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp|tiff?)$/i;

/**
 * Android/iOS library picks often omit MIME or use `application/octet-stream`
 * (HEIC, content URIs). Treat those as images unless the type is clearly not.
 */
export function isLikelyImageFile(file: File): boolean {
  const t = (file.type || "").toLowerCase().trim();
  if (t.startsWith("image/")) return true;
  if (t && t !== "application/octet-stream") return false;
  if (!file.name || !file.name.includes(".")) return true;
  return IMAGE_NAME_RE.test(file.name);
}

/** Collect image files from a file input, respecting the per-post cap. */
export function filesFromImageInput(files: FileList | null, currentCount: number): File[] {
  if (!files?.length) return [];
  const next: File[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (!f || !isLikelyImageFile(f)) continue;
    if (currentCount + next.length >= MAX_POST_IMAGES) break;
    next.push(f);
  }
  return next;
}

function fileFromCameraBase64(base64: string | undefined, format: string | undefined): File | null {
  const data = base64?.trim();
  if (!data) return null;
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const kind = (format || "jpeg").toLowerCase();
  const type = kind === "png" ? "image/png" : kind === "gif" ? "image/gif" : "image/jpeg";
  const ext = kind === "png" ? "png" : kind === "gif" ? "gif" : "jpg";
  return new File([bytes], `photo-${Date.now()}.${ext}`, { type });
}

async function ensurePhotosPermission(): Promise<void> {
  try {
    const current = await Camera.checkPermissions();
    if (current.photos === "granted" || current.photos === "limited") return;
    await Camera.requestPermissions({ permissions: ["photos"] });
  } catch {
    /* Picker may still work (PHPicker) even if this request fails. */
  }
}

async function pickViaChooseFromGallery(currentCount: number, remaining: number): Promise<File[]> {
  const res = await Camera.chooseFromGallery({
    mediaType: MediaTypeSelection.Photo,
    allowMultipleSelection: remaining > 1,
    limit: remaining,
    quality: 90,
    includeMetadata: true,
    presentationStyle: "fullscreen",
  });
  const photos = (res?.results ?? []).filter((item) => item.type !== MediaType.Video);
  if (photos.length === 0) return [];

  const newFiles: File[] = [];
  for (const photo of photos) {
    const file = await fileFromGalleryMedia(photo, "photo");
    if (!file || !isLikelyImageFile(file)) continue;
    newFiles.push(file);
    if (currentCount + newFiles.length >= MAX_POST_IMAGES) break;
  }
  return newFiles;
}

async function pickViaGetPhotoBase64(): Promise<File | null> {
  const photo = await Camera.getPhoto({
    source: CameraSource.Photos,
    resultType: CameraResultType.Base64,
    quality: 90,
    correctOrientation: true,
  });
  return fileFromCameraBase64(photo.base64String, photo.format);
}

/**
 * Open the photo library for a feed/edit attach.
 *
 * Native: Capacitor Camera (same path stories use). Reading gallery `webPath`
 * via `fetch` used to throw "Load failed" — that is fixed in fileFromGalleryMedia.
 * HTML file inputs on iPhone can open a Photo Library sheet whose thumbnails
 * never load, so they are a last-resort fallback only.
 */
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

  const endHold = beginFilePickerHold();
  const restore = unlockSystemPickerPointerEvents();
  try {
    await ensurePhotosPermission();

    try {
      const multi = await pickViaChooseFromGallery(currentCount, remaining);
      if (multi.length > 0) return multi;
    } catch (error) {
      if (isGalleryPickerCancel(error)) return [];
      /* Fall through to getPhoto Base64 — more reliable on some iPhones. */
    }

    try {
      const single = await pickViaGetPhotoBase64();
      return single ? [single] : [];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? "");
      if (/cancel/i.test(message) || isGalleryPickerCancel(error)) return [];
      if (fallbackInput) {
        clickHiddenFileInput(fallbackInput);
        return [];
      }
      throw error instanceof Error ? error : new Error("Couldn't open your photos.");
    }
  } finally {
    restore();
    endHold();
  }
}

/** One photo from the camera or the library. On web, clicks the fallback input and returns null. */
export async function pickSinglePhoto(
  source: CameraSource,
  fallbackInput?: HTMLInputElement | null,
): Promise<File | null> {
  if (!Capacitor.isNativePlatform()) {
    clickHiddenFileInput(fallbackInput);
    return null;
  }

  const endHold = beginFilePickerHold();
  const restore = unlockSystemPickerPointerEvents();
  try {
    if (source === CameraSource.Photos) await ensurePhotosPermission();
    const photo = await Camera.getPhoto({
      source,
      resultType: CameraResultType.Base64,
      quality: 90,
      correctOrientation: true,
    });
    return fileFromCameraBase64(photo.base64String, photo.format);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (/cancel/i.test(message)) return null;
    throw error instanceof Error ? error : new Error(message || "Couldn't open that photo");
  } finally {
    restore();
    endHold();
  }
}

/** One photo from the library. On web, clicks the fallback input and returns null. */
export async function pickSingleImageFromLibrary(
  fallbackInput?: HTMLInputElement | null,
): Promise<File | null> {
  return pickSinglePhoto(CameraSource.Photos, fallbackInput);
}
