#!/usr/bin/env python3
"""
Export Instagram portrait images from the horizontal Diabeaters marketing masters.

Carousel post slide: 1080 x 1350 (4:5) — same size as typical vertical IG carousel screenshots.
Story:              1080 x 1920 (9:16)

Uses cover-fill so every pixel of the frame is used (no letterboxing).
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent

CAROUSEL_MASTER = ROOT / "master-carousel-horizontal.png"
STORY_MASTER = ROOT / "master-story-horizontal.png"

_ASSETS = Path("/Users/olliepassingham/.cursor/projects/Users-olliepassingham-Diabeaters-Diabeaters/assets")
if not CAROUSEL_MASTER.exists():
    CAROUSEL_MASTER = _ASSETS / "instagram-carousel-source.png"
if not STORY_MASTER.exists():
    STORY_MASTER = _ASSETS / "instagram-story-source.png"

# 4:5 — Instagram carousel / feed portrait (match app screenshot slides)
POST_W, POST_H = 1080, 1350
# 9:16 — Instagram Story
STORY_W, STORY_H = 1080, 1920


def cover_fill(
    img: Image.Image,
    target_w: int,
    target_h: int,
    *,
    focus_x: float,
    focus_y: float,
) -> Image.Image:
    w, h = img.size
    scale = max(target_w / w, target_h / h)
    nw, nh = int(round(w * scale)), int(round(h * scale))
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    left = int((nw - target_w) * focus_x)
    top = int((nh - target_h) * focus_y)
    left = max(0, min(left, nw - target_w))
    top = max(0, min(top, nh - target_h))
    return resized.crop((left, top, left + target_w, top + target_h))


def main() -> None:
    carousel_src = Image.open(CAROUSEL_MASTER).convert("RGB")
    story_src = Image.open(STORY_MASTER).convert("RGB")

    carousel = cover_fill(carousel_src, POST_W, POST_H, focus_x=0.48, focus_y=0.36)
    story = cover_fill(story_src, STORY_W, STORY_H, focus_x=0.30, focus_y=0.36)

    carousel.save(ROOT / "instagram-carousel-cover-diabeaters.png", format="PNG", optimize=True)
    story.save(ROOT / "instagram-story-diabeaters.png", format="PNG", optimize=True)

    print(f"Carousel  {POST_W}x{POST_H} (4:5 portrait)")
    print(f"Story     {STORY_W}x{STORY_H} (9:16 portrait)")


if __name__ == "__main__":
    main()
