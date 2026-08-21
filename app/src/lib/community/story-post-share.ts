import { format, formatDistanceToNow } from "date-fns";
import { fileFromPostMediaPath } from "@/lib/community/post-media-signed-urls";
import { parseEventDate } from "@/lib/community/event-display";
import { parseEventExtra, parsePollExtra } from "@/lib/community/post-kinds";
import { communityTopicLabel } from "@/lib/community/topics";
import { resolveProfileImageUrl } from "@/lib/storage-profile";
import type { CommunityPostRow } from "@/lib/community";

const W = 1080;
const H = 1920;
/** Keep content clear of the story viewer header (avatar / name / close). */
const TOP_SAFE = 280;
/** Keep content clear of the Activity / reply chrome. */
const BOTTOM_SAFE = 260;
const SIDE = 72;

const FONT = 'Outfit, "Inter Variable", Inter, system-ui, sans-serif';
const FONT_SERIF = 'Georgia, "Iowan Old Style", "Times New Roman", serif';

const INK = "#12141a";
const INK_MUTED = "#5c6473";
const CREAM = "#f6f1e8";
const TEAL = "#14b8a6";
const TEAL_DEEP = "#0f766e";
const WHITE = "#f8fafc";
const PAGE_MINT = "#d7ebe4";
const CARD_WHITE = "#ffffff";
const PILL = "#e8ecef";

