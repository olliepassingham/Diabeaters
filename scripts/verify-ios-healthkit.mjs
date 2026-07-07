import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const entitlementsPaths = [
  join(process.cwd(), "ios", "App", "App", "AppDebug.entitlements"),
  join(process.cwd(), "ios", "App", "App", "AppRelease.entitlements"),
];
const configPath = join(process.cwd(), "ios", "App", "App", "capacitor.config.json");
const pbxprojPath = join(process.cwd(), "ios", "App", "App.xcodeproj", "project.pbxproj");

for (const path of entitlementsPaths) {
  if (!existsSync(path)) {
    console.error(`Missing ${path}`);
    process.exit(1);
  }
  const xml = readFileSync(path, "utf8");
  if (!xml.includes("com.apple.developer.healthkit")) {
    console.error(`HealthKit entitlement missing from ${path}`);
    process.exit(1);
  }
}

if (!existsSync(configPath)) {
  console.error(`Missing ${configPath} — run npm run ios:release:sync first.`);
  process.exit(1);
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
const plugins = config.packageClassList ?? [];
if (!plugins.includes("HealthPlugin")) {
  console.error("capacitor.config.json packageClassList must include HealthPlugin for CGM prefill.");
  process.exit(1);
}

if (!existsSync(pbxprojPath)) {
  console.error(`Missing ${pbxprojPath}`);
  process.exit(1);
}
const pbx = readFileSync(pbxprojPath, "utf8");
if (!pbx.includes("com.apple.HealthKit")) {
  console.error("Xcode project must enable the HealthKit capability (com.apple.HealthKit).");
  process.exit(1);
}

console.log("✓ iOS HealthKit config looks ready (entitlements, HealthPlugin, Xcode capability)");
