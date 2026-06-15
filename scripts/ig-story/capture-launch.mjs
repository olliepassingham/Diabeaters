import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(dir, "diabeaters-launch.html");
const outPath = path.join(dir, "diabeaters-instagram-launch-1080x1350.png");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
await page.goto(`file://${htmlPath}`);
await page.waitForTimeout(400);
await page.screenshot({ path: outPath });
await browser.close();
console.log(`Saved ${outPath}`);
