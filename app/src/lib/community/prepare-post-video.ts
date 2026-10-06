import {
  GUIDED_POST_VIDEO_MAX_SECONDS,
  MAX_POST_VIDEO_SECONDS,
  readVideoFileDurationSeconds,
} from "@/lib/community/feed-video-limits";

const TRIM_EPSILON_SEC = 0.2;
const POSTER_MAX_EDGE_PX = 1280;

export type VideoTrimRange = {
  startSec: number;
  endSec: number;
};

function clampRange(startSec: number, endSec: number, duration: number): VideoTrimRange {
  const dur = Number.isFinite(duration) && duration > 0 ? duration : 0;
  let start = Math.max(0, Math.min(startSec, Math.max(0, dur - 0.5)));
  let end = Math.max(start + 0.5, Math.min(endSec, dur || endSec));
  if (end - start > MAX_POST_VIDEO_SECONDS) {
    end = start + MAX_POST_VIDEO_SECONDS;
  }
  return { startSec: start, endSec: end };
}

/** Default selection: first ~60s (or the full clip when shorter). */
export function defaultVideoTrimRange(durationSec: number): VideoTrimRange {
  const dur = Math.max(0, durationSec);
  const end = Math.min(dur, GUIDED_POST_VIDEO_MAX_SECONDS);
  return { startSec: 0, endSec: Math.max(0.5, end || Math.min(dur, MAX_POST_VIDEO_SECONDS)) };
}

function loadVideoElement(file: File): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.src = url;
    const cleanup = () => URL.revokeObjectURL(url);
    video.onloadedmetadata = () => resolve(video);
    video.onerror = () => {
      cleanup();
      reject(new Error("Could not read that video."));
    };
    // Keep object URL alive until the caller tears the element down.
    (video as HTMLVideoElement & { __objectUrl?: string }).__objectUrl = url;
  });
}

function releaseVideoElement(video: HTMLVideoElement): void {
  const withUrl = video as HTMLVideoElement & { __objectUrl?: string };
  video.pause();
  video.removeAttribute("src");
  video.load();
  if (withUrl.__objectUrl) {
    URL.revokeObjectURL(withUrl.__objectUrl);
    delete withUrl.__objectUrl;
  }
}

function waitForSeeked(video: HTMLVideoElement, timeSec: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const target = Math.max(0, timeSec);
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Could not scrub that video."));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      window.clearTimeout(timer);
    };
    const timer = window.setTimeout(() => {
      cleanup();
      resolve();
    }, 4000);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    try {
      video.currentTime = target;
    } catch {
      cleanup();
      reject(new Error("Could not scrub that video."));
    }
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

/**
 * Grab a JPEG still near `atSeconds` for feed posters and profile grid thumbs.
 */
