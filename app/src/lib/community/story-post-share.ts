import { format } from "date-fns";
import { fileFromPostMediaPath } from "@/lib/community/post-media-signed-urls";
import { parseEventDate } from "@/lib/community/event-display";
import { parseEventExtra, parsePollExtra } from "@/lib/community/post-kinds";
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
  ctx.fillStyle = "#07080d";
  ctx.fillRect(0, 0, W, H);

  if (media) {
    ctx.save();
    ctx.filter = "blur(48px)";
    drawCover(ctx, media, -120, -120, W + 240, H + 240, 0);
    ctx.restore();
    ctx.fillStyle = "rgba(6, 8, 14, 0.58)";
    ctx.fillRect(0, 0, W, H);
  } else {
    const a = ctx.createRadialGradient(W * 0.22, H * 0.28, 40, W * 0.22, H * 0.28, 780);
    a.addColorStop(0, "rgba(20, 184, 166, 0.28)");
    a.addColorStop(1, "rgba(20, 184, 166, 0)");
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, W, H);
    const b = ctx.createRadialGradient(W * 0.86, H * 0.72, 20, W * 0.86, H * 0.72, 820);
    b.addColorStop(0, "rgba(59, 130, 246, 0.22)");
    b.addColorStop(1, "rgba(59, 130, 246, 0)");
    ctx.fillStyle = b;
    ctx.fillRect(0, 0, W, H);
  }

  const vignette = ctx.createLinearGradient(0, 0, 0, H);
  vignette.addColorStop(0, "rgba(0,0,0,0.38)");
  vignette.addColorStop(0.22, "rgba(0,0,0,0)");
  vignette.addColorStop(0.78, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.55)");
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

function drawAuthorRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  name: string,
  handle: string | null,
  onLight: boolean,
) {
  const av = 52;
  drawInitialAvatar(ctx, x, y, av, name, onLight);
  ctx.fillStyle = onLight ? INK : WHITE;
  ctx.font = `600 28px ${FONT}`;
  ctx.fillText(name, x + av + 16, y + 24);
  ctx.fillStyle = onLight ? INK_MUTED : "rgba(248,250,252,0.62)";
  ctx.font = `500 22px ${FONT}`;
  ctx.fillText(handle ? `@${handle}` : "From the feed", x + av + 16, y + 48);
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
) {
  const pad = 56;
  const innerW = W - SIDE * 2;
  const textW = innerW - pad * 2;
  const metrics = quoteMetrics(body);
  ctx.font = `500 ${metrics.size}px ${FONT_SERIF}`;
  const textH = wrappedHeight(ctx, body, textW, metrics.lh, metrics.maxLines);
  const authorH = 64;
  const cardH = Math.min(H - TOP_SAFE - BOTTOM_SAFE, pad + 92 + textH + 40 + authorH + pad);
  const cardY = TOP_SAFE + Math.max(0, (H - TOP_SAFE - BOTTOM_SAFE - cardH) / 2);

  drawLiftedCard(ctx, SIDE, cardY, innerW, cardH, 40, CREAM);
  ctx.save();
  roundRect(ctx, SIDE, cardY, innerW, cardH, 40);
  ctx.clip();
  ctx.fillStyle = TEAL;
  ctx.fillRect(SIDE, cardY, innerW, 8);
  ctx.restore();

  ctx.fillStyle = "rgba(15, 118, 110, 0.14)";
  ctx.font = `700 168px ${FONT_SERIF}`;
  ctx.fillText("“", SIDE + 28, cardY + 148);

  ctx.fillStyle = INK;
  ctx.font = `500 ${metrics.size}px ${FONT_SERIF}`;
  drawWrapped(ctx, body, SIDE + pad, cardY + pad + 108, textW, metrics.lh, metrics.maxLines);

  const authorY = cardY + cardH - pad - authorH + 6;
  ctx.strokeStyle = "rgba(18, 20, 26, 0.08)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(SIDE + pad, authorY - 22);
  ctx.lineTo(SIDE + innerW - pad, authorY - 22);
  ctx.stroke();
  drawAuthorRow(ctx, SIDE + pad, authorY, name, handle, true);
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

function drawMediaCard(
  ctx: CanvasRenderingContext2D,
  media: CanvasImageSource,
  caption: string,
  name: string,
  handle: string | null,
) {
  const innerW = W - SIDE * 2;
  const maxCardH = H - TOP_SAFE - BOTTOM_SAFE;
  const imageH = Math.min(1180, maxCardH);
  const cardY = TOP_SAFE + Math.max(0, (maxCardH - imageH) / 2);

  drawLiftedCard(ctx, SIDE, cardY, innerW, imageH, 40, "#101826");
  ctx.save();
  roundRect(ctx, SIDE, cardY, innerW, imageH, 40);
  ctx.clip();
  drawCover(ctx, media, SIDE, cardY, innerW, imageH, 0);

  ctx.font = `600 28px ${FONT}`;
  const nameW = ctx.measureText(name).width;
  ctx.font = `500 22px ${FONT}`;
  const subW = ctx.measureText(handle ? `@${handle}` : "From the feed").width;
  const chipW = Math.min(innerW - 56, 52 + 16 + Math.max(nameW, subW) + 36);
  fillRoundRect(ctx, SIDE + 28, cardY + 28, chipW, 64, 32, "rgba(8, 10, 16, 0.58)");
  drawAuthorRow(ctx, SIDE + 40, cardY + 34, name, handle, false);

  if (caption) {
    const fade = ctx.createLinearGradient(0, cardY + imageH - 220, 0, cardY + imageH);
    fade.addColorStop(0, "rgba(8, 10, 16, 0)");
    fade.addColorStop(1, "rgba(8, 10, 16, 0.78)");
    ctx.fillStyle = fade;
    ctx.fillRect(SIDE, cardY + imageH - 220, innerW, 220);
    ctx.fillStyle = WHITE;
    ctx.font = `500 32px ${FONT}`;
    drawWrapped(ctx, caption, SIDE + 40, cardY + imageH - 88, innerW - 80, 42, 3);
  }
  ctx.restore();
}

function drawPollCard(
  ctx: CanvasRenderingContext2D,
  question: string,
  options: string[],
  name: string,
  handle: string | null,
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

  drawAuthorRow(ctx, SIDE + pad, cardY + cardH - pad - 52, name, handle, false);
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
  const handle = handleOf(meta);
  const name = nameOf(meta);

  drawAtmosphere(ctx, media);

  if (poll) {
    drawPollCard(ctx, poll.question, poll.options, name, handle);
  } else if (event) {
    drawEventCard(ctx, event, media, name, handle);
  } else if (media) {
    drawMediaCard(ctx, media, caption, name, handle);
  } else {
    drawQuoteCard(ctx, caption || "Shared from the feed", name, handle);
  }

  return canvasToFile(canvas);
}
