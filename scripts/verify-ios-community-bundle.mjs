import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Fail release sync if the iOS bundle was built without community (Feed tab + routes).
 */
const publicAssets = join(process.cwd(), "ios", "App", "App", "public", "assets");
const required = ["community-feed", "isNativePlatform", "bottomnav-community"];

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
      "iOS bundled web JS is missing community / Feed support:",
      ...missing.map((m) => `  - ${m}`),
      "Fix: npm run ios:release:sync (uses web:build:production with VITE_FEATURE_COMMUNITY=true)",
    ].join("\n"),
  );
  process.exit(1);
}

console.log("✓ iOS bundled web JS includes community Feed support");
