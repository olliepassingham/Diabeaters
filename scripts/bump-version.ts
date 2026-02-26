/**
 * Bumps version in package.json and mirrors to iOS.
 * Run: npm run version:patch | version:minor | version:major
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const PKG_PATH = join(ROOT, "package.json");
const PBXPROJ_PATH = join(ROOT, "ios", "App", "App.xcodeproj", "project.pbxproj");

type Bump = "patch" | "minor" | "major";

function parseVersion(v: string): [number, number, number] {
  const parts = v.replace(/^v/, "").split(".").map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function bump(ver: string, kind: Bump): string {
  const [major, minor, patch] = parseVersion(ver);
  if (kind === "major") return `${major + 1}.0.0`;
  if (kind === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function main() {
  const arg = process.argv[2] as Bump | undefined;
  if (!arg || !["patch", "minor", "major"].includes(arg)) {
    console.error("Usage: tsx scripts/bump-version.ts (patch|minor|major)");
    process.exit(1);
  }

  const pkg = JSON.parse(readFileSync(PKG_PATH, "utf-8"));
  const oldVer = pkg.version;
  const newVer = bump(oldVer, arg);

  pkg.version = newVer;
  writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
  console.log(`package.json: ${oldVer} → ${newVer}`);

  const pbx = readFileSync(PBXPROJ_PATH, "utf-8");
  const buildMatch = pbx.match(/CURRENT_PROJECT_VERSION = (\d+);/);
  const buildNum = buildMatch ? parseInt(buildMatch[1], 10) + 1 : 1;

  const newPbx = pbx
    .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${newVer};`)
    .replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${buildNum};`);

  writeFileSync(PBXPROJ_PATH, newPbx, "utf-8");
  console.log(`iOS: MARKETING_VERSION=${newVer}, CFBundleVersion=${buildNum}`);

  console.log("Done.");
}

main();
