import { test, expect } from "@playwright/test";

/**
 * Environment tests: staging banner visibility.
 * Run against a deployed or preview build:
 *   - Staging: BASE_URL=<staging-url> STAGING_EXPECTED=1 npm run test:e2e -- e2e/env.spec.ts
 *   - Production: BASE_URL=<prod-url> npm run test:e2e -- e2e/env.spec.ts
 */
const stagingExpected = process.env.STAGING_EXPECTED === "1" || process.env.STAGING_EXPECTED === "true";

test.describe("Environment indicators", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("diabeater_onboarding_completed", "true");
    });
  });

  test("staging banner visibility matches APP_ENV", async ({ page }) => {
    await page.goto("/login");
    const banner = page.getByTestId("staging-banner");
    if (stagingExpected) {
      await expect(banner).toBeVisible();
    } else {
      await expect(banner).not.toBeVisible();
    }
  });
});
