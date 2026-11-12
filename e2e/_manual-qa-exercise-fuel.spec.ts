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
      localStorage.setItem("diabeater_onboarding_completed_user_id", "e2e-exercise-qa");
      localStorage.setItem("diabeater_profile", JSON.stringify({ bgUnits: "mmol/L", name: "Jake", dateOfBirth: "1995-01-01" }));
      localStorage.removeItem("diabeater_active_exercise");
      localStorage.setItem("diabeater_settings", JSON.stringify(settings));
    },
    { settings },
  );
  await page.reload();
}

test.describe("Exercise pre-workout fuel plan manual QA", () => {
  test("pick what you're eating, see Eat / Insulin / Carry, carry into the coach", async ({ page }) => {
    page.on("pageerror", (err) => console.log(`[pageerror] ${err.message}\n${err.stack}`));
    await seedPatientSession(page, { snackRatio: "1:10g", lunchRatio: "1:10g", correctionFactor: 3 });
    await page.goto("/scenarios/exercise");
    await expect(page.getByTestId("exercise-guided-coach-start")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("button-prefuel-intent-meal")).toBeVisible();
    await page.getByTestId("input-plan-bg").fill("8");
    await page.screenshot({ path: "test-results/prefuel-1-plan-card.png", fullPage: true });

    // Top-up when in range: nothing to eat, no insulin.
    await page.getByTestId("button-prefuel-intent-top_up").click();
    await expect(page.getByTestId("prefuel-plan-summary")).toBeVisible();
    await expect(page.getByTestId("prefuel-row-eat")).toContainText(/No top-up needed/);
    await expect(page.getByTestId("prefuel-row-insulin")).toContainText("None");
    await page.screenshot({ path: "test-results/prefuel-2-topup-in-range.png", fullPage: true });

    // Top-up when low: carbs, still no insulin.
    await page.getByTestId("input-plan-bg").fill("4.8");
    await expect(page.getByTestId("prefuel-row-eat")).toContainText(/~\d+g/);
    await expect(page.getByTestId("prefuel-row-insulin")).toContainText("None");
    await page.screenshot({ path: "test-results/prefuel-3-topup-low.png", fullPage: true });

    // Meal: reduced bolus.
    await page.getByTestId("input-plan-bg").fill("8");
    await page.getByTestId("button-prefuel-intent-meal").click();
    await page.getByTestId("input-prefuel-meal-carbs").fill("50");
    await expect(page.getByTestId("prefuel-row-insulin")).toContainText(/\d+(\.\d+)?u/);
    await expect(page.getByTestId("prefuel-row-carry")).toBeVisible();
    await page.screenshot({ path: "test-results/prefuel-4-meal.png", fullPage: true });

    // Start the guided session: the Before step shows the same plan without asking again.
    await page.getByTestId("button-start-coach").click();
    await expect(page.getByTestId("coach-preplan-summary")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("input-coach-bg")).toHaveValue("8");
    await page.screenshot({ path: "test-results/prefuel-5-coach-before-step.png", fullPage: true });
  });
});