export async function captureVideoPosterJpeg(
  file: File,
  atSeconds = 0.15,
): Promise<File | null> {
  if (typeof document === "undefined") return null;
  let video: HTMLVideoElement | null = null;
  try {
    video = await loadVideoElement(file);
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const seekTo = Math.max(0, Math.min(atSeconds, Math.max(0, duration - 0.05)));
    await waitForSeeked(video, seekTo);

    const srcW = video.videoWidth || 0;
    const srcH = video.videoHeight || 0;
    if (!srcW || !srcH) return null;

    const scale = Math.min(1, POSTER_MAX_EDGE_PX / Math.max(srcW, srcH));
    const width = Math.max(1, Math.round(srcW * scale));
    const height = Math.max(1, Math.round(srcH * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, width, height);

    const baseName = (file.name.replace(/\.[^.]+$/, "") || "clip").slice(0, 80);
    for (const quality of [0.82, 0.7, 0.55]) {
      const blob = await canvasToJpegBlob(canvas, quality);
      if (!blob) continue;
      return new File([blob], `${baseName}-poster.jpg`, { type: "image/jpeg" });
    }
    return null;
  } catch {
    return null;
  } finally {
    if (video) releaseVideoElement(video);
  }
}

function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

function extensionForMime(mime: string | undefined): string {
  if (!mime) return "webm";
  if (mime.includes("mp4")) return "mp4";
  return "webm";
}

function captureStreamFromVideo(video: HTMLVideoElement): MediaStream | null {
  const anyVideo = video as HTMLVideoElement & {
    captureStream?: (frameRate?: number) => MediaStream;
    mozCaptureStream?: (frameRate?: number) => MediaStream;
  };
  try {
    if (typeof anyVideo.captureStream === "function") return anyVideo.captureStream();
    if (typeof anyVideo.mozCaptureStream === "function") return anyVideo.mozCaptureStream();
  } catch {
    return null;
  }
  return null;
}

function nearlyFullRange(range: VideoTrimRange, duration: number): boolean {
  return range.startSec <= TRIM_EPSILON_SEC && range.endSec >= duration - TRIM_EPSILON_SEC;
}

/**
 * Re-encode a selected range with MediaRecorder when the browser can capture the video stream.
 * Returns the original file when the range already covers the whole clip.
 */
export async function trimVideoFile(
  file: File,
  range: VideoTrimRange,
  opts?: { onProgress?: (ratio: number) => void },
): Promise<File> {
  if (typeof document === "undefined") {
    throw new Error("Video trimming needs a browser.");
  }

  const duration = (await readVideoFileDurationSeconds(file)) ?? 0;
  const clamped = clampRange(range.startSec, range.endSec, duration || range.endSec);
  const span = clamped.endSec - clamped.startSec;

  if (span <= 0) {
    throw new Error("Choose a longer section of the video.");
  }
  if (span > MAX_POST_VIDEO_SECONDS + 0.05) {
    throw new Error(
      `Keep clips to about ${GUIDED_POST_VIDEO_MAX_SECONDS}s (max ${MAX_POST_VIDEO_SECONDS}s).`,
    );
  }

  if (duration > 0 && nearlyFullRange(clamped, duration) && duration <= MAX_POST_VIDEO_SECONDS) {
    opts?.onProgress?.(1);
    return file;
  }

  if (typeof MediaRecorder === "undefined") {
    throw new Error("This phone cannot cut video in the app. Pick a shorter clip from Photos.");
  }

  const mimeType = pickRecorderMimeType();
  let video: HTMLVideoElement | null = null;
  let stream: MediaStream | null = null;

  try {
    video = await loadVideoElement(file);
    const metaDuration = Number.isFinite(video.duration) ? video.duration : duration;
    const finalRange = clampRange(clamped.startSec, clamped.endSec, metaDuration || clamped.endSec);
    await waitForSeeked(video, finalRange.startSec);

    // Unmute for the capture pass so audio is included when the stream supports it.
    video.muted = false;
    stream = captureStreamFromVideo(video);
    if (!stream || stream.getVideoTracks().length === 0) {
      throw new Error("This phone cannot cut video in the app. Pick a shorter clip from Photos.");
    }

    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 })
      : new MediaRecorder(stream, { videoBitsPerSecond: 2_500_000 });

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };

    const stopped = new Promise<void>((resolve, reject) => {
      recorder.onstop = () => resolve();
      recorder.onerror = () => reject(new Error("Could not save the cut video."));
    });

    recorder.start(250);
    await video.play();

    await new Promise<void>((resolve, reject) => {
      const onTime = () => {
        const progress = (video!.currentTime - finalRange.startSec) / Math.max(0.01, finalRange.endSec - finalRange.startSec);
        opts?.onProgress?.(Math.max(0, Math.min(0.99, progress)));
        if (video!.currentTime >= finalRange.endSec - 0.04) {
          cleanup();
          video!.pause();
          if (recorder.state !== "inactive") recorder.stop();
          resolve();
        }
      };
      const onEnded = () => {
        cleanup();
        if (recorder.state !== "inactive") recorder.stop();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("Playback failed while cutting the video."));
      };
      const cleanup = () => {
        video!.removeEventListener("timeupdate", onTime);
        video!.removeEventListener("ended", onEnded);
        video!.removeEventListener("error", onError);
        window.clearTimeout(timer);
      };
      const maxMs = Math.ceil((finalRange.endSec - finalRange.startSec + 2) * 1000);
      const timer = window.setTimeout(() => {
        cleanup();
        video!.pause();
        if (recorder.state !== "inactive") recorder.stop();
        resolve();
      }, maxMs);
      video!.addEventListener("timeupdate", onTime);
      video!.addEventListener("ended", onEnded);
      video!.addEventListener("error", onError);
    });

    await stopped;
    opts?.onProgress?.(1);

    const outType = recorder.mimeType || mimeType || "video/webm";
    const blob = new Blob(chunks, { type: outType });
    if (blob.size < 1024) {
      throw new Error("The cut video was empty. Try a different section.");
    }

    const baseName = (file.name.replace(/\.[^.]+$/, "") || "clip").slice(0, 80);
    const ext = extensionForMime(outType);
    return new File([blob], `${baseName}-trim.${ext}`, { type: outType.split(";")[0] || outType });
  } finally {
    stream?.getTracks().forEach((track) => track.stop());
    if (video) releaseVideoElement(video);
  }
}

export type PreparedPostVideo = {
  video: File;
  poster: File | null;
  range: VideoTrimRange;
};

/** Trim (when needed) and capture a poster for the feed. */
export async function preparePostVideo(
  file: File,
  range: VideoTrimRange,
  opts?: { onProgress?: (ratio: number) => void },
): Promise<PreparedPostVideo> {
  const video = await trimVideoFile(file, range, opts);
  const poster = await captureVideoPosterJpeg(video, 0.12);
  return { video, poster, range: clampRange(range.startSec, range.endSec, (await readVideoFileDurationSeconds(video)) ?? range.endSec) };
}
