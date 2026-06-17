import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const width = 1584;
const height = 396;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: 1,
});

const html = path.join(dir, "linkedin-cover.html");
const out = path.join(dir, "linkedin-cover-1584x396.png");
await page.goto(`file://${html}`);
await page.waitForTimeout(300);
await page.screenshot({ path: out });
console.log(`Saved ${out}`);

await browser.close();
