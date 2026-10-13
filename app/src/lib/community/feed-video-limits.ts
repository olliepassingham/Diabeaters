/** Client-side helpers for video clips in the community feed. */

/** Soft hint. The composer still accepts anything up to the hard cap. */
export const GUIDED_POST_VIDEO_MAX_SECONDS = 180;
/** Influencer clips: up to 10 minutes. Longer than this must be trimmed first. */
export const MAX_POST_VIDEO_SECONDS = 10 * 60;
/** Matches the community_post_images bucket limit (500MB). */
export const MAX_FEED_VIDEO_BYTES = 524288000;

export function feedVideoTooLargeMessage(file: File): string | null {
  if (file.size > MAX_FEED_VIDEO_BYTES) {
    return "That video is too large to upload. Keep it under 500MB.";
  }
  return null;
}

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

/**
 * Reads duration from a local video File.
 * Some camera-roll files report Infinity until the end of the file is seeked.
 */
export function readVideoFileDurationSeconds(file: File): Promise<number | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    let settled = false;

    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
      resolve(value);
    };

    const knownDuration = () => {
      const duration = video.duration;
      return Number.isFinite(duration) && duration > 0 ? duration : null;
    };

    const acceptIfKnown = () => {
      const duration = knownDuration();
      if (duration != null) finish(duration);
      return duration != null;
    };

    const seekPastEnd = () => {
      const onTime = () => {
        video.removeEventListener("timeupdate", onTime);
        if (!acceptIfKnown()) finish(null);
      };
      video.addEventListener("timeupdate", onTime);
      try {
        video.currentTime = 1e101;
      } catch {
        video.removeEventListener("timeupdate", onTime);
        finish(null);
      }
    };

    video.onloadedmetadata = () => {
      if (acceptIfKnown()) return;
      if (video.duration === Number.POSITIVE_INFINITY) seekPastEnd();
    };
    video.ondurationchange = () => {
      acceptIfKnown();
    };
    video.onerror = () => finish(null);
    const timer = window.setTimeout(() => finish(knownDuration()), 12000);
    video.src = url;
  });
}
