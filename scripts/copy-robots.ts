/**
 * Copies the correct robots.txt for the build environment.
 * Production: allow indexing. Staging: disallow indexing.
 * Run as postbuild. Reads VITE_APP_ENV from process.env.
 */
import { copyFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const PUBLIC = join(ROOT, "client", "public");
const DIST = join(ROOT, "dist", "public");
const env = (process.env.VITE_APP_ENV ?? "production").trim().toLowerCase();
const isStaging = env === "staging";
const source = join(PUBLIC, isStaging ? "robots.staging.txt" : "robots.prod.txt");
const dest = join(DIST, "robots.txt");

if (!existsSync(source)) {
  console.error(`Missing ${source}`);
  process.exit(1);
}
copyFileSync(source, dest);
console.log(`✓ robots.txt: ${isStaging ? "staging (no-index)" : "production (allow)"}`);
