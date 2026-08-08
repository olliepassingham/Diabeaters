#!/usr/bin/env node
/**
 * Capacitor iOS only auto-registers plugins listed in capacitor.config.json
 * `packageClassList`. Local in-app plugins (not npm packages) must be appended
 * after `npx cap sync`, which rewrites that file from npm deps only.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const configPath = join(process.cwd(), "ios", "App", "App", "capacitor.config.json");

/** @type {string[]} */
const LOCAL_IOS_PLUGINS = [
  "AppIconBadgePlugin",
  "NotificationSettingsPlugin",
  "HealthAuthorizationPlugin",
  "OsSurfacesPlugin",
];

if (!existsSync(configPath)) {
  console.error(`Missing ${configPath} — run npx cap sync ios first.`);
  process.exit(1);
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
const list = Array.isArray(config.packageClassList) ? [...config.packageClassList] : [];
let added = 0;
for (const name of LOCAL_IOS_PLUGINS) {
  if (!list.includes(name)) {
    list.push(name);
    added += 1;
  }
}
config.packageClassList = list;
writeFileSync(configPath, `${JSON.stringify(config, null, "\t")}\n`);
console.log(
  added > 0
    ? `✓ Added ${added} local iOS plugin(s) to packageClassList (${LOCAL_IOS_PLUGINS.join(", ")})`
    : `✓ Local iOS plugins already in packageClassList (${LOCAL_IOS_PLUGINS.join(", ")})`,
);
