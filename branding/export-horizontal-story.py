#!/usr/bin/env python3
"""Export polished horizontal story graphic from master + real brand mark."""

from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

BRANDING = Path(__file__).resolve().parent
MASTER = BRANDING / "master-story-horizontal.png"
MARK = BRANDING / "diabeaters-mark.png"
OUT = BRANDING / "instagram-story-diabeaters.png"
OUT_2X = BRANDING / "instagram-story-diabeaters@2x.png"

# Same header layout as carousel master (1536×1024).
MARK_HEIGHT = 54
MARK_X = 118
MARK_Y = 52


def mark_to_white(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    pixels = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = pixels[x, y]
            if a:
                pixels[x, y] = (255, 255, 255, a)
    return img


def composite_mark(base: Image.Image) -> Image.Image:
    mark = Image.open(MARK)
    aspect = mark.width / mark.height
    mark_w = int(MARK_HEIGHT * aspect)
    mark = mark.resize((mark_w, MARK_HEIGHT), Image.Resampling.LANCZOS)
    mark = mark_to_white(mark)

    canvas = base.convert("RGBA")
    patch = Image.new("RGBA", (mark_w + 12, MARK_HEIGHT + 8), (0, 0, 0, 0))
    sample = canvas.getpixel((MARK_X - 8, MARK_Y + MARK_HEIGHT // 2))
    patch_bg = Image.new("RGBA", patch.size, sample)
    canvas.paste(patch_bg, (MARK_X - 6, MARK_Y - 4), patch)
    canvas.paste(mark, (MARK_X, MARK_Y), mark)
    return canvas


def polish(img: Image.Image) -> Image.Image:
    rgb = img.convert("RGB")
    rgb = ImageEnhance.Sharpness(rgb).enhance(1.08)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.02)
    return rgb.filter(ImageFilter.UnsharpMask(radius=1.2, percent=90, threshold=2))


def main() -> None:
    base = Image.open(MASTER)
    composed = composite_mark(base)
    final = polish(composed)

    final.save(OUT, "PNG", optimize=False)
    final_2x = final.resize((3072, 2048), Image.Resampling.LANCZOS)
    final_2x = polish(final_2x)
    final_2x.save(OUT_2X, "PNG", optimize=False)

    print(f"Wrote {OUT} ({final.size[0]}×{final.size[1]})")
    print(f"Wrote {OUT_2X} ({final_2x.size[0]}×{final_2x.size[1]})")


if __name__ == "__main__":
    main()
