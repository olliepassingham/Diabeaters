import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const configPath = join(process.cwd(), "android", "app", "src", "main", "assets", "capacitor.config.json");

if (!existsSync(configPath)) {
  console.error(`Missing ${configPath} — run npm run android:release:sync:bundled first.`);
  process.exit(1);
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
if (config.server?.url) {
  console.error(
    [
      "Android capacitor.config.json is set to a remote server URL:",
      `  ${config.server.url}`,
      "Bundled / offline builds must omit server.url.",
      "Run: npm run android:release:sync:bundled",
    ].join("\n"),
  );
  process.exit(1);
}

console.log("✓ Android Capacitor config uses bundled webDir (no server.url)");
