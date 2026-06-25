/** Ensures only one in-feed video plays at a time. */
let activeFeedVideo: HTMLVideoElement | null = null;

export function claimActiveFeedVideo(video: HTMLVideoElement): void {
  if (activeFeedVideo && activeFeedVideo !== video) {
    activeFeedVideo.pause();
  }
  activeFeedVideo = video;
}

export function releaseActiveFeedVideo(video: HTMLVideoElement): void {
  if (activeFeedVideo === video) activeFeedVideo = null;
}
