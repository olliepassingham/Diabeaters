import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const PRECACHE_MANIFEST_MARKER = "__PRECACHE_MANIFEST__";

const ROOT_SHELL_PATHS = ["/", "/index.html", "/manifest.json", "/service-worker.js"] as const;

const OPTIONAL_ROOT_FILES = [
  "icon-192.png",
  "icon-512.png",
  "favicon.ico",
  "robots.txt",
] as const;

const PRECACHE_URLS_LINE = /const PRECACHE_URLS = \[[\s\S]*?\];/;

export function serviceWorkerTemplatePath(repoRoot = process.cwd()): string {
  return join(repoRoot, "app", "public", "service-worker.js");
}

export function serviceWorkerIsPatchable(swSource: string): boolean {
  return swSource.includes(PRECACHE_MANIFEST_MARKER) || PRECACHE_URLS_LINE.test(swSource);
}

/** Collect same-origin URLs to precache after a Vite production build. */
export function collectPrecacheUrls(distDir: string): string[] {
  const urls = new Set<string>(ROOT_SHELL_PATHS);

  const indexPath = join(distDir, "index.html");
  if (existsSync(indexPath)) {
    const indexHtml = readFileSync(indexPath, "utf8");
    for (const match of indexHtml.matchAll(/(?:src|href)="(\/[^"?#]+)"/g)) {
      const path = match[1];
      if (path.startsWith("/assets/")) urls.add(path);
    }
  }

  const assetsDir = join(distDir, "assets");
  if (existsSync(assetsDir)) {
    for (const file of readdirSync(assetsDir)) {
      urls.add(`/assets/${file}`);
    }
  }

  for (const file of OPTIONAL_ROOT_FILES) {
    if (existsSync(join(distDir, file))) urls.add(`/${file}`);
  }

  return [...urls].sort((a, b) => a.localeCompare(b));
}

export function patchServiceWorkerPrecacheManifest(swSource: string, urls: string[]): string {
  const manifest = JSON.stringify(urls);
  if (swSource.includes(PRECACHE_MANIFEST_MARKER)) {
    return swSource.replace(PRECACHE_MANIFEST_MARKER, manifest);
  }
  if (PRECACHE_URLS_LINE.test(swSource)) {
    return swSource.replace(PRECACHE_URLS_LINE, `const PRECACHE_URLS = ${manifest};`);
  }
  throw new Error(`service-worker.js is missing ${PRECACHE_MANIFEST_MARKER}`);
}

function ensureDistServiceWorker(distDir: string, repoRoot = process.cwd()): string {
  const swPath = join(distDir, "service-worker.js");
  const templatePath = serviceWorkerTemplatePath(repoRoot);

  if (!existsSync(templatePath)) {
    throw new Error(`Missing service worker template at ${templatePath}`);
  }

  if (!existsSync(swPath)) {
    copyFileSync(templatePath, swPath);
  }

  let swSource = readFileSync(swPath, "utf8");
  if (!serviceWorkerIsPatchable(swSource)) {
    copyFileSync(templatePath, swPath);
    swSource = readFileSync(swPath, "utf8");
  }

  if (!serviceWorkerIsPatchable(swSource)) {
    throw new Error(`service-worker.js is missing ${PRECACHE_MANIFEST_MARKER}`);
  }

  return swSource;
}

export function generateServiceWorkerPrecache(
  distDir: string,
  repoRoot = process.cwd(),
): { urlCount: number; outputPath: string } {
  const swPath = join(distDir, "service-worker.js");
  const urls = collectPrecacheUrls(distDir);
  const swSource = ensureDistServiceWorker(distDir, repoRoot);
  const patched = patchServiceWorkerPrecacheManifest(swSource, urls);
  writeFileSync(swPath, patched, "utf8");

  return { urlCount: urls.length, outputPath: swPath };
}

export function runGenerateServiceWorkerPrecache(distDir = join(process.cwd(), "dist")): void {
  const { urlCount, outputPath } = generateServiceWorkerPrecache(distDir);
  console.log(`✓ service-worker precache: ${urlCount} URLs → ${outputPath}`);
}

const invokedDirectly = process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/sw-precache.ts");
if (invokedDirectly) {
  runGenerateServiceWorkerPrecache();
}
