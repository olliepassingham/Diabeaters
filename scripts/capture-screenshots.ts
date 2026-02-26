/**
 * Captures App Store screenshots from /_shots.
 * Run: npm run shots:dev (if not running) then npm run shots:capture
 */
import { chromium } from "@playwright/test";
import { mkdirSync, existsSync } from "fs";
import { join } from "path";

const BASE_URL = process.env.SHOTS_BASE_URL ?? "http://localhost:5173";
const OUTPUT_DIR = join(process.cwd(), "screenshots", "en-GB");

const SIZES = [
  { name: "iphone-67", width: 1290, height: 2796 },
  { name: "iphone-65", width: 1242, height: 2688 },
  { name: "iphone-55", width: 1242, height: 2208 },
] as const;

const STATES = ["onboarding", "dashboard", "add-supply", "routines", "settings-about"] as const;

async function main() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: null });

  for (const size of SIZES) {
    for (const state of STATES) {
      const page = await context.newPage();
      await page.setViewportSize({ width: size.width, height: size.height });
      const url = `${BASE_URL}/_shots?state=${state}`;
      await page.goto(url, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      const filename = `${size.name}-${state}.png`;
      const filepath = join(OUTPUT_DIR, filename);
      await page.screenshot({ path: filepath, fullPage: false });
      console.log(`Saved ${filename}`);

      await page.close();
    }
  }

  await browser.close();
  console.log(`Done. Screenshots in ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
