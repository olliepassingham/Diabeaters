import { test, expect } from "@playwright/test";

/**
 * Seeds an authenticated patient session, then loads once first (so the app assigns
 * `diabeater_active_user_id`) before writing the local profile/settings — writing them
 * up-front trips the app's "legacy unscoped data" account-switch wipe.
 */
async function seedPatientSession(
  page: import("@playwright/test").Page,
  settings: Record<string, unknown>,
): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      "diabeater_e2e_user",
      JSON.stringify({ id: "e2e-meal-qa", email: "meal-qa@example.com", email_confirmed_at: new Date().toISOString() }),
    );
    sessionStorage.setItem("diabeater_primary_app_role", "patient");
    sessionStorage.setItem("diabeater_onboarding_account_path_v1", "patient");
  });
  await page.goto("/");
  await page.evaluate(
    ({ settings }) => {
      localStorage.setItem("diabeater_onboarding_completed", "true");
      localStorage.setItem("diabeater_profile", JSON.stringify({ bgUnits: "mmol/L" }));
      localStorage.setItem("diabeater_settings", JSON.stringify(settings));
    },
    { settings },
  );
  await page.reload();
}

test.describe("Meal & ratios manual QA", () => {
  test("fresh profile (no ratios) shows inline setup instead of a dead end, then recalculates", async ({ page }) => {
    page.on("console", (msg) => console.log(`[console:${msg.type()}] ${msg.text()}`));
    page.on("pageerror", (err) => console.log(`[pageerror] ${err.message}\n${err.stack}`));
    await seedPatientSession(page, {});
    await page.goto("/adviser?tab=meal");
    await expect(page.getByTestId("input-meal-carbs")).toBeVisible({ timeout: 10000 });

    await page.getByTestId("input-meal-carbs").fill("60");
    await expect(page.getByTestId("input-meal-carbs")).toHaveValue("60");
    await expect(page.getByTestId("button-get-meal-advice")).toBeEnabled();
    await page.getByTestId("button-get-meal-advice").click();
    await page.waitForTimeout(300);
    console.log("URL after click:", page.url());

    await expect(page.getByTestId("meal-result-no-ratios")).toBeVisible();
    await page.screenshot({ path: "test-results/qa-1-no-ratios-inline-setup.png", fullPage: true });

    const inputs = page.locator('[data-testid="meal-result-ratios-setup-panel"] input');
    const count = await inputs.count();
    for (let i = 0; i < Math.min(4, count); i++) {
      await inputs.nth(i).fill("10");
    }
    await page.getByRole("button", { name: /save/i }).click();

    await expect(page.getByTestId("text-meal-dose")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("meal-impact-card")).toBeVisible();
    await page.screenshot({ path: "test-results/qa-2-recalculated-after-ratios-saved.png", fullPage: true });
  });

  test("carbs validation toast shows instead of silently doing nothing", async ({ page }) => {
    await seedPatientSession(page, { snackRatio: "1:10g", lunchRatio: "1:10g" });
    await page.goto("/adviser?tab=meal");
    await expect(page.getByTestId("input-meal-carbs")).toBeVisible({ timeout: 10000 });
    await page.getByTestId("input-meal-carbs").fill("0");
    await page.getByTestId("button-get-meal-advice").click();
    await expect(page.getByText("Enter carbs first", { exact: true })).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: "test-results/qa-3-carbs-validation-toast.png", fullPage: true });
  });

  test("ratios-set flow with fat+protein composition surfaces impact chart, tail-risk note and split preview", async ({
    page,
  }) => {
    await seedPatientSession(page, {
      breakfastRatio: "1:10g",
      lunchRatio: "1:10g",
      dinnerRatio: "1:8g",
      snackRatio: "1:12g",
    });
    await page.goto("/adviser?tab=meal");
    await expect(page.getByTestId("input-meal-carbs")).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: "test-results/qa-4-entry-screen-composition-builder.png", fullPage: true });

    await page.getByTestId("input-meal-carbs").fill("80");
    await page.getByTestId("select-meal-time").click();
    await page.getByRole("option", { name: "Dinner" }).click();
    await page.getByTestId("select-meal-carb-type").click();
    await page.getByRole("option", { name: "Starchy" }).click();
    await page.getByTestId("toggle-meal-hasFat").click();
    await page.getByTestId("toggle-meal-hasProtein").click();

    await page.getByTestId("button-get-meal-advice").click();

    await expect(page.getByTestId("text-meal-dose")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("meal-impact-card")).toBeVisible();
    await expect(page.getByTestId("meal-impact-pattern-label")).toHaveText("Slow & extended");
    await expect(page.getByTestId("meal-impact-tail-risk-note")).toBeVisible();
    await expect(page.getByTestId("meal-result-split-preview")).toBeVisible();
    await page.screenshot({ path: "test-results/qa-5-result-with-impact-and-split-preview.png", fullPage: true });

    await page.getByTestId("button-open-split-from-result").click();
    await expect(page.getByTestId("card-split-dose-calculator")).toBeVisible();
    await expect(page.getByTestId("input-split-carbs")).toHaveValue("80");
    await page.screenshot({ path: "test-results/qa-6-split-calculator-prefilled.png", fullPage: true });
  });

  test("ratios strip shows compact always-visible summary", async ({ page }) => {
    await seedPatientSession(page, { breakfastRatio: "1:10g", lunchRatio: "1:10g", dinnerRatio: "1:8g" });
    await page.goto("/adviser?tab=meal");
    await expect(page.getByTestId("meal-ratios-strip")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("meal-ratios-strip-breakfast")).not.toHaveText("Not set");
    await expect(page.getByTestId("meal-ratios-strip-snack")).toHaveText("Not set");
  });
});
