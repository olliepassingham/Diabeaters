import { chromium } from "playwright";
import { copyFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const width = 1200;
const height = 630;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: 1,
});

const html = path.join(dir, "og-share.html");
const outBrandingPng = path.join(dir, "og-share-1200x630.png");
const outBrandingJpg = path.join(dir, "og-share-1200x630.jpg");
const outPublicJpg = path.join(dir, "..", "app", "public", "og-share.jpg");

await page.goto(`file://${html}`);
await page.waitForTimeout(400);
await page.screenshot({ path: outBrandingPng, type: "png" });
await page.screenshot({ path: outBrandingJpg, type: "jpeg", quality: 88 });
copyFileSync(outBrandingJpg, outPublicJpg);
console.log(`Saved ${outBrandingPng}`);
console.log(`Saved ${outBrandingJpg}`);
console.log(`Copied ${outPublicJpg}`);

await browser.close();
