/**
 * Ensure Universal / App Link association files land in `dist/.well-known/`.
 * Vite usually copies `app/public`, but a post-build check keeps deploys honest.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "app", "public", ".well-known");
const DEST = join(ROOT, "dist", ".well-known");

const files = ["apple-app-site-association", "assetlinks.json"];

mkdirSync(DEST, { recursive: true });

for (const name of files) {
  const from = join(SRC, name);
  const to = join(DEST, name);
  if (!existsSync(from)) {
    console.error(`Missing ${from}`);
    process.exit(1);
  }
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log(`✓ ${name} → ${to}`);
}
