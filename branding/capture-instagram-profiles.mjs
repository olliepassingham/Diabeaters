import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const size = 1080;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });

const tealHtml = path.join(dir, "instagram-profile-teal.html");
const tealOut = path.join(dir, "instagram-profile-teal-1080.png");
await page.goto(`file://${tealHtml}`);
await page.waitForTimeout(300);
await page.screenshot({ path: tealOut });
console.log(`Saved ${tealOut}`);

await browser.close();
