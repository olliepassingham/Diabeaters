import { fileFromPostMediaPath } from "@/lib/community/post-media-signed-urls";
import { formatEventWhen } from "@/lib/community/event-display";
import { parseEventExtra, parsePollExtra } from "@/lib/community/post-kinds";
import type { CommunityPostRow } from "@/lib/community";

const W = 1080;
const H = 1920;
/** Keep content clear of the story viewer header (avatar / name / close). */
const TOP_SAFE = 300;
/** Keep content clear of the Activity / reply chrome. */
const BOTTOM_SAFE = 250;
const SIDE = 64;
const CARD_PAD = 48;
const CARD_RADIUS = 44;
const IMAGE_RADIUS = 28;

const BG_INNER = "#152036";
const BG_OUTER = "#070b14";
const CARD = "#1b2740";
const TEXT = "#f8fafc";
const MUTED = "#94a3b8";
const ACCENT = "#2dd4bf";
const LINE = "rgba(255,255,255,0.12)";

export type StoryPostShareMeta = {
  authorName: string;
  authorHandle?: string | null;
  isOwn: boolean;
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const paragraphs = text.replace(/\r/g, "").split("\n");
  const lines: string[] = [];
  outer: for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      if (lines.length < maxLines) lines.push("");
      continue;
    }
    let current = words[0] ?? "";
    for (let i = 1; i < words.length; i++) {
      const next = `${current} ${words[i]}`;
      if (ctx.measureText(next).width <= maxWidth) {
        current = next;
      } else {
        lines.push(current);
        current = words[i] ?? "";
        if (lines.length >= maxLines) break outer;
      }
    }
    if (lines.length < maxLines) lines.push(current);
    if (lines.length >= maxLines) break;
  }
  if (lines.length > maxLines) lines.length = maxLines;
  return lines;
}

function drawWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  baseline: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): number {
  const lines = wrapText(ctx, text, maxWidth, maxLines);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const last = i === lines.length - 1 && lines.length === maxLines;
    const overflow = last && ctx.measureText(line).width > maxWidth - 4;
    const out = overflow ? `${line.replace(/\s+\S*$/, "").trimEnd()}…` : line;
    ctx.fillText(out, x, baseline + i * lineHeight);
  }
  return lines.length * lineHeight;
}

function wrappedHeight(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): number {
  return wrapText(ctx, text, maxWidth, maxLines).length * lineHeight;
}

function sourceSize(img: CanvasImageSource): { w: number; h: number } {
  if (img instanceof HTMLImageElement) {
    return { w: img.naturalWidth || img.width || 1, h: img.naturalHeight || img.height || 1 };
  }
  if (img instanceof HTMLCanvasElement) {
    return { w: img.width || 1, h: img.height || 1 };
  }
  if (img instanceof HTMLVideoElement) {
    return { w: img.videoWidth || 1, h: img.videoHeight || 1 };
  }
  return { w: 1, h: 1 };
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const { w: srcW, h: srcH } = sourceSize(img);
  const scale = Math.max(w / srcW, h / srcH);
  const dw = srcW * scale;
  const dh = srcH * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = url;
  });
}

function loadVideoFrame(url: string): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    const finish = (frame: HTMLCanvasElement | null) => {
      video.removeAttribute("src");
      video.load();
      resolve(frame);
    };
    const timer = window.setTimeout(() => finish(null), 4000);
    video.addEventListener("error", () => {
      window.clearTimeout(timer);
      finish(null);
    });
    video.addEventListener("loadeddata", () => {
      try {
        video.currentTime = Math.min(0.25, Number.isFinite(video.duration) ? video.duration * 0.05 : 0.1);
      } catch {
        window.clearTimeout(timer);
        finish(null);
      }
    });
    video.addEventListener("seeked", () => {
      window.clearTimeout(timer);
      const frame = document.createElement("canvas");
      frame.width = video.videoWidth || 1080;
      frame.height = video.videoHeight || 1920;
      const fctx = frame.getContext("2d");
      if (!fctx || !frame.width || !frame.height) {
        finish(null);
        return;
      }
      fctx.drawImage(video, 0, 0);
      finish(frame);
    });
  });
}

