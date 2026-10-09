import { format, formatDistanceToNow } from "date-fns";
import { fileFromPostMediaPath } from "@/lib/community/post-media-signed-urls";
import { parseEventDate } from "@/lib/community/event-display";
import { parseEventExtra, parsePollExtra } from "@/lib/community/post-kinds";
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
/** Same family as feed posts (Inter), not the display face used on story stickers. */
const POST_FONT = '"Inter Variable", Inter, system-ui, sans-serif';
/** Maps a feed CSS pixel onto the 1080-wide story so it reads the same on a phone. */
const POST_SCALE = W / 390;
const POST_INK = "#1c1b23";
const POST_MUTED = "#404656";
const INK = "#12141a";
const INK_MUTED = "#5c6473";
const CREAM = "#f6f1e8";
const TEAL = "#14b8a6";
const TEAL_DEEP = "#0f766e";
const WHITE = "#f8fafc";
const CARD_WHITE = "#ffffff";
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
  const full = text.replace(/\s+/g, " ").trim();
  const shown = lines.join(" ").replace(/\s+/g, " ").trim();
  const truncated = shown.length > 0 && shown.length < full.length;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const last = i === lines.length - 1;
    let out = line;
    if (last && truncated) {
      const ellipsis = "…";
      while (out && ctx.measureText(`${out}${ellipsis}`).width > maxWidth) {
        out = out.replace(/\s+\S*$|\S$/, "").trimEnd();
      }
      out = out ? `${out}${ellipsis}` : ellipsis;
    }
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

function postPx(cssPx: number): number {
  return Math.round(cssPx * POST_SCALE);
}

type PostWord = { text: string; weight: "600" | "400"; gapBefore: number; breakBefore: boolean };

/** Feed photo captions: semibold name, then the body in regular Inter at text-sm / leading-snug. */
function postCaptionWords(name: string, body: string): PostWord[] {
  const words: PostWord[] = [];
  const space = postPx(3.5);
  const nameGap = postPx(6);
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .forEach((text, i) => {
      words.push({ text, weight: "600", gapBefore: i === 0 ? 0 : space, breakBefore: false });
    });
  body
    .replace(/\r/g, "")
    .split("\n")
    .forEach((para, pi) => {
      para
        .split(/\s+/)
        .filter(Boolean)
        .forEach((text, i) => {
          const first = words.length > 0 && i === 0 && pi === 0;
          words.push({
            text,
            weight: "400",
            gapBefore: words.length === 0 ? 0 : first ? nameGap : space,
            breakBefore: pi > 0 && i === 0,
          });
        });
    });
  return words;
}

function layoutPostCaption(
  ctx: CanvasRenderingContext2D,
  words: PostWord[],
  maxWidth: number,
  maxLines: number,
): { lines: PostWord[][]; truncated: boolean } {
  const size = postPx(14);
  const lines: PostWord[][] = [];
  let current: PostWord[] = [];
  let width = 0;
  const pushLine = () => {
    if (current.length === 0) return;
    lines.push(current);
    current = [];
    width = 0;
  };
  for (const word of words) {
    if (word.breakBefore) pushLine();
    if (lines.length >= maxLines) return { lines, truncated: true };
    ctx.font = `${word.weight} ${size}px ${POST_FONT}`;
    const wordW = ctx.measureText(word.text).width;
    const gap = current.length === 0 ? 0 : word.gapBefore;
    if (current.length > 0 && width + gap + wordW > maxWidth) {
      pushLine();
      if (lines.length >= maxLines) return { lines, truncated: true };
      current = [{ ...word, gapBefore: 0, breakBefore: false }];
      width = wordW;
    } else {
      current.push(current.length === 0 ? { ...word, gapBefore: 0 } : word);
      width += gap + wordW;
    }
  }
  pushLine();
  return { lines, truncated: false };
}

function postCaptionHeight(
  ctx: CanvasRenderingContext2D,
  name: string,
  body: string,
  maxWidth: number,
  maxLines: number,
): number {
  const words = postCaptionWords(name, body);
  if (words.length === 0) return 0;
  const { lines } = layoutPostCaption(ctx, words, maxWidth, maxLines);
  return lines.length * postPx(14 * 1.375);
}

