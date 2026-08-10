import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const configPath = join(process.cwd(), "android", "app", "src", "main", "assets", "capacitor.config.json");
const EXPECTED = "https://diabeaters.vercel.app";

if (!existsSync(configPath)) {
  console.error(`Missing ${configPath} — run npm run android:release:sync first.`);
  process.exit(1);
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
const url = typeof config.server?.url === "string" ? config.server.url.trim() : "";

if (!url) {
  console.error(
    [
      "Android capacitor.config.json has no server.url — Live WebView updates will not work.",
      "Expected production URL:",
      `  ${EXPECTED}`,
      "Run: npm run android:release:sync:remote",
      "For an offline bundled binary (Play Store archive): npm run android:release:sync:bundled",
    ].join("\n"),
  );
  process.exit(1);
}

if (url !== EXPECTED) {
  console.error(
    [
      "Android capacitor.config.json server.url is not production:",
      `  ${url}`,
      `Expected: ${EXPECTED}`,
      "Do not ship store archives pointed at staging.",
    ].join("\n"),
  );
  process.exit(1);
}

console.log(`✓ Android Capacitor config loads live web from ${EXPECTED}`);
