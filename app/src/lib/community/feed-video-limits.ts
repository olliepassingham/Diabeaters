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
