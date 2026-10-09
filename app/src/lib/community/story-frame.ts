/** Pixels of `src` that `object-fit: cover` shows inside a box of `destW` × `destH`. */
export function objectCoverSourceRect(
  srcW: number,
  srcH: number,
  destW: number,
  destH: number,
): { sx: number; sy: number; sw: number; sh: number } {
  if (srcW <= 0 || srcH <= 0 || destW <= 0 || destH <= 0) {
    return { sx: 0, sy: 0, sw: Math.max(0, srcW), sh: Math.max(0, srcH) };
  }
  const destAspect = destW / destH;
  const srcAspect = srcW / srcH;
  if (srcAspect > destAspect) {
    const sw = srcH * destAspect;
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH };
  }
  const sh = srcW / destAspect;
  return { sx: 0, sy: (srcH - sh) / 2, sw: srcW, sh };
}

/** Same full-bleed crop in the story editor and the story viewer. */
export const STORY_MEDIA_CLASS = "h-full w-full object-cover";

/** Centered story stage. On a phone this fills the screen; on a wide window it stays a tall column. */
export const STORY_STAGE_CLASS =
  "relative h-full w-full max-w-[min(100%,calc(100dvh*9/16))] overflow-hidden";
