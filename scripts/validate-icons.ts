/**
 * Validates App Store icon requirements.
 * Run: npm run icons:validate
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { PNG } from "pngjs";

const ROOT = process.cwd();
const SOURCE_1024 = join(ROOT, "branding", "appstore-icon-1024.png");
const APPCON_SET = join(ROOT, "ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset");
const CONTENTS_JSON = join(APPCON_SET, "Contents.json");

function hasAlpha(buffer: Buffer): boolean {
  const png = PNG.sync.read(buffer);
  // Color type 4 = grayscale+alpha, 6 = RGBA
  if (png.colorType === 4 || png.colorType === 6) return true;
  return false;
}

function getDimensions(buffer: Buffer): { width: number; height: number } {
  const png = PNG.sync.read(buffer);
  return { width: png.width, height: png.height };
}

function main() {
  let failed = false;

  // 1. Check branding/appstore-icon-1024.png
  if (!existsSync(SOURCE_1024)) {
    console.error(`Missing: ${SOURCE_1024}`);
    console.error("  Export a 1024×1024 PNG (no transparency) and place it there.");
    failed = true;
  } else {
    const buf = readFileSync(SOURCE_1024);
    const dims = getDimensions(buf);
    if (dims.width !== 1024 || dims.height !== 1024) {
      console.error(`${SOURCE_1024}: expected 1024×1024, got ${dims.width}×${dims.height}`);
      failed = true;
    }
    if (hasAlpha(buf)) {
      console.error(`${SOURCE_1024}: must have NO alpha channel (transparency). App Store rejects it.`);
      failed = true;
    }
    if (!failed) console.log(`✓ ${SOURCE_1024}: 1024×1024, no alpha`);
  }

  // 2. Check AppIcon.appiconset
  if (!existsSync(CONTENTS_JSON)) {
    console.error(`Missing: ${CONTENTS_JSON}`);
    failed = true;
  } else {
    const contents = JSON.parse(readFileSync(CONTENTS_JSON, "utf-8"));
    const images = contents?.images ?? [];
    for (const img of images) {
      const fn = img.filename;
      if (!fn) continue;
      const path = join(APPCON_SET, fn);
      if (!existsSync(path)) {
        console.error(`Referenced in Contents.json but missing: ${fn}`);
        failed = true;
      }
    }
    if (!failed && images.length > 0) {
      console.log(`✓ AppIcon.appiconset: ${images.length} image(s) present`);
    }
  }

  if (failed) process.exit(1);
  console.log("Icons validation passed.");
}

main();