export type StoryPostShareMeta = {
  authorName: string;
  authorHandle?: string | null;
  authorAvatarPath?: string | null;
  authorAvatarFallbackSrc?: string | null;
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

async function loadImageFromUrl(url: string): Promise<HTMLImageElement | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      return await loadImage(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

async function loadAvatar(meta: StoryPostShareMeta): Promise<HTMLImageElement | null> {
  const path = meta.authorAvatarPath?.trim() || null;
  if (path) {
    const url = await resolveProfileImageUrl(path);
    if (url) {
      const img = await loadImageFromUrl(url);
      if (img) return img;
    }
  }
  const fallback = meta.authorAvatarFallbackSrc?.trim() || null;
  if (fallback) return loadImageFromUrl(fallback);
  return null;
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

function handleOf(meta: StoryPostShareMeta): string | null {
  const h = meta.authorHandle?.trim().replace(/^@/, "") || null;
  return h || null;
}

function nameOf(meta: StoryPostShareMeta): string {
  return meta.authorName.trim() || "Member";
}

function initialOf(name: string): string {
  const ch = name.trim().charAt(0);
  return ch ? ch.toUpperCase() : "M";
}

function quoteMetrics(text: string): { size: number; lh: number; maxLines: number } {
  const len = text.trim().length;
  if (len <= 70) return { size: 54, lh: 68, maxLines: 7 };
  if (len <= 140) return { size: 44, lh: 58, maxLines: 8 };
  if (len <= 240) return { size: 38, lh: 50, maxLines: 10 };
  return { size: 34, lh: 46, maxLines: 12 };
}

function eventParts(iso: string): { weekday: string; day: string; month: string; time: string } {
  const d = parseEventDate(iso);
  if (!d) return { weekday: "EVENT", day: "·", month: "", time: iso };
  return {
    weekday: format(d, "EEE").toUpperCase(),
    day: format(d, "d"),
    month: format(d, "MMM").toUpperCase(),
    time: format(d, "h:mm a"),
  };
}

function drawAtmosphere(ctx: CanvasRenderingContext2D, media: CanvasImageSource | null) {
  ctx.fillStyle = "#0c2f2c";
  ctx.fillRect(0, 0, W, H);

  if (media) {
    ctx.save();
    ctx.filter = "blur(48px)";
    drawCover(ctx, media, -120, -120, W + 240, H + 240, 0);
    ctx.restore();
    ctx.fillStyle = "rgba(12, 47, 44, 0.55)";
    ctx.fillRect(0, 0, W, H);
  } else {
    const a = ctx.createRadialGradient(W * 0.28, H * 0.22, 40, W * 0.28, H * 0.22, 900);
    a.addColorStop(0, "rgba(45, 212, 191, 0.34)");
    a.addColorStop(1, "rgba(45, 212, 191, 0)");
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, W, H);
    const b = ctx.createRadialGradient(W * 0.82, H * 0.78, 20, W * 0.82, H * 0.78, 860);
    b.addColorStop(0, "rgba(56, 189, 248, 0.2)");
    b.addColorStop(1, "rgba(56, 189, 248, 0)");
    ctx.fillStyle = b;
    ctx.fillRect(0, 0, W, H);
  }

  const vignette = ctx.createLinearGradient(0, 0, 0, H);
  vignette.addColorStop(0, "rgba(0,0,0,0.22)");
  vignette.addColorStop(0.2, "rgba(0,0,0,0)");
  vignette.addColorStop(0.82, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}

function drawLiftedCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
) {
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.48)";
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 22;
  fillRoundRect(ctx, x, y, w, h, r, fill);
  ctx.restore();
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawInitialAvatar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  name: string,
  onLight: boolean,
) {
  fillRoundRect(ctx, x, y, size, size, size / 2, onLight ? TEAL_DEEP : "rgba(20, 184, 166, 0.22)");
  ctx.fillStyle = onLight ? WHITE : TEAL;
  ctx.font = `700 ${Math.round(size * 0.42)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(initialOf(name), x + size / 2, y + size * 0.68);
  ctx.textAlign = "left";
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  name: string,
  photo: CanvasImageSource | null,
  onLight: boolean,
) {
  if (photo) {
    drawCover(ctx, photo, x, y, size, size, size / 2);
    return;
  }
  drawInitialAvatar(ctx, x, y, size, name, onLight);
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

function drawAuthorRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  name: string,
  handle: string | null,
  onLight: boolean,
  photo: CanvasImageSource | null = null,
) {
  const av = 52;
  drawAvatar(ctx, x, y, av, name, photo, onLight);
  ctx.fillStyle = onLight ? INK : WHITE;
  ctx.font = `600 28px ${FONT}`;
  ctx.fillText(name, x + av + 16, y + 24);
  ctx.fillStyle = onLight ? INK_MUTED : "rgba(248,250,252,0.62)";
  ctx.font = `500 22px ${FONT}`;
  ctx.fillText(handle ? `@${handle}` : "From the feed", x + av + 16, y + 48);
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatDistanceToNow(d, { addSuffix: true });
}

function drawTopicPill(ctx: CanvasRenderingContext2D, x: number, y: number, label: string): number {
  ctx.font = `600 22px ${FONT}`;
  const text = ellipsize(ctx, label, 420);
  const w = ctx.measureText(text).width + 28;
  const h = 40;
  fillRoundRect(ctx, x, y, w, h, h / 2, PILL);
  ctx.fillStyle = "rgba(18, 20, 26, 0.72)";
  ctx.fillText(text, x + 14, y + 28);
  return w;
}

function drawNameAndCaption(
  ctx: CanvasRenderingContext2D,
  name: string,
  caption: string,
  x: number,
  baseline: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): number {
  ctx.font = `700 30px ${FONT}`;
  ctx.fillStyle = INK;
  const nameText = ellipsize(ctx, name, maxWidth);
  ctx.fillText(nameText, x, baseline);
  if (!caption) return lineHeight;

  const nameW = ctx.measureText(nameText).width;
  ctx.font = `500 30px ${FONT}`;
  const gap = ctx.measureText(" ").width;
  const firstMax = Math.max(80, maxWidth - nameW - gap);
  const words = caption.split(/\s+/).filter(Boolean);
  let firstLine = "";
  let used = 0;
  for (const word of words) {
    const next = firstLine ? `${firstLine} ${word}` : word;
    if (ctx.measureText(next).width <= firstMax) {
      firstLine = next;
      used += 1;
    } else {
      break;
    }
  }
  if (firstLine) ctx.fillText(firstLine, x + nameW + gap, baseline);
  const rest = words.slice(used).join(" ");
  if (!rest || maxLines <= 1) return lineHeight;
  return lineHeight + drawWrapped(ctx, rest, x, baseline + lineHeight, maxWidth, lineHeight, maxLines - 1);
}

/** Reshared post: a feed card so it’s obvious this is someone else’s post. */
function drawSharedFeedCard(
  ctx: CanvasRenderingContext2D,
  media: CanvasImageSource,
  caption: string,
  name: string,
  handle: string | null,
  photo: CanvasImageSource | null,
  topicLabel: string,
  timeLabel: string,
) {
  ctx.fillStyle = PAGE_MINT;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.filter = "blur(64px)";
  ctx.globalAlpha = 0.35;
  drawCover(ctx, media, -100, -100, W + 200, H + 200, 0);
  ctx.restore();
  ctx.fillStyle = "rgba(215, 235, 228, 0.78)";
  ctx.fillRect(0, 0, W, H);

  const cardX = 28;
  const cardW = W - 56;
  const radius = 44;
  const pad = 32;
  const av = 88;
  const headerH = pad + av + 28;

  const { w: srcW, h: srcH } = sourceSize(media);
  const aspect = srcW / Math.max(srcH, 1);
  const imageH =
    aspect >= 1
      ? Math.round(Math.min(880, Math.max(620, cardW / aspect)))
      : Math.round(Math.min(cardW * 1.12, cardW / Math.max(aspect, 0.72)));

  ctx.font = `500 30px ${FONT}`;
  const capH = caption ? Math.max(36, wrappedHeight(ctx, caption, cardW - pad * 2, 38, 3) + 4) : 0;
  const captionBlock = pad + (caption ? capH : 4) + pad;
  let cardH = headerH + imageH + captionBlock;
  const maxCardH = H - 72;
  let drawImageH = imageH;
  if (cardH > maxCardH) {
    // Prefer keeping the photo large; shrink caption space first, then image.
    const overflow = cardH - maxCardH;
    const reducedCap = Math.max(0, capH - overflow);
    const stillOver = cardH - maxCardH - (capH - reducedCap);
    drawImageH = Math.max(640, imageH - Math.max(0, stillOver));
    cardH = headerH + drawImageH + pad + (caption ? Math.max(36, reducedCap) : 4) + pad;
  }
  const cardY = Math.max(36, Math.round((H - cardH) / 2));

  drawLiftedCard(ctx, cardX, cardY, cardW, cardH, radius, CARD_WHITE);

  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.clip();

  const avX = cardX + pad;
  const avY = cardY + pad;
  drawAvatar(ctx, avX, avY, av, name, photo, true);

  const textX = avX + av + 20;
  const textMax = cardX + cardW - pad - textX;
  ctx.fillStyle = INK;
  ctx.font = `700 34px ${FONT}`;
  const nameLabel = ellipsize(ctx, name, handle ? textMax * 0.55 : textMax);
  ctx.fillText(nameLabel, textX, avY + 34);
  if (handle) {
    const nameW = ctx.measureText(nameLabel).width;
    ctx.fillStyle = INK_MUTED;
    ctx.font = `500 26px ${FONT}`;
    ctx.fillText(ellipsize(ctx, `@${handle}`, textMax - nameW - 16), textX + nameW + 14, avY + 34);
  }
  const pillW = drawTopicPill(ctx, textX, avY + 48, topicLabel);
  if (timeLabel) {
    ctx.fillStyle = INK_MUTED;
    ctx.font = `500 22px ${FONT}`;
    ctx.fillText(`·  ${timeLabel}`, textX + pillW + 12, avY + 76);
  }

  drawCover(ctx, media, cardX, cardY + headerH, cardW, drawImageH, 0);

  if (caption) {
    ctx.fillStyle = INK;
    ctx.font = `500 30px ${FONT}`;
    drawWrapped(
      ctx,
      caption,
      cardX + pad,
      cardY + headerH + drawImageH + pad + 28,
      cardW - pad * 2,
      38,
      3,
    );
  }
  ctx.restore();
  roundRect(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.strokeStyle = "rgba(18, 20, 26, 0.10)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawPin(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + 11, y);
  ctx.bezierCurveTo(x + 4, y, x, y + 7, x, y + 13);
  ctx.bezierCurveTo(x, y + 20, x + 11, y + 30, x + 11, y + 30);
  ctx.bezierCurveTo(x + 11, y + 30, x + 22, y + 20, x + 22, y + 13);
  ctx.bezierCurveTo(x + 22, y + 7, x + 18, y, x + 11, y);
  ctx.closePath();
  ctx.arc(x + 11, y + 12, 4, 0, Math.PI * 2, true);
  ctx.fill("evenodd");
  ctx.restore();
}

function drawQuoteCard(
  ctx: CanvasRenderingContext2D,
  body: string,
  name: string,
  handle: string | null,
  photo: CanvasImageSource | null,
) {
  // Full-bleed cream story — no floating card on a black void.
  const wash = ctx.createLinearGradient(0, 0, W, H);
  wash.addColorStop(0, "#d7ebe4");
  wash.addColorStop(0.45, CREAM);
  wash.addColorStop(1, "#e8f4f1");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);

  const padX = 72;
  const textW = W - padX * 2;
  const metrics = quoteMetrics(body);
  const topY = TOP_SAFE + 40;
  const authorH = 72;
  const authorY = H - BOTTOM_SAFE - authorH;

  ctx.fillStyle = "rgba(15, 118, 110, 0.16)";
  ctx.font = `700 200px ${FONT_SERIF}`;
  ctx.fillText("“", padX - 12, topY + 120);

  ctx.fillStyle = INK;
  ctx.font = `500 ${metrics.size}px ${FONT_SERIF}`;
  drawWrapped(ctx, body, padX, topY + 132, textW, metrics.lh, metrics.maxLines);

  ctx.strokeStyle = "rgba(18, 20, 26, 0.08)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padX, authorY - 28);
  ctx.lineTo(W - padX, authorY - 28);
  ctx.stroke();
  drawAuthorRow(ctx, padX, authorY, name, handle, true, photo);
}

function drawEventCard(
  ctx: CanvasRenderingContext2D,
  event: { title: string; starts_at: string; location?: string; details?: string },
  media: CanvasImageSource | null,
  name: string,
  handle: string | null,
) {
  const innerW = W - SIDE * 2;
  const maxCardH = H - TOP_SAFE - BOTTOM_SAFE;
  const imageH = media ? 720 : 280;
  const pad = 44;
  const textW = innerW - pad * 2;
  const parts = eventParts(event.starts_at);
  const loc = event.location?.trim() || "";

  ctx.font = `700 46px ${FONT}`;
  const titleH = media ? 0 : wrappedHeight(ctx, event.title, textW, 54, 3);
  const metaH = 156;
  const cardH = Math.min(maxCardH, imageH + (media ? 0 : titleH + 24) + metaH + pad);
  const cardY = TOP_SAFE + Math.max(0, (maxCardH - cardH) / 2);

  drawLiftedCard(ctx, SIDE, cardY, innerW, cardH, 40, "#101826");

  ctx.save();
  roundRect(ctx, SIDE, cardY, innerW, cardH, 40);
  ctx.clip();
  if (media) {
    drawCover(ctx, media, SIDE, cardY, innerW, imageH, 0);
    const fade = ctx.createLinearGradient(0, cardY + imageH - 220, 0, cardY + imageH);
    fade.addColorStop(0, "rgba(16, 24, 38, 0)");
    fade.addColorStop(1, "#101826");
    ctx.fillStyle = fade;
    ctx.fillRect(SIDE, cardY + imageH - 220, innerW, 220);
    ctx.fillStyle = WHITE;
    ctx.font = `700 52px ${FONT}`;
    drawWrapped(ctx, event.title, SIDE + pad, cardY + imageH - 118, textW, 58, 2);
  } else {
    const hdr = ctx.createLinearGradient(SIDE, cardY, SIDE + innerW, cardY + imageH);
    hdr.addColorStop(0, "#134e4a");
    hdr.addColorStop(1, "#1e3a5f");
    ctx.fillStyle = hdr;
    ctx.fillRect(SIDE, cardY, innerW, imageH);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.font = `700 220px ${FONT}`;
    ctx.fillText(parts.day, SIDE + 36, cardY + 210);
  }
  ctx.restore();

  let y = cardY + imageH + 28;
  if (!media) {
    ctx.fillStyle = WHITE;
    ctx.font = `700 46px ${FONT}`;
    y += 40;
    y += drawWrapped(ctx, event.title, SIDE + pad, y, textW, 54, 3) + 20;
  }

  const chipW = 118;
  fillRoundRect(ctx, SIDE + pad, y, chipW, 118, 22, CREAM);
  ctx.fillStyle = TEAL_DEEP;
  ctx.font = `700 18px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(parts.weekday, SIDE + pad + chipW / 2, y + 32);
  ctx.fillStyle = INK;
  ctx.font = `700 44px ${FONT}`;
  ctx.fillText(parts.day, SIDE + pad + chipW / 2, y + 76);
  ctx.fillStyle = INK_MUTED;
  ctx.font = `600 16px ${FONT}`;
  ctx.fillText(parts.month, SIDE + pad + chipW / 2, y + 100);
  ctx.textAlign = "left";

  const metaX = SIDE + pad + chipW + 28;
  ctx.fillStyle = WHITE;
  ctx.font = `600 30px ${FONT}`;
  ctx.fillText(parts.time, metaX, y + 38);
  if (loc) {
    drawPin(ctx, metaX, y + 52, TEAL);
    ctx.fillStyle = "rgba(248,250,252,0.78)";
    ctx.font = `500 26px ${FONT}`;
    const locLabel = loc.length > 28 ? `${loc.slice(0, 27)}…` : loc;
    ctx.fillText(locLabel, metaX + 30, y + 76);
  }
  ctx.fillStyle = "rgba(248,250,252,0.5)";
  ctx.font = `500 22px ${FONT}`;
  ctx.fillText(handle ? `${name}  ·  @${handle}` : name, metaX, y + 110);
}

function drawMediaStory(
  ctx: CanvasRenderingContext2D,
  media: CanvasImageSource,
  caption: string,
) {
  ctx.fillStyle = "#05060a";
  ctx.fillRect(0, 0, W, H);
  drawCover(ctx, media, 0, 0, W, H, 0);

  const top = ctx.createLinearGradient(0, 0, 0, 460);
  top.addColorStop(0, "rgba(0,0,0,0.58)");
  top.addColorStop(0.45, "rgba(0,0,0,0.18)");
  top.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, 460);

  const bottomH = 620;
  const bot = ctx.createLinearGradient(0, H - bottomH, 0, H);
  bot.addColorStop(0, "rgba(0,0,0,0)");
  bot.addColorStop(0.38, "rgba(0,0,0,0.22)");
  bot.addColorStop(1, "rgba(0,0,0,0.7)");
  ctx.fillStyle = bot;
  ctx.fillRect(0, H - bottomH, W, bottomH);

  const textX = 72;
  const textW = W - 144;
  ctx.font = `500 36px ${FONT}`;
  const capH = caption ? wrappedHeight(ctx, caption, textW, 46, 4) : 0;
  const y = H - BOTTOM_SAFE - 12 - capH;

  if (caption) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 16;
    ctx.fillStyle = WHITE;
    ctx.font = `500 36px ${FONT}`;
    drawWrapped(ctx, caption, textX, y + 36, textW, 46, 4);
    ctx.restore();
  }
}

