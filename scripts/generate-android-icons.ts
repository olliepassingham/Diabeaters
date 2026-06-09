/**
 * Generate Android launcher mipmaps from branding/appstore-icon-1024.png.
 * Run: npm run icons:android
 */
import { existsSync } from "fs";
import { join } from "path";
import sharp from "sharp";

const ROOT = process.cwd();
const SOURCE = join(ROOT, "branding", "appstore-icon-1024.png");
const ANDROID_RES = join(ROOT, "android", "app", "src", "main", "res");

/** Launcher + adaptive-icon foreground sizes per density bucket. */
const DENSITIES = [
  { folder: "mipmap-mdpi", launcher: 48, adaptive: 108 },
  { folder: "mipmap-hdpi", launcher: 72, adaptive: 162 },
  { folder: "mipmap-xhdpi", launcher: 96, adaptive: 216 },
  { folder: "mipmap-xxhdpi", launcher: 144, adaptive: 324 },
  { folder: "mipmap-xxxhdpi", launcher: 192, adaptive: 432 },
] as const;

async function writeSquarePng(source: string, size: number, dest: string) {
  await sharp(source)
    .resize(size, size, { fit: "cover", position: "centre" })
    .png()
    .toFile(dest);
}

async function main() {
  if (!existsSync(SOURCE)) {
    console.error(`Missing source icon: ${SOURCE}`);
    process.exit(1);
  }

  const meta = await sharp(SOURCE).metadata();
  if (meta.width !== 1024 || meta.height !== 1024) {
    console.error(`Expected 1024×1024 source, got ${meta.width}×${meta.height}`);
    process.exit(1);
  }

  for (const { folder, launcher, adaptive } of DENSITIES) {
    const dir = join(ANDROID_RES, folder);
    const targets = [
      ["ic_launcher.png", launcher],
      ["ic_launcher_round.png", launcher],
      ["ic_launcher_foreground.png", adaptive],
    ] as const;

    for (const [name, size] of targets) {
      const dest = join(dir, name);
      await writeSquarePng(SOURCE, size, dest);
      console.log(`✓ ${join(folder, name)} (${size}×${size})`);
    }
  }

  console.log("Android launcher icons generated from branding/appstore-icon-1024.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
