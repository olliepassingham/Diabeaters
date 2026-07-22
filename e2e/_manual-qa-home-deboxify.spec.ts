import { test, expect } from "@playwright/test";

async function seedPatientSession(
  page: import("@playwright/test").Page,
  { supplies }: { supplies: Record<string, unknown>[] },
): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      "diabeater_e2e_user",
      JSON.stringify({ id: "e2e-home-qa", email: "home-qa@example.com", email_confirmed_at: new Date().toISOString() }),
    );
    sessionStorage.setItem("diabeater_primary_app_role", "patient");
    sessionStorage.setItem("diabeater_onboarding_account_path_v1", "patient");
  });
  await page.goto("/");
  await page.evaluate(
    ({ supplies }) => {
      localStorage.setItem("diabeater_onboarding_completed", "true");
      localStorage.setItem("diabeater_profile", JSON.stringify({ bgUnits: "mmol/L", name: "Jake" }));
      localStorage.setItem(
        "diabeater_settings",
        JSON.stringify({ snackRatio: "1:10g", lunchRatio: "1:10g", correctionFactor: 3 }),
      );
      localStorage.setItem("diabeater_supplies", JSON.stringify(supplies));
    },
    { supplies },
  );
  await page.reload();
}

test.describe("Home page de-boxify manual QA", () => {
  test("supplies OK — mobile viewport stacks the merged card with a horizontal divider", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedPatientSession(page, {
      supplies: [{ id: "s1", name: "Novorapid", type: "insulin_short", currentQuantity: 900, dailyUsage: 15 }],
    });
    await expect(page.getByTestId("dashboard-today-overview-card")).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: "test-results/home-0-mobile-supplies-ok.png", fullPage: true });
  });

  test("supplies OK — merged today/supply card renders as one surface", async ({ page }) => {
    page.on("pageerror", (err) => console.log(`[pageerror] ${err.message}\n${err.stack}`));
    await seedPatientSession(page, {
      supplies: [
        {
          id: "s1",
          name: "Novorapid",
          type: "insulin_short",
          currentQuantity: 900,
          dailyUsage: 15,
        },
      ],
    });
    await expect(page.getByTestId("dashboard-page")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("dashboard-today-overview-card")).toBeVisible();
    await expect(page.getByTestId("dashboard-supply-tracker-card")).toBeVisible();
    await expect(page.getByTestId("dashboard-today-inline")).toBeVisible();
    await page.screenshot({ path: "test-results/home-1-supplies-ok.png", fullPage: true });
  });

  test("supplies need attention — single combined attention row, no duplicate entry card", async ({ page }) => {
    page.on("pageerror", (err) => console.log(`[pageerror] ${err.message}\n${err.stack}`));
    await seedPatientSession(page, {
      supplies: [
        {
          id: "s1",
          name: "Novorapid",
          type: "insulin_short",
          currentQuantity: 20,
          dailyUsage: 15,
        },
      ],
    });
    await expect(page.getByTestId("dashboard-page")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("dashboard-today-overview-card")).toBeVisible();
    await expect(page.getByTestId("dashboard-supply-tracker-card")).toHaveCount(0);
    await expect(page.getByTestId("dashboard-today-inline")).toBeVisible();
    await page.screenshot({ path: "test-results/home-2-supplies-attention.png", fullPage: true });
  });

  test("widget grid shows a 'Your widgets' section label and no duplicate runway stat", async ({ page }) => {
    await seedPatientSession(page, {
      supplies: [
        {
          id: "s1",
          name: "Novorapid",
          type: "insulin_short",
          currentQuantity: 900,
          dailyUsage: 15,
        },
      ],
    });
    await expect(page.getByTestId("dashboard-widgets")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Your widgets")).toBeVisible();
    await expect(page.getByTestId("widget-supply-summary")).toBeVisible();
    await expect(page.getByTestId("text-min-days")).toHaveCount(0);
    await page.screenshot({ path: "test-results/home-3-widget-grid.png", fullPage: true });
  });
});
