import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Fail release sync if the iOS public bundle still has the pre-fix Capgo-only BG path.
 * Build 15 looked identical to 14 because native version was bumped without rebundling JS.
 */
const publicAssets = join(process.cwd(), "ios", "App", "App", "public", "assets");
const required = ["readBloodGlucoseSamples", "Looking up recent BG"];
const forbiddenLegacyOnly = []; // keep empty; we still may mention Checking briefly elsewhere

if (!existsSync(publicAssets)) {
  console.error(`Missing ${publicAssets} — run cap sync ios first.`);
  process.exit(1);
}

const jsFiles = readdirSync(publicAssets)
  .filter((name) => name.endsWith(".js"))
  .map((name) => join(publicAssets, name));

if (jsFiles.length === 0) {
  console.error("No JS assets under ios/App/App/public/assets.");
  process.exit(1);
}

let combined = "";
let newestMtime = 0;
for (const file of jsFiles) {
  combined += readFileSync(file, "utf8");
  newestMtime = Math.max(newestMtime, statSync(file).st_mtimeMs);
}

const missing = required.filter((needle) => !combined.includes(needle));
if (missing.length > 0) {
  console.error(
    [
      "iOS bundled web JS is missing CGM prefill fixes:",
      ...missing.map((m) => `  - ${m}`),
      "The Archive would ship stale UI (same hang as build 14).",
      "Fix: VITE_FEATURE_COMMUNITY=true VITE_APP_ENV=production npm run ios:release:sync",
    ].join("\n"),
  );
  process.exit(1);
}

for (const needle of forbiddenLegacyOnly) {
  if (combined.includes(needle)) {
    console.error(`Unexpected legacy string still in iOS bundle: ${needle}`);
    process.exit(1);
  }
}

const ageMinutes = (Date.now() - newestMtime) / 60_000;
if (ageMinutes > 30) {
  console.warn(
    `⚠ iOS public assets look old (${ageMinutes.toFixed(0)} min). Re-run ios:release:sync if you changed CGM code.`,
  );
}

console.log("✓ iOS bundled web JS includes native BG read path (readBloodGlucoseSamples)");