function drawPollCard(
  ctx: CanvasRenderingContext2D,
  question: string,
  options: string[],
  name: string,
  handle: string | null,
  photo: CanvasImageSource | null,
) {
  const pad = 48;
  const innerW = W - SIDE * 2;
  const textW = innerW - pad * 2;
  const opts = options.slice(0, 6);
  ctx.font = `700 40px ${FONT}`;
  const qH = wrappedHeight(ctx, question, textW, 52, 4);
  const cardH = Math.min(
    H - TOP_SAFE - BOTTOM_SAFE,
    pad + 36 + qH + 28 + opts.length * 96 + 28 + 64 + pad,
  );
  const cardY = TOP_SAFE + Math.max(0, (H - TOP_SAFE - BOTTOM_SAFE - cardH) / 2);

  drawLiftedCard(ctx, SIDE, cardY, innerW, cardH, 40, "#101826");
  ctx.save();
  roundRect(ctx, SIDE, cardY, innerW, cardH, 40);
  ctx.clip();
  ctx.fillStyle = TEAL;
  ctx.fillRect(SIDE, cardY, innerW, 8);
  ctx.restore();
  ctx.fillStyle = WHITE;
  ctx.font = `700 40px ${FONT}`;
  let y = cardY + pad + 12;
  y += drawWrapped(ctx, question, SIDE + pad, y + 40, textW, 52, 4) + 24;

  ctx.font = `600 28px ${FONT}`;
  for (const option of opts) {
    if (y + 80 > cardY + cardH - pad - 80) break;
    fillRoundRect(ctx, SIDE + pad, y, textW, 80, 22, "rgba(255,255,255,0.06)");
    roundRect(ctx, SIDE + pad, y, textW, 80, 22);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(SIDE + pad + 32, y + 40, 11, 0, Math.PI * 2);
    ctx.strokeStyle = TEAL;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = WHITE;
    const label = option.length > 42 ? `${option.slice(0, 41)}…` : option;
    ctx.fillText(label, SIDE + pad + 58, y + 50);
    y += 96;
  }

  drawAuthorRow(ctx, SIDE + pad, cardY + cardH - pad - 52, name, handle, false, photo);
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
  // Video posts: freeze one frame into the same shared card as photos (caption below).
  // The story viewer then plays the live post video inside StorySharedPostStage.
  const mediaPath = event ? post.image_urls[0] || null : post.video_url || post.image_urls[0] || null;
  const media = await loadMedia(mediaPath);
  const caption = (() => {
    const body = post.body.trim();
    if (!body) return "";
    if (poll && body === poll.question.trim()) return "";
    if (event && body === event.title.trim()) return "";
    return body;
  })();
  const handle = handleOf(meta);
  const name = nameOf(meta);
  const photo = await loadAvatar(meta);
  const topicLabel = communityTopicLabel(post.topic);
  const postedAgo = timeAgo(post.created_at);

  if (poll) {
    drawAtmosphere(ctx, null);
    drawPollCard(ctx, poll.question, poll.options, name, handle, photo);
  } else if (event) {
    drawAtmosphere(ctx, media);
    drawEventCard(ctx, event, media, name, handle);
  } else if (media) {
    if (meta.isOwn) {
      drawMediaStory(ctx, media, caption);
    } else {
      drawSharedFeedCard(ctx, media, caption, name, handle, photo, topicLabel, postedAgo);
    }
  } else {
    drawAtmosphere(ctx, null);
    drawQuoteCard(ctx, caption || "Shared from the feed", name, handle, photo);
  }

  return canvasToFile(canvas);
}