async function loadMedia(path: string | null | undefined): Promise<CanvasImageSource | null> {
  if (!path) return null;
  const file = await fileFromPostMediaPath(path);
  if (!file) return null;
  const url = URL.createObjectURL(file);
  try {
    if (file.type.startsWith("video/")) return await loadVideoFrame(url);
    return await loadImage(url);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function kindLabel(post: CommunityPostRow): string {
  if (post.post_kind === "poll") return "Poll";
  if (post.post_kind === "event") return "Event";
  if (post.video_url) return "Video";
  return "Post";
}

function canvasToFile(canvas: HTMLCanvasElement): Promise<File | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        resolve(new File([blob], "story-post.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  });
}

function headerHeight(handle: string | null): number {
  return 44 + 12 + 40 + (handle ? 32 : 0) + 28;
}

function drawCardHeader(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: string,
  name: string,
  handle: string | null,
): number {
  ctx.font = "700 20px system-ui, sans-serif";
  const label = kind.toUpperCase();
  const pillW = Math.ceil(ctx.measureText(label).width) + 28;
  fillRoundRect(ctx, x, y, pillW, 40, 20, "rgba(45, 212, 191, 0.16)");
  ctx.fillStyle = ACCENT;
  ctx.fillText(label, x + 14, y + 27);

  ctx.fillStyle = TEXT;
  ctx.font = "700 34px system-ui, sans-serif";
  ctx.fillText(name, x, y + 40 + 12 + 30);
  let next = y + 40 + 12 + 40;
  if (handle) {
    ctx.fillStyle = MUTED;
    ctx.font = "500 26px system-ui, sans-serif";
    ctx.fillText(`@${handle}`, x, next + 28);
    next += 32;
  }
  return next + 28;
}

/** Renders a 9:16 story card for any feed post (photo + caption, text, poll, or event). */
export async function renderPostAsStoryFile(
  post: CommunityPostRow,
  meta: StoryPostShareMeta,
): Promise<File | null> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const poll = post.post_kind === "poll" ? parsePollExtra(post.post_extra) : null;
  const event = post.post_kind === "event" ? parseEventExtra(post.post_extra) : null;
  const mediaPath = event ? post.image_urls[0] || null : post.video_url || post.image_urls[0] || null;
  const media = await loadMedia(mediaPath);
  const caption = (() => {
    const body = post.body.trim();
    if (!body) return "";
    if (poll && body === poll.question.trim()) return "";
    if (event && body === event.title.trim()) return "";
    return body;
  })();
  const handle = meta.authorHandle?.trim().replace(/^@/, "") || null;
  const name = meta.authorName.trim() || "Member";
  const kind = kindLabel(post);
  const innerW = W - SIDE * 2;
  const textW = innerW - CARD_PAD * 2;
  const maxCardH = H - TOP_SAFE - BOTTOM_SAFE;
  const chromeH = headerHeight(handle);

  const bg = ctx.createRadialGradient(W / 2, H * 0.48, 40, W / 2, H * 0.48, 1100);
  bg.addColorStop(0, BG_INNER);
  bg.addColorStop(1, BG_OUTER);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  let bodyH = 0;
  let imageH = 0;
  const optionCount = poll ? Math.min(poll.options.length, 6) : 0;

  if (poll) {
    ctx.font = "700 44px system-ui, sans-serif";
    const qH = wrappedHeight(ctx, poll.question, textW, 56, 5);
    bodyH = qH + 28 + optionCount * 92;
  } else if (event) {
    imageH = media ? 520 : 0;
    ctx.font = "700 44px system-ui, sans-serif";
    const titleH = wrappedHeight(ctx, event.title, textW, 54, 3);
    ctx.font = "600 28px system-ui, sans-serif";
    const whenH = wrappedHeight(ctx, formatEventWhen(event.starts_at), textW, 38, 2);
    ctx.font = "500 26px system-ui, sans-serif";
    const locH = event.location?.trim() ? wrappedHeight(ctx, event.location.trim(), textW, 36, 2) : 0;
    const detH = event.details?.trim() ? wrappedHeight(ctx, event.details.trim(), textW, 34, 3) : 0;
    bodyH = (imageH ? imageH + 28 : 0) + titleH + 14 + whenH + (locH ? locH + 10 : 0) + (detH ? detH + 8 : 0);
  } else if (media) {
    const captionH = caption
      ? (() => {
          ctx.font = "500 34px system-ui, sans-serif";
          return 28 + wrappedHeight(ctx, caption, textW, 44, 6);
        })()
      : 0;
    imageH = Math.min(980, maxCardH - CARD_PAD * 2 - chromeH - captionH);
    imageH = Math.max(520, imageH);
    bodyH = imageH + captionH;
  } else {
    ctx.font = "600 42px system-ui, sans-serif";
    bodyH = wrappedHeight(ctx, caption || "Shared from the feed", textW, 54, 10);
  }

  const cardH = Math.min(maxCardH, Math.max(420, CARD_PAD * 2 + chromeH + bodyH));
  const cardY = TOP_SAFE + Math.max(0, (maxCardH - cardH) / 2);
  const cardX = SIDE;

  fillRoundRect(ctx, cardX, cardY, innerW, cardH, CARD_RADIUS, CARD);
  ctx.save();
  roundRect(ctx, cardX, cardY, innerW, cardH, CARD_RADIUS);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  const contentX = cardX + CARD_PAD;
  let y = drawCardHeader(ctx, contentX, cardY + CARD_PAD, kind, name, handle);
  const contentBottom = cardY + cardH - CARD_PAD;

  if (poll) {
    ctx.fillStyle = TEXT;
    ctx.font = "700 44px system-ui, sans-serif";
    y += drawWrapped(ctx, poll.question, contentX, y, textW, 56, 5) + 20;
    ctx.font = "600 30px system-ui, sans-serif";
    for (const option of poll.options.slice(0, 6)) {
      if (y + 80 > contentBottom) break;
      fillRoundRect(ctx, contentX, y, textW, 76, 38, "rgba(255,255,255,0.05)");
      roundRect(ctx, contentX, y, textW, 76, 38);
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = TEXT;
      const label = option.length > 40 ? `${option.slice(0, 39)}…` : option;
      ctx.fillText(label, contentX + 28, y + 48);
      y += 92;
    }
  } else if (event) {
    if (media && imageH > 0) {
      drawCover(ctx, media, contentX, y, textW, imageH, IMAGE_RADIUS);
      y += imageH + 32;
    }
    ctx.fillStyle = TEXT;
    ctx.font = "700 44px system-ui, sans-serif";
    y += drawWrapped(ctx, event.title, contentX, y, textW, 54, 3) + 12;
    ctx.fillStyle = ACCENT;
    ctx.font = "600 28px system-ui, sans-serif";
    y += drawWrapped(ctx, formatEventWhen(event.starts_at), contentX, y, textW, 38, 2) + 8;
    if (event.location?.trim()) {
      ctx.fillStyle = MUTED;
      ctx.font = "500 26px system-ui, sans-serif";
      y += drawWrapped(ctx, event.location.trim(), contentX, y, textW, 36, 2) + 8;
    }
    if (event.details?.trim()) {
      ctx.fillStyle = MUTED;
      ctx.font = "500 26px system-ui, sans-serif";
      drawWrapped(ctx, event.details.trim(), contentX, y, textW, 34, 3);
    }
  } else if (media) {
    drawCover(ctx, media, contentX, y, textW, imageH, IMAGE_RADIUS);
    if (caption) {
      ctx.fillStyle = TEXT;
      ctx.font = "500 34px system-ui, sans-serif";
      drawWrapped(ctx, caption, contentX, y + imageH + 48, textW, 44, 6);
    }
  } else {
    const body = caption || "Shared from the feed";
    ctx.font = "600 42px system-ui, sans-serif";
    const textH = wrappedHeight(ctx, body, textW, 54, 10);
    const avail = contentBottom - y;
    const firstBaseline = y + Math.max(24, (avail - textH) / 2) + 40;
    ctx.fillStyle = TEXT;
    drawWrapped(ctx, body, contentX, firstBaseline, textW, 54, 10);
  }

  return canvasToFile(canvas);
}
