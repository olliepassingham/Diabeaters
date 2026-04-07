/**
 * Copies the correct robots.txt into the built SPA output.
 *
 * Production: allow indexing. Staging: disallow indexing.
 * Reads VITE_APP_ENV from process.env.
 */
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const PUBLIC = join(ROOT, "app", "public");
const DIST = join(ROOT, "dist");

const env = String(process.env.VITE_APP_ENV ?? "production")
  .trim()
  .toLowerCase();
const isStaging = env === "staging";

const source = join(PUBLIC, isStaging ? "robots.staging.txt" : "robots.prod.txt");
const dest = join(DIST, "robots.txt");

if (!existsSync(source)) {
  console.error(`Missing ${source}`);
  process.exit(1);
}

copyFileSync(source, dest);
console.log(
  `✓ robots.txt: ${isStaging ? "staging (no-index)" : "production (allow)"} → ${dest}`,
);

