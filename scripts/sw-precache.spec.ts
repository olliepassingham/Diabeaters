import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectPrecacheUrls, patchServiceWorkerPrecacheManifest, PRECACHE_MANIFEST_MARKER } from "./sw-precache";

describe("sw precache", () => {
  it("collects shell, index assets, and all built chunks", () => {
    const dir = mkdtempSync(join(tmpdir(), "sw-precache-"));
    writeFileSync(
      join(dir, "index.html"),
      '<html><link href="/assets/index-abc.css" rel="stylesheet"><script src="/assets/index-abc.js"></script></html>',
    );
    mkdirSync(join(dir, "assets"));
    writeFileSync(join(dir, "assets", "index-abc.js"), "export {}");
    writeFileSync(join(dir, "assets", "dashboard-def.js"), "export {}");
    writeFileSync(join(dir, "icon-192.png"), "png");

    const urls = collectPrecacheUrls(dir);

    expect(urls).toContain("/");
    expect(urls).toContain("/index.html");
    expect(urls).toContain("/assets/index-abc.js");
    expect(urls).toContain("/assets/dashboard-def.js");
    expect(urls).toContain("/icon-192.png");
  });

  it("patches the service worker manifest marker", () => {
    const source = `const PRECACHE_URLS = ${PRECACHE_MANIFEST_MARKER};`;
    const patched = patchServiceWorkerPrecacheManifest(source, ["/", "/index.html"]);
    expect(patched).toBe('const PRECACHE_URLS = ["/","/index.html"];');
  });
});
