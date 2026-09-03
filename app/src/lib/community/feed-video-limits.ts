/** Client-side helpers for short peer-learning video clips in the community feed. */

/** Soft target length shown in composer guidance. */
export const GUIDED_POST_VIDEO_MAX_SECONDS = 60;
/** Hard upload cap — keeps feed clips short and mobile-friendly. */
export const MAX_POST_VIDEO_SECONDS = 90;

export function formatVideoDurationSeconds(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

const VIDEO_NAME_RE = /\.(mp4|mov|m4v|webm|qt)$/i;

/**
 * iOS camera recordings often omit MIME or use `application/octet-stream`.
 * Reject only when the type is clearly not video.
 */
export function isLikelyVideoFile(file: File): boolean {
  const t = (file.type || "").toLowerCase().trim();
  if (t.startsWith("video/")) return true;
  if (t && t !== "application/octet-stream") return false;
  if (!file.name || !file.name.includes(".")) return true;
  return VIDEO_NAME_RE.test(file.name);
}

/** Reads duration from a local video File via HTMLVideoElement metadata. */
export function readVideoFileDurationSeconds(file: File): Promise<number | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    const finish = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.onloadedmetadata = () => {
      const duration = video.duration;
      finish(Number.isFinite(duration) && duration > 0 ? duration : null);
    };
    video.onerror = () => finish(null);
    video.src = url;
  });
}
