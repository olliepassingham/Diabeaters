#!/usr/bin/env python3
"""
Export Instagram profile pictures (1080×1080) with circular-safe mark placement.

Variants:
  - instagram-profile-teal-1080.png    — app teal / mint (matches launch post)
  - instagram-profile-sunrise-1080.png — blue → cream → mint (matches App Store icon)

Preview crops (for checking the IG circle) are written alongside each export.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
SIZE = 1080
# Mark occupies ~58% of frame — safe inside Instagram's circular crop
MARK_SCALE = 0.58
MARK_COLOR_DARK = (26, 42, 58, 255)  # navy lines on light backgrounds
MARK_COLOR_LIGHT = (255, 255, 255, 255)  # white lines on dark teal


def extract_mark_from_logo(logo_path: Path, *, light_on_dark: bool = False) -> Image.Image:
    """White line art on black → clean transparent PNG mark."""
    line_rgb = MARK_COLOR_LIGHT if light_on_dark else MARK_COLOR_DARK
    src = Image.open(logo_path).convert("L")
    # Upscale before thresholding so edges stay smooth when scaled down
    work_size = 1024
    src = src.resize((work_size, work_size), Image.Resampling.LANCZOS)
    gray = src.load()
    alpha = Image.new("L", (work_size, work_size), 0)
    alpha_px = alpha.load()
    for y in range(work_size):
        for x in range(work_size):
            if gray[x, y] > 130:
                alpha_px[x, y] = 255
    # Slight thicken so lines survive IG's tiny avatar size
    alpha = alpha.filter(ImageFilter.MaxFilter(5))
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.6))
    out = Image.new("RGBA", (work_size, work_size), (*line_rgb[:3], 0))
    out.putalpha(alpha)
    return out


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def _lerp_rgb(c1: tuple[int, int, int], c2: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return (
        int(_lerp(c1[0], c2[0], t)),
        int(_lerp(c1[1], c2[1], t)),
        int(_lerp(c1[2], c2[2], t)),
    )


def _bilinear_corner_gradient(
    size: int,
    tl: tuple[int, int, int],
    tr: tuple[int, int, int],
    bl: tuple[int, int, int],
    br: tuple[int, int, int],
) -> Image.Image:
    img = Image.new("RGB", (size, size))
    px = img.load()
    last = size - 1
    for y in range(size):
        ty = y / last
        for x in range(size):
            tx = x / last
            top = _lerp_rgb(tl, tr, tx)
            bottom = _lerp_rgb(bl, br, tx)
            px[x, y] = _lerp_rgb(top, bottom, ty)
    return img


def _radial_glow(base: Image.Image, cx: float, cy: float, radius: float, color: tuple[int, int, int], alpha: float) -> Image.Image:
    w, h = base.size
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    steps = 48
    for i in range(steps, 0, -1):
        t = i / steps
        r = radius * t
        a = int(255 * alpha * (1 - t) ** 1.6)
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(*color, a))
    base_rgba = base.convert("RGBA")
    return Image.alpha_composite(base_rgba, glow).convert("RGB")


def _subtle_grain(img: Image.Image, opacity: float = 0.035) -> Image.Image:
    noise = Image.effect_noise((img.width, img.height), 48).convert("L")
    noise_rgb = Image.merge("RGB", (noise, noise, noise))
    return ImageChops.blend(img, noise_rgb, opacity)


def paste_mark_centered(canvas: Image.Image, mark: Image.Image) -> Image.Image:
    target = int(SIZE * MARK_SCALE)
    mark_scaled = mark.resize((target, target), Image.Resampling.LANCZOS)
    x = (SIZE - target) // 2
    y = (SIZE - target) // 2
    base = canvas.convert("RGBA")
    base.alpha_composite(mark_scaled, (x, y))
    return base.convert("RGB")


def circle_preview(img: Image.Image) -> Image.Image:
    """Simulate Instagram circular crop for QA."""
    size = img.size[0]
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size - 1, size - 1), fill=255)
    dark = Image.new("RGB", (size, size), (18, 24, 32))
    out = Image.composite(img, dark, mask)
    return out


def build_teal() -> Image.Image:
    # Deep teal-charcoal base with mint centre glow (matches app + launch post)
    base = _bilinear_corner_gradient(
        SIZE,
        (6, 28, 26),
        (10, 48, 44),
        (5, 22, 20),
        (14, 72, 66),
    )
    img = _radial_glow(base, SIZE * 0.5, SIZE * 0.46, SIZE * 0.52, (84, 196, 186), 0.32)
    img = _radial_glow(img, SIZE * 0.5, SIZE * 0.46, SIZE * 0.34, (20, 130, 118), 0.26)
    img = _subtle_grain(img)
    return img


def build_sunrise() -> Image.Image:
    # App Store / linkedin-logo gradient: sky blue → cream → mint
    img = _bilinear_corner_gradient(
        SIZE,
        (168, 212, 238),
        (210, 228, 245),
        (232, 248, 238),
        (184, 228, 196),
    )
    img = _radial_glow(img, SIZE * 0.42, SIZE * 0.38, SIZE * 0.55, (245, 240, 220), 0.35)
    img = _subtle_grain(img, 0.03)
    return img


def upscale_sunrise_from_linkedin() -> Image.Image | None:
    linkedin = ROOT / "linkedin-logo-300x300.png"
    if not linkedin.exists():
        return None
    return Image.open(linkedin).convert("RGB").resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def main() -> None:
    logo = ROOT / "logo-300x300.png"
    if not logo.exists():
        raise SystemExit(f"Missing mark source: {logo}")

    teal_path = ROOT / "instagram-profile-teal-1080.png"
    # Teal is rendered via branding/instagram-profile-teal.html + capture-instagram-profiles.mjs
    # (cleaner line art than raster mark extraction). Sunrise stays PIL/upscale below.
    if not teal_path.exists():
        print("Note: run `node branding/capture-instagram-profiles.mjs` for teal profile PNG")

    # Prefer upscaled linkedin asset for sunrise (matches existing social / App Store)
    sunrise = upscale_sunrise_from_linkedin()
    if sunrise is None:
        sunrise_bg = build_sunrise()
        sunrise_mark = extract_mark_from_logo(logo, light_on_dark=False)
        sunrise = paste_mark_centered(sunrise_bg, sunrise_mark)
    sunrise_path = ROOT / "instagram-profile-sunrise-1080.png"
    sunrise.save(sunrise_path, format="PNG", optimize=True)
    circle_preview(sunrise).save(ROOT / "instagram-profile-sunrise-1080-circle-preview.png", format="PNG", optimize=True)

    if teal_path.exists():
        teal = Image.open(teal_path).convert("RGB")
        circle_preview(teal).save(ROOT / "instagram-profile-teal-1080-circle-preview.png", format="PNG", optimize=True)

    print(f"Sunrise → {sunrise_path.name} (+ circle preview)")
    if teal_path.exists():
        print(f"Teal    → {teal_path.name} (+ circle preview)")
    else:
        print("Teal    → run node branding/capture-instagram-profiles.mjs")
    print(f"Mark scale: {MARK_SCALE * 100:.0f}% of frame (circular safe zone)")


if __name__ == "__main__":
    main()
