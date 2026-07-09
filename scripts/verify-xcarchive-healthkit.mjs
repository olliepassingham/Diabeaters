#!/usr/bin/env node
/**
 * Verify a signed .xcarchive embeds the HealthKit entitlement before TestFlight upload.
 *
 * Usage:
 *   node scripts/verify-xcarchive-healthkit.mjs /path/to/App.xcarchive
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const archivePath = process.argv[2];
if (!archivePath) {
  console.error("Usage: node scripts/verify-xcarchive-healthkit.mjs /path/to/App.xcarchive");
  process.exit(1);
}

const appPath = join(archivePath, "Products", "Applications", "App.app");
if (!existsSync(appPath)) {
  console.error(`App bundle not found at ${appPath}`);
  process.exit(1);
}

const result = spawnSync("codesign", ["-d", "--entitlements", ":-", appPath], {
  encoding: "utf8",
});
if (result.status !== 0) {
  console.error(result.stderr || "codesign failed");
  process.exit(1);
}

const entitlements = result.stdout;
if (!entitlements.includes("com.apple.developer.healthkit")) {
  console.error("✗ HealthKit entitlement is MISSING from the signed archive.");
  console.error("  Fix: Xcode → App target → Signing & Capabilities → add HealthKit.");
  console.error("  Then enable HealthKit on App ID com.passingtime.diabeaters and archive again.");
  process.exit(1);
}

const infoPlist = join(appPath, "Info.plist");
if (existsSync(infoPlist)) {
  const plist = readFileSync(infoPlist, "utf8");
  if (!plist.includes("NSHealthShareUsageDescription")) {
    console.error("✗ NSHealthShareUsageDescription missing from archived Info.plist");
    process.exit(1);
  }
}

console.log("✓ Archive includes HealthKit entitlement and usage description");
