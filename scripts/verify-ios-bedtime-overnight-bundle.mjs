import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const publicAssets = join(process.cwd(), "ios", "App", "App", "public", "assets");
const required = ["card-bedtime-last-night", "Last night", "Overnight glucose review"];

if (!existsSync(publicAssets)) {
  console.error(`Missing ${publicAssets} — run cap sync ios first.`);
  process.exit(1);
}

const combined = readdirSync(publicAssets)
  .filter((name) => name.endsWith(".js"))
  .map((name) => readFileSync(join(publicAssets, name), "utf8"))
  .join("\n");

const missing = required.filter((needle) => !combined.includes(needle));
if (missing.length > 0) {
  console.error(
    [
      "iOS bundled web JS is missing bedtime overnight review:",
      ...missing.map((m) => `  - ${m}`),
      "Fix: VITE_FEATURE_COMMUNITY=true VITE_APP_ENV=production npm run ios:release:sync",
    ].join("\n"),
  );
  process.exit(1);
}

console.log("✓ iOS bundled web JS includes bedtime last-night review");
