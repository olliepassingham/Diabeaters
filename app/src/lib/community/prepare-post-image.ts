import { MAX_POST_IMAGE_BYTES } from "@/lib/community/posts-supabase";

const MAX_EDGE_PX = 2048;

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

/**
 * Keep feed photos under the storage cap. Phone camera-roll files often exceed 5MB;
 * re-encode as JPEG (downscale if needed) so Post doesn't fail after a silent toast.
 */
export async function preparePostImageFile(file: File): Promise<File> {
  if (file.size <= MAX_POST_IMAGE_BYTES) return file;

  let img: HTMLImageElement;
  try {
    img = await loadImageElement(file);
  } catch {
    throw new Error("Each image must be 5MB or smaller.");
  }

  let { width, height } = img;
  if (!width || !height) throw new Error("Each image must be 5MB or smaller.");

  const scale = Math.min(1, MAX_EDGE_PX / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Each image must be 5MB or smaller.");
  ctx.drawImage(img, 0, 0, width, height);

  const baseName = (file.name.replace(/\.[^.]+$/, "") || "photo").slice(0, 80);

  for (const quality of [0.85, 0.72, 0.58, 0.45]) {
    const blob = await canvasToJpegBlob(canvas, quality);
    if (!blob) continue;
    if (blob.size <= MAX_POST_IMAGE_BYTES) {
      return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
    }
  }

  throw new Error("Each image must be 5MB or smaller.");
}

export async function preparePostImageFiles(files: File[]): Promise<{
  files: File[];
  error: Error | null;
}> {
  const out: File[] = [];
  for (const f of files) {
    try {
      out.push(await preparePostImageFile(f));
    } catch (e) {
      return {
        files: out,
        error: e instanceof Error ? e : new Error("Each image must be 5MB or smaller."),
      };
    }
  }
  return { files: out, error: null };
}
