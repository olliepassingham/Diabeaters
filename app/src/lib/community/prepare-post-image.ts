import { MAX_POST_IMAGE_BYTES } from "@/lib/community/posts-supabase";

const MAX_EDGE_PX = 2048;
/** Re-encode camera-roll JPEGs above this so Post stays under the bucket cap. */
const PROACTIVE_REENCODE_BYTES = 2 * 1024 * 1024;

export function isHeicLikeImage(file: File): boolean {
  const t = (file.type || "").toLowerCase();
  const n = (file.name || "").toLowerCase();
  return (
    t.includes("heic") ||
    t.includes("heif") ||
    n.endsWith(".heic") ||
    n.endsWith(".heif") ||
    n.endsWith(".heics")
  );
}

export function shouldReencodePostImage(file: File): boolean {
  if (file.size > PROACTIVE_REENCODE_BYTES) return true;
  if (isHeicLikeImage(file)) return true;
  const t = (file.type || "").toLowerCase().trim();
  if (!t || t === "application/octet-stream") return true;
  if (t.startsWith("image/") && t !== "image/jpeg" && t !== "image/jpg" && t !== "image/png" && t !== "image/gif" && t !== "image/webp") {
    return true;
  }
  return false;
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

function sizedCanvas(width: number, height: number): { canvas: HTMLCanvasElement; width: number; height: number } {
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return { canvas, width: w, height: h };
}

async function drawFileToCanvas(file: File): Promise<HTMLCanvasElement> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      try {
        const { canvas, width, height } = sizedCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not prepare image");
        ctx.drawImage(bitmap, 0, 0, width, height);
        return canvas;
      } finally {
        bitmap.close();
      }
    } catch {
      /* Fall through to <img> decode. */
    }
  }

  const img = await loadImageElement(file);
  const { width: srcW, height: srcH } = img;
  if (!srcW || !srcH) throw new Error("Could not read image");
  const { canvas, width, height } = sizedCanvas(srcW, srcH);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare image");
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

async function jpegFileFromCanvas(canvas: HTMLCanvasElement, baseName: string): Promise<File> {
  for (const quality of [0.88, 0.78, 0.68, 0.55, 0.42]) {
    const blob = await canvasToJpegBlob(canvas, quality);
    if (!blob) continue;
    if (blob.size <= MAX_POST_IMAGE_BYTES) {
      return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
    }
  }
  throw new Error("That photo is still too large after compressing. Try another shot or a smaller image.");
}

function asUploadableJpegAlias(file: File): File {
  const baseName = (file.name.replace(/\.[^.]+$/, "") || "photo").slice(0, 80);
  const type = file.type?.startsWith("image/") ? file.type : "image/jpeg";
  const name = type === "image/png" ? `${baseName}.png` : type === "image/webp" ? `${baseName}.webp` : type === "image/gif" ? `${baseName}.gif` : `${baseName}.jpg`;
  if (file.name === name && file.type === type) return file;
  return new File([file], name, { type, lastModified: file.lastModified || Date.now() });
}

/**
 * Own the bytes before upload. iPhone can invalidate a File handle after the
 * picker closes or the input is cleared — same class of bug as feed video.
 */
export async function copyImageFileForUpload(file: File): Promise<File> {
  try {
    const bytes = await file.arrayBuffer();
    if (bytes.byteLength > 0) {
      return new File([bytes], file.name || "photo.jpg", {
        type: file.type || "image/jpeg",
        lastModified: file.lastModified || Date.now(),
      });
    }
  } catch {
    /* Fall through and use the original handle. */
  }
  return file;
}

export function explainImageUploadError(message: string): string {
  const raw = message.trim() || "Upload failed";
  const lower = raw.toLowerCase();
  if (
    lower.includes("maximum allowed size") ||
    lower.includes("entity too large") ||
    lower.includes("payload too large") ||
    lower.includes("exceeded the maximum") ||
    lower.includes("5mb")
  ) {
    return "That photo is larger than the server will accept. Try another photo or take a new one.";
  }
  if (lower.includes("mime") || lower.includes("content type") || lower.includes("content-type") || lower.includes("not supported")) {
    return "The server rejected that photo format. Try choosing the photo again, or take a new one with Most Compatible camera settings.";
  }
  if (lower.includes("heic") || lower.includes("heif") || lower.includes("could not read") || lower.includes("could not prepare")) {
    return "This iPhone photo could not be converted. Try again, or in Camera settings switch Formats to Most Compatible.";
  }
  if (lower.includes("load failed") || lower.includes("failed to fetch") || lower.includes("network connection") || lower.includes("networkerror")) {
    return "The upload stopped before it finished. Check your connection and post the photo again.";
  }
  if (lower.includes("jwt") || lower.includes("unauthorized") || lower.includes("invalid compact jws")) {
    return "You were signed out before the photo finished uploading. Sign in and try again.";
  }
  return raw;
}

/**
 * Normalise feed photos for upload: convert HEIC / odd MIME / large camera-roll
 * files to JPEG under the storage cap so Post does not fail after attach.
 */
export async function preparePostImageFile(file: File): Promise<File> {
  const baseName = (file.name.replace(/\.[^.]+$/, "") || "photo").replace(/[^\w.-]+/g, "-").slice(0, 80) || "photo";

  if (!shouldReencodePostImage(file) && file.size <= MAX_POST_IMAGE_BYTES) {
    return asUploadableJpegAlias(file);
  }

  try {
    const canvas = await drawFileToCanvas(file);
    return await jpegFileFromCanvas(canvas, baseName);
  } catch {
    if (!isHeicLikeImage(file) && file.size <= MAX_POST_IMAGE_BYTES && (file.type || "").startsWith("image/")) {
      return asUploadableJpegAlias(file);
    }
    throw new Error(
      isHeicLikeImage(file)
        ? "This iPhone photo could not be converted. Try again, or in Camera settings switch Formats to Most Compatible."
        : "Couldn't prepare that photo. Try choosing it again or take a new one.",
    );
  }
}

export async function preparePostImageFiles(files: File[]): Promise<{
  files: File[];
  error: Error | null;
}> {
  const out: File[] = [];
  for (const f of files) {
    try {
      const prepared = await preparePostImageFile(f);
      out.push(await copyImageFileForUpload(prepared));
    } catch (e) {
      return {
        files: out,
        error: e instanceof Error ? e : new Error("Couldn't prepare that photo. Try choosing it again."),
      };
    }
  }
  return { files: out, error: null };
}
