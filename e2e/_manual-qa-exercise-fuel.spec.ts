import { test, expect } from "@playwright/test";

async function seedPatientSession(
  page: import("@playwright/test").Page,
  settings: Record<string, unknown>,
): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      "diabeater_e2e_user",
      JSON.stringify({ id: "e2e-exercise-qa", email: "exercise-qa@example.com", email_confirmed_at: new Date().toISOString() }),
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

test.describe("Exercise fuel & insulin manual QA", () => {
  test("redesigned form + result flow", async ({ page }) => {
    page.on("pageerror", (err) => console.log(`[pageerror] ${err.message}\n${err.stack}`));
    await seedPatientSession(page, { snackRatio: "1:10g", lunchRatio: "1:10g", correctionFactor: 3 });
    await page.goto("/scenarios/exercise");
    await expect(page.getByTestId("efc-collapsible-trigger")).toBeVisible({ timeout: 10000 });
    await page.getByTestId("efc-collapsible-trigger").click();
    await expect(page.getByTestId("efc-meal-carbs")).toBeVisible();
    await page.screenshot({ path: "test-results/efc-1-form-open.png", fullPage: true });

    // activity dropdown + intensity pills
    await page.getByTestId("efc-activity").click();
    await page.getByTestId("efc-type-hiit").click();
    await page.getByTestId("efc-intensity-intense").click();
    await page.getByTestId("efc-bg").fill("7");
    await page.screenshot({ path: "test-results/efc-2-pills-selected.png", fullPage: true });

    // extras collapsible
    await page.getByTestId("efc-extras-toggle").click();
    await expect(page.getByTestId("efc-fasted")).toBeVisible();
    await page.screenshot({ path: "test-results/efc-3-extras-open.png", fullPage: true });
    await page.getByTestId("efc-extras-toggle").click();

    await expect(page.getByTestId("efc-calculate")).toBeEnabled();
    await page.getByTestId("efc-calculate").click();
    await expect(page.getByTestId("efc-result")).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: "test-results/efc-4-result-suggested.png", fullPage: true });

    await page.getByTestId("efc-details-toggle").click();
    await page.screenshot({ path: "test-results/efc-5-result-details-open.png", fullPage: true });

    // Now switch to "known carbs" by editing the field directly
    await page.getByTestId("efc-clear").click();
    await page.getByTestId("efc-meal-carbs").fill("50");
    await expect(page.getByTestId("efc-meal-carbs-reset")).toBeVisible();
    await page.screenshot({ path: "test-results/efc-6-form-known-carbs.png", fullPage: true });
    await page.getByTestId("efc-calculate").click();
    await expect(page.getByTestId("efc-result")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("text-efc-dose")).toBeVisible();
    await page.screenshot({ path: "test-results/efc-7-result-known-carbs.png", fullPage: true });
  });

  test("suggested carbs respond to BG without the user touching the field", async ({ page }) => {
    await seedPatientSession(page, { snackRatio: "1:10g", correctionFactor: 3 });
    await page.goto("/scenarios/exercise");
    await page.getByTestId("efc-collapsible-trigger").click();
    await page.getByTestId("efc-activity").click();
    await page.getByTestId("efc-type-cardio").click();
    await page.getByTestId("efc-intensity-moderate").click();

    // In-range BG, not fasted -> engine intentionally suggests 0 extra pre-meal carbs.
    await page.getByTestId("efc-bg").fill("8");
    await page.waitForTimeout(200);
    const inRangeValue = await page.getByTestId("efc-meal-carbs").inputValue();
    console.log("carbs suggested at BG 8 (in-range):", JSON.stringify(inRangeValue));

    // Low BG -> engine should suggest carbs to bring BG up before exercise.
    await page.getByTestId("efc-bg").fill("3.8");
    await page.waitForTimeout(200);
    const lowBgValue = await page.getByTestId("efc-meal-carbs").inputValue();
    console.log("carbs suggested at BG 3.8 (low):", JSON.stringify(lowBgValue));
    await page.screenshot({ path: "test-results/efc-8-suggestion-low-bg.png", fullPage: true });

    // High BG -> engine should suggest 0 (don't add more carbs on top of high BG).
    await page.getByTestId("efc-bg").fill("16");
    await page.waitForTimeout(200);
    const highBgValue = await page.getByTestId("efc-meal-carbs").inputValue();
    console.log("carbs suggested at BG 16 (high):", JSON.stringify(highBgValue));

    // Elevated-but-not-"very high" BG (the reported bug: 13 mmol/L was wrongly
    // suggesting 20g of carbs) -> engine should suggest 0.
    await page.getByTestId("efc-bg").fill("13");
    await page.waitForTimeout(200);
    const elevatedBgValue = await page.getByTestId("efc-meal-carbs").inputValue();
    console.log("carbs suggested at BG 13 (elevated):", JSON.stringify(elevatedBgValue));

    expect(Number(lowBgValue || "0")).toBeGreaterThan(0);
    expect(Number(inRangeValue || "0")).toBe(0);
    expect(Number(highBgValue || "0")).toBe(0);
    expect(Number(elevatedBgValue || "0")).toBe(0);
  });

  test("low-BG top-up is visible in the result and its explanation", async ({ page }) => {
    await seedPatientSession(page, { snackRatio: "1:10g", correctionFactor: 3 });
    await page.goto("/scenarios/exercise");
    await page.getByTestId("efc-collapsible-trigger").click();
    await page.getByTestId("efc-activity").click();
    await page.getByTestId("efc-type-cardio").click();
    await page.getByTestId("efc-intensity-moderate").click();
    await page.getByTestId("efc-bg").fill("4.8");
    await page.waitForTimeout(200);
    await page.screenshot({ path: "test-results/efc-9-low-bg-form.png", fullPage: true });
    await page.getByTestId("efc-calculate").click();
    await expect(page.getByTestId("efc-result")).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: "test-results/efc-10-low-bg-result.png", fullPage: true });
    await page.getByTestId("efc-details-toggle").click();
    await expect(page.getByText(/Added ~\d+g on top of your usual buffer/)).toBeVisible();
    await page.screenshot({ path: "test-results/efc-11-low-bg-result-details.png", fullPage: true });
  });
});
