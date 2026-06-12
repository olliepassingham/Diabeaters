import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const configPath = join(process.cwd(), "ios", "App", "App", "capacitor.config.json");

if (!existsSync(configPath)) {
  console.error(`Missing ${configPath} — run npm run ios:release:sync first.`);
  process.exit(1);
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
if (config.server?.url) {
  console.error(
    [
      "iOS capacitor.config.json is set to a remote server URL:",
      `  ${config.server.url}`,
      "Store / offline builds must bundle dist/ instead.",
      "Run: npm run ios:release:sync",
      "Do not use: npm run ios:release:sync:remote",
    ].join("\n"),
  );
  process.exit(1);
}

console.log("✓ iOS Capacitor config uses bundled webDir (no server.url)");