function drawPostCaption(
  ctx: CanvasRenderingContext2D,
  name: string,
  body: string,
  x: number,
  baseline: number,
  maxWidth: number,
  maxLines: number,
): number {
  const words = postCaptionWords(name, body);
  if (words.length === 0) return 0;
  const size = postPx(14);
  const lineHeight = postPx(14 * 1.375);
  const { lines, truncated } = layoutPostCaption(ctx, words, maxWidth, maxLines);
  ctx.fillStyle = POST_INK;
  ctx.textAlign = "left";
  lines.forEach((line, i) => {
    let cursor = x;
    const lastLine = i === lines.length - 1;
    line.forEach((word, wi) => {
      if (wi > 0) cursor += word.gapBefore;
      ctx.font = `${word.weight} ${size}px ${POST_FONT}`;
      let text = word.text;
      if (truncated && lastLine && wi === line.length - 1) {
        const ellipsis = "…";
        while (text && ctx.measureText(`${text}${ellipsis}`).width > maxWidth - (cursor - x)) {
          text = text.slice(0, -1);
        }
        text = text ? `${text}${ellipsis}` : ellipsis;
      }
      ctx.fillText(text, cursor, baseline + i * lineHeight);
      cursor += ctx.measureText(text).width;
    });
  });
  return lines.length * lineHeight;
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

function drawAtmosphere(ctx: CanvasRenderingContext2D, _media: CanvasImageSource | null) {
  ctx.fillStyle = "#f4f4f5";
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

function drawCollage(
  ctx: CanvasRenderingContext2D,
  images: CanvasImageSource[],
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const gap = 8;
  const shots = images.slice(0, 4);
  if (shots.length <= 1) {
    if (shots[0]) drawCover(ctx, shots[0], x, y, w, h, 0);
    return;
  }
  if (shots.length === 2) {
    const cw = (w - gap) / 2;
    drawCover(ctx, shots[0]!, x, y, cw, h, 0);
    drawCover(ctx, shots[1]!, x + cw + gap, y, cw, h, 0);
    return;
  }
  if (shots.length === 3) {
    const topH = Math.round(h * 0.56);
    const botH = h - gap - topH;
    const cw = (w - gap) / 2;
    drawCover(ctx, shots[0]!, x, y, w, topH, 0);
    drawCover(ctx, shots[1]!, x, y + topH + gap, cw, botH, 0);
    drawCover(ctx, shots[2]!, x + cw + gap, y + topH + gap, cw, botH, 0);
    return;
  }
  const cw = (w - gap) / 2;
  const ch = (h - gap) / 2;
  shots.forEach((img, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    drawCover(ctx, img, x + col * (cw + gap), y + row * (ch + gap), cw, ch, 0);
  });
}

/** Feed-style card that fits a phone story, with room for the share controls. */
function drawSharedFeedCard(
  ctx: CanvasRenderingContext2D,
  images: CanvasImageSource[],
  caption: string,
  name: string,
  handle: string | null,
  photo: CanvasImageSource | null,
  timeLabel: string,
) {
  ctx.fillStyle = "#f4f4f5";
  ctx.fillRect(0, 0, W, H);

  const cardX = 56;
  const cardW = W - 112;
  const radius = 40;
  const pad = 32;
  const topSafe = 260;
  const bottomSafe = 390;
  const maxCardH = H - topSafe - bottomSafe;
  const av = 84;
  const headerH = 28 + av + 28;
  const viewRow = 64;
  const capLines = caption ? 4 : 0;
  const capH = caption ? postCaptionHeight(ctx, name, caption, cardW - pad * 2, capLines) : 0;
  const captionBlock = caption ? postPx(6) + capH + postPx(4) : 0;
  const imageH = Math.max(520, maxCardH - headerH - captionBlock - viewRow);
  const cardH = Math.min(maxCardH, headerH + imageH + captionBlock + viewRow);
  const cardY = topSafe + Math.max(0, Math.round((maxCardH - cardH) / 2));

  drawLiftedCard(ctx, cardX, cardY, cardW, cardH, radius, CARD_WHITE);
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.clip();

  const avX = cardX + pad;
  const avY = cardY + 28;
  drawAvatar(ctx, avX, avY, av, name, photo, true);
  ctx.font = `600 ${postPx(11)}px ${POST_FONT}`;
  const badge = "Shared post";
  const badgeW = ctx.measureText(badge).width + postPx(16);
  const badgeH = postPx(20);
  const badgeX = cardX + cardW - pad - badgeW;
  const badgeY = avY + postPx(2);
  fillRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2, "rgba(15, 118, 110, 0.12)");
  ctx.fillStyle = TEAL_DEEP;
  ctx.textAlign = "center";
  ctx.fillText(badge, badgeX + badgeW / 2, badgeY + postPx(14));
  ctx.textAlign = "left";

  const textX = avX + av + 20;
  const textMax = Math.max(80, badgeX - 16 - textX);
  ctx.fillStyle = POST_INK;
  ctx.font = `600 ${postPx(15)}px ${POST_FONT}`;
  ctx.fillText(ellipsize(ctx, name, textMax), textX, avY + postPx(16));
  ctx.fillStyle = POST_MUTED;
  ctx.font = `400 ${postPx(13)}px ${POST_FONT}`;
  const byline = [handle ? `@${handle}` : null, timeLabel || null].filter(Boolean).join("  ·  ");
  ctx.fillText(ellipsize(ctx, byline || "From the feed", textMax), textX, avY + postPx(34));

  const mediaY = cardY + headerH;
  const mediaH = cardH - headerH - captionBlock - viewRow;
  ctx.fillStyle = "#eef1f4";
  ctx.fillRect(cardX, mediaY, cardW, mediaH);
  drawCollage(ctx, images, cardX, mediaY, cardW, mediaH);

  let y = mediaY + mediaH;
  if (caption) {
    const capSize = postPx(14);
    drawPostCaption(ctx, name, caption, cardX + pad, y + postPx(6) + capSize, cardW - pad * 2, capLines);
    y += captionBlock;
  }

  ctx.fillStyle = TEAL_DEEP;
  ctx.font = `600 ${postPx(13)}px ${POST_FONT}`;
  ctx.fillText("View post", cardX + pad, y + postPx(18));
  ctx.restore();

  roundRect(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.strokeStyle = "rgba(15, 23, 42, 0.08)";
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

/** Text posts use the same card as a photo share: author, the post body, then View post. */
function drawTextFeedCard(
  ctx: CanvasRenderingContext2D,
  body: string,
  name: string,
  handle: string | null,
  photo: CanvasImageSource | null,
  timeLabel: string,
) {
  ctx.fillStyle = "#f4f4f5";
  ctx.fillRect(0, 0, W, H);

  const cardX = 56;
  const cardW = W - 112;
  const radius = 40;
  const pad = 36;
  const textW = cardW - pad * 2;
  const topSafe = 260;
  const bottomSafe = 390;
  const maxCardH = H - topSafe - bottomSafe;
  const av = 84;
  const headerH = 28 + av + 28;
  const viewRow = postPx(44);
  const bodySize = postPx(15);
  const lineH = postPx(15 * 1.45);
  const maxLines = 12;
  ctx.font = `400 ${bodySize}px ${POST_FONT}`;
  const bodyH = wrappedHeight(ctx, body, textW, lineH, maxLines);
  const cardH = Math.min(maxCardH, headerH + postPx(10) + bodyH + viewRow);
  const cardY = topSafe + Math.max(0, Math.round((maxCardH - cardH) / 2));

  drawLiftedCard(ctx, cardX, cardY, cardW, cardH, radius, CARD_WHITE);
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.clip();

  const avX = cardX + pad;
  const avY = cardY + 28;
  drawAvatar(ctx, avX, avY, av, name, photo, true);
  ctx.font = `600 ${postPx(11)}px ${POST_FONT}`;
  const badge = "Shared post";
  const badgeW = ctx.measureText(badge).width + postPx(16);
  const badgeH = postPx(20);
  const badgeX = cardX + cardW - pad - badgeW;
  const badgeY = avY + postPx(2);
  fillRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2, "rgba(15, 118, 110, 0.12)");
  ctx.fillStyle = TEAL_DEEP;
  ctx.textAlign = "center";
  ctx.fillText(badge, badgeX + badgeW / 2, badgeY + postPx(14));
  ctx.textAlign = "left";

  const textX = avX + av + 20;
  const textMax = Math.max(80, badgeX - 16 - textX);
  ctx.fillStyle = POST_INK;
  ctx.font = `600 ${postPx(15)}px ${POST_FONT}`;
  ctx.fillText(ellipsize(ctx, name, textMax), textX, avY + postPx(16));
  ctx.fillStyle = POST_MUTED;
  ctx.font = `400 ${postPx(13)}px ${POST_FONT}`;
  const byline = [handle ? `@${handle}` : null, timeLabel || null].filter(Boolean).join("  ·  ");
  ctx.fillText(ellipsize(ctx, byline || "From the feed", textMax), textX, avY + postPx(34));

  ctx.fillStyle = POST_INK;
  ctx.font = `400 ${bodySize}px ${POST_FONT}`;
  const bodyTop = cardY + headerH + postPx(10) + bodySize;
  drawWrapped(ctx, body, cardX + pad, bodyTop, textW, lineH, maxLines);

  ctx.fillStyle = TEAL_DEEP;
  ctx.font = `600 ${postPx(13)}px ${POST_FONT}`;
  ctx.fillText("View post", cardX + pad, cardY + cardH - postPx(22));
  ctx.restore();

  roundRect(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.strokeStyle = "rgba(15, 23, 42, 0.08)";
  ctx.lineWidth = 2;
  ctx.stroke();
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
  const imagePaths = (post.image_urls ?? []).filter(Boolean).slice(0, 4);
  const videoPath = post.video_url?.trim() || null;
  const loaded = await Promise.all(
    (event ? imagePaths.slice(0, 1) : videoPath ? [videoPath] : imagePaths).map((path) => loadMedia(path)),
  );
  const shots = loaded.filter((item): item is CanvasImageSource => item != null);
  const media = shots[0] ?? null;
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
  const postedAgo = timeAgo(post.created_at);

  if (poll) {
    drawAtmosphere(ctx, null);
    drawPollCard(ctx, poll.question, poll.options, name, handle, photo);
  } else if (event) {
    drawAtmosphere(ctx, media);
    drawEventCard(ctx, event, media, name, handle);
  } else if (shots.length > 0) {
    drawSharedFeedCard(ctx, shots, caption, name, handle, photo, postedAgo);
  } else {
    drawTextFeedCard(ctx, caption || "Shared from the feed", name, handle, photo, postedAgo);
  }

  return canvasToFile(canvas);
}
