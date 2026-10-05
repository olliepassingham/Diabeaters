const FEED_VIDEO_MUTE_KEY = "diabeater_feed_video_muted";

/** Shared mute preference for in-feed and Watch video players. Default muted. */
export function readFeedVideoMuted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(FEED_VIDEO_MUTE_KEY);
    if (raw === "0") return false;
    if (raw === "1") return true;
  } catch {
    /* private mode */
  }
  return true;
}

export function writeFeedVideoMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FEED_VIDEO_MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* private mode */
  }
}
